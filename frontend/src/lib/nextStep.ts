import { daysSince, formatDateTime } from './format';
import { INTERVIEW_TYPE_LABELS } from './labels';
import type { ApplicationListItem } from './types';

/** After this many days without news, suggest a follow-up. A design choice; tune after testing. */
export const FOLLOW_UP_AFTER_DAYS = 14;

export type NextStepTone = 'event' | 'action' | 'waiting' | 'closed';

export interface NextStep {
  label: string;
  detail?: string;
  tone: NextStepTone;
}

/** What the student should expect or do next for an application, for the "Next step" column. */
export function nextStep(
  app: Pick<ApplicationListItem, 'status' | 'dateApplied' | 'nextInterview'>,
  now = new Date(),
): NextStep {
  if (app.nextInterview) {
    return {
      label: `${INTERVIEW_TYPE_LABELS[app.nextInterview.type]} interview`,
      detail: formatDateTime(app.nextInterview.scheduledAt),
      tone: 'event',
    };
  }
  switch (app.status) {
    case 'OFFER':
      return { label: 'Respond to offer', tone: 'action' };
    case 'INTERVIEW':
      return { label: 'No interview scheduled', tone: 'waiting' };
    case 'APPLIED':
    case 'IN_PROGRESS': {
      const days = app.dateApplied ? daysSince(app.dateApplied, now) : 0;
      return days >= FOLLOW_UP_AFTER_DAYS
        ? { label: 'Consider following up', detail: `No update in ${days} days`, tone: 'action' }
        : { label: 'Waiting to hear back', tone: 'waiting' };
    }
    case 'SAVED':
      return { label: 'Not applied yet', tone: 'waiting' };
    case 'REJECTED':
    case 'WITHDRAWN':
      return { label: 'Closed', tone: 'closed' };
  }
}
