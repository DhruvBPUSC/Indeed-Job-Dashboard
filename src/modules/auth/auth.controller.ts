import type { Request, Response } from 'express';

import { clearAuthCookie, setAuthCookie } from '../../lib/auth-cookie.js';
import { signAuthToken } from '../../lib/jwt.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import * as authService from './auth.service.js';

async function startSession(res: Response, userId: string): Promise<void> {
  const { token, expiresAt } = await signAuthToken(userId);
  setAuthCookie(res, token, expiresAt);
}

export async function register(req: Request, res: Response): Promise<void> {
  const user = await authService.register(req.body as RegisterInput);
  await startSession(res, user.id);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response): Promise<void> {
  const user = await authService.login(req.body as LoginInput);
  await startSession(res, user.id);
  res.json({ user });
}

export function logout(_req: Request, res: Response): void {
  clearAuthCookie(res);
  res.status(204).end();
}
