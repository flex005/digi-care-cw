/**
 * How long a session may sit idle before it ends (AUTH-09).
 *
 * **Twelve hours, as the Care Worker PRD sets it for the web**, where the Admin
 * build's governance screens use eight. A care worker leaves a tablet on a
 * trolley between tasks for longer than a manager leaves a desk.
 *
 * **`?timeout=<minutes>` shortens it**, read once when the page loads, so the
 * warning and the end of a session can be reviewed without waiting twelve
 * hours: `?timeout=11` shows the warning within a minute. Like `?at=`, it is
 * in the address rather than in storage, so it is visible and nobody leaves it
 * switched on by accident.
 */
export const SESSION_TIMEOUT_MINUTES = 12 * 60
export const WARN_WITHIN_MINUTES = 10

/**
 * **Read from the address the page was loaded at, by the session provider on
 * its first render**, never by whatever screen asks later. This first read the
 * parameter when the shell's module loaded, which is after signing in has
 * navigated twice and the address no longer carries it: `?timeout=10` did
 * nothing, and a screenshot of the warning timed out waiting for it.
 */
export function requestedMinutes(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('timeout')
  if (raw === null) return undefined
  const minutes = Number(raw)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined
}
