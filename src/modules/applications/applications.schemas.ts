import { z } from 'zod';

import { ApplicationStatus, InterviewType } from '../../generated/prisma/enums.js';
import { paginationQuery } from '../../lib/pagination.js';

const status = z.enum(ApplicationStatus);

/** Notes: trimmed; blank becomes null. */
const notes = z
  .string()
  .trim()
  .max(5000)
  .transform((v) => (v === '' ? null : v));

/** ISO 8601 with Z or an offset (e.g. 2026-11-02T14:00:00Z), converted to a Date (stored in UTC). */
const isoDateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

/** "a,b" or ["a", "b,c"] -> ["a", "b", "c"]. Non-strings pass through for Zod to reject. */
function splitList(value: unknown): unknown {
  if (value === undefined) return undefined;
  const items: unknown[] = Array.isArray(value) ? value : [value];
  return items
    .flatMap((s): unknown[] => (typeof s === 'string' ? s.split(',') : [s]))
    .map((s) => (typeof s === 'string' ? s.trim() : s))
    .filter((s) => s !== '');
}

const requireSomeField = (v: object): boolean => Object.keys(v).length > 0;
const someFieldMessage = { message: 'Provide at least one field to update' };

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export const SORT_FIELDS = ['dateApplied', 'updatedAt', 'company'] as const;

/** Search over job title and company. Blank means no search. */
const searchQ = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const listApplicationsQuerySchema = z.strictObject({
  /** Repeatable (?status=APPLIED&status=INTERVIEW) or comma-separated (?status=APPLIED,INTERVIEW). */
  status: z.preprocess(splitList, z.array(status)).optional(),
  q: searchQ,
  sort: z.enum(SORT_FIELDS).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...paginationQuery,
});

/** Same search as the list, so tab counts match what the list shows. */
export const statsByStatusQuerySchema = z.strictObject({
  q: searchQ,
});

export const applicationIdParamsSchema = z.strictObject({
  id: z.uuid('Invalid application id'),
});

export const createApplicationSchema = z.strictObject({
  jobId: z.uuid('Invalid job id'),
  status: status.default('SAVED'),
  notes: notes.optional(),
});

export const updateApplicationSchema = z
  .strictObject({
    status: status.optional(),
    // null clears the notes.
    notes: notes.nullable().optional(),
  })
  .refine(requireSomeField, someFieldMessage);

// ---------------------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------------------

export const interviewParamsSchema = z.strictObject({
  id: z.uuid('Invalid application id'),
  interviewId: z.uuid('Invalid interview id'),
});

export const createInterviewSchema = z.strictObject({
  scheduledAt: isoDateTime,
  type: z.enum(InterviewType),
  notes: notes.optional(),
});

export const updateInterviewSchema = z
  .strictObject({
    scheduledAt: isoDateTime.optional(),
    type: z.enum(InterviewType).optional(),
    notes: notes.nullable().optional(),
  })
  .refine(requireSomeField, someFieldMessage);

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
export type StatsByStatusQuery = z.infer<typeof statsByStatusQuerySchema>;
export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type InterviewParams = z.infer<typeof interviewParamsSchema>;
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
