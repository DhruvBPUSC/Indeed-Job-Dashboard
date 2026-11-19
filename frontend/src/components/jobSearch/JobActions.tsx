import { Bookmark, BookmarkCheck, Send } from 'lucide-react';
import { Link } from 'react-router';

import type { BackState } from '../../lib/navigation';
import type { JobWithApplication } from '../../lib/types';
import { focusRing, primaryButton, secondaryButton } from '../applicationDetail/styles';
import { StatusBadge } from '../ui/StatusBadge';
import type { JobAnnouncement } from './useJobActions';

interface JobActionsProps {
  job: JobWithApplication;
  busy: boolean;
  backState: BackState;
  onSave: () => void;
  onUnsave: () => void;
  onApply: () => void;
}

/** Buttons that depend on whether the user already tracks the job. */
export function JobActions({ job, busy, backState, onSave, onUnsave, onApply }: JobActionsProps) {
  // Visible text stays the accessible name's start; the job is added for screen readers.
  const forScreenReaders = (
    <span className="sr-only">
      : {job.title} at {job.company}
    </span>
  );

  if (job.applicationStatus !== null && job.applicationStatus !== 'SAVED') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={job.applicationStatus} />
        <Link
          to={`/applications/${job.applicationId}`}
          state={backState}
          className={secondaryButton}
        >
          View application
          {forScreenReaders}
        </Link>
      </div>
    );
  }

  const saved = job.applicationStatus === 'SAVED';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={saved}
        className={
          saved
            ? `${secondaryButton} border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100`
            : secondaryButton
        }
        disabled={busy}
        onClick={saved ? onUnsave : onSave}
      >
        {saved ? (
          <BookmarkCheck aria-hidden="true" className="size-4" />
        ) : (
          <Bookmark aria-hidden="true" className="size-4" />
        )}
        {saved ? 'Saved' : 'Save'}
        {forScreenReaders}
      </button>
      <button type="button" className={primaryButton} disabled={busy} onClick={onApply}>
        <Send aria-hidden="true" className="size-4" />I applied
        {forScreenReaders}
      </button>
    </div>
  );
}

/** Confirmation after a job action; also read out by screen readers. */
export function JobAnnouncementBar({ announcement }: { announcement: JobAnnouncement | null }) {
  return (
    <div role="status" aria-live="polite">
      {announcement && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            announcement.error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          {announcement.text}{' '}
          {announcement.link && (
            <Link
              to={announcement.link.to}
              className={`rounded font-semibold underline hover:no-underline ${focusRing}`}
            >
              {announcement.link.label}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
