import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { del, get, patch, post } from '../../lib/api';
import type {
  ApplicationDetail,
  ApplicationStatus,
  Interview,
  InterviewType,
} from '../../lib/types';

const detailKey = (id: string) => ['applications', 'detail', id] as const;

/** Anything that changes an application can change lists, tab counts, and dashboard cards. */
const refreshAll = (qc: QueryClient) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['applications'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

export function useApplication(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: async () =>
      (await get<{ application: ApplicationDetail }>(`/applications/${id}`)).application,
  });
}

export function useUpdateApplication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { status?: ApplicationStatus; notes?: string | null }) =>
      patch<{ application: ApplicationDetail }>(`/applications/${id}`, body),
    onSuccess: ({ application }) => qc.setQueryData(detailKey(id), application),
    onSettled: () => refreshAll(qc),
  });
}

export function useDeleteApplication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del(`/applications/${id}`),
    onSuccess: () => qc.removeQueries({ queryKey: detailKey(id) }),
    onSettled: () => refreshAll(qc),
  });
}

export interface NewInterview {
  scheduledAt: string;
  type: InterviewType;
  notes?: string;
}

export function useCreateInterview(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewInterview) =>
      post<{ interview: Interview }>(`/applications/${applicationId}/interviews`, body),
    onSettled: () => refreshAll(qc),
  });
}

export function useDeleteInterview(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (interviewId: string) =>
      del(`/applications/${applicationId}/interviews/${interviewId}`),
    onSettled: () => refreshAll(qc),
  });
}
