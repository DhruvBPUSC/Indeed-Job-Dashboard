import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { secondaryButton } from '../components/applicationDetail/styles';
import { ApplicationsListSkeleton } from '../components/applications/ApplicationsList';
import {
  PAGE_SIZE,
  useApplicationsList,
  useUpdateStatus,
} from '../components/applications/queries';
import { SavedJobCard } from '../components/savedJobs/SavedJobCard';
import { useRemoveSaved, useRestoreSaved } from '../components/savedJobs/queries';
import { ErrorState } from '../components/ui/ErrorState';
import type { ApplicationListItem } from '../lib/types';

const SORTS = {
  updated: { label: 'Recently updated', sort: 'updatedAt', order: 'desc' },
  company: { label: 'Company (A–Z)', sort: 'company', order: 'asc' },
} as const;
type SortParam = keyof typeof SORTS;

type Announcement =
  | { kind: 'removed'; app: ApplicationListItem }
  | { kind: 'applied'; app: ApplicationListItem }
  | { kind: 'restored'; app: ApplicationListItem }
  | { kind: 'error'; text: string };

const linkClass =
  'rounded font-semibold underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function SavedJobsPage() {
  const [params, setParams] = useSearchParams();
  const rawSort = params.get('sort');
  const sort: SortParam = rawSort === 'company' ? 'company' : 'updated';
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const setView = (next: { sort?: SortParam; page?: number }) => {
    const out = new URLSearchParams();
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    if (s !== 'updated') out.set('sort', s);
    if (p > 1) out.set('page', String(p));
    setParams(out);
  };

  const list = useApplicationsList({
    statuses: ['SAVED'],
    q: '',
    sort: SORTS[sort].sort,
    order: SORTS[sort].order,
    page,
  });
  const apply = useUpdateStatus();
  const remove = useRemoveSaved();
  const restore = useRestoreSaved();

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = (a: Announcement) => {
    clearTimeout(timer.current);
    setAnnouncement(a);
    // Long enough to reach the Undo button, including by keyboard.
    timer.current = setTimeout(() => setAnnouncement(null), 10_000);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const busyId =
    (apply.isPending && apply.variables.id) || (remove.isPending && remove.variables.id) || null;

  const onApply = (app: ApplicationListItem) =>
    apply.mutate(
      { id: app.id, status: 'APPLIED', jobTitle: app.job.title },
      {
        onSuccess: () => announce({ kind: 'applied', app }),
        onError: (err) => announce({ kind: 'error', text: `Couldn't update: ${err.message}` }),
      },
    );

  const onRemove = (app: ApplicationListItem) =>
    remove.mutate(app, {
      onSuccess: () => announce({ kind: 'removed', app }),
      onError: (err) => announce({ kind: 'error', text: `Couldn't remove: ${err.message}` }),
    });

  const onUndo = (app: ApplicationListItem) =>
    restore.mutate(app, {
      onSuccess: () => announce({ kind: 'restored', app }),
      onError: (err) => announce({ kind: 'error', text: `Couldn't undo: ${err.message}` }),
    });

  const total = list.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Saved Jobs</h1>
          <p className="mt-1 text-slate-600">
            {list.data
              ? `${total} job${total === 1 ? '' : 's'} you're thinking about applying to.`
              : "Jobs you're thinking about applying to."}
          </p>
        </div>
        <div className="sm:w-56">
          <label htmlFor="saved-sort" className="mb-1.5 block text-sm font-semibold text-slate-800">
            Sort by
          </label>
          <select
            id="saved-sort"
            value={sort}
            onChange={(e) => setView({ sort: e.target.value as SortParam })}
            className="min-h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div role="status" aria-live="polite">
        {announcement && (
          <AnnouncementBar a={announcement} undoBusy={restore.isPending} onUndo={onUndo} />
        )}
      </div>

      {list.isPending ? (
        <div role="status" aria-label="Loading saved jobs">
          <ApplicationsListSkeleton />
        </div>
      ) : list.isError ? (
        <ErrorState
          message={`We couldn't load your saved jobs. ${list.error.message}`}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.data.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center">
          <Bookmark aria-hidden="true" className="size-8 text-slate-400" />
          <p className="font-semibold text-slate-900">No saved jobs</p>
          <p className="text-sm text-slate-600">
            Save jobs while you search, then come back here when you&apos;re ready to apply.
          </p>
          <Link
            to="/jobs"
            className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Search jobs
          </Link>
        </div>
      ) : (
        <>
          <ul
            className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${list.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {list.data.data.map((app) => (
              <SavedJobCard
                key={app.id}
                app={app}
                busy={busyId === app.id}
                onApply={() => onApply(app)}
                onRemove={() => onRemove(app)}
              />
            ))}
          </ul>
          {lastPage > 1 && (
            <nav aria-label="Pagination" className="flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                disabled={page <= 1}
                onClick={() => setView({ page: page - 1 })}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                Previous
              </button>
              <button
                type="button"
                className={secondaryButton}
                disabled={page >= lastPage}
                onClick={() => setView({ page: page + 1 })}
              >
                Next
                <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function AnnouncementBar({
  a,
  undoBusy,
  onUndo,
}: {
  a: Announcement;
  undoBusy: boolean;
  onUndo: (app: ApplicationListItem) => void;
}) {
  const tone =
    a.kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-green-200 bg-green-50 text-green-800';
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium ${tone}`}
    >
      {a.kind === 'error' && <p>{a.text}</p>}
      {a.kind === 'applied' && (
        <p>
          {a.app.job.title} at {a.app.job.company} moved to{' '}
          <Link to="/applications?status=APPLIED" className={linkClass}>
            My Applications
          </Link>
          .
        </p>
      )}
      {a.kind === 'restored' && (
        <p>
          {a.app.job.title} at {a.app.job.company} is saved again.
        </p>
      )}
      {a.kind === 'removed' && (
        <>
          <p>
            Removed {a.app.job.title} at {a.app.job.company} from Saved Jobs.
          </p>
          <button
            type="button"
            disabled={undoBusy}
            onClick={() => onUndo(a.app)}
            className="min-h-11 cursor-pointer rounded-lg border border-green-300 bg-white px-4 font-semibold text-green-900 hover:bg-green-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800 disabled:cursor-wait disabled:opacity-60"
          >
            {undoBusy ? 'Restoring…' : 'Undo'}
          </button>
        </>
      )}
    </div>
  );
}
