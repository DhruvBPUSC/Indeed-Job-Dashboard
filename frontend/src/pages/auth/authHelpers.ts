import { useLocation } from 'react-router';

/** Where to go after signing in: the page that sent us here, if it's a path in this app. */
export function useReturnTo(): string {
  const from = (useLocation().state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export const submitButtonClass =
  'flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-700 px-4 font-semibold text-white transition-colors duration-150 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-70';

export const authLinkClass =
  'rounded font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';
