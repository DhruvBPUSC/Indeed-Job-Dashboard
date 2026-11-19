import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError, get, post } from '../lib/api';
import type { User } from '../lib/types';

export const ME_KEY = ['me'] as const;

/** The signed-in user, or null when signed out. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async (): Promise<User | null> => {
      try {
        return (await get<{ user: User }>('/me')).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => post<{ user: User }>('/auth/login', input),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => post<{ user: User }>('/auth/register', input),
    onSuccess: ({ user }) => {
      qc.clear();
      qc.setQueryData(ME_KEY, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<void>('/auth/logout'),
    // Drop every cached response so the next user never sees the previous user's data.
    onSettled: () => {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
    },
  });
}
