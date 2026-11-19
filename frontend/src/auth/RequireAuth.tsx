import { Navigate, Outlet, useLocation } from 'react-router';

import { ErrorState } from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Spinner';
import { useCurrentUser } from './auth';

/** Renders child routes for signed-in users; sends everyone else to /login and back after. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useCurrentUser();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Loading your account" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <ErrorState message="We couldn't load your account." onRetry={() => void refetch()} />
      </div>
    );
  }
  if (!user) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return <Outlet />;
}
