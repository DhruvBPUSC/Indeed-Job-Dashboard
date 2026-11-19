// Mirrors the backend contract in docs/openapi.yaml. Dates arrive as ISO 8601 strings (UTC).

export type ApplicationStatus =
  'SAVED' | 'APPLIED' | 'IN_PROGRESS' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN';

export type InterviewType = 'PHONE' | 'VIRTUAL' | 'ONSITE';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardCounts {
  total: number;
  inProgress: number;
  interview: number;
  offer: number;
}

export interface RecentApplication {
  id: string;
  jobTitle: string;
  company: string;
  dateApplied: string;
  status: ApplicationStatus;
}

export interface UpcomingInterview {
  id: string;
  applicationId: string;
  scheduledAt: string;
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

export type JobType = 'INTERNSHIP' | 'PART_TIME' | 'FULL_TIME_ENTRY';

export interface ListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** An item from GET /api/applications. */
export interface ApplicationListItem {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  dateApplied: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: { id: string; title: string; company: string; location: string; jobType: JobType };
  nextInterview: { id: string; scheduledAt: string; type: InterviewType } | null;
}

/** GET /api/applications/stats/by-status. `total` includes SAVED. */
export interface StatusCounts {
  counts: Record<ApplicationStatus, number>;
  total: number;
}

export interface JobFields {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  description: string;
  url: string;
  postedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  scheduledAt: string;
  type: InterviewType;
  notes: string | null;
}

/** GET /api/applications/:id. History is newest first; interviews soonest first. */
export interface ApplicationDetail {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  dateApplied: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: JobFields;
  statusHistory: StatusHistoryEntry[];
  interviews: Interview[];
}
