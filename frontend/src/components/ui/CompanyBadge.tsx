// Full class strings (not built dynamically) so Tailwind can see them.
const COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-900',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-900',
  'bg-indigo-100 text-indigo-800',
  'bg-orange-100 text-orange-900',
];

/** "Best Buy" -> "BB", "T-Mobile" -> "TM", "Amazon" -> "AM". */
function initials(company: string): string {
  const words = company.split(/[\s\-&.,/]+/).filter((w) => /[a-z0-9]/i.test(w));
  const letters =
    words.length >= 2
      ? (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')
      : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase();
}

/** Same company, same color, on every page. */
function colorFor(company: string): string {
  let hash = 0;
  for (const ch of company) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0]!;
}

/**
 * Initials stand-in for a company logo: quick to scan, no third-party logo service. Decorative,
 * because the company name is always shown next to it.
 */
export function CompanyBadge({ company, size = 'md' }: { company: string; size?: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold ${colorFor(company)} ${
        size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'
      }`}
    >
      {initials(company)}
    </span>
  );
}
