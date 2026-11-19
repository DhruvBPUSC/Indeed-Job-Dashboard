import { useQuery } from '@tanstack/react-query';

import { useCurrentUser } from '../auth/auth';
import {
  RecentApplications,
  RecentApplicationsSkeleton,
} from '../components/dashboard/RecentApplications';
import { StatCards, StatCardsSkeleton } from '../components/dashboard/StatCards';
import { ErrorState } from '../components/ui/ErrorState';
import { get } from '../lib/api';
import { greeting } from '../lib/format';
import type { DashboardSummary } from '../lib/types';

export function DashboardPage() {
  const { data: user } = useCurrentUser();
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => get<DashboardSummary>('/dashboard/summary'),
  });

  // Greet with the cached user while the summary loads, so the heading never jumps.
  const name = summary.data?.greetingName ?? user?.name.split(' ')[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="mt-1 text-slate-600">Here&apos;s a quick look at your job search progress.</p>
      </header>

      {summary.isPending ? (
        <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-8">
          <StatCardsSkeleton />
          <RecentApplicationsSkeleton />
        </div>
      ) : summary.isError ? (
        <ErrorState
          message={`We couldn't load your dashboard. ${summary.error.message}`}
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <>
          <section aria-label="Application summary">
            <StatCards counts={summary.data.counts} />
          </section>
          <RecentApplications applications={summary.data.recentApplications} />
        </>
      )}
    </div>
  );
}
