import type { CookieOptions, Response } from 'express';

import { env } from '../config/env.js';

export const AUTH_COOKIE = 'token';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE,
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setAuthCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(AUTH_COOKIE, token, { ...baseOptions(), expires: expiresAt });
}

/** Must use the same options as setAuthCookie, or the browser won't clear it. */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, baseOptions());
}
