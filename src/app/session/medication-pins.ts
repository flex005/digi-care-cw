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

export const pinHoldings = (): SessionHolding[] =>
  held('medication PINs you chose', pins.size)

export function resetMedicationPins(): void {
  pins.clear()
}
