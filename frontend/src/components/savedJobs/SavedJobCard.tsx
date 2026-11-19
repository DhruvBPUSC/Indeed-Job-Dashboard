import { BookmarkX, Briefcase, MapPin, Send } from 'lucide-react';
import { Link } from 'react-router';

import { timeAgo } from '../../lib/format';
import { JOB_TYPE_LABELS } from '../../lib/labels';
import type { BackState } from '../../lib/navigation';
import type { ApplicationListItem } from '../../lib/types';
import { primaryButton, secondaryButton } from '../applicationDetail/styles';
import { CompanyBadge } from '../ui/CompanyBadge';

interface SavedJobCardProps {
  app: ApplicationListItem;
  busy: boolean;
  onApply: () => void;
  onRemove: () => void;
}

const backState: BackState = { back: { to: '/saved', label: 'Saved Jobs' } };

export function SavedJobCard({ app, busy, onApply, onRemove }: SavedJobCardProps) {
  const { job } = app;
  return (
    <li className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <CompanyBadge company={job.company} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-slate-900">
            <Link
              to={`/applications/${app.id}`}
              state={backState}
              className="rounded hover:text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              {job.title}
            </Link>
          </h2>
          <p className="text-sm text-slate-600">{job.company}</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <Briefcase aria-hidden="true" className="size-4 text-slate-500" />
          {JOB_TYPE_LABELS[job.jobType]}
        </li>
        <li className="flex items-center gap-2">
          <MapPin aria-hidden="true" className="size-4 text-slate-500" />
          {job.location}
        </li>
      </ul>

      {app.notes && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{app.notes}</p>}

      <p className="mt-3 text-xs text-slate-600">
        Saved <time dateTime={app.createdAt}>{timeAgo(app.createdAt).toLowerCase()}</time>
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button
          type="button"
          className={`${primaryButton} flex-1`}
          disabled={busy}
          onClick={onApply}
        >
          <Send aria-hidden="true" className="size-4" />
          Mark as applied
          <span className="sr-only">
            : {job.title} at {job.company}
          </span>
        </button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={onRemove}>
          <BookmarkX aria-hidden="true" className="size-4" />
          Remove
          <span className="sr-only">
            : {job.title} at {job.company}
          </span>
        </button>
      </div>
    </li>
  );
}
