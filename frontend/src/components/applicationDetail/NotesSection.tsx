import { useState, type FormEvent } from 'react';

import type { ApplicationDetail } from '../../lib/types';
import { useUpdateApplication } from './queries';
import { Section } from './Section';
import { fieldClass, primaryButton, secondaryButton } from './styles';

const MAX_NOTES = 5000;

/**
 * Notes with an explicit Save (no silent autosave, so users know when it's stored).
 * The parent keys this by the saved notes, so a successful save resets the draft.
 */
export function NotesSection({ app }: { app: ApplicationDetail }) {
  const saved = app.notes ?? '';
  const [draft, setDraft] = useState(saved);
  const update = useUpdateApplication(app.id);
  const dirty = draft.trim() !== saved;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ notes: draft.trim() === '' ? null : draft });
  };

  return (
    <Section id="notes-heading" title="Notes">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="app-notes" className="sr-only">
          Notes about this application
        </label>
        <textarea
          id="app-notes"
          rows={5}
          maxLength={MAX_NOTES}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Recruiter names, follow-up dates, questions to ask…"
          aria-describedby="app-notes-count"
          className={`${fieldClass} py-2`}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="app-notes-count" className="text-xs text-slate-600 tabular-nums">
            {draft.length.toLocaleString()} / {MAX_NOTES.toLocaleString()} characters
          </p>
          <div className="flex items-center gap-2">
            {update.isError && (
              <p role="alert" className="text-sm font-medium text-red-700">
                Couldn&apos;t save: {update.error.message}
              </p>
            )}
            {dirty && (
              <button type="button" className={secondaryButton} onClick={() => setDraft(saved)}>
                Discard changes
              </button>
            )}
            <button type="submit" className={primaryButton} disabled={!dirty || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save notes'}
            </button>
          </div>
        </div>
      </form>
    </Section>
  );
}
