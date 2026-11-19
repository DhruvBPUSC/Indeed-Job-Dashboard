import { ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router';

import { formatDate } from '../../lib/format';
import type { RecentApplication } from '../../lib/types';
import { CompanyBadge } from '../ui/CompanyBadge';
import { StatusBadge } from '../ui/StatusBadge';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700';

export function RecentApplications({ applications }: { applications: RecentApplication[] }) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-heading" className="text-lg font-bold text-slate-900">
          Recent Applications
        </h2>
        <Link
          to="/applications"
          className={`rounded px-1 text-sm font-semibold text-blue-800 hover:underline ${focusRing}`}
        >
          View All
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
          <FileText aria-hidden="true" className="size-8 text-slate-400" />
          <p className="font-semibold text-slate-900">No applications yet</p>
          <p className="text-sm text-slate-600">
            Search for a job above, then mark it as applied to start tracking it here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Job Title
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">
                  Company
                </th>
                <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                  Date Applied
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="w-12 px-2 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {applications.map((app) => (
                <tr key={app.id} className="transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CompanyBadge company={app.company} size="sm" />
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900">{app.jobTitle}</span>
                        {/* Company moves under the title when its column is hidden. */}
                        <span className="block text-slate-600 sm:hidden">{app.company}</span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-700 sm:table-cell">{app.company}</td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-slate-700 md:table-cell">
                    {formatDate(app.dateApplied)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Link
                      to={`/applications/${app.id}`}
                      aria-label={`View ${app.jobTitle} at ${app.company}`}
                      className={`inline-flex size-11 items-center justify-center rounded-lg text-blue-800 hover:bg-blue-50 ${focusRing}`}
                    >
                      <ChevronRight aria-hidden="true" className="size-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function RecentApplicationsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
      <div className="flex flex-col divide-y divide-slate-200 rounded-xl border border-slate-200">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex h-17 items-center gap-4 px-4">
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
