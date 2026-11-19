import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { del, get, patch, post } from '../../lib/api';
import type { JobType, JobWithApplication, ListResponse } from '../../lib/types';

export const JOBS_PAGE_SIZE = 20;

export interface JobSearchParams {
  q: string;
  jobType: JobType | null;
  page: number;
}

export function useJobs(params: JobSearchParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(JOBS_PAGE_SIZE),
  });
  if (params.q) search.set('q', params.q);
  if (params.jobType) search.set('jobType', params.jobType);

  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => get<ListResponse<JobWithApplication>>(`/jobs?${search.toString()}`),
    placeholderData: keepPreviousData,
  });
}

/** Saving or applying changes job cards, application lists, and dashboard counts. */
function useRefreshAfter() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['jobs'] }),
      qc.invalidateQueries({ queryKey: ['applications'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export function useSaveJob() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (job: JobWithApplication) =>
      post('/applications', { jobId: job.id, status: 'SAVED' }),
    onSettled: refresh,
  });
}

export function useUnsaveJob() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (job: JobWithApplication) => del(`/applications/${job.applicationId}`),
    onSettled: refresh,
  });
}

/** "I applied": creates the application, or moves a saved one to Applied. */
export function useMarkApplied() {
  const refresh = useRefreshAfter();
  return useMutation({
    mutationFn: (job: JobWithApplication) =>
      job.applicationId
        ? patch(`/applications/${job.applicationId}`, { status: 'APPLIED' })
        : post('/applications', { jobId: job.id, status: 'APPLIED' }),
    onSettled: refresh,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', 'detail', id],
    queryFn: async () => (await get<{ job: JobWithApplication }>(`/jobs/${id}`)).job,
  });
}
