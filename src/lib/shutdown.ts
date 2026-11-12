import type { Server, ServerResponse } from 'node:http';

import type { Logger } from 'pino';

export interface ShutdownOptions {
  logger: Logger;
  /** Max time to wait for in-flight requests before forcing connections closed. */
  timeoutMs: number;
  /** Cleanup after the server stops, e.g. closing the database pool. */
  onClose?: () => Promise<void>;
  /** Injected so tests can observe it instead of ending the test process. */
  exit?: (code: number) => void;
}

/**
 * Returns shutdown(reason, exitCode). Stops accepting connections, lets in-flight requests
 * finish (keep-alive clients are told to reconnect), runs onClose, then exits. If requests
 * are still running after timeoutMs, their connections are closed and the exit code is 1.
 * Calling it again while shutting down (e.g. a second Ctrl+C) exits immediately.
 */
export function createShutdown(
  server: Server,
  { logger, timeoutMs, onClose, exit = (code) => process.exit(code) }: ShutdownOptions,
): (reason: string, exitCode?: number) => Promise<void> {
  let shuttingDown = false;
  const inFlight = new Set<ServerResponse>();

  // Keep-alive sockets would otherwise sit idle after their last response and hold
  // server.close() open until Node's keep-alive timeout. So during shutdown every response
  // says Connection: close, and idle sockets are closed as each response finishes.
  const releaseSocket = (res: ServerResponse): void => {
    if (!res.headersSent) res.setHeader('Connection', 'close');
  };
  server.on('request', (_req, res) => {
    inFlight.add(res);
    if (shuttingDown) releaseSocket(res);
    res.on('close', () => {
      inFlight.delete(res);
      if (shuttingDown) server.closeIdleConnections();
    });
  });

  return async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) {
      logger.warn({ reason }, 'Forced exit during shutdown');
      exit(1);
      return;
    }
    shuttingDown = true;
    for (const res of inFlight) releaseSocket(res);
    logger.info({ reason, timeoutMs }, 'Shutting down: waiting for in-flight requests');

    // An object, not a let, so TypeScript sees the timer callback can change it.
    const state = { timedOut: false };
    const timer = setTimeout(() => {
      state.timedOut = true;
      logger.warn('Shutdown timeout reached; closing remaining connections');
      server.closeAllConnections();
    }, timeoutMs);
    timer.unref();

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
      server.closeIdleConnections();
    });
    clearTimeout(timer);

    try {
      await onClose?.();
    } catch (err) {
      logger.error({ err }, 'Error during shutdown cleanup');
      exitCode = 1;
    }

    const code = state.timedOut ? 1 : exitCode;
    logger.info({ exitCode: code }, 'Shutdown complete');
    logger.flush();
    exit(code);
  };
}
