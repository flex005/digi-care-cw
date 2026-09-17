/**
 * A lock's end as a person reads it: "20:35". On the real clock and in the
 * viewer's own zone, because a lock is about the device in their hand now,
 * not about a record at the home.
 */
export function formatClockTime(at: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(at)
}
