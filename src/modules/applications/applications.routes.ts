import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import * as c from './applications.controller.js';
import {
  applicationIdParamsSchema as idParams,
  createApplicationSchema,
  createInterviewSchema,
  interviewParamsSchema as interviewParams,
  listApplicationsQuerySchema,
  statsByStatusQuerySchema,
  updateApplicationSchema,
  updateInterviewSchema,
} from './applications.schemas.js';

// Mounted at /api/applications.
export const applicationsRouter = Router();

applicationsRouter.use(requireAuth);

applicationsRouter.get('/', validate({ query: listApplicationsQuerySchema }), c.listApplications);
applicationsRouter.post('/', validate({ body: createApplicationSchema }), c.createApplication);
applicationsRouter.get(
  '/stats/by-status',
  validate({ query: statsByStatusQuerySchema }),
  c.statsByStatus,
);
applicationsRouter.get('/:id', validate({ params: idParams }), c.getApplication);
applicationsRouter.patch(
  '/:id',
  validate({ params: idParams, body: updateApplicationSchema }),
  c.updateApplication,
);
applicationsRouter.delete('/:id', validate({ params: idParams }), c.deleteApplication);

applicationsRouter.post(
  '/:id/interviews',
  validate({ params: idParams, body: createInterviewSchema }),
  c.createInterview,
);
applicationsRouter.patch(
  '/:id/interviews/:interviewId',
  validate({ params: interviewParams, body: updateInterviewSchema }),
  c.updateInterview,
);
applicationsRouter.delete(
  '/:id/interviews/:interviewId',
  validate({ params: interviewParams }),
  c.deleteInterview,
);
