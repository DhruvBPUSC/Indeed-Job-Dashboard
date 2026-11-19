import { Bell, Menu, UserRound } from 'lucide-react';
import { Link } from 'react-router';

import { JobSearchBox } from './JobSearchBox';

const iconButton =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:gap-3 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className={`${iconButton} lg:hidden`}
      >
        <Menu aria-hidden="true" className="size-6" />
      </button>

      <JobSearchBox />

      <div className="ml-auto flex items-center gap-1">
        <Link to="/notifications" aria-label="Notifications" className={iconButton}>
          <Bell aria-hidden="true" className="size-5" />
        </Link>
        <Link to="/profile" aria-label="Your profile" className={iconButton}>
          <UserRound aria-hidden="true" className="size-5" />
        </Link>
      </div>
    </header>
  );
}
