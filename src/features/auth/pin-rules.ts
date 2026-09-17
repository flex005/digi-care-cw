/**
 * What a medication PIN has to be (AUTH-02): four digits, not 0000, not 1234,
 * and not the person's birth year.
 *
 * **The birth year cannot be checked, and the screen says so.** No staff
 * member's date of birth is held anywhere in this build, so there is nothing
 * to compare against. A rule shown as met when it was never tested would be a
 * tick nobody earned.
 */
export interface PinRule {
  id: 'four_digits' | 'not_obvious' | 'matches'
  says: string
  met: (pin: string, confirm: string) => boolean
}

const OBVIOUS = new Set(['0000', '1234'])

export const PIN_RULES: PinRule[] = [
  {
    id: 'four_digits',
    says: 'Four digits',
    met: (pin) => /^\d{4}$/.test(pin),
  },
  {
    id: 'not_obvious',
    says: 'Not 0000 or 1234',
    met: (pin) => /^\d{4}$/.test(pin) && !OBVIOUS.has(pin),
  },
  {
    id: 'matches',
    says: 'Both entries match',
    met: (pin, confirm) => pin.length === 4 && pin === confirm,
  },
]

export const PIN_CANNOT_CHECK =
  'Your birth year cannot be checked: no date of birth is held.'

export const pinReady = (pin: string, confirm: string): boolean =>
  PIN_RULES.every((rule) => rule.met(pin, confirm))
