import type { Request, RequestHandler } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ownOrigin(req: Request): string {
  return `${req.protocol}://${req.get('host') ?? ''}`;
}

/**
 * CSRF protection that doesn't depend on SameSite: a state-changing request that carries an
 * Origin header must come from FRONTEND_URL or the API's own origin (e.g. Swagger UI).
 * Browsers always send Origin on cross-origin POST/PATCH/DELETE, so a forged form or fetch
 * from another site is rejected even when the cookie is SameSite=None.
 * Requests without Origin (curl, server-to-server) carry no browser cookies by accident and
 * are left to normal auth.
 */
export function createOriginGuard(origins: readonly string[] = env.FRONTEND_URL): RequestHandler {
  const allowed = new Set(origins);
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.has(req.method) || origin === undefined) {
      next();
      return;
    }
    if (allowed.has(origin) || origin === ownOrigin(req)) {
      next();
      return;
    }
    next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Requests from this origin are not allowed'));
  };
}
