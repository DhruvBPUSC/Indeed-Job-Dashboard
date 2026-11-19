import { X } from 'lucide-react';
import { useRef } from 'react';
import { Outlet } from 'react-router';

import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** Sidebar + top bar around every signed-in page. Below `lg` the sidebar becomes a drawer. */
export function AppLayout() {
  const drawer = useRef<HTMLDialogElement>(null);
  const closeDrawer = () => drawer.current?.close();

  return (
    <div className="flex min-h-dvh bg-slate-100 font-sans text-slate-900">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-slate-200 bg-slate-50 lg:block">
        <Sidebar />
      </aside>

      {/* Native modal dialog: traps focus, closes on Escape, and restores focus on close. */}
      <dialog
        ref={drawer}
        aria-label="Menu"
        onClick={(e) => e.target === e.currentTarget && closeDrawer()}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-slate-50 backdrop:bg-slate-900/40 lg:hidden"
      >
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Close menu"
          className="absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-lg text-slate-700 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
        <Sidebar onNavigate={closeDrawer} />
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => drawer.current?.showModal()} />
        <main className="flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
