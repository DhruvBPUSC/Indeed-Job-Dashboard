import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { get } from '../../lib/api';
import { JOB_TYPE_LABELS } from '../../lib/labels';
import type { BackState } from '../../lib/navigation';
import { STATUS_STYLES } from '../../lib/status';
import type { JobWithApplication, ListResponse } from '../../lib/types';
import { CompanyBadge } from '../ui/CompanyBadge';

const MIN_CHARS = 2;
const SUGGESTION_COUNT = 5;
const DEBOUNCE_MS = 200;

/** `value`, but only after it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Bolds the part of `text` that matches `term` (case-insensitive), like most search UIs. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (!term || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-bold text-slate-900">
        {text.slice(at, at + term.length)}
      </mark>
      {text.slice(at + term.length)}
    </>
  );
}

/** Names the page a suggestion was opened from, for the details page's back link. */
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/applications': 'My Applications',
  '/saved': 'Saved Jobs',
  '/jobs': 'Job Search',
};

const jobsHref = (q: string) => (q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');

/**
 * Top-bar job search with live suggestions (WAI-ARIA combobox pattern): type to see the top
 * matches, arrow keys to move, Enter to open one, Escape to close. Enter with nothing
 * highlighted runs the full search, as before.
 */
export function JobSearchBox() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  // On the job search page the box shows the current search; elsewhere it starts empty.
  const urlQuery = pathname === '/jobs' ? (new URLSearchParams(search).get('q') ?? '') : '';
  const [query, setQuery] = useState(urlQuery);
  const [queryFor, setQueryFor] = useState(urlQuery);
  if (urlQuery !== queryFor) {
    setQueryFor(urlQuery);
    setQuery(urlQuery);
  }

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const term = useDebounced(query.trim(), DEBOUNCE_MS);
  const ready = term.length >= MIN_CHARS;

  const suggestions = useQuery({
    queryKey: ['jobs', 'suggest', term],
    queryFn: () =>
      get<ListResponse<JobWithApplication>>(
        `/jobs?${new URLSearchParams({ q: term, pageSize: String(SUGGESTION_COUNT) }).toString()}`,
      ),
    enabled: open && ready,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const jobs = ready ? (suggestions.data?.data ?? []) : [];
  const total = suggestions.data?.total ?? 0;
  // Options: the matching jobs, then "See all results" (only when there are results).
  const optionCount = jobs.length > 0 ? jobs.length + 1 : 0;
  const showPopup = open && query.trim().length >= MIN_CHARS;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const goToResults = (q: string) => {
    close();
    void navigate(jobsHref(q));
  };

  const goToJob = (job: JobWithApplication) => {
    close();
    input.current?.blur();
    setQuery('');
    const label = PAGE_NAMES[pathname] ?? 'previous page';
    const state: BackState = { back: { to: pathname + search, label } };
    void navigate(`/jobs/${job.id}`, { state });
  };

  const choose = (index: number) => {
    const job = jobs[index];
    if (job) goToJob(job);
    else goToResults(query.trim());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (optionCount === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Wraps around, with -1 (back in the text box) between the last and first options.
      setActive((i) => ((i + step + 1 + optionCount + 1) % (optionCount + 1)) - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showPopup && active >= 0) choose(active);
      else goToResults(query.trim());
    } else if (e.key === 'Escape') {
      if (open) close();
      else setQuery('');
    }
  };

  // Close when focus leaves the whole search box (not when it moves within it).
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) close();
  };

  const optionId = (i: number) => `${listId}-option-${i}`;
  const optionClass = (i: number) =>
    `flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${
      i === active ? 'bg-blue-50' : 'hover:bg-slate-50'
    }`;

  return (
    <div role="search" className="relative min-w-0 flex-1 lg:max-w-2xl" onBlur={onBlur}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search jobs
      </label>
      <input
        ref={input}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showPopup}
        aria-controls={listId}
        aria-activedescendant={showPopup && active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search by job title or company"
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pr-12 pl-4 text-sm text-slate-900 transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
      />
      <button
        type="button"
        aria-label="Search"
        onClick={() => goToResults(query.trim())}
        className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-r-lg text-slate-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <Search aria-hidden="true" className="size-5" />
      </button>

      {/* Screen readers hear how many suggestions there are, not every list change. */}
      <p role="status" className="sr-only">
        {showPopup && suggestions.data && term === query.trim()
          ? jobs.length > 0
            ? `${jobs.length} suggestions. Use up and down arrows to review, Enter to open.`
            : 'No matching jobs.'
          : ''}
      </p>

      <div
        className={`absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ${
          showPopup ? '' : 'hidden'
        }`}
      >
        {suggestions.isFetching && jobs.length === 0 && (
          <p className="flex items-center gap-2 px-3 py-3 text-sm text-slate-600">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            Searching…
          </p>
        )}
        {!suggestions.isFetching && suggestions.data && jobs.length === 0 && (
          <p className="px-3 py-3 text-sm text-slate-600">
            No jobs match “{query.trim()}”. Try a company name or a different title.
          </p>
        )}
        {suggestions.isError && (
          <p className="px-3 py-3 text-sm text-red-700">Couldn&apos;t load suggestions.</p>
        )}

        <ul id={listId} role="listbox" aria-label="Job suggestions">
          {jobs.map((job, i) => (
            <li
              key={job.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // mousedown would blur the input before click fires; keep focus in the box.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              onMouseEnter={() => setActive(i)}
              className={optionClass(i)}
            >
              <CompanyBadge company={job.company} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">
                  <Highlight text={job.title} term={term} />
                </span>
                <span className="block truncate text-xs text-slate-600">
                  <Highlight text={job.company} term={term} /> ·{' '}
                  {job.applicationStatus
                    ? STATUS_STYLES[job.applicationStatus].label
                    : JOB_TYPE_LABELS[job.jobType]}
                </span>
              </span>
            </li>
          ))}
          {jobs.length > 0 && (
            <li
              id={optionId(jobs.length)}
              role="option"
              aria-selected={active === jobs.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(jobs.length)}
              onMouseEnter={() => setActive(jobs.length)}
              className={`${optionClass(jobs.length)} border-t border-slate-200 font-semibold text-blue-800`}
            >
              <span className="flex-1">
                See all {total} result{total === 1 ? '' : 's'} for “{query.trim()}”
              </span>
              <ArrowRight aria-hidden="true" className="size-4" />
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
