import type { InterviewType, JobType } from './types';

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  INTERNSHIP: 'Internship',
  PART_TIME: 'Part-time',
  FULL_TIME_ENTRY: 'Full-time · Entry level',
};

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE: 'Phone',
  VIRTUAL: 'Virtual',
  ONSITE: 'Onsite',
};
