import { afterEach, describe, expect, it } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import {
  PIN_LOCK_MINUTES,
  checkMedicationPin,
  resetMedicationPins,
  setMedicationPin,
} from './medication-pins'

afterEach(resetMedicationPins)

describe('the medication PIN', () => {
  it('holds nothing to check for somebody who chose no PIN this session', () => {
    expect(checkMedicationPin(staffEze.id, '0000')).toEqual({ kind: 'not_held' })
  })

  it('confirms a held PIN entered correctly', () => {
    setMedicationPin(staffAkinyemi.id, '4827')
    expect(checkMedicationPin(staffAkinyemi.id, '4827')).toEqual({ kind: 'confirmed' })
  })

  it('locks a held PIN after five wrong, on the real clock, and opens again after', () => {
    setMedicationPin(staffAkinyemi.id, '4827')
    const at = 1_000_000
    for (const left of [4, 3, 2, 1])
      expect(checkMedicationPin(staffAkinyemi.id, '1111', at)).toEqual({
        kind: 'wrong',
        left,
      })
    expect(checkMedicationPin(staffAkinyemi.id, '1111', at)).toEqual({
      kind: 'locked',
      until: at + PIN_LOCK_MINUTES * 60_000,
    })
    // Locked means locked: the right PIN does not get through either.
    expect(checkMedicationPin(staffAkinyemi.id, '4827', at + 60_000).kind).toBe(
      'locked',
    )
    expect(
      checkMedicationPin(staffAkinyemi.id, '4827', at + PIN_LOCK_MINUTES * 60_000 + 1),
    ).toEqual({ kind: 'confirmed' })
  })
})
