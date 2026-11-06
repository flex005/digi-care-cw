/**
 * The credential's name, wherever a screen says it. **One owner**, because
 * CLAUDE.md §6 fixes it ("the medication PIN is named the medication PIN") and
 * a name retyped at each call site can be retyped wrong: a rename on the phone
 * once turned it into "drug PIN" inside a string, and the test agreed because
 * it compared the same constant.
 */
export const MEDICATION_PIN = 'medication PIN'

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
