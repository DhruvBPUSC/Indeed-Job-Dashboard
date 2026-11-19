import { Briefcase, ChevronDown, MapPin } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { timeAgo } from '../../lib/format';
import { JOB_TYPE_LABELS } from '../../lib/labels';
import type { BackState } from '../../lib/navigation';
import type { JobWithApplication } from '../../lib/types';
import { focusRing } from '../applicationDetail/styles';
import { CompanyBadge } from '../ui/CompanyBadge';
import { JobActions } from './JobActions';

interface JobCardProps {
  job: JobWithApplication;
  busy: boolean;
  onSave: () => void;
  onUnsave: () => void;
  onApply: () => void;
}

export function JobCard({ job, busy, onSave, onUnsave, onApply }: JobCardProps) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const { pathname, search } = useLocation();
  const backState: BackState = { back: { to: pathname + search, label: 'Job Search' } };

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CompanyBadge company={job.company} />
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">
              <Link
                to={`/jobs/${job.id}`}
                state={backState}
                className={`rounded hover:text-blue-800 hover:underline ${focusRing}`}
              >
                {job.title}
              </Link>
            </h2>
            <p className="text-sm text-slate-700">{job.company}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Briefcase aria-hidden="true" className="size-4" />
                {JOB_TYPE_LABELS[job.jobType]}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {job.location}
              </span>
              <span>
                Posted <time dateTime={job.postedAt}>{timeAgo(job.postedAt).toLowerCase()}</time>
              </span>
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <JobActions
            job={job}
            busy={busy}
            backState={backState}
            onSave={onSave}
            onUnsave={onUnsave}
            onApply={onApply}
          />
        </div>
      </div>

      <div className="mt-4">
        <p
          id={descriptionId}
          className={`text-sm leading-relaxed whitespace-pre-line text-slate-700 ${expanded ? '' : 'line-clamp-2'}`}
        >
          {job.description}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={descriptionId}
          onClick={() => setExpanded((v) => !v)}
          className={`mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded text-sm font-semibold text-blue-800 hover:underline ${focusRing}`}
        >
          {expanded ? 'Show less' : 'Show full description'}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
    </li>
  );
}
