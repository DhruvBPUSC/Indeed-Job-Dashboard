import type { Request, Response } from 'express';

import { currentUserId } from '../../middleware/require-auth.js';
import type {
  ApplicationIdParams,
  CreateApplicationInput,
  CreateInterviewInput,
  InterviewParams,
  ListApplicationsQuery,
  StatsByStatusQuery,
  UpdateApplicationInput,
  UpdateInterviewInput,
} from './applications.schemas.js';
import * as applicationsService from './applications.service.js';
import * as interviewsService from './interviews.service.js';

// validate() has already replaced req.body/params/query with parsed values.

export async function listApplications(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListApplicationsQuery;
  res.json(await applicationsService.listApplications(currentUserId(req), query));
}

export async function statsByStatus(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as StatsByStatusQuery;
  res.json(await applicationsService.countByStatus(currentUserId(req), query));
}

export async function getApplication(req: Request, res: Response): Promise<void> {
  const { id } = req.params as ApplicationIdParams;
  const application = await applicationsService.getApplication(currentUserId(req), id);
  res.json({ application });
}

export async function createApplication(req: Request, res: Response): Promise<void> {
  const application = await applicationsService.createApplication(
    currentUserId(req),
    req.body as CreateApplicationInput,
  );
  res.status(201).json({ application });
}

export async function updateApplication(req: Request, res: Response): Promise<void> {
  const { id } = req.params as ApplicationIdParams;
  const application = await applicationsService.updateApplication(
    currentUserId(req),
    id,
    req.body as UpdateApplicationInput,
  );
  res.json({ application });
}

export async function deleteApplication(req: Request, res: Response): Promise<void> {
  const { id } = req.params as ApplicationIdParams;
  await applicationsService.deleteApplication(currentUserId(req), id);
  res.status(204).end();
}

export async function createInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params as ApplicationIdParams;
  const interview = await interviewsService.createInterview(
    currentUserId(req),
    id,
    req.body as CreateInterviewInput,
  );
  res.status(201).json({ interview });
}

export async function updateInterview(req: Request, res: Response): Promise<void> {
  const { id, interviewId } = req.params as InterviewParams;
  const interview = await interviewsService.updateInterview(
    currentUserId(req),
    id,
    interviewId,
    req.body as UpdateInterviewInput,
  );
  res.json({ interview });
}

export async function deleteInterview(req: Request, res: Response): Promise<void> {
  const { id, interviewId } = req.params as InterviewParams;
  await interviewsService.deleteInterview(currentUserId(req), id, interviewId);
  res.status(204).end();
}
