import { Trash2 } from 'lucide-react';
import { useRef } from 'react';

import type { ApplicationDetail } from '../../lib/types';
import { useDeleteApplication } from './queries';
import { dangerButton, secondaryButton } from './styles';

/** Delete with a confirmation dialog (native <dialog>: focus trap, Escape to cancel). */
export function DeleteApplication({
  app,
  onDeleted,
}: {
  app: ApplicationDetail;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const remove = useDeleteApplication(app.id);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-lg px-3 text-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Delete application
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-6 text-slate-900 backdrop:bg-slate-900/40"
      >
        <h2 id="delete-title" className="text-lg font-bold">
          Delete this application?
        </h2>
        <p id="delete-desc" className="mt-2 text-sm text-slate-700">
          <span className="font-semibold">
            {app.job.title} at {app.job.company}
          </span>{' '}
          will be removed along with its status history, interviews, and notes. This can&apos;t be
          undone.
        </p>
        {remove.isError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            Couldn&apos;t delete: {remove.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {/* Cancel first and focused by default, so Enter never deletes by accident. */}
          <button
            type="button"
            autoFocus
            className={secondaryButton}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={dangerButton}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  dialog.current?.close();
                  onDeleted();
                },
              })
            }
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </dialog>
    </>
  );
}
