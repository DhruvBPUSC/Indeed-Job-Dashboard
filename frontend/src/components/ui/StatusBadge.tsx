import { STATUS_STYLES } from '../../lib/status';
import type { ApplicationStatus } from '../../lib/types';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
