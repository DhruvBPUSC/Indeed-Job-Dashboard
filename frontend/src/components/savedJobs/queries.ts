import { useMutation, useQueryClient } from '@tanstack/react-query';

import { del, post } from '../../lib/api';
import type { ApplicationListItem } from '../../lib/types';

const refreshAll = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['applications'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

/** Unsave: deletes the SAVED application (and its notes). */
export function useRemoveSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (app: ApplicationListItem) => del(`/applications/${app.id}`),
    onSettled: () => refreshAll(qc),
  });
}

/** Undo an unsave: saves the same job again, with the notes it had. */
export function useRestoreSaved() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (app: ApplicationListItem) =>
      post('/applications', {
        jobId: app.job.id,
        status: 'SAVED',
        ...(app.notes && { notes: app.notes }),
      }),
    onSettled: () => refreshAll(qc),
  });
}
