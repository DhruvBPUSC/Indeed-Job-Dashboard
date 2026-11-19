import type { ReactNode } from 'react';

interface SectionProps {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

/** A titled card; the heading labels the section for screen-reader navigation. */
export function Section({ id, title, action, children }: SectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={id} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
