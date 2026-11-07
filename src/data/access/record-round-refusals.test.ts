import { vi } from 'vitest'

/*
 * **The clock, pinned to a full instant before any fixture loads**: 16/09/2026
 * at 20:20 BST, twenty minutes into the 20:00 round, so its window is open and
 * the fixtures have signed for half of it already. A pin that named only the
 * hour would take today's date and the machine's zone (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T19:20:00Z')
})

import { beforeEach, describe, expect, it } from 'vitest'
import type {
  IsoDateTime,
  MarCellState,
  MedicationId,
  ResidentId,
  StaffRef,
} from '@/data/types'
import { GAP_MEDICATION_IDS, medications } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { openDosesAt, recordRound } from '@/data/access/client'
import { patchedRecords } from '@/data/access/mar-store'
import { endSession } from '@/data/access/session-losses'
import { memberById } from '@/data/access/team-store'
import { residentScopeFor } from '@/app/session/resident-scope'
import { scopeReaches } from '@/app/session/resident-scope'
import { DISCREPANCY_LINE } from '@/features/medications/medication-words'
import { zonedDate } from '@/lib/format'

/**
 * The round's rules, asked of the loader with no screen in front of it.
 *
 * **A rule held by a screen is held only on that screen.** Each case here
 * sends the loader something the round screen would never send, and each is
 * paired with the same call made properly, so a refusal is shown to be about
 * the defect rather than about the round.
 */

const ROUND = '20:00'
const AT = now().toISOString() as IsoDateTime
const TODAY = zonedDate(AT, 'Europe/London')
const OKAFOR = 'res-okafor' as ResidentId
const MORPHINE = GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy

beforeEach(() => endSession())

const recordOf = (medicationId: MedicationId) => {
  const record = patchedRecords().find(
    (entry) =>
      entry.medicationId === medicationId &&
      entry.date === TODAY &&
      entry.roundTime === ROUND,
  )
  if (record === undefined) throw new Error(`No ${ROUND} record for ${medicationId}`)
  return record
}

