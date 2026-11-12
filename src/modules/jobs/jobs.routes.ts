import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import * as jobsController from './jobs.controller.js';
import { jobIdParamsSchema, listJobsQuerySchema } from './jobs.schemas.js';

// Mounted at /api/jobs.
export const jobsRouter = Router();

jobsRouter.use(requireAuth);

jobsRouter.get('/', validate({ query: listJobsQuerySchema }), jobsController.listJobs);
jobsRouter.get('/:id', validate({ params: jobIdParamsSchema }), jobsController.getJob);
