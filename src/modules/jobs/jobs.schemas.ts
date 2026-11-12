import { z } from 'zod';

import { JobType } from '../../generated/prisma/enums.js';
import { paginationQuery } from '../../lib/pagination.js';

export const listJobsQuerySchema = z.strictObject({
  // A blank ?q= means "no search" rather than a validation error.
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  jobType: z.enum(JobType).optional(),
  ...paginationQuery,
});

export const jobIdParamsSchema = z.strictObject({
  id: z.uuid('Invalid job id'),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;
