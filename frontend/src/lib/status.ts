import type { ApplicationStatus } from './types';

/** Label + colors for each status. The text label carries the meaning; color is a second cue. */
export const STATUS_STYLES: Record<ApplicationStatus, { label: string; className: string }> = {
  SAVED: { label: 'Saved', className: 'bg-slate-100 text-slate-700 ring-slate-300' },
  APPLIED: { label: 'Applied', className: 'bg-slate-100 text-slate-800 ring-slate-300' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-blue-50 text-blue-800 ring-blue-200' },
  INTERVIEW: { label: 'Interview', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  OFFER: { label: 'Offer', className: 'bg-green-50 text-green-800 ring-green-200' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-800 ring-red-200' },
  WITHDRAWN: { label: 'Withdrawn', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
};
