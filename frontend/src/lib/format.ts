const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** "2025-04-12T13:00:00.000Z" -> "Apr 12, 2025" (in the viewer's time zone). */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "Good morning" / "Good afternoon" / "Good evening" for the viewer's local time. */
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const DAY_MS = 86_400_000;

/** "Today", "Yesterday", "12 days ago", "3 months ago". */
export function timeAgo(iso: string, now = new Date()): string {
  const days = daysSince(iso, now);
  const text =
    days < 30 ? relative.format(-days, 'day') : relative.format(-Math.floor(days / 30), 'month');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Whole days between an ISO date and now (calendar days, viewer's time zone). */
export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Thu, Nov 21, 2:00 PM". */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
