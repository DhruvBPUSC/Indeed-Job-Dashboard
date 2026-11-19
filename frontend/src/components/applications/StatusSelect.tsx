import { ChevronDown } from 'lucide-react';

import { STATUS_STYLES } from '../../lib/status';
import type { ApplicationStatus } from '../../lib/types';

const STATUSES = Object.keys(STATUS_STYLES) as ApplicationStatus[];

interface StatusSelectProps {
  value: ApplicationStatus;
  label: string;
  disabled?: boolean;
  onChange: (status: ApplicationStatus) => void;
}

/** Native select (keyboard and screen-reader friendly) styled as the status badge it replaces. */
export function StatusSelect({ value, label, disabled, onChange }: StatusSelectProps) {
  const { className } = STATUS_STYLES[value];
  return (
    <div className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ApplicationStatus)}
        className={`min-h-11 cursor-pointer appearance-none rounded-full py-1 pr-8 pl-3 text-xs font-semibold ring-1 ring-inset transition-colors duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60 ${className}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_STYLES[s].label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
      />
    </div>
  );
}
