import { vi } from 'vitest'

/*
 * **The clock, pinned to a full instant before any fixture loads**: 16/09/2026
 * at 20:20 BST, inside the 20:00 round's window, when Arthur Pemberton's
 * oxycodone is still to give (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T19:20:00Z')
})

import { beforeEach, describe, expect, it } from 'vitest'
import type {
  IsoDate,
  IsoDateTime,
  MedicationId,
  ResidentId,
  StaffRef,
} from '@/data/types'
import { staffAkinyemi, staffEze, staffNwosu } from '@/data/fixtures/organisation'
import { countersignControlledDrug, recordRound } from '@/data/access/client'
import { patchedRecords } from '@/data/access/mar-store'
import { endSession } from '@/data/access/session-losses'

/**
 * Who records and who countersigns a controlled drug, asked of the loader with
 * no screen in front of it. CW PRD Table 3, "Medications — countersign
 * controlled drugs: Both must be Senior+", and MED-03: "Senior 1 records
 * administration + stock count … Senior 2 taps Countersign".
 *
 * Every case is paired with the same call made by somebody who may, so a
 * refusal is shown to be about the person rather than the dose.
 */

const PEMBERTON = 'res-pemberton' as ResidentId
const OXYCODONE = 'med-res-pemberton-oxycodone-modified-release' as MedicationId
const DAY = '2026-09-16' as IsoDate
const ROUND = '20:00'
const AT = '2026-09-16T19:20:00.000Z' as IsoDateTime

beforeEach(() => endSession())

const stateOf = () => {
  const record = patchedRecords().find(
    (entry) =>
      entry.medicationId === OXYCODONE &&
      entry.date === DAY &&
      entry.roundTime === ROUND,
  )
  if (record === undefined) throw new Error('No 20:00 record for Pemberton’s oxycodone')
  return record.state
}

const give = (by: StaffRef) =>
  recordRound({
    residentId: PEMBERTON,
    date: DAY,
    roundTime: ROUND,
    doses: [
      {
        medicationId: OXYCODONE,
        state: {
          kind: 'given',
          givenAt: AT,
          givenBy: by,
          witness: { kind: 'required_not_recorded' },
        },
      },
    ],
    openingCounts: [],
    by,
    at: AT,
  })

const countersign = (by: StaffRef) =>
  countersignControlledDrug({
    medicationId: OXYCODONE,
    date: DAY,
    roundTime: ROUND,
    by,
    at: AT,
  })

describe('recording a controlled drug dose', () => {
  it('refuses a care worker, on her own list, in the words of the rule', async () => {
    expect(stateOf().kind).toBe('due')
    await expect(give(staffEze)).rejects.toThrow(
      'A senior carer records controlled drugs.',
    )
    expect(stateOf().kind).toBe('due')

    await expect(give(staffAkinyemi)).resolves.toBe(1)
    expect(stateOf().kind).toBe('given')
  })
})

describe('countersigning a controlled drug dose', () => {
  it('refuses a care worker, and records nothing', async () => {
    await give(staffAkinyemi)
    await expect(countersign(staffEze)).rejects.toThrow(
      'Countersigning a controlled drug is for a senior carer.',
    )
    expect(stateOf()).toMatchObject({ witness: { kind: 'required_not_recorded' } })
  })

  it('leaves the dose half a record until a second senior carer signs, and never the giver', async () => {
    await give(staffAkinyemi)
    expect(stateOf()).toMatchObject({
      kind: 'given',
      givenBy: { id: staffAkinyemi.id },
      witness: { kind: 'required_not_recorded' },
    })

    await expect(countersign(staffAkinyemi)).rejects.toThrow(
      'The second signature has to be somebody other than the person who gave it',
    )
    await expect(countersign(staffEze)).rejects.toThrow()
    expect(stateOf()).toMatchObject({ witness: { kind: 'required_not_recorded' } })

    await countersign(staffNwosu)
    expect(stateOf()).toMatchObject({
      witness: { kind: 'witnessed', by: { id: staffNwosu.id } },
    })
  })
})
