import { CalendarClock, ChevronRight, MapPin } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { formatDate, timeAgo } from '../../lib/format';
import { JOB_TYPE_LABELS } from '../../lib/labels';
import type { BackState } from '../../lib/navigation';
import { nextStep, type NextStepTone } from '../../lib/nextStep';
import type { ApplicationListItem, ApplicationStatus } from '../../lib/types';
import { CompanyBadge } from '../ui/CompanyBadge';
import { StatusSelect } from './StatusSelect';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

const TONE_CLASS: Record<NextStepTone, string> = {
  event: 'text-violet-800',
  action: 'text-amber-800',
  waiting: 'text-slate-700',
  closed: 'text-slate-500',
};

interface ListProps {
  applications: ApplicationListItem[];
  pendingId: string | undefined;
  onStatusChange: (app: ApplicationListItem, status: ApplicationStatus) => void;
}

function Applied({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-500">—</span>;
  return (
    <time dateTime={iso} title={formatDate(iso)}>
      {timeAgo(iso)}
    </time>
  );
}

function NextStepCell({ app }: { app: ApplicationListItem }) {
  const step = nextStep(app);
  return (
    <div className="flex items-start gap-1.5">
      {step.tone === 'event' && (
        <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-700" />
      )}
      <div>
        <p className={`font-medium ${TONE_CLASS[step.tone]}`}>{step.label}</p>
        {step.detail && <p className="text-slate-600">{step.detail}</p>}
      </div>
    </div>
  );
}

function DetailsLink({ app }: { app: ApplicationListItem }) {
  const { pathname, search } = useLocation();
  const state: BackState = { back: { to: pathname + search, label: 'My Applications' } };
  return (
    <Link
      to={`/applications/${app.id}`}
      state={state}
      aria-label={`View ${app.job.title} at ${app.job.company}`}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-blue-800 hover:bg-blue-50 ${focusRing}`}
    >
      <ChevronRight aria-hidden="true" className="size-5" />
    </Link>
  );
}

const statusLabel = (app: ApplicationListItem) =>
  `Status for ${app.job.title} at ${app.job.company}`;

/** Table on medium screens and up. */
export function ApplicationsTable({ applications, pendingId, onStatusChange }: ListProps) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Job
            </th>
            <th scope="col" className="hidden px-4 py-3 font-semibold lg:table-cell">
              Type &amp; location
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Applied
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Next step
            </th>
            <th scope="col" className="w-12 px-2 py-3">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {applications.map((app) => (
            <tr key={app.id} className="transition-colors duration-150 hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <CompanyBadge company={app.job.company} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{app.job.title}</p>
                    <p className="text-slate-600">{app.job.company}</p>
                    {/* Type moves here when its own column is hidden. */}
                    <p className="text-slate-600 lg:hidden">{JOB_TYPE_LABELS[app.job.jobType]}</p>
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                <p className="text-slate-800">{JOB_TYPE_LABELS[app.job.jobType]}</p>
                <p className="text-slate-600">{app.job.location}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                <Applied iso={app.dateApplied} />
              </td>
              <td className="px-4 py-3">
                <StatusSelect
                  value={app.status}
                  label={statusLabel(app)}
                  disabled={pendingId === app.id}
                  onChange={(s) => onStatusChange(app, s)}
                />
              </td>
              <td className="px-4 py-3">
                <NextStepCell app={app} />
              </td>
              <td className="px-2 py-1 text-right">
                <DetailsLink app={app} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Stacked cards on small screens. */
export function ApplicationCards({ applications, pendingId, onStatusChange }: ListProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {applications.map((app) => (
        <li key={app.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-start gap-3">
            <CompanyBadge company={app.job.company} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{app.job.title}</p>
              <p className="text-slate-600">{app.job.company}</p>
            </div>
            <DetailsLink app={app} />
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
            <span>{JOB_TYPE_LABELS[app.job.jobType]}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5" />
              {app.job.location}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Applied <Applied iso={app.dateApplied} />
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <NextStepCell app={app} />
            <StatusSelect
              value={app.status}
              label={statusLabel(app)}
              disabled={pendingId === app.id}
              onChange={(s) => onStatusChange(app, s)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ApplicationsListSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex h-18 items-center gap-4 px-4">
          <div className="size-10 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
            <div className="h-3 w-1/5 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          </div>
          <div className="h-7 w-24 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
