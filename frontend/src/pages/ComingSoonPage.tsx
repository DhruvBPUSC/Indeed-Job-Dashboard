import { Construction } from 'lucide-react';
import { Link } from 'react-router';

/** Stand-in for screens that are designed in the mockup but not built yet. */
export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-6 py-16 text-center">
        <Construction aria-hidden="true" className="size-8 text-slate-400" />
        <p className="font-semibold text-slate-900">This page is coming soon</p>
        <Link
          to="/"
          className="rounded text-sm font-semibold text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
