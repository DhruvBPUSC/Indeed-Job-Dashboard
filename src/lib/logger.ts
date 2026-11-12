import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { pino, stdSerializers, type Logger } from 'pino';
import { pinoHttp, type HttpLogger } from 'pino-http';

import { env } from '../config/env.js';

/**
 * Logs an error without leaking secrets. Prisma error messages (and stacks) embed the
 * arguments of the failed query, e.g. `passwordHash: "..."`, so for Prisma errors only the
 * type and code are kept.
 *
 * Accepts a raw Error or one pino has already serialized ({ type, message, stack, ... }):
 * pino-http wraps custom serializers and passes the latter.
 */
export function serializeError(err: unknown): object {
  const serialized: unknown = err instanceof Error ? stdSerializers.err(err) : err;
  if (typeof serialized === 'object' && serialized !== null && 'type' in serialized) {
    const { type, code } = serialized as { type: unknown; code?: unknown };
    if (typeof type === 'string' && type.startsWith('PrismaClient')) {
      return { type, ...(typeof code === 'string' && { code }) };
    }
    return serialized;
  }
  return { value: String(err) };
}

// Second line of defense: these never appear in logs even if something logs them by mistake.
// (The request/response serializers below already leave headers and bodies out entirely.)
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'token',
  '*.password',
  '*.passwordHash',
  '*.token',
  'body',
  '*.body',
];

export function createLogger(destination?: pino.DestinationStream): Logger {
  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    serializers: { err: serializeError },
  };
  if (destination) return pino(options, destination);
  if (env.NODE_ENV === 'development') {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    });
  }
  return pino(options);
}

export const logger = createLogger();

const QUIET_PATHS = ['/api/health', '/api/docs'];

/**
 * One line per request. Logs an allowlist of fields only: no headers (so no cookies or
 * Authorization), no bodies (so no passwords), and no response headers (so no Set-Cookie).
 */
export function createHttpLogger(base: Logger = logger): HttpLogger {
  return pinoHttp({
    logger: base,
    genReqId: (_req: IncomingMessage, res: ServerResponse) => {
      const id = randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: {
      ignore: (req) => QUIET_PATHS.some((p) => (req.url ?? '').startsWith(p)),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps: (req) => {
      const userId = (req as IncomingMessage & { user?: { id: string } }).user?.id;
      return userId ? { userId } : {};
    },
    serializers: {
      req: (req: {
        id: unknown;
        method: string;
        url: string;
        headers: Record<string, unknown>;
        raw: { ip?: string };
      }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        // Express's req.ip honors TRUST_PROXY, so behind a proxy it's the client, not the proxy.
        ip: req.raw.ip,
        userAgent: req.headers['user-agent'],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      err: serializeError,
    },
  });
}
