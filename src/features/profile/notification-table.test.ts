import { describe, expect, it } from 'vitest'
import {
  NOTIFICATIONS,
  PROF_01_SAFETY_CRITICAL,
  canBeTurnedOff,
  cannotBeTurnedOff,
  type CanTurnOff,
  type NotificationId,
} from './notification-table'

/**
 * Appendix D, held cell by cell against the PRD, the way the role table is.
 *
 * **Written out by hand rather than derived from the table it checks.** A test
 * that iterates `NOTIFICATIONS` and agrees with whatever it says would agree
 * with a row somebody mistyped. These twelve are typed from Table 19, so a row
 * that drifts from it fails here by name.
 */
const TABLE_19: { id: NotificationId; can: CanTurnOff }[] = [
  { id: 'medication_round_due', can: 'no_safety_critical' },
  { id: 'medication_window_closing', can: 'no_safety_critical' },
  { id: 'care_note_not_written', can: 'no' },
  { id: 'your_note_flagged', can: 'yes' },
  { id: 'your_flagged_note_reviewed', can: 'yes' },
  { id: 'new_handover', can: 'yes' },
  { id: 'risk_band_raised', can: 'yes' },
  { id: 'goal_date_approaching', can: 'yes' },
  { id: 'attendance_not_recorded', can: 'yes' },
  { id: 'controlled_drug_discrepancy', can: 'no' },
  { id: 'account_locked', can: 'no' },
  { id: 'session_expiring', can: 'no' },
]

describe('appendix D', () => {
  it('holds every row the PRD lists, in the PRD’s order', () => {
    expect(NOTIFICATIONS.map((kind) => kind.id)).toEqual(TABLE_19.map((row) => row.id))
  })

  for (const row of TABLE_19) {
    it(`${row.id} can be turned off: ${row.can}`, () => {
      const kind = NOTIFICATIONS.find((entry) => entry.id === row.id)
      expect(kind?.canTurnOff).toBe(row.can)
      expect(canBeTurnedOff(kind!)).toBe(row.can === 'yes')
    })
  }

  it('gives every row its channel, its timing and who it reaches, in words', () => {
    for (const kind of NOTIFICATIONS) {
      expect(kind.what.length).toBeGreaterThan(0)
      expect(kind.channel.length).toBeGreaterThan(0)
      expect(kind.when.length).toBeGreaterThan(0)
      expect(kind.reaches.length).toBeGreaterThan(0)
    }
  })
})

/**
 * The disagreement itself, asserted rather than described in a comment.
 *
 * PROF-01 names four notifications as the safety-critical ones that cannot be
 * turned off. Table 19's own column refuses six. If either document is ever
 * corrected, one of these fails and the line drawn on the screen is revisited
 * with it.
 */
describe('PROF-01 against appendix D', () => {
  it('agrees that all four PROF-01 names cannot be turned off', () => {
    for (const id of PROF_01_SAFETY_CRITICAL) expect(cannotBeTurnedOff()).toContain(id)
  })

  it('refuses two more than PROF-01 names, which is the open question', () => {
    const extra = cannotBeTurnedOff().filter(
      (id) => !PROF_01_SAFETY_CRITICAL.includes(id),
    )
    expect(extra).toEqual(['care_note_not_written', 'controlled_drug_discrepancy'])
  })

  it('calls only two of them safety critical, where PROF-01 calls four', () => {
    const named = NOTIFICATIONS.filter(
      (kind) => kind.canTurnOff === 'no_safety_critical',
    ).map((kind) => kind.id)
    expect(named).toEqual(['medication_round_due', 'medication_window_closing'])
    expect(named.length).toBeLessThan(PROF_01_SAFETY_CRITICAL.length)
  })
})
