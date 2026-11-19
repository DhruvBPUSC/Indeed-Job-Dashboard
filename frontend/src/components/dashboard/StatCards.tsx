import type { DashboardCounts } from '../../lib/types';

const CARDS: { key: keyof DashboardCounts; label: string }[] = [
  { key: 'total', label: 'Total Applications' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer / Next Steps' },
];

const cardClass = 'rounded-xl border border-slate-200 bg-white px-5 py-4';

export function StatCards({ counts }: { counts: DashboardCounts }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {CARDS.map(({ key, label }) => (
        <div key={key} className={`flex flex-col ${cardClass}`}>
          {/* Number first visually (as in the mockup), label first for screen readers. */}
          <dt className="mt-1 text-sm font-medium text-slate-600">{label}</dt>
          <dd className="order-first text-3xl font-bold text-slate-900 tabular-nums">
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function StatCardsSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {CARDS.map(({ key }) => (
        <div key={key} className={cardClass}>
          <div className="h-9 w-12 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-2 h-4 w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
