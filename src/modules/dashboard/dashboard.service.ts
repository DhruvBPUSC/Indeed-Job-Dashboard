import type { ApplicationStatus, InterviewType } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { countByCard, type DashboardCounts } from './buckets.js';

const RECENT_LIMIT = 5;
const UPCOMING_LIMIT = 3;

export interface RecentApplication {
  id: string;
  jobTitle: string;
  company: string;
  dateApplied: Date;
  status: ApplicationStatus;
}

export interface UpcomingInterview {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  type: InterviewType;
  jobTitle: string;
  company: string;
}

export interface DashboardSummary {
  greetingName: string;
  counts: DashboardCounts;
  recentApplications: RecentApplication[];
  upcomingInterviews: UpcomingInterview[];
}

/** "Cayden Willey" -> "Cayden". */
function firstName(name: string): string {
  return name.trim().replace(/\s.*$/s, '');
}

export async function getSummary(userId: string, now = new Date()): Promise<DashboardSummary> {
  // One transaction so all four parts reflect the same moment.
  const [user, statusCounts, recent, upcoming] = await prisma.$transaction([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),

    // A single query for every card: count per status, then map statuses to cards in buckets.ts.
    prisma.application.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    }),

    prisma.application.findMany({
      where: { userId, dateApplied: { not: null } },
      orderBy: [{ dateApplied: 'desc' }, { id: 'asc' }],
      take: RECENT_LIMIT,
      select: {
        id: true,
        status: true,
        dateApplied: true,
        job: { select: { title: true, company: true } },
      },
    }),

    prisma.interview.findMany({
      where: { application: { userId }, scheduledAt: { gte: now } },
      orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
      take: UPCOMING_LIMIT,
      select: {
        id: true,
        applicationId: true,
        scheduledAt: true,
        type: true,
        application: { select: { job: { select: { title: true, company: true } } } },
      },
    }),
  ]);

  // A valid token for an account that no longer exists: treat as signed out.
  if (!user) throw AppError.unauthorized('Session is invalid or has expired');

  const perStatus: Partial<Record<ApplicationStatus, number>> = {};
  for (const row of statusCounts) perStatus[row.status] = row._count._all;

  return {
    greetingName: firstName(user.name),
    counts: countByCard(perStatus),
    recentApplications: recent.map((a) => ({
      id: a.id,
      jobTitle: a.job.title,
      company: a.job.company,
      // Never null: the query filters on dateApplied: { not: null }.
      dateApplied: a.dateApplied as Date,
      status: a.status,
    })),
    upcomingInterviews: upcoming.map((i) => ({
      id: i.id,
      applicationId: i.applicationId,
      scheduledAt: i.scheduledAt,
      type: i.type,
      jobTitle: i.application.job.title,
      company: i.application.job.company,
    })),
  };
}
