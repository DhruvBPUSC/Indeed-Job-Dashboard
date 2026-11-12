import { z } from 'zod';

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

/** Spread into a query schema: `z.object({ ...paginationQuery, ... })`. */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export interface PageParams {
  page: number;
  pageSize: number;
}

/** List response shape from CLAUDE.md. */
export interface ListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function toSkipTake({ page, pageSize }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
