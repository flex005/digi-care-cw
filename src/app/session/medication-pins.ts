import { held, type SessionHolding } from '@/data/access/session-holding'
import type { StaffId } from '@/data/types'

/**
 * Medication PINs chosen during this session, in memory and nowhere else.
 *
 * **Held, because a field that accepts input must hand it to something.** The
 * PIN chosen at account setup is what confirms a dose, a handover signature and
 * a risk assessment later; dropping it on the floor would be a control that
 * does nothing, dressed as one that does.
 *
 * Cleared when the session ends, with every other thing the session wrote, and
 * counted on the sign-out screen so the list of what would go is complete.
 */
const pins = new Map<StaffId, string>()

export function setMedicationPin(id: StaffId, pin: string): void {
  pins.set(id, pin)
}

export const hasChosenPin = (id: StaffId): boolean => pins.has(id)

export const medicationPinMatches = (id: StaffId, pin: string): boolean =>
  pins.get(id) === pin

/*
 * **Five wrong PINs lock the PIN for fifteen minutes** (CW PRD MED-02), counted
 * per person on the real clock, as the sign-in lock is: a lock is about now,
 * and fifteen minutes measured against the fixture clock would never run out.
 * Only a PIN this session holds can be wrong, so only that PIN can lock.
 */
export const PIN_ATTEMPTS_BEFORE_LOCK = 5
export const PIN_LOCK_MINUTES = 15

const failures = new Map<StaffId, { count: number; lockedUntil: number | undefined }>()

/**
 * What entering four digits as the medication PIN does.
 *
 * - `confirmed`: the PIN this session holds for the person, entered correctly.
 * - `not_held`: nobody chose a PIN for this person this session, so there is
 *   nothing to check against and any four digits confirm. **The screen says so
 *   before anybody types**, as the six-digit code does.
 * - `wrong`: a held PIN, entered wrongly, with how many tries are left.
 * - `locked`: five wrong, and the time it opens again.
 */
export type PinCheck =
  | { kind: 'confirmed' }
  | { kind: 'not_held' }
  | { kind: 'wrong'; left: number }
  | { kind: 'locked'; until: number }

export function pinLock(id: StaffId, at: number = Date.now()): PinCheck | undefined {
  const entry = failures.get(id)
  if (entry?.lockedUntil === undefined) return undefined
  if (entry.lockedUntil > at) return { kind: 'locked', until: entry.lockedUntil }
  failures.delete(id)
  return undefined
}

export function checkMedicationPin(
  id: StaffId,
  pin: string,
  at: number = Date.now(),
): PinCheck {
  if (!/^\d{4}$/.test(pin)) throw new Error('A medication PIN is four digits.')
  if (!pins.has(id)) return { kind: 'not_held' }
  const locked = pinLock(id, at)
  if (locked) return locked
  if (pins.get(id) === pin) {
    failures.delete(id)
    return { kind: 'confirmed' }
  }
  const entry = failures.get(id) ?? { count: 0, lockedUntil: undefined }
  entry.count += 1
  if (entry.count >= PIN_ATTEMPTS_BEFORE_LOCK)
    entry.lockedUntil = at + PIN_LOCK_MINUTES * 60_000
  failures.set(id, entry)
  return entry.lockedUntil === undefined
    ? { kind: 'wrong', left: PIN_ATTEMPTS_BEFORE_LOCK - entry.count }
    : { kind: 'locked', until: entry.lockedUntil }
}

export const pinHoldings = (): SessionHolding[] =>
  held('medication PINs you chose', pins.size)

export function resetMedicationPins(): void {
  pins.clear()
  failures.clear()
}
