import { Prisma } from '../../generated/prisma/client.js';
import { ApplicationStatus } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake, type ListResponse } from '../../lib/pagination.js';
import { prisma } from '../../lib/prisma.js';
import { escapeLike } from '../../lib/search.js';
import { jobFieldsSelect } from '../jobs/jobs.service.js';
import type {
  CreateApplicationInput,
  ListApplicationsQuery,
  StatsByStatusQuery,
  UpdateApplicationInput,
} from './applications.schemas.js';

// Every query in this file is scoped by userId. Another user's application is reported as
// 404, never 403, so ids can't be probed.

const applicationFields = {
  id: true,
  jobId: true,
  status: true,
  dateApplied: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ApplicationSelect;

const nextInterviewSelect = {
  id: true,
  scheduledAt: true,
  type: true,
} satisfies Prisma.InterviewSelect;

function listItemSelect(now: Date) {
  return {
    ...applicationFields,
    job: { select: { id: true, title: true, company: true, location: true, jobType: true } },
    // Only the soonest upcoming interview, for the list's "next step" column.
    interviews: {
      where: { scheduledAt: { gte: now } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: 1,
      select: nextInterviewSelect,
    },
  } satisfies Prisma.ApplicationSelect;
}

export const interviewSelect = {
  id: true,
  applicationId: true,
  scheduledAt: true,
  type: true,
  notes: true,
} satisfies Prisma.InterviewSelect;

const detailSelect = {
  ...applicationFields,
  job: { select: jobFieldsSelect },
  statusHistory: {
    select: { id: true, fromStatus: true, toStatus: true, changedAt: true },
    orderBy: { changedAt: 'desc' },
  },
  interviews: { select: interviewSelect, orderBy: { scheduledAt: 'asc' } },
} satisfies Prisma.ApplicationSelect;

type ListItemRow = Prisma.ApplicationGetPayload<{ select: ReturnType<typeof listItemSelect> }>;
export type ApplicationListItem = Omit<ListItemRow, 'interviews'> & {
  /** The soonest interview scheduled from now on, or null if none. */
  nextInterview: Prisma.InterviewGetPayload<{ select: typeof nextInterviewSelect }> | null;
};
export type ApplicationDetail = Prisma.ApplicationGetPayload<{ select: typeof detailSelect }>;

const notFound = (): AppError => AppError.notFound('Application not found');

function orderByFor({
  sort,
  order,
}: ListApplicationsQuery): Prisma.ApplicationOrderByWithRelationInput[] {
  const primary: Prisma.ApplicationOrderByWithRelationInput =
    sort === 'company'
      ? { job: { company: order } }
      : sort === 'dateApplied'
        ? // SAVED applications have no dateApplied; keep them at the end either way.
          { dateApplied: { sort: order, nulls: 'last' } }
        : { updatedAt: order };
  // id breaks ties so pages never overlap or skip rows.
  return [primary, { id: 'asc' }];
}

/** The user's applications, optionally filtered by status and a title/company search. */
function userApplicationsWhere(
  userId: string,
  { status, q }: { status?: ApplicationStatus[] | undefined; q?: string | undefined },
): Prisma.ApplicationWhereInput {
  return {
    userId,
    ...(status?.length && { status: { in: status } }),
    ...(q && {
      job: {
        OR: [
          { title: { contains: escapeLike(q), mode: 'insensitive' } },
          { company: { contains: escapeLike(q), mode: 'insensitive' } },
        ],
      },
    }),
  };
}

export async function listApplications(
  userId: string,
  query: ListApplicationsQuery,
  now = new Date(),
): Promise<ListResponse<ApplicationListItem>> {
  const { status, q, page, pageSize } = query;
  const [total, rows] = await prisma.$transaction([
    prisma.application.count({ where: userApplicationsWhere(userId, { status, q }) }),
    prisma.application.findMany({
      where: userApplicationsWhere(userId, { status, q }),
      select: listItemSelect(now),
      orderBy: orderByFor(query),
      ...toSkipTake(query),
    }),
  ]);

  const data = rows.map(({ interviews, ...rest }) => ({
    ...rest,
    nextInterview: interviews[0] ?? null,
  }));
  return { data, page, pageSize, total };
}

export interface StatusCounts {
  /** Every status, including those with no applications (0). */
  counts: Record<ApplicationStatus, number>;
  /** All applications, SAVED included (the "All" tab). */
  total: number;
}

/** Per-status counts for the My Applications tabs, from a single groupBy. */
export async function countByStatus(
  userId: string,
  query: StatsByStatusQuery,
): Promise<StatusCounts> {
  const rows = await prisma.application.groupBy({
    by: ['status'],
    where: userApplicationsWhere(userId, { q: query.q }),
    _count: { _all: true },
  });

  const counts = Object.fromEntries(Object.values(ApplicationStatus).map((s) => [s, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const row of rows) counts[row.status] = row._count._all;
  return { counts, total: rows.reduce((sum, r) => sum + r._count._all, 0) };
}

export async function getApplication(userId: string, id: string): Promise<ApplicationDetail> {
  const application = await prisma.application.findFirst({
    where: { id, userId },
    select: detailSelect,
  });
  if (!application) throw notFound();
  return application;
}

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
): Promise<ApplicationDetail> {
  const job = await prisma.job.findUnique({ where: { id: input.jobId }, select: { id: true } });
  if (!job) throw AppError.notFound('Job not found');

  const now = new Date();
  try {
    // Nested writes run in one transaction: the application and its first history row.
    return await prisma.application.create({
      data: {
        userId,
        jobId: input.jobId,
        status: input.status,
        notes: input.notes ?? null,
        dateApplied: input.status === 'SAVED' ? null : now,
        // One timestamp for creation, dateApplied, and the first history row.
        createdAt: now,
        updatedAt: now,
        statusHistory: { create: { fromStatus: null, toStatus: input.status, changedAt: now } },
      },
      select: detailSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.application.findUnique({
        where: { userId_jobId: { userId, jobId: input.jobId } },
        select: { id: true },
      });
      throw new AppError(
        409,
        'APPLICATION_EXISTS',
        'You already have an application for this job',
        {
          applicationId: existing?.id,
        },
      );
    }
    throw err;
  }
}

export async function updateApplication(
  userId: string,
  id: string,
  input: UpdateApplicationInput,
): Promise<ApplicationDetail> {
  return prisma.$transaction(async (tx) => {
    // Lock the row so concurrent status changes are serialized and each history row's
    // fromStatus is the status that was actually current.
    const locked = await tx.$queryRaw<{ status: string }[]>`
      SELECT "status" FROM "Application"
      WHERE "id" = ${id}::uuid AND "userId" = ${userId}::uuid
      FOR UPDATE`;
    if (locked.length === 0) throw notFound();

    const current = await tx.application.findFirstOrThrow({
      where: { id, userId },
      select: { status: true, dateApplied: true },
    });

    const data: Prisma.ApplicationUpdateInput = {};
    if (input.notes !== undefined) data.notes = input.notes;

    if (input.status !== undefined && input.status !== current.status) {
      const now = new Date();
      data.status = input.status;
      // Set once, the first time the application leaves SAVED; later changes never move it.
      if (current.dateApplied === null && input.status !== 'SAVED') data.dateApplied = now;
      data.statusHistory = {
        create: { fromStatus: current.status, toStatus: input.status, changedAt: now },
      };
    }

    return tx.application.update({ where: { id, userId }, data, select: detailSelect });
  });
}

export async function deleteApplication(userId: string, id: string): Promise<void> {
  // Cascades to StatusHistory and Interview.
  const { count } = await prisma.application.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound();
}
