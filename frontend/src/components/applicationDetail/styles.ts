export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export const secondaryButton = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors duration-150 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 ${focusRing}`;

export const primaryButton = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70 ${focusRing}`;

export const dangerButton = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-800 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700`;

export const fieldClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700';
