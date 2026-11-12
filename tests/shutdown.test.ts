import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShutdown } from '../src/lib/shutdown.js';

const silent = pino({ level: 'silent' });

/** A server with /fast and /slow?ms=N routes, listening on a random port. */
async function startServer(): Promise<{ server: Server; port: number }> {
  const app = express();
  app.get('/fast', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/slow', (req, res) => {
    setTimeout(() => {
      res.json({ ok: true });
    }, Number(req.query.ms));
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

/** GET with a keep-alive agent; resolves with status + headers, or rejects on connection error. */
function get(
  port: number,
  path: string,
): Promise<{ status: number; connection: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ port, path, headers: { connection: 'keep-alive' } }, (res) => {
      res.resume();
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, connection: res.headers.connection });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

let server: Server | undefined;
afterEach(() => {
  server?.closeAllConnections();
  server?.close();
  server = undefined;
});

describe('graceful shutdown', () => {
  it('lets in-flight requests finish, refuses new connections, then cleans up and exits 0', async () => {
    const started = await startServer();
    server = started.server;
    const events: string[] = [];
    const exit = vi.fn((code: number) => events.push(`exit ${code}`));
    const shutdown = createShutdown(server, {
      logger: silent,
      timeoutMs: 5_000,
      onClose: async () => {
        events.push('onClose');
        await Promise.resolve();
      },
      exit,
    });

    const inFlight = get(started.port, '/slow?ms=300');
    await new Promise((r) => setTimeout(r, 50)); // request is now being handled
    const done = shutdown('SIGTERM');

    await expect(get(started.port, '/fast')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    const res = await inFlight;
    expect(res.status).toBe(200);
    expect(res.connection).toBe('close'); // keep-alive client told to reconnect
    await done;

    expect(events).toEqual(['onClose', 'exit 0']);
  });

  it('forces connections closed and exits 1 when requests outlast the timeout', async () => {
    const started = await startServer();
    server = started.server;
    const onClose = vi.fn(() => Promise.resolve());
    const exit = vi.fn();
    const shutdown = createShutdown(server, { logger: silent, timeoutMs: 100, onClose, exit });

    const stuck = get(started.port, '/slow?ms=10000').catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 50));
    const t0 = Date.now();
    await shutdown('SIGTERM');

    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(await stuck).toMatchObject({ code: 'ECONNRESET' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 immediately on a second signal', async () => {
    const started = await startServer();
    server = started.server;
    const exit = vi.fn();
    const shutdown = createShutdown(server, { logger: silent, timeoutMs: 5_000, exit });

    const stuck = get(started.port, '/slow?ms=1000').catch(() => undefined);
    await new Promise((r) => setTimeout(r, 50));
    const first = shutdown('SIGINT');
    await shutdown('SIGINT');

    expect(exit).toHaveBeenCalledWith(1);
    await stuck;
    await first;
  });

  it('exits with the given code (e.g. after a crash) and 1 if cleanup fails', async () => {
    const a = await startServer();
    const exitA = vi.fn();
    await createShutdown(a.server, { logger: silent, timeoutMs: 1_000, exit: exitA })(
      'uncaughtException',
      1,
    );
    expect(exitA).toHaveBeenCalledWith(1);

    const b = await startServer();
    const exitB = vi.fn();
    await createShutdown(b.server, {
      logger: silent,
      timeoutMs: 1_000,
      onClose: () => Promise.reject(new Error('pool already closed')),
      exit: exitB,
    })('SIGTERM');
    expect(exitB).toHaveBeenCalledWith(1);
  });
});
