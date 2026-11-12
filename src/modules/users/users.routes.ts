import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth.js';
import { validate } from '../../middleware/validate.js';
import * as usersController from './users.controller.js';
import { updateMeSchema } from './users.schemas.js';

// Mounted at /api/me.
export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get('/', validate(), usersController.getMe);
usersRouter.patch('/', validate({ body: updateMeSchema }), usersController.updateMe);
