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
