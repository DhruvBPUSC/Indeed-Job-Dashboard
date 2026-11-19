import { ArrowLeft, Briefcase, CalendarDays, FileQuestion, MapPin } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { DeleteApplication } from '../components/applicationDetail/DeleteApplication';
import { InterviewsSection } from '../components/applicationDetail/InterviewsSection';
import { NotesSection } from '../components/applicationDetail/NotesSection';
import { useApplication } from '../components/applicationDetail/queries';
import { Section } from '../components/applicationDetail/Section';
import { ActivityTimeline, StatusPanel } from '../components/applicationDetail/StatusPanel';
import { CompanyBadge } from '../components/ui/CompanyBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ApiError } from '../lib/api';
import { formatDate } from '../lib/format';
import { JOB_TYPE_LABELS } from '../lib/labels';
import type { BackState } from '../lib/navigation';

const DEFAULT_BACK = { to: '/applications', label: 'My Applications' };

const backLinkClass =
  'inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg pr-2 text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const state = useLocation().state as BackState | null;
  const back = state?.back?.to.startsWith('/') ? state.back : DEFAULT_BACK;
  const navigate = useNavigate();
  const query = useApplication(id);

  const backLink = (
    <Link to={back.to} className={backLinkClass}>
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to {back.label}
    </Link>
  );

  if (query.isPending) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {backLink}
        <Spinner label="Loading application" />
      </div>
    );
  }

  if (query.isError) {
    // 404 (not yours or deleted) and 400 (malformed id in the URL) both mean "nothing here".
    const missing =
      query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 400);
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {backLink}
        {missing ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
            <FileQuestion aria-hidden="true" className="size-8 text-slate-400" />
            <h1 className="font-semibold text-slate-900">Application not found</h1>
            <p className="text-sm text-slate-600">It may have been deleted.</p>
          </div>
        ) : (
          <ErrorState
            message={`We couldn't load this application. ${query.error.message}`}
            onRetry={() => void query.refetch()}
          />
        )}
      </div>
    );
  }

  const app = query.data;
  const { job } = app;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {backLink}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CompanyBadge company={job.company} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{job.title}</h1>
          <p className="mt-1 text-lg text-slate-700">{job.company}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
            <li className="inline-flex items-center gap-1.5">
              <Briefcase aria-hidden="true" className="size-4" />
              {JOB_TYPE_LABELS[job.jobType]}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4" />
              {job.location}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              Posted {formatDate(job.postedAt)}
            </li>
          </ul>
        </div>
        <div className="sm:pt-1">
          <StatusBadge status={app.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* On phones, status comes first: it's what people check most. */}
        <div className="flex flex-col gap-6 lg:order-last">
          <StatusPanel app={app} />
          <ActivityTimeline app={app} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <InterviewsSection app={app} />
          <NotesSection key={app.notes ?? ''} app={app} />
          <Section id="description-heading" title="Job description">
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-700">
              {job.description}
            </p>
          </Section>
          <DeleteApplication
            app={app}
            onDeleted={() => void navigate(back.to, { replace: true })}
          />
        </div>
      </div>
    </div>
  );
}
