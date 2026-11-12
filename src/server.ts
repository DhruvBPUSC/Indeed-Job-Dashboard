import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { createShutdown } from './lib/shutdown.js';

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, frontend: env.FRONTEND_URL },
    `API listening on http://localhost:${env.PORT}`,
  );
});

const shutdown = createShutdown(server, {
  logger,
  timeoutMs: env.SHUTDOWN_TIMEOUT_MS,
  onClose: () => prisma.$disconnect(),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

// A crash still drains in-flight requests and closes the pool, but exits non-zero.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});
