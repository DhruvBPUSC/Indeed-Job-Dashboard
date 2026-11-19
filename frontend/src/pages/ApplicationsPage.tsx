import { ChevronLeft, ChevronRight, FileText, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  ApplicationCards,
  ApplicationsListSkeleton,
  ApplicationsTable,
} from '../components/applications/ApplicationsList';
import {
  PAGE_SIZE,
  useApplicationsList,
  useStatusCounts,
  useUpdateStatus,
  type ListParams,
} from '../components/applications/queries';
import { ErrorState } from '../components/ui/ErrorState';
import { STATUS_STYLES } from '../lib/status';
import type { ApplicationListItem, ApplicationStatus } from '../lib/types';

/** Saved jobs have their own page, so "All" here means everything you've actually applied to. */
const APPLIED_STATUSES: ApplicationStatus[] = [
  'APPLIED',
  'IN_PROGRESS',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
];

const SORTS = {
  updated: { label: 'Recently updated', sort: 'updatedAt', order: 'desc' },
  'applied-new': { label: 'Date applied (newest)', sort: 'dateApplied', order: 'desc' },
  'applied-old': { label: 'Date applied (oldest)', sort: 'dateApplied', order: 'asc' },
  company: { label: 'Company (A–Z)', sort: 'company', order: 'asc' },
} as const satisfies Record<
  string,
  { label: string; sort: ListParams['sort']; order: 'asc' | 'desc' }
>;
type SortParam = keyof typeof SORTS;

const SEARCH_DELAY_MS = 300;

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

/** Reads the view from the URL so back/forward, refresh, and shared links all restore it. */
function useListState() {
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get('status');
  const status = APPLIED_STATUSES.find((s) => s === rawStatus) ?? null;
  const rawSort = params.get('sort');
  const sort: SortParam = rawSort && rawSort in SORTS ? (rawSort as SortParam) : 'updated';
  const q = params.get('q')?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  /** Changing any filter returns to page 1. Defaults are left out to keep URLs short. */
  const update = useCallback(
    (
      next: Partial<{ status: ApplicationStatus | null; sort: SortParam; q: string; page: number }>,
      replace = false,
    ) => {
      const merged = { status, sort, q, page: 1, ...next };
      const out = new URLSearchParams();
      if (merged.status) out.set('status', merged.status);
      if (merged.q) out.set('q', merged.q);
      if (merged.sort !== 'updated') out.set('sort', merged.sort);
      if (merged.page > 1) out.set('page', String(merged.page));
      if (out.toString() !== params.toString()) setParams(out, { replace });
    },
    [status, sort, q, params, setParams],
  );

  return { status, sort, q, page, update };
}

