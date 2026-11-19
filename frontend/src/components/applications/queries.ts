import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { get, patch } from '../../lib/api';
import type {
  ApplicationListItem,
  ApplicationStatus,
  ListResponse,
  StatusCounts,
} from '../../lib/types';

export type SortKey = 'dateApplied' | 'updatedAt' | 'company';

export interface ListParams {
  statuses: ApplicationStatus[];
  q: string;
  sort: SortKey;
  order: 'asc' | 'desc';
  page: number;
}

export const PAGE_SIZE = 20;

export function useApplicationsList(params: ListParams) {
  const search = new URLSearchParams({
    status: params.statuses.join(','),
    sort: params.sort,
    order: params.order,
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
  });
  if (params.q) search.set('q', params.q);

  return useQuery({
    queryKey: ['applications', 'list', params],
    queryFn: () => get<ListResponse<ApplicationListItem>>(`/applications?${search.toString()}`),
    // Keep showing the current rows while the next page or filter loads (no layout jump).
    placeholderData: keepPreviousData,
  });
}

/** Per-status counts for the tab badges, using the same search as the list. */
export function useStatusCounts(q: string) {
  const search = q ? `?${new URLSearchParams({ q }).toString()}` : '';
  return useQuery({
    queryKey: ['applications', 'stats', q],
    queryFn: () => get<StatusCounts>(`/applications/stats/by-status${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus; jobTitle: string }) =>
      patch<{ application: unknown }>(`/applications/${id}`, { status }),
    // Lists, tab counts, and dashboard cards all depend on statuses.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['applications'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]),
  });
}
