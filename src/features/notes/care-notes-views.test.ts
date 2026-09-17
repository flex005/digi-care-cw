import { describe, expect, it } from 'vitest'
import type {
  CareNote,
  CareNoteId,
  IsoDateTime,
  Resident,
  ResidentId,
} from '@/data/types'
import { residentById } from '@/data/fixtures/residents'
import { staffEze, staffNwosu } from '@/data/fixtures/organisation'
import {
  CARE_NOTES_VIEWS,
  allNotes,
  authorCount,
  byShift,
  flaggedNotReviewed,
  notesToday,
  oldestFlag,
  shiftHasBegun,
  withoutNoteOnShift,
  withoutNoteToday,
  yourNotes,
} from './care-notes-views'

const ZONE = 'Europe/London'
const NOW = '2026-09-17T19:20:00.000Z' as IsoDateTime

const resident = (id: string): Resident => {
  const found = residentById(id as ResidentId)
  if (found === undefined) throw new Error(`no fixture ${id}`)
  return found
}
const okafor = resident('res-okafor')
const adeyemi = resident('res-adeyemi')
const hutchinson = resident('res-hutchinson')

let sequence = 0
function note(overrides: Partial<CareNote> & { residentId: ResidentId }): CareNote {
  sequence += 1
  return {
    id: `note-test-${sequence}` as CareNoteId,
    category: 'general',
    body: 'Settled.',
    mood: { kind: 'not_recorded' },
    recordedBy: staffNwosu,
    recordedAt: NOW,
    shift: { kind: 'auto', value: 'late' },
    review: { kind: 'not_flagged' },
    supersededBy: 'none',
    corrects: 'none',
    ...overrides,
  }
}

const flag = (at: string): CareNote['review'] => ({
  kind: 'flagged_not_reviewed',
  flaggedBy: staffNwosu,
  flaggedAt: at as IsoDateTime,
  reason: { kind: 'not_given' },
})

describe('the care notes views', () => {
  it('offers no view of a named colleague’s notes', () => {
    expect(CARE_NOTES_VIEWS.map((view) => view.label)).toEqual([
      'Flagged, not reviewed',
      'No note today',
      'Your notes',
      'By shift',
      'All notes',
    ])
  })

  it('puts the longest-waiting flag first, and says when it was raised', () => {
    const recent = note({
      residentId: okafor.id,
      review: flag('2026-09-17T08:00:00.000Z'),
    })
    const older = note({
      residentId: adeyemi.id,
      review: flag('2026-09-14T08:00:00.000Z'),
    })
    const unflagged = note({ residentId: okafor.id })
    const queue = flaggedNotReviewed([recent, unflagged, older], [okafor, adeyemi])
    expect(queue.map((item) => item.note.id)).toEqual([older.id, recent.id])
    expect(oldestFlag(queue)).toEqual({
      kind: 'waiting_since',
      at: '2026-09-14T08:00:00.000Z',
    })
    expect(oldestFlag([])).toEqual({ kind: 'nothing_waiting' })
  })

  it('leaves out notes about residents it was not given', () => {
    const elsewhere = note({ residentId: hutchinson.id, review: flag(NOW) })
    expect(flaggedNotReviewed([elsewhere], [okafor])).toEqual([])
    expect(allNotes([elsewhere], [okafor])).toEqual([])
  })

  it('lists nobody-ever-written-up first among residents with no note today', () => {
    const today = note({
      residentId: okafor.id,
      recordedAt: '2026-09-17T09:00:00.000Z' as IsoDateTime,
    })
    const yesterday = note({
      residentId: adeyemi.id,
      recordedAt: '2026-09-16T09:00:00.000Z' as IsoDateTime,
    })
    const quiet = withoutNoteToday(
      [okafor, adeyemi, hutchinson],
      [today, yesterday],
      ZONE,
      NOW,
    )
    expect(quiet.map((entry) => entry.resident.id)).toEqual([hutchinson.id, adeyemi.id])
    expect(quiet[0]?.last).toBe('never')
    expect(quiet[1]?.last).toBe(yesterday)
  })

  it('reckons today in the home’s day, not the machine’s', () => {
    // 23:30 UTC on the 16th is 00:30 on the 17th in London.
    const justAfterMidnight = note({
      residentId: okafor.id,
      recordedAt: '2026-09-16T23:30:00.000Z' as IsoDateTime,
    })
    expect(notesToday([justAfterMidnight], [okafor], ZONE, NOW)).toHaveLength(1)
  })

  it('shows only the viewer’s own notes, newest first', () => {
    const mine = note({
      residentId: okafor.id,
      recordedBy: staffEze,
      recordedAt: '2026-09-17T08:00:00.000Z' as IsoDateTime,
    })
    const mineLater = note({ residentId: adeyemi.id, recordedBy: staffEze })
    const theirs = note({ residentId: okafor.id })
    expect(
      yourNotes([mine, theirs, mineLater], [okafor, adeyemi], staffEze.id).map(
        (item) => item.note.id,
      ),
    ).toEqual([mineLater.id, mine.id])
  })

  it('counts who wrote, without naming them', () => {
    expect(
      authorCount([
        note({ residentId: okafor.id }),
        note({ residentId: okafor.id }),
        note({ residentId: okafor.id, recordedBy: staffEze }),
      ]),
    ).toBe(2)
  })

  it('finds the residents a shift did not write about today', () => {
    const late = note({ residentId: okafor.id, shift: { kind: 'auto', value: 'late' } })
    const early = note({
      residentId: adeyemi.id,
      recordedAt: '2026-09-17T08:00:00.000Z' as IsoDateTime,
      shift: { kind: 'auto', value: 'early' },
    })
    expect(byShift([late, early], [okafor, adeyemi], 'late', ZONE, NOW)).toHaveLength(1)
    expect(
      withoutNoteOnShift([okafor, adeyemi], [late, early], 'late', ZONE, NOW).map(
        (entry) => entry.id,
      ),
    ).toEqual([adeyemi.id])
  })

  it('does not count a shift that has not begun', () => {
    // 09:00 in London.
    const morning = '2026-09-17T08:00:00.000Z' as IsoDateTime
    expect(shiftHasBegun('early', ZONE, morning)).toBe(true)
    expect(shiftHasBegun('late', ZONE, morning)).toBe(false)
    expect(shiftHasBegun('night', ZONE, morning)).toBe(true)
  })
})
