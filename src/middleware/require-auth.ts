import type { Request, RequestHandler } from 'express';

import { AUTH_COOKIE } from '../lib/auth-cookie.js';
import { AppError } from '../lib/errors.js';
import { verifyAuthToken } from '../lib/jwt.js';

/** Rejects with 401 unless the request carries a valid auth cookie; sets req.user.id. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[AUTH_COOKIE];
  if (typeof token !== 'string' || token === '') {
    throw AppError.unauthorized();
  }

  const userId = await verifyAuthToken(token);
  if (!userId) {
    throw AppError.unauthorized('Session is invalid or has expired');
  }

  req.user = { id: userId };
  next();
};

/** The authenticated user's id. Only call from handlers mounted behind requireAuth. */
export function currentUserId(req: Request): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}
