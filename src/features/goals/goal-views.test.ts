import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/goals?at=20:20')
})

import { describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { goalProgressNotes, goals } from '@/data/fixtures/goals'
import { residentsBySite } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { goalStanding } from './goal-timing'
import { byLongestWait, inView, summarise, type GoalRow } from './goal-views'

/**
 * The queue's rules, as arithmetic. CW PRD GOAL-01.
 *
 * Read against the fixtures rather than against invented goals: the figures
 * GOAL-01 quotes are the ones this home holds, and a rule tested on made-up
 * data can agree with itself while disagreeing with the screen.
 */

const at = now().toISOString() as IsoDateTime

const rows: GoalRow[] = (() => {
  const residents = residentsBySite('site-rosewood-court')
  const byId = new Map(residents.map((resident) => [resident.id, resident]))
  return goals.flatMap((goal) => {
    const resident = byId.get(goal.residentId)
    if (resident === undefined) return []
    return [
      {
        goal,
        resident,
        notes: goalProgressNotes.filter((note) => note.goalId === goal.id),
      },
    ]
  })
})()

describe('the fixtures hold GOAL-01’s own figures', () => {
  it('has 40 goals at Rosewood Court, 32 with a target date and 8 without', () => {
    const summary = summarise(rows, at)
    expect(summary.total).toBe(40)
    expect(summary.withTargetDate).toBe(32)
    expect(summary.noTargetDate).toBe(8)
    expect(summary.withTargetDate + summary.noTargetDate).toBe(summary.total)
  })

  it('counts the past-date finding over the dated goals, not over all of them', () => {
    const summary = summarise(rows, at)
    expect(summary.pastTarget).toBeGreaterThan(0)
    expect(summary.pastTarget).toBeLessThanOrEqual(summary.withTargetDate)
    // A goal with no date can never be in it: it is not late, it has no date.
    for (const row of rows.filter((entry) => inView(entry, 'past_target', at)))
      expect(row.goal.target.kind).toBe('by_date')
  })
})

describe('the five views', () => {
  it('puts every open goal in Open and every closed one in Closed', () => {
    for (const row of rows) {
      expect(inView(row, 'open', at)).toBe(row.goal.outcome.kind === 'open')
      expect(inView(row, 'closed', at)).toBe(row.goal.outcome.kind !== 'open')
      expect(inView(row, 'all', at)).toBe(true)
    }
  })

  it('holds "resident not asked" to closures where nobody put it to them', () => {
    const notAsked = rows.filter((row) => inView(row, 'resident_not_asked', at))
    expect(notAsked.length).toBeGreaterThan(0)
    for (const row of notAsked) {
      const standing = goalStanding(row.goal, row.notes, at)
      expect(standing.kind).toBe('closed')
      if (standing.kind !== 'closed') throw new Error('not closed')
      expect(standing.residentView).not.toBe('not_applicable')
      if (standing.residentView === 'not_applicable') throw new Error('withdrawn')
      expect(standing.residentView.kind).toBe('not_asked')
    }
    /*
     * A withdrawal is never in it: the withdrawal is the resident's view, and
     * asking what they thought of their own decision is incoherent.
     */
    for (const row of rows.filter(
      (entry) => entry.goal.outcome.kind === 'withdrawn_by_resident',
    ))
      expect(inView(row, 'resident_not_asked', at)).toBe(false)
  })

  it('counts past-date goals as the view and the summary agree', () => {
    expect(rows.filter((row) => inView(row, 'past_target', at))).toHaveLength(
      summarise(rows, at).pastTarget,
    )
  })
})

describe('the order', () => {
  it('puts the longest past its date first, and the undated last', () => {
    const ordered = byLongestWait(rows)
    const dates = ordered.map((row) =>
      row.goal.target.kind === 'by_date' ? row.goal.target.on : 'none',
    )
    const dated = dates.filter((entry) => entry !== 'none')
    expect([...dated].sort()).toEqual(dated)
    // Undated goals sort after the dated ones, and are never dropped.
    expect(dates.indexOf('none')).toBe(dated.length)
    expect(ordered).toHaveLength(rows.length)
  })
})
