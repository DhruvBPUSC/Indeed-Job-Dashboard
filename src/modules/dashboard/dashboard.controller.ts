import type { Request, Response } from 'express';

import { currentUserId } from '../../middleware/require-auth.js';
import * as dashboardService from './dashboard.service.js';

export async function getSummary(req: Request, res: Response): Promise<void> {
  res.json(await dashboardService.getSummary(currentUserId(req)));
}
