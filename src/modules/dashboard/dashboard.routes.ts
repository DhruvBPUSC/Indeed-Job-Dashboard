import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import * as dashboardController from './dashboard.controller.js';

// Mounted at /api/dashboard.
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get('/summary', validate(), dashboardController.getSummary);
