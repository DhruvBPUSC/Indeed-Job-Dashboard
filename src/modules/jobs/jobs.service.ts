import type { Prisma } from '../../generated/prisma/client.js';
import type { ApplicationStatus } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake, type ListResponse } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { escapeLike } from '../../lib/search.js';
import type { ListJobsQuery } from './jobs.schemas.js';

/** All public job fields. */
export const jobFieldsSelect = {
  id: true,
  title: true,
  company: true,
  location: true,
  jobType: true,
  description: true,
  url: true,
  postedAt: true,
} satisfies Prisma.JobSelect;

/** Job fields plus the current user's application for it, if any. */
function jobSelect(userId: string) {
  return {
    ...jobFieldsSelect,
    // Scoped to the current user; the (userId, jobId) unique means at most one row.
    applications: { where: { userId }, select: { id: true, status: true }, take: 1 },
  } satisfies Prisma.JobSelect;
}

type JobRow = Prisma.JobGetPayload<{ select: ReturnType<typeof jobSelect> }>;

export type JobWithApplication = Omit<JobRow, 'applications'> & {
  applicationId: string | null;
  applicationStatus: ApplicationStatus | null;
};

function toJobWithApplication({ applications, ...job }: JobRow): JobWithApplication {
  const application = applications[0];
  return {
    ...job,
    applicationId: application?.id ?? null,
    applicationStatus: application?.status ?? null,
  };
}

export async function listJobs(
  userId: string,
  query: ListJobsQuery,
): Promise<ListResponse<JobWithApplication>> {
  const { q, jobType, page, pageSize } = query;

  const where: Prisma.JobWhereInput = {
    ...(jobType && { jobType }),
    ...(q && {
      OR: [
        { title: { contains: escapeLike(q), mode: 'insensitive' } },
        { company: { contains: escapeLike(q), mode: 'insensitive' } },
      ],
    }),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: jobSelect(userId),
      // id breaks ties so pages never overlap or skip rows.
      orderBy: [{ postedAt: 'desc' }, { id: 'asc' }],
      ...toSkipTake(query),
    }),
  ]);

  return { data: rows.map(toJobWithApplication), page, pageSize, total };
}

export async function getJob(userId: string, jobId: string): Promise<JobWithApplication> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: jobSelect(userId) });
  if (!job) throw AppError.notFound('Job not found');
  return toJobWithApplication(job);
}
