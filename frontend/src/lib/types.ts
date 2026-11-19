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
