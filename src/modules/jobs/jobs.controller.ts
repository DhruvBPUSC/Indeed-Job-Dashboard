import type { Request, Response } from 'express';

import { currentUserId } from '../../middleware/require-auth.js';
import type { JobIdParams, ListJobsQuery } from './jobs.schemas.js';
import * as jobsService from './jobs.service.js';

export async function listJobs(req: Request, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed value.
  const query = req.query as unknown as ListJobsQuery;
  const result = await jobsService.listJobs(currentUserId(req), query);
  res.json(result);
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const { id } = req.params as JobIdParams;
  const job = await jobsService.getJob(currentUserId(req), id);
  res.json({ job });
}
