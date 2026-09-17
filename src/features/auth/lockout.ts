/**
 * Failed sign-ins, and the lock after five of them (AUTH-04).
 *
 * **Counted per address, on the real clock**, because a lock is about now: the
 * fixture clock is the instant the record was drawn, and fifteen minutes of
 * lock measured against it would never run out.
 *
 * **Not record data, and not part of a session.** It exists before anybody
 * signs in and outlives a sign-out, as a real lock does; a reload clears it,
 * as it clears everything in this build.
 */
export const ATTEMPTS_BEFORE_LOCK = 5
export const LOCK_MINUTES = 15

interface Attempts {
  failures: number
  lockedUntil: number | undefined
}

const byAddress = new Map<string, Attempts>()

const key = (address: string) => address.trim().toLowerCase()

export type LockState =
  { kind: 'open'; failures: number } | { kind: 'locked'; until: number }

export function lockState(address: string, at: number = Date.now()): LockState {
  const entry = byAddress.get(key(address))
  if (entry === undefined) return { kind: 'open', failures: 0 }
  if (entry.lockedUntil !== undefined) {
    if (entry.lockedUntil > at) return { kind: 'locked', until: entry.lockedUntil }
    byAddress.delete(key(address))
    return { kind: 'open', failures: 0 }
  }
  return { kind: 'open', failures: entry.failures }
}

/** Records a refused attempt, and locks the address on the fifth. */
export function recordFailure(address: string, at: number = Date.now()): LockState {
  const entry = byAddress.get(key(address)) ?? { failures: 0, lockedUntil: undefined }
  entry.failures += 1
  if (entry.failures >= ATTEMPTS_BEFORE_LOCK)
    entry.lockedUntil = at + LOCK_MINUTES * 60_000
  byAddress.set(key(address), entry)
  return lockState(address, at)
}

/** A sign-in that got through clears the count. */
export function clearFailures(address: string): void {
  byAddress.delete(key(address))
}

/** For tests: every address open again. */
export function resetLockouts(): void {
  byAddress.clear()
}
