import { ChevronRight, LogOut, UserRound } from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router';

import { useCurrentUser, useLogout } from '../../auth/auth';
import { APP_NAME } from '../../config/brand';
import { NAV_ITEMS } from './navItems';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

/** Sidebar contents, shared by the desktop column and the mobile drawer. */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const signOut = () => {
    logout.mutate(undefined, { onSettled: () => void navigate('/login', { replace: true }) });
  };

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        to="/"
        onClick={onNavigate}
        className={`rounded-md px-3 pt-2 text-2xl font-extrabold tracking-tight text-blue-800 ${focusRing}`}
      >
        {APP_NAME}
      </Link>

      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${focusRing} ${
                    isActive
                      ? 'bg-blue-100 font-semibold text-blue-900'
                      : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                  }`
                }
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-3 px-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <UserRound aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <Link
              to="/profile"
              onClick={onNavigate}
              className={`inline-flex items-center gap-0.5 rounded text-xs font-medium text-slate-600 hover:text-blue-800 hover:underline ${focusRing}`}
            >
              Edit Profile
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={logout.isPending}
          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
        >
          <LogOut aria-hidden="true" className="size-5" />
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
