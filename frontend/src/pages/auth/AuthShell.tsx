import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useCurrentUser } from '../../auth/auth';
import { APP_NAME } from '../../config/brand';
import { useReturnTo } from './authHelpers';

interface AuthShellProps {
  title: string;
  subtitle: string;
  formError?: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, formError, children, footer }: AuthShellProps) {
  const { data: user } = useCurrentUser();
  const returnTo = useReturnTo();
  if (user) return <Navigate to={returnTo} replace />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-4 py-10 font-sans text-slate-900">
      <main className="w-full max-w-md">
        <p className="mb-6 text-center text-3xl font-extrabold tracking-tight text-blue-800">
          {APP_NAME}
        </p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-slate-600">{subtitle}</p>
          {formError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"
            >
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {formError}
            </div>
          )}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-700">{footer}</p>
        <p className="mt-8 text-center text-xs text-slate-600">
          A student concept project. Not affiliated with or endorsed by Indeed.
        </p>
      </main>
    </div>
  );
}
