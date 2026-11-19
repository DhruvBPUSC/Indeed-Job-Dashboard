import { Bell, Menu, Search, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

const iconButton =
  'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    void navigate(q ? `/jobs?q=${encodeURIComponent(q)}` : '/jobs');
  };

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

      <form role="search" onSubmit={onSubmit} className="relative min-w-0 flex-1 lg:max-w-2xl">
        <label htmlFor="job-search" className="sr-only">
          Search jobs
        </label>
        <input
          id="job-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs, companies, or keywords..."
          className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pr-12 pl-4 text-sm text-slate-900 transition-colors duration-150 placeholder:text-slate-500 hover:border-slate-400 focus:outline-2 focus:outline-offset-1 focus:outline-blue-700"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-r-lg text-slate-600 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <Search aria-hidden="true" className="size-5" />
        </button>
      </form>

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
