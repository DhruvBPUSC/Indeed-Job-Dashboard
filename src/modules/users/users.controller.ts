import type { Request, Response } from 'express';

import { currentUserId } from '../../middleware/require-auth.js';
import type { UpdateMeInput } from './users.schemas.js';
import * as usersService from './users.service.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.getUserById(currentUserId(req));
  res.json({ user });
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateUser(currentUserId(req), req.body as UpdateMeInput);
  res.json({ user });
}
