import { CalendarClock } from 'lucide-react';

import { formatDate, formatDateTime, timeAgo } from '../../lib/format';
import { nextStep } from '../../lib/nextStep';
import { STATUS_STYLES } from '../../lib/status';
import type { ApplicationDetail, ApplicationStatus } from '../../lib/types';
import { useNow } from '../../lib/useNow';
import { StatusSelect } from '../applications/StatusSelect';
import { useUpdateApplication } from './queries';
import { Section } from './Section';

export function StatusPanel({ app }: { app: ApplicationDetail }) {
  const update = useUpdateApplication(app.id);
  const now = useNow();
  const upcoming = app.interviews.find((i) => new Date(i.scheduledAt).getTime() >= now) ?? null;
  const step = nextStep({ ...app, nextInterview: upcoming }, new Date(now));

  return (
    <Section id="status-heading" title="Status">
      <div className="flex flex-col gap-4 text-sm">
        <StatusSelect
          value={app.status}
          label="Application status"
          disabled={update.isPending}
          onChange={(status: ApplicationStatus) => update.mutate({ status })}
        />
        <div role="status" aria-live="polite">
          {update.isError ? (
            <p className="font-medium text-red-700">Couldn&apos;t update: {update.error.message}</p>
          ) : update.isSuccess ? (
            <p className="font-medium text-green-800">
              Status updated to {STATUS_STYLES[app.status].label}.
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-slate-600">Applied</dt>
          <dd className="text-slate-900">
            {app.dateApplied ? (
              <>
                {formatDate(app.dateApplied)}{' '}
                <span className="text-slate-600">({timeAgo(app.dateApplied).toLowerCase()})</span>
              </>
            ) : (
              'Not yet'
            )}
          </dd>
          <dt className="text-slate-600">Next step</dt>
          <dd className="text-slate-900">
            <span className="font-medium">{step.label}</span>
            {step.detail && <span className="block text-slate-600">{step.detail}</span>}
          </dd>
        </dl>
      </div>
    </Section>
  );
}

/** Status changes, newest first, from the server's status history. */
export function ActivityTimeline({ app }: { app: ApplicationDetail }) {
  return (
    <Section id="activity-heading" title="Activity">
      <ol className="relative flex flex-col gap-4 border-l-2 border-slate-200 pl-5 text-sm">
        {app.statusHistory.map((entry) => (
          <li key={entry.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-1 -left-[1.6rem] size-3 rounded-full border-2 border-white bg-blue-700 ring-1 ring-slate-300"
            />
            <p className="font-medium text-slate-900">
              {entry.fromStatus === null
                ? `Started tracking as ${STATUS_STYLES[entry.toStatus].label}`
                : `Moved from ${STATUS_STYLES[entry.fromStatus].label} to ${STATUS_STYLES[entry.toStatus].label}`}
            </p>
            <p className="flex items-center gap-1 text-slate-600">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              <time dateTime={entry.changedAt}>{formatDateTime(entry.changedAt)}</time>
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
