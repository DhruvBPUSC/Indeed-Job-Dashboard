import { ApplicationStatus } from '../../generated/prisma/enums.js';

/**
 * Which application statuses count toward each dashboard card.
 *
 * This is the one place to change what the cards mean. A status may appear in several cards
 * (every tracked status is also in Total). A status left out of a card doesn't count toward it.
 */
export const DASHBOARD_BUCKETS = {
  /** Every tracked application. SAVED is excluded: saved jobs aren't applications yet. */
  total: [
    ApplicationStatus.APPLIED,
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFER,
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
  ],
  /**
   * Waiting to hear back. APPLIED is included: from the student's side, an application they've
   * sent is in progress. Remove APPLIED here to count only applications that have moved past it.
   */
  inProgress: [ApplicationStatus.APPLIED, ApplicationStatus.IN_PROGRESS],
  interview: [ApplicationStatus.INTERVIEW],
  offer: [ApplicationStatus.OFFER],
} as const satisfies Record<string, readonly ApplicationStatus[]>;

export type DashboardCard = keyof typeof DASHBOARD_BUCKETS;
export type DashboardCounts = Record<DashboardCard, number>;

/** Turns per-status counts (e.g. from a groupBy) into card counts. */
export function countByCard(
  perStatus: Partial<Record<ApplicationStatus, number>>,
): DashboardCounts {
  const sum = (statuses: readonly ApplicationStatus[]): number =>
    statuses.reduce((acc, s) => acc + (perStatus[s] ?? 0), 0);

  return {
    total: sum(DASHBOARD_BUCKETS.total),
    inProgress: sum(DASHBOARD_BUCKETS.inProgress),
    interview: sum(DASHBOARD_BUCKETS.interview),
    offer: sum(DASHBOARD_BUCKETS.offer),
  };
}