const medicationOf = (id: MedicationId) => {
  const found = medications.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No medication ${id}`)
  return found
}

const refused = (by: StaffRef): MarCellState => ({
  kind: 'not_given',
  reason: 'resident_refused',
  note: '',
  recordedAt: AT,
  recordedBy: by,
})

const given = (by: StaffRef): MarCellState => ({
  kind: 'given',
  givenAt: AT,
  givenBy: by,
  witness: { kind: 'not_required' },
})

/** Every open dose at this round for a resident, answered "refused" by the signer. */
const wholeRound = (residentId: ResidentId, by: StaffRef) =>
  openDosesAt(residentId, TODAY, ROUND).map((medicationId) => ({
    medicationId,
    state: refused(by),
  }))

const send = (
  residentId: ResidentId,
  doses: { medicationId: MedicationId; state: MarCellState }[],
  by: StaffRef = staffAkinyemi,
  at: IsoDateTime = AT,
) =>
  recordRound({
    residentId,
    date: TODAY,
    roundTime: ROUND,
    doses,
    openingCounts: [],
    by,
    at,
  })

/** A resident at this round with a dose already recorded and none controlled. */
function withARecordedDose(): { residentId: ResidentId; recorded: MedicationId } {
  for (const resident of residents) {
    const open = openDosesAt(resident.id, TODAY, ROUND)
    const done = patchedRecords().find(
      (record) =>
        record.residentId === resident.id &&
        record.date === TODAY &&
        record.roundTime === ROUND &&
        record.state.kind === 'given' &&
        !medicationOf(record.medicationId).isPrn,
    )
    const anyControlled = open.some((id) => medicationOf(id).isControlledDrug)
    if (done !== undefined && open.length > 0 && !anyControlled)
      return { residentId: resident.id, recorded: done.medicationId }
  }
  throw new Error(`No resident at ${ROUND} has one dose recorded and another open`)
}

/** A resident with open doses at this round, none of them controlled. */
function openNonControlled(): ResidentId {
  const found = residents.find((resident) => {
    const open = openDosesAt(resident.id, TODAY, ROUND)
    return open.length > 0 && open.every((id) => !medicationOf(id).isControlledDrug)
  })
  if (found === undefined)
    throw new Error(`Nobody has only non-controlled doses open at ${ROUND}`)
  return found.id
}

/** N. Eze's list, from the one owner of what a list reaches. */
function onEzesList(residentId: ResidentId): boolean {
  const member = memberById(staffEze.id)
  if (member === undefined) throw new Error('N. Eze is not on the team')
  const scope = residentScopeFor(member)
  return scope.kind !== 'not_decided' && scopeReaches(scope, residentId)
}

/** A resident off N. Eze's list with open doses at this round, none controlled. */
function offEzesList(): ResidentId {
  const found = residents.find((resident) => {
    const open = openDosesAt(resident.id, TODAY, ROUND)
    return (
      open.length > 0 &&
      open.every((id) => !medicationOf(id).isControlledDrug) &&
      !onEzesList(resident.id)
    )
  })
  if (found === undefined) throw new Error('Nobody off N. Eze’s list has an open dose')
  return found.id
}

describe('the fixtures reach the states this file is about', () => {
  it('has Okafor’s morphine open at 20:00, with a count that does not reconcile', () => {
    expect(recordOf(MORPHINE).state.kind).toBe('due')
  })
})

/*
 * **The helpers above ask `openDosesAt` which doses are open**, the list
 * `recordRound` refuses by, so they agree with whatever it believes. These two
 * stand without it. The first checks it against the raw records; the second,
 * the whole-round refusal, names its resident and doses as literals and asks no
 * helper at all (PROGRESS.md, 06/11/2026, helper verdict 6).
 */
describe('openDosesAt, against the raw records', () => {
  it('is every dose due or omitted at the round, never one with nothing due and never an as-required drug, for everybody today', () => {
    const prn = new Set(
      medications.filter((entry) => entry.isPrn).map((entry) => entry.id),
    )
    const today = patchedRecords().filter((record) => record.date === TODAY)
    const people = [...new Set(today.map((record) => record.residentId))]
    let compared = 0
    for (const person of people)
      for (const round of ['08:00', '14:00', '18:00', '20:00']) {
        const raw = today
          .filter(
            (record) =>
              record.residentId === person &&
              record.roundTime === round &&
              (record.state.kind === 'due' || record.state.kind === 'omitted') &&
              !prn.has(record.medicationId),
          )
          .map((record) => record.medicationId)
          .sort()
        expect(
          [...openDosesAt(person, TODAY, round)].sort(),
          `${person} at ${round}`,
        ).toEqual(raw)
        compared += 1
      }
    expect(compared).toBeGreaterThan(80)
  })

  it('names an omitted dose, and leaves out a patch on its day off', () => {
    // Adeyemi's 08:00 metformin closed with nothing recorded: still open.
    expect(openDosesAt('res-adeyemi' as ResidentId, '2026-09-16', '08:00')).toEqual([
      'med-res-adeyemi-metformin',
    ])
    // Kavanagh's 08:00 doses are recorded, and her fentanyl patch is changed
    // every third day: today it is not due, so nothing at 08:00 is open.
    expect(openDosesAt('res-kavanagh' as ResidentId, '2026-09-16', '08:00')).toEqual([])
  })
})

describe('a round is recorded whole', () => {
  it('refuses Vera Lonsdale’s 20:00 round with one of its two doses unanswered, records nothing, and takes it whole', async () => {
    const lonsdale = 'res-lonsdale' as ResidentId
    const donepezil = 'med-res-lonsdale-donepezil' as MedicationId
    const atorvastatin = 'med-res-lonsdale-atorvastatin' as MedicationId
    const at = '2026-09-16T19:20:00.000Z' as IsoDateTime
    const declined = {
      kind: 'not_given',
      reason: 'resident_refused',
      note: '',
      recordedAt: at,
      recordedBy: staffAkinyemi,
    } as const
    const round = (doses: MedicationId[]) =>
      recordRound({
        residentId: lonsdale,
        date: '2026-09-16',
        roundTime: '20:00',
        doses: doses.map((medicationId) => ({ medicationId, state: declined })),
        openingCounts: [],
        by: staffAkinyemi,
        at,
      })
    const stateOf = (medicationId: MedicationId) =>
      patchedRecords().find(
        (record) =>
          record.medicationId === medicationId &&
          record.date === '2026-09-16' &&
          record.roundTime === '20:00',
      )?.state.kind

    expect(stateOf(donepezil)).toBe('due')
    expect(stateOf(atorvastatin)).toBe('due')
    await expect(round([donepezil])).rejects.toThrow(
      'This round is short 1 of 2 doses: answer every dose before recording it.',
    )
    expect(stateOf(donepezil)).toBe('due')
    expect(stateOf(atorvastatin)).toBe('due')

    await expect(round([donepezil, atorvastatin])).resolves.toBe(2)
    expect(stateOf(donepezil)).toBe('not_given')
    expect(stateOf(atorvastatin)).toBe('not_given')
  })
})

describe('recordRound refuses what the round screen refuses', () => {
  it('never writes over a dose already on the record, and leaves it as it was', async () => {
    const { residentId, recorded } = withARecordedDose()
    const before = recordOf(recorded).state
    await expect(
      send(residentId, [
        ...wholeRound(residentId, staffAkinyemi),
        { medicationId: recorded, state: refused(staffAkinyemi) },
      ]),
    ).rejects.toThrow(
      /already recorded as given.*A recorded dose is never written over/,
    )
    expect(recordOf(recorded).state).toEqual(before)
    const stillOpen = openDosesAt(residentId, TODAY, ROUND).length
    await expect(send(residentId, wholeRound(residentId, staffAkinyemi))).resolves.toBe(
      stillOpen,
    )
  })

  it('never writes over a dose this session recorded a moment ago', async () => {
    const residentId = openNonControlled()
    await send(residentId, wholeRound(residentId, staffAkinyemi))
    const [first] = patchedRecords().filter(
      (record) =>
        record.residentId === residentId &&
        record.date === TODAY &&
        record.roundTime === ROUND &&
        record.state.kind === 'not_given',
    )
    if (first === undefined) throw new Error('Nothing was recorded')
    await expect(
      send(
        residentId,
        [{ medicationId: first.medicationId, state: given(staffOsei) }],
        staffOsei,
      ),
    ).rejects.toThrow(/already recorded as not given, by T\. Akinyemi/)
    expect(recordOf(first.medicationId).state.kind).toBe('not_given')
  })

  it('records nothing before the window opens, and the same answers once it has', async () => {
    const residentId = openNonControlled()
    const [medicationId] = openDosesAt(residentId, TODAY, ROUND)
    const state = recordOf(medicationId as MedicationId).state
    if (state.kind !== 'due') throw new Error('Not due')
    const early = new Date(
      new Date(state.windowOpensAt).getTime() - 600_000,
    ).toISOString() as IsoDateTime
    await expect(
      send(residentId, wholeRound(residentId, staffAkinyemi), staffAkinyemi, early),
    ).rejects.toThrow(/cannot be recorded before its window opens/)
    expect(openDosesAt(residentId, TODAY, ROUND)).toContain(medicationId)
    await expect(
      send(residentId, wholeRound(residentId, staffAkinyemi)),
    ).resolves.toBeGreaterThan(0)
  })

  it('asks the role table about the signer: a care worker off her list is told the PRD does not say', async () => {
    const off = offEzesList()
    await expect(send(off, wholeRound(off, staffEze), staffEze)).rejects.toThrow(
      /N\. Eze may not record .*does not say whether for .* not on their list/,
    )
    expect(openDosesAt(off, TODAY, ROUND).length).toBeGreaterThan(0)
    await expect(send(off, wholeRound(off, staffAkinyemi))).resolves.toBeGreaterThan(0)
  })

  it('refuses a care worker a controlled drug on her own list, saying who records one, and lets a senior carer record it', async () => {
    expect(onEzesList(OKAFOR)).toBe(true)
    await expect(send(OKAFOR, wholeRound(OKAFOR, staffEze), staffEze)).rejects.toThrow(
      'may not record Morphine sulfate oral solution at 20:00 for Emmanuel Okafor: A senior carer records controlled drugs.',
    )
    await expect(
      send(OKAFOR, wholeRound(OKAFOR, staffAkinyemi)),
    ).resolves.toBeGreaterThan(0)
  })

  it('will not record Given on a controlled drug whose count does not reconcile, in MED-03’s words', async () => {
    const doses = wholeRound(OKAFOR, staffAkinyemi).map((dose) =>
      dose.medicationId === MORPHINE ? { ...dose, state: given(staffAkinyemi) } : dose,
    )
    const attempt = send(OKAFOR, doses)
    await expect(attempt).rejects.toThrow(DISCREPANCY_LINE)
    expect(recordOf(MORPHINE).state.kind).toBe('due')
  })

  it('will not record a dose signed in somebody else’s name', async () => {
    const residentId = openNonControlled()
    const doses = wholeRound(residentId, staffAkinyemi).map((dose, index) =>
      index === 0 ? { ...dose, state: refused(staffOsei) } : dose,
    )
    await expect(send(residentId, doses)).rejects.toThrow(
      /signed in K\. Osei’s name by T\. Akinyemi\. A dose is signed by the person recording it/,
    )
    expect(openDosesAt(residentId, TODAY, ROUND).length).toBe(
      wholeRound(residentId, staffAkinyemi).length,
    )
  })
})
