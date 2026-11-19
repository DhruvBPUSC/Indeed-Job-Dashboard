import { ArrowLeft, Briefcase, CalendarDays, FileQuestion, MapPin } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { Section } from '../components/applicationDetail/Section';
import { focusRing } from '../components/applicationDetail/styles';
import { JobActions, JobAnnouncementBar } from '../components/jobSearch/JobActions';
import { useJob, useJobs } from '../components/jobSearch/queries';
import { useJobActions } from '../components/jobSearch/useJobActions';
import { CompanyBadge } from '../components/ui/CompanyBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Spinner';
import { ApiError } from '../lib/api';
import { formatDate, timeAgo } from '../lib/format';
import { JOB_TYPE_LABELS } from '../lib/labels';
import type { BackState } from '../lib/navigation';
import type { JobWithApplication } from '../lib/types';

const DEFAULT_BACK = { to: '/jobs', label: 'Job Search' };

export function JobDetailPage() {
  const { id = '' } = useParams();
  const { pathname, state } = useLocation() as { pathname: string; state: BackState | null };
  const back = state?.back?.to.startsWith('/') ? state.back : DEFAULT_BACK;
  const query = useJob(id);
  const actions = useJobActions();

  const backLink = (
    <Link
      to={back.to}
      className={`inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg pr-2 text-sm font-semibold text-blue-800 hover:underline ${focusRing}`}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to {back.label}
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {backLink}
        <Spinner label="Loading job" />
      </div>
    );
  }

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400);
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {backLink}
        {missing ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <FileQuestion aria-hidden="true" className="size-8 text-slate-400" />
            <h1 className="font-semibold text-slate-900">Job not found</h1>
            <p className="text-sm text-slate-600">This listing may have been removed.</p>
          </div>
        ) : (
          <ErrorState
            message={`We couldn't load this job. ${query.error.message}`}
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  const job = query.data;
  // Links from this page (to the application) come back here, keeping the original back link.
  const hereState: BackState = { back: { to: pathname, label: job.title } };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {backLink}

      <header className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <CompanyBadge company={job.company} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{job.title}</h1>
            <p className="mt-1 text-lg text-slate-700">{job.company}</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
          <li className="inline-flex items-center gap-1.5">
            <Briefcase aria-hidden="true" className="size-4 text-slate-500" />
            {JOB_TYPE_LABELS[job.jobType]}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-4 text-slate-500" />
            {job.location}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4 text-slate-500" />
            Posted {formatDate(job.postedAt)} ({timeAgo(job.postedAt).toLowerCase()})
          </li>
        </ul>
        <JobActions
          job={job}
          busy={actions.pendingJobId === job.id}
          backState={hereState}
          onSave={() => actions.onSave(job)}
          onUnsave={() => actions.onUnsave(job)}
          onApply={() => actions.onApply(job)}
        />
      </header>

      <JobAnnouncementBar announcement={actions.announcement} />

      <Section id="about-heading" title="About the job">
        <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
          {job.description}
        </p>
      </Section>

      <MoreFromCompany job={job} back={back} />
    </div>
  );
}

/** Up to 3 other listings from the same company, to keep browsing without going back. */
function MoreFromCompany({
  job,
  back,
}: {
  job: JobWithApplication;
  back: { to: string; label: string };
}) {
  const others = useJobs({ q: job.company, jobType: null, page: 1 });
  const list = (others.data?.data ?? [])
    .filter((j) => j.id !== job.id && j.company === job.company)
    .slice(0, 3);
  if (list.length === 0) return null;

  return (
    <Section id="more-heading" title={`More jobs at ${job.company}`}>
      <ul className="flex flex-col divide-y divide-slate-200">
        {list.map((j) => (
          <li key={j.id} className="py-3 first:pt-0 last:pb-0">
            <Link
              to={`/jobs/${j.id}`}
              state={{ back } satisfies BackState}
              className={`flex min-h-11 flex-col justify-center rounded ${focusRing}`}
            >
              <span className="font-semibold text-blue-800 hover:underline">{j.title}</span>
              <span className="text-sm text-slate-600">
                {JOB_TYPE_LABELS[j.jobType]} · {j.location}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
