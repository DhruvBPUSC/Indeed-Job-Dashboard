import { CalendarClock, CalendarPlus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { INTERVIEW_TYPE_LABELS } from '../../lib/labels';
import type { ApplicationDetail, Interview, InterviewType } from '../../lib/types';
import { useNow } from '../../lib/useNow';
import { useCreateInterview, useDeleteInterview, useUpdateApplication } from './queries';
import { Section } from './Section';
import { dangerButton, fieldClass, primaryButton, secondaryButton } from './styles';

const TYPES = Object.keys(INTERVIEW_TYPE_LABELS) as InterviewType[];

export function InterviewsSection({ app }: { app: ApplicationDetail }) {
  const [adding, setAdding] = useState(false);
  const [offerMove, setOfferMove] = useState(false);
  const updateApp = useUpdateApplication(app.id);
  const now = useNow();

  return (
    <Section
      id="interviews-heading"
      title="Interviews"
      action={
        !adding && (
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setAdding(true);
              setOfferMove(false);
            }}
          >
            <CalendarPlus aria-hidden="true" className="size-4" />
            Add interview
          </button>
        )
      }
    >
      {adding && (
        <AddInterviewForm
          applicationId={app.id}
          onDone={(added) => {
            setAdding(false);
            // Logging an interview usually means the application has reached that stage.
            if (added && (app.status === 'APPLIED' || app.status === 'IN_PROGRESS')) {
              setOfferMove(true);
            }
          }}
        />
      )}

      {offerMove && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900"
        >
          <p className="font-medium">Interview added. Move this application to Interview?</p>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} onClick={() => setOfferMove(false)}>
              Not now
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={updateApp.isPending}
              onClick={() =>
                updateApp.mutate({ status: 'INTERVIEW' }, { onSuccess: () => setOfferMove(false) })
              }
            >
              Move to Interview
            </button>
          </div>
        </div>
      )}

      {app.interviews.length === 0 ? (
        !adding && <p className="text-sm text-slate-600">No interviews scheduled yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-200">
          {app.interviews.map((interview) => (
            <InterviewRow
              key={interview.id}
              interview={interview}
              upcoming={new Date(interview.scheduledAt).getTime() >= now}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function InterviewRow({ interview, upcoming }: { interview: Interview; upcoming: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteInterview(interview.applicationId);
  const when = formatDateTime(interview.scheduledAt);

  return (
    <li className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
          upcoming ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'
        }`}
      >
        <CalendarClock aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-slate-900">
          {INTERVIEW_TYPE_LABELS[interview.type]} interview
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
              upcoming ? 'bg-violet-50 text-violet-800' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {upcoming ? 'Upcoming' : 'Past'}
          </span>
        </p>
        <p className="text-slate-700">
          <time dateTime={interview.scheduledAt}>{when}</time>
        </p>
        {interview.notes && (
          <p className="mt-1 whitespace-pre-line text-slate-600">{interview.notes}</p>
        )}
        {remove.isError && (
          <p role="alert" className="mt-1 font-medium text-red-700">
            Couldn&apos;t delete: {remove.error.message}
          </p>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
          <span className="text-sm text-slate-700">Delete?</span>
          <button type="button" className={secondaryButton} onClick={() => setConfirming(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={dangerButton}
            disabled={remove.isPending}
            onClick={() => remove.mutate(interview.id)}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${INTERVIEW_TYPE_LABELS[interview.type].toLowerCase()} interview on ${when}`}
          onClick={() => setConfirming(true)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </button>
      )}
    </li>
  );
}

function AddInterviewForm({
  applicationId,
  onDone,
}: {
  applicationId: string;
  onDone: (added: boolean) => void;
}) {
  const [when, setWhen] = useState('');
  const [type, setType] = useState<InterviewType>('VIRTUAL');
  const [notes, setNotes] = useState('');
  const [whenError, setWhenError] = useState<string>();
  const create = useCreateInterview(applicationId);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!when) {
      setWhenError('Choose a date and time.');
      return;
    }
    setWhenError(undefined);
    create.mutate(
      // datetime-local is the viewer's local time; the API wants an ISO instant.
      { scheduledAt: new Date(when).toISOString(), type, ...(notes.trim() && { notes }) },
      { onSuccess: () => onDone(true) },
    );
  };

  const serverErrors = create.error instanceof ApiError ? create.error.fieldErrors() : {};
  const dateError = whenError ?? serverErrors.scheduledAt;
  const formError =
    create.error && Object.keys(serverErrors).length === 0 ? create.error.message : undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Add interview"
      className="mb-4 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="interview-when" className="text-sm font-semibold text-slate-800">
            Date and time
          </label>
          <input
            id="interview-when"
            type="datetime-local"
            required
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? 'interview-when-error' : undefined}
            className={`${fieldClass} ${dateError ? 'border-red-600' : ''}`}
          />
          {dateError && (
            <p id="interview-when-error" className="text-sm font-medium text-red-700">
              {dateError}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="interview-type" className="text-sm font-semibold text-slate-800">
            Type
          </label>
          <select
            id="interview-type"
            value={type}
            onChange={(e) => setType(e.target.value as InterviewType)}
            className={`${fieldClass} cursor-pointer`}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {INTERVIEW_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="interview-notes" className="text-sm font-semibold text-slate-800">
          Notes <span className="font-normal text-slate-600">(optional)</span>
        </label>
        <textarea
          id="interview-notes"
          rows={2}
          maxLength={5000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Who you're meeting, what to prepare…"
          className={`${fieldClass} py-2`}
        />
      </div>
      {formError && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={secondaryButton} onClick={() => onDone(false)}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save interview'}
        </button>
      </div>
    </form>
  );
}
