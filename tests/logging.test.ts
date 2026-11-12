import { Writable } from 'node:stream';

import express from 'express';
import type { pino } from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createHttpLogger, createLogger } from '../src/lib/logger.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { prisma, resetDb } from './helpers/db.js';

const PASSWORD = 'Sup3r-Secret-Passw0rd!';

/** A logger that keeps every line it writes, at the most verbose level. */
function captureLogs(): {
  logger: pino.Logger;
  lines: () => Record<string, unknown>[];
  raw: () => string;
} {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const logger = createLogger(stream);
  logger.level = 'trace';
  return {
    logger,
    raw: () => chunks.join(''),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('request logging', () => {
  it('logs one line per request with method, url, status, request id, and user id', async () => {
    const logs = captureLogs();
    const agent = request.agent(createApp({ logger: logs.logger }));
    await agent
      .post('/api/auth/register')
      .send({ name: 'Log Test', email: 'log@example.com', password: PASSWORD })
      .expect(201);

    const res = await agent.get('/api/me').set('User-Agent', 'vitest').expect(200);

    const meLine = logs
      .lines()
      .find((l) => (l.req as { url?: string } | undefined)?.url === '/api/me');
    expect(meLine).toMatchObject({
      level: 30, // info
      msg: 'request completed',
      req: { method: 'GET', url: '/api/me', id: res.headers['x-request-id'] },
      res: { statusCode: 200 },
      userId: (res.body as { user: { id: string } }).user.id,
    });
    expect(Object.keys(meLine?.req ?? {}).sort()).toEqual(
      ['id', 'ip', 'method', 'url', 'userAgent'].sort(),
    );
    expect(Object.keys(meLine?.res ?? {})).toEqual(['statusCode']);
  });

  it('never logs passwords, cookies, tokens, or password hashes', async () => {
    const logs = captureLogs();
    const agent = request.agent(createApp({ logger: logs.logger }));

    const registered = await agent
      .post('/api/auth/register')
      .set('Authorization', 'Bearer should-not-be-logged')
      .send({ name: 'Log Test', email: 'log@example.com', password: PASSWORD })
      .expect(201);
    const cookie = (registered.headers['set-cookie'] as string[] | undefined)?.[0] ?? '';
    const token = cookie.split(';')[0]?.split('=')[1] ?? '';
    expect(token.length).toBeGreaterThan(20);

    await agent.post('/api/auth/login').send({ email: 'log@example.com', password: PASSWORD });
    await agent
      .post('/api/auth/login')
      .send({ email: 'log@example.com', password: `${PASSWORD}-wrong` });
    await agent.get('/api/me');
    await agent.patch('/api/me').send({ name: 'Renamed', password: PASSWORD }); // 400, still not logged
    await agent.post('/api/auth/logout');

    const { passwordHash } = await prisma.user.findUniqueOrThrow({
      where: { email: 'log@example.com' },
      select: { passwordHash: true },
    });
    const raw = logs.raw();
    expect(logs.lines().length).toBeGreaterThanOrEqual(6);
    expect(raw).not.toContain(PASSWORD);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(passwordHash);
    expect(raw).not.toContain('should-not-be-logged');
    expect(raw).not.toMatch(/set-cookie/i);
    expect(raw).not.toMatch(/"cookie"/i);
    expect(raw).not.toMatch(/\$argon2/);
  });

  it('logs 4xx as warn and 5xx as error', async () => {
    const logs = captureLogs();
    await request(createApp({ logger: logs.logger }))
      .get('/api/me')
      .expect(401);

    expect(logs.lines().at(-1)).toMatchObject({ level: 40, res: { statusCode: 401 } });
  });

  it('skips health checks and docs', async () => {
    const logs = captureLogs();
    await request(createApp({ logger: logs.logger }))
      .get('/api/health')
      .expect(200);

    expect(logs.lines()).toEqual([]);
  });
});

describe('error logging', () => {
  it('logs unhandled Prisma errors by type and code only, never their message', async () => {
    // A real Prisma validation error: its message embeds the query arguments, secret included.
    const secret = 'SECRET-HASH-THAT-MUST-NOT-BE-LOGGED';
    const prismaError = await prisma.user
      .create({
        data: { email: 'x@example.com', passwordHash: secret, name: 123 as unknown as string },
      })
      .catch((e: unknown) => e);
    expect((prismaError as Error).message).toContain(secret); // the danger is real

    const logs = captureLogs();
    const mini = express();
    mini.use(createHttpLogger(logs.logger));
    mini.get('/boom', () => {
      throw prismaError;
    });
    mini.use(errorHandler);

    const res = await request(mini).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(res.text).not.toContain(secret);
    const errorLine = logs.lines().find((l) => l.msg === 'Unhandled error');
    expect(errorLine).toMatchObject({ level: 50, err: { type: 'PrismaClientValidationError' } });
    expect(logs.raw()).not.toContain(secret);
  });

  it('logs other unhandled errors with message and stack', async () => {
    const logs = captureLogs();
    const mini = express();
    mini.use(createHttpLogger(logs.logger));
    mini.get('/boom', () => {
      throw new Error('disk on fire');
    });
    mini.use(errorHandler);

    await request(mini).get('/boom').expect(500);

    const errorLine = logs.lines().find((l) => l.msg === 'Unhandled error');
    expect(errorLine).toMatchObject({ err: { type: 'Error', message: 'disk on fire' } });
    expect((errorLine?.err as { stack?: string }).stack).toContain('disk on fire');
  });
});