export function ApplicationsPage() {
  const { status, sort, q, page, update } = useListState();
  const listParams: ListParams = {
    statuses: status ? [status] : APPLIED_STATUSES,
    q,
    sort: SORTS[sort].sort,
    order: SORTS[sort].order,
    page,
  };
  const list = useApplicationsList(listParams);
  const stats = useStatusCounts(q);
  const updateStatus = useUpdateStatus();
  const [announcement, setAnnouncement] = useState<{ text: string; error: boolean } | null>(null);

  // Search box: type freely; the URL (and the query) updates after a short pause.
  const [searchInput, setSearchInput] = useState(q);
  const [searchInputFor, setSearchInputFor] = useState(q);
  if (q !== searchInputFor) {
    // The URL changed from elsewhere (back/forward, a tab link): show its search.
    setSearchInputFor(q);
    if (searchInput.trim() !== q) setSearchInput(q);
  }
  const latestUpdate = useRef(update);
  useEffect(() => {
    latestUpdate.current = update;
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearchChange = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => latestUpdate.current({ q: value.trim() }, true),
      SEARCH_DELAY_MS,
    );
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // A status change can empty the current page (e.g. the last row on page 2): go to the last page.
  const lastPage = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));
  const pageOutOfRange = !!list.data && list.data.data.length === 0 && list.data.total > 0;
  useEffect(() => {
    if (pageOutOfRange) update({ page: lastPage }, true);
  }, [pageOutOfRange, lastPage, update]);

  // Hide the confirmation after a few seconds.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = (text: string, error = false) => {
    clearTimeout(timer.current);
    setAnnouncement({ text, error });
    timer.current = setTimeout(() => setAnnouncement(null), 5000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const onStatusChange = (app: ApplicationListItem, next: ApplicationStatus) => {
    updateStatus.mutate(
      { id: app.id, status: next, jobTitle: app.job.title },
      {
        onSuccess: () => {
          const where =
            next === 'SAVED'
              ? ' It moved to Saved Jobs.'
              : status && status !== next
                ? ` It moved to the ${STATUS_STYLES[next].label} tab.`
                : '';
          announce(
            `${app.job.title} at ${app.job.company} is now ${STATUS_STYLES[next].label}.${where}`,
          );
        },
        onError: (err) => announce(`Couldn't update ${app.job.title}: ${err.message}`, true),
      },
    );
  };

  const counts = stats.data?.counts;
  const tabCount = (s: ApplicationStatus | null): number | undefined =>
    counts && (s ? counts[s] : APPLIED_STATUSES.reduce((sum, k) => sum + counts[k], 0));

  const total = list.data?.total ?? 0;
  const pageCount = lastPage;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My Applications</h1>
        <p className="mt-1 text-slate-600">
          Everything you&apos;ve applied to, where it stands, and what&apos;s next.
        </p>
      </header>

      {/* Toolbar: search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <label htmlFor="app-search" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Search your applications
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-3 size-5 text-slate-500"
          />
          <input
            id="app-search"
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Job title or company"
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-10 text-sm text-slate-900 transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
          />
        </div>
        <div className="sm:w-56">
          <label htmlFor="app-sort" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Sort by
          </label>
          <select
            id="app-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value as SortParam })}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status tabs (links, so each view has its own URL) */}
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-slate-200">
          {[null, ...APPLIED_STATUSES].map((s) => {
            const active = s === status;
            const count = tabCount(s);
            return (
              <li key={s ?? 'all'}>
                <Link
                  to={{ search: tabSearch(s, q, sort) }}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${focusRing} ${
                    active
                      ? 'border-blue-700 font-semibold text-blue-800'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {s ? STATUS_STYLES[s].label : 'All'}
                  {count !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        active ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Status-change confirmation, read out by screen readers. */}
      <div role="status" aria-live="polite">
        {announcement && (
          <p
            className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              announcement.error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            {announcement.text}
          </p>
        )}
      </div>

      {list.isPending ? (
        <div role="status" aria-label="Loading your applications">
          <ApplicationsListSkeleton />
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load your applications. ${list.error.message}`}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          q={q}
          status={status}
          onClearSearch={() => {
            clearTimeout(searchTimer.current);
            setSearchInput('');
            update({ q: '' });
          }}
        />
      ) : (
        <div className={`flex flex-col gap-4 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          <ApplicationsTable
            applications={list.data.data}
            pendingId={updateStatus.isPending ? updateStatus.variables.id : undefined}
            onStatusChange={onStatusChange}
          />
          <ApplicationCards
            applications={list.data.data}
            pendingId={updateStatus.isPending ? updateStatus.variables.id : undefined}
            onStatusChange={onStatusChange}
          />

          <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700"
          >
            <p>
              Showing <span className="font-semibold">{first}</span>–
              <span className="font-semibold">{last}</span> of{' '}
              <span className="font-semibold">{total}</span>
            </p>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <PageButton
                  disabled={page <= 1}
                  onClick={() => update({ page: page - 1 })}
                  label="Previous"
                  icon="prev"
                />
                <PageButton
                  disabled={page >= pageCount}
                  onClick={() => update({ page: page + 1 })}
                  label="Next"
                  icon="next"
                />
              </div>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}

function tabSearch(status: ApplicationStatus | null, q: string, sort: SortParam): string {
  const out = new URLSearchParams();
  if (status) out.set('status', status);
  if (q) out.set('q', q);
  if (sort !== 'updated') out.set('sort', sort);
  const s = out.toString();
  return s ? `?${s}` : '';
}

function PageButton(props: {
  label: string;
  icon: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = props.icon === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
    >
      {props.icon === 'prev' && <Icon aria-hidden="true" className="size-4" />}
      {props.label}
      {props.icon === 'next' && <Icon aria-hidden="true" className="size-4" />}
    </button>
  );
}

function EmptyState({
  q,
  status,
  onClearSearch,
}: {
  q: string;
  status: ApplicationStatus | null;
  onClearSearch: () => void;
}) {
  const [title, body] = q
    ? [`No applications match “${q}”`, 'Check the spelling, or search by company or job title.']
    : status
      ? [
          `No applications in ${STATUS_STYLES[status].label}`,
          'Applications show up here when you change their status.',
        ]
      : [
          "You haven't applied anywhere yet",
          'Find a job, then mark it as applied to track it here.',
        ];

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
      <FileText aria-hidden="true" className="size-8 text-slate-400" />
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-600">{body}</p>
      {q ? (
        <button
          type="button"
          onClick={onClearSearch}
          className={`mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${focusRing}`}
        >
          <X aria-hidden="true" className="size-4" />
          Clear search
        </button>
      ) : (
        !status && (
          <Link
            to="/jobs"
            className={`mt-2 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 ${focusRing}`}
          >
            Search jobs
          </Link>
        )
      )}
    </div>
  );
}
