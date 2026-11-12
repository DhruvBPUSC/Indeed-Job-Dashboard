import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, type ErrorBody } from '../lib/errors.js';

function body(code: string, message: string, details?: unknown): ErrorBody {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

/** Catch-all for unmatched routes. Mount after all routers. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number'
  );
}

/** Central error handler. Mount last. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(body('VALIDATION_ERROR', 'Request validation failed', err.issues));
    return;
  }

  // express.json() errors: malformed JSON, body over the size limit, bad encoding, etc.
  if (isBodyParserError(err) && err.status >= 400 && err.status < 500) {
    if (err.type === 'entity.too.large') {
      res.status(413).json(body('PAYLOAD_TOO_LARGE', 'Request body is too large'));
      return;
    }
    const message =
      err.type === 'entity.parse.failed' ? 'Malformed JSON body' : 'Invalid request body';
    res.status(err.status).json(body('BAD_REQUEST', message));
    return;
  }

  // req.log is the request-scoped logger from pino-http (tagged with the request id). Its err
  // serializer strips Prisma messages, which can contain query arguments such as passwordHash.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong'));
};
