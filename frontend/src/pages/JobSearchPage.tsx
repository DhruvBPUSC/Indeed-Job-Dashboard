import { ChevronLeft, ChevronRight, SearchX, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';

import { focusRing, secondaryButton } from '../components/applicationDetail/styles';
import { ApplicationsListSkeleton } from '../components/applications/ApplicationsList';
import { JobCard } from '../components/jobSearch/JobCard';
import { JobAnnouncementBar } from '../components/jobSearch/JobActions';
import { JOBS_PAGE_SIZE, useJobs } from '../components/jobSearch/queries';
import { useJobActions } from '../components/jobSearch/useJobActions';
import { ErrorState } from '../components/ui/ErrorState';
import { JOB_TYPE_LABELS } from '../lib/labels';
import type { JobType } from '../lib/types';

const JOB_TYPES = Object.keys(JOB_TYPE_LABELS) as JobType[];

/** /jobs?q=&type=&page= — the top bar's search box sets q; this page adds filters and results. */
export function JobSearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const rawType = params.get('type');
  const jobType = JOB_TYPES.find((t) => t === rawType) ?? null;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const jobs = useJobs({ q, jobType, page });
  const { announcement, pendingJobId, onSave, onUnsave, onApply } = useJobActions();

  const total = jobs.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / JOBS_PAGE_SIZE));
  const href = (next: { type?: JobType | null; page?: number; q?: string }) => {
    const out = new URLSearchParams();
    const nq = next.q ?? q;
    const nt = next.type === undefined ? jobType : next.type;
    const np = next.page ?? 1;
    if (nq) out.set('q', nq);
    if (nt) out.set('type', nt);
    if (np > 1) out.set('page', String(np));
    const s = out.toString();
    return { search: s ? `?${s}` : '' };
  };

  // New page of results: start at the top (filters and links don't change the pathname).
  useEffect(() => window.scrollTo(0, 0), [page]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {q ? `Jobs matching “${q}”` : 'Find jobs'}
        </h1>
        <p className="mt-1 text-slate-600">
          {q ? (
            <Link
              to={href({ q: '' })}
              className={`inline-flex items-center gap-1 rounded font-semibold text-blue-800 hover:underline ${focusRing}`}
            >
              <X aria-hidden="true" className="size-4" />
              Clear search
            </Link>
          ) : (
            'Search by job title or company using the search bar above, or browse the newest listings.'
          )}
        </p>
      </header>

      {/* Job type filter: links so each filter has its own URL. */}
      <nav aria-label="Filter by job type">
        <ul className="flex flex-wrap gap-2">
          {[null, ...JOB_TYPES].map((t) => {
            const active = t === jobType;
            return (
              <li key={t ?? 'all'}>
                <Link
                  to={href({ type: t })}
                  aria-current={active ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150 ${focusRing} ${
                    active
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {t ? JOB_TYPE_LABELS[t] : 'All job types'}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <JobAnnouncementBar announcement={announcement} />

      {jobs.isPending ? (
        <div role="status" aria-label="Loading jobs">
          <ApplicationsListSkeleton />
        </div>
      ) : jobs.isError ? (
        <ErrorState
          message={`We couldn't load jobs. ${jobs.error.message}`}
          onRetry={() => void jobs.refetch()}
        />
      ) : jobs.data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <SearchX aria-hidden="true" className="size-8 text-slate-400" />
          <p className="font-semibold text-slate-900">No jobs found</p>
          <p className="text-sm text-slate-600">
            Try a different job title or company{jobType ? ', or remove the job type filter' : ''}.
          </p>
          {(q || jobType) && (
            <Link to={{ search: '' }} className={`${secondaryButton} mt-2`}>
              Show all jobs
            </Link>
          )}
        </div>
      ) : (
        <section aria-label="Results" className="flex flex-col gap-4">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">{total}</span> job{total === 1 ? '' : 's'}
            {jobType ? ` · ${JOB_TYPE_LABELS[jobType]}` : ''} · newest first
          </p>
          <ul className={`flex flex-col gap-4 ${jobs.isPlaceholderData ? 'opacity-60' : ''}`}>
            {jobs.data.data.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                busy={pendingJobId === job.id}
                onSave={() => onSave(job)}
                onUnsave={() => onUnsave(job)}
                onApply={() => onApply(job)}
              />
            ))}
          </ul>
          {lastPage > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-700">
                Page {page} of {lastPage}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link to={href({ page: page - 1 })} className={secondaryButton}>
                    <ChevronLeft aria-hidden="true" className="size-4" />
                    Previous
                  </Link>
                )}
                {page < lastPage && (
                  <Link to={href({ page: page + 1 })} className={secondaryButton}>
                    Next
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Link>
                )}
              </div>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
