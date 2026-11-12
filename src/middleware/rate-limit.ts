import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

/** Per-IP limiter for /api/auth/*. Created per app so each app instance has its own counters. */
export function createAuthRateLimit(limit = env.AUTH_RATE_LIMIT_MAX): RequestHandler {
  return rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
    },
  });
}
