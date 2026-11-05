import { describe, expect, it } from 'vitest'
import { staffEze } from '@/data/fixtures/organisation'
import { residentById } from '@/data/fixtures/residents'
import type { CareNote, IsoDate, IsoDateTime, ResidentId } from '@/data/types'
import { outstandingFor } from './outstanding'
import type { DoseRecord, Person } from './phone-data'

/**
 * What is outstanding for one person, against records this test writes and a
 * clock this test supplies, so the literals and the clock move together
 * (CLAUDE.md §8, on dates in tests).
 */
const person = residentById('res-okafor' as ResidentId) as Person
const at = '2026-09-16T13:40:00.000Z' as IsoDateTime
const today = '2026-09-16' as IsoDate
const zone = 'Europe/London'
const by = staffEze

const dose = (
  roundTime: string,
  state: DoseRecord['state'],
  medicationId = `med-${roundTime}-${Math.random()}`,
): DoseRecord =>
  ({ medicationId, residentId: person.id, roundTime, date: today, state }) as DoseRecord

const omitted = (closed = false): DoseRecord['state'] => ({
  kind: 'omitted',
  dueAt: '2026-09-16T07:00:00.000Z' as IsoDateTime,
  escalation: { kind: 'not_escalated' },
  closure: closed
    ? { kind: 'closed', by, at, reason: 'Asleep, spoke to GP' }
    : { kind: 'open' },
})
const given = (
  witness: 'not_required' | 'required_not_recorded',
): DoseRecord['state'] => ({
  kind: 'given',
  givenAt: '2026-09-16T07:05:00.000Z' as IsoDateTime,
  givenBy: by,
  witness: { kind: witness },
})
const due = (opens: string, closes: string): DoseRecord['state'] => ({
  kind: 'due',
  windowOpensAt: opens as IsoDateTime,
  windowClosesAt: closes as IsoDateTime,
})
/*
 * Partial, and cast: the rule reads only these. `corrects` is among them since
 * a correction stopped counting as a note today, which the cast had hidden by
 * leaving it undefined rather than saying 'none'.
 */
const noteAt = (recordedAt: string): CareNote =>
  ({
    id: 'note-1',
    residentId: person.id,
    recordedAt,
    recordedBy: by,
    corrects: 'none',
  }) as unknown as CareNote

describe('what is outstanding today', () => {
  it('ranks a missed dose, then a missing signature, then due now, then due soon, then the care note', () => {
    const items = outstandingFor({
      person,
      records: [
        dose('14:00', due('2026-09-16T12:30:00.000Z', '2026-09-16T13:30:00.000Z')),
        dose('15:00', due('2026-09-16T13:30:00.000Z', '2026-09-16T14:30:00.000Z')),
        dose('08:00', given('required_not_recorded')),
        dose('08:00', omitted()),
        dose('08:00', given('not_required')),
        dose('16:00', due('2026-09-16T14:30:00.000Z', '2026-09-16T15:30:00.000Z')),
      ],
      notes: [],
      timeZone: zone,
      at,
    })
    expect(items.map((item) => item.kind)).toEqual([
      'doses_missed',
      'second_signature',
      'doses_due',
      'doses_due',
      'no_note_today',
    ])
    expect(items[0]).toEqual({
      kind: 'doses_missed',
      round: '08:00',
      missed: 1,
      due: 3,
    })
    expect(items[2]).toMatchObject({ round: '15:00', window: 'open' })
    expect(items[3]).toMatchObject({ round: '16:00', window: 'opens_soon' })
  })

  it('leaves out a closed omission, a window that has closed, and one beyond the look-ahead', () => {
    const items = outstandingFor({
      person,
      records: [
        dose('08:00', omitted(true)),
        dose('12:00', due('2026-09-16T10:30:00.000Z', '2026-09-16T11:30:00.000Z')),
        dose('20:00', due('2026-09-16T18:30:00.000Z', '2026-09-16T19:30:00.000Z')),
      ],
      notes: [noteAt('2026-09-16T09:00:00.000Z')],
      timeZone: zone,
      at,
    })
    expect(items).toEqual([])
  })

  it('counts a care note from yesterday as none today, and carries it as the last one', () => {
    const yesterday = noteAt('2026-09-15T21:00:00.000Z')
    const items = outstandingFor({
      person,
      records: [],
      notes: [yesterday],
      timeZone: zone,
      at,
    })
    expect(items).toEqual([{ kind: 'no_note_today', last: yesterday }])
  })

  it('says never when nobody has written a care note at all', () => {
    expect(
      outstandingFor({ person, records: [], notes: [], timeZone: zone, at }),
    ).toEqual([{ kind: 'no_note_today', last: 'never' }])
  })

  it('reads only this person, and only today', () => {
    const someoneElse = {
      ...dose('08:00', omitted()),
      residentId: 'res-obi' as ResidentId,
    }
    const yesterday = { ...dose('08:00', omitted()), date: '2026-09-15' as IsoDate }
    const items = outstandingFor({
      person,
      records: [someoneElse, yesterday],
      notes: [noteAt('2026-09-16T09:00:00.000Z')],
      timeZone: zone,
      at,
    })
    expect(items).toEqual([])
  })
})
