import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/goals?at=20:20')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GoalId, IsoDateTime, ResidentId } from '@/data/types'
import { goalProgressNotes, goals } from '@/data/fixtures/goals'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { endSession } from '@/data/access/session-losses'
import { progressNotesThisSession, resetSessionGoals } from '@/data/access/goal-store'
import { memberById } from '@/data/access/team-store'
import { residentScopeFor } from '@/app/session/resident-scope'
import { renderSignedIn } from '@/test/render-signed-in'
import { GoalDetailRoute } from './GoalDetailRoute'
import { GoalsRoute, noDateLine } from './GoalsRoute'
import { goalStanding } from './goal-timing'

const navigation = vi.hoisted(() => ({
  pathname: '/goals',
  params: {} as Record<string, string>,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const at = now().toISOString() as IsoDateTime

beforeEach(() => {
  endSession()
  resetSessionGoals()
  navigation.params = {}
})

const here = () => {
  const ids = new Set(residentsBySite(ROSEWOOD).map((resident) => resident.id))
  return goals.filter((goal) => ids.has(goal.residentId))
}

const notesFor = (id: GoalId) => goalProgressNotes.filter((note) => note.goalId === id)

async function openQueue(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <GoalsRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Goals view' })
  return { user, ...rendered }
}

async function openGoal(goalId: GoalId, id = staffAkinyemi.id) {
  navigation.pathname = `/goals/${goalId}`
  navigation.params = { goalId }
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <GoalDetailRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1, name: /’s goal$/ })
  return { user, ...rendered }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-goal]')]

describe('the queue', () => {
  it('leads on the goals past their date, with the exclusion stated', async () => {
    await openQueue()
    const past = here().filter(
      (goal) => goalStanding(goal, notesFor(goal.id), at).kind === 'past_target',
    ).length
    const dated = here().filter((goal) => goal.target.kind === 'by_date').length
    const undated = here().length - dated

    const banner = document.querySelector('[data-goals-banner]')?.closest('section')
    expect(banner?.textContent).toContain(String(past))
    expect(banner?.textContent).toContain(
      `of ${dated} goals with a target date, across ${here().length} at Rosewood Court`,
    )
    // The goals with no date are stated, not silently left out.
    expect(banner?.textContent).toContain(noDateLine(undated))
  })

  it('opens on the past-date view, longest wait first', async () => {
    await openQueue()
    expect(
      document
        .querySelector('[data-goal-view="past_target"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    const dates = rows().map((row) => {
      const goal = here().find((entry) => entry.id === row.dataset.goal)
      return goal?.target.kind === 'by_date' ? goal.target.on : 'none'
    })
    expect([...dates].sort()).toEqual(dates)
  })

  it('draws a goal past its date with nothing said as a gap, never a finding', async () => {
    await openQueue()
    const row = rows()[0]!
    const hatched = row.querySelector('[data-state="unrecorded"]')
    expect(hatched?.textContent).toContain('Nothing recorded')
    // Amber is for findings. The wait is a gap.
    expect(row.querySelector('[data-tone="caution"]')).toBeNull()
  })

  it('keeps the goal in the resident’s own words, in quotation marks', async () => {
    await openQueue()
    const row = rows()[0]!
    const goal = here().find((entry) => entry.id === row.dataset.goal)!
    expect(row.querySelector(`[data-goal-statement="${goal.id}"]`)?.textContent).toBe(
      `“${goal.statement}”`,
    )
  })

  it('draws "the resident was not asked" as amber, not as a gap', async () => {
    const { user } = await openQueue()
    await user.click(document.querySelector('[data-goal-view="resident_not_asked"]')!)
    const row = rows()[0]!
    const amber = row.querySelector('[data-tone="caution"]')
    expect(amber?.textContent).toContain('The resident was not asked')
    expect(amber?.closest('[data-state="unrecorded"]')).toBeNull()
  })

  it('refuses both roles a goal’s status, in the role table’s words, drawn once', async () => {
    await openQueue(staffEze.id)
    const refusals = [...document.querySelectorAll('[data-act-line="refused"]')].map(
      (line) => line.textContent,
    )
    expect(refusals).toEqual(['A manager sets and closes goals.'])
  })
})

describe('one goal', () => {
  const openGoalWithNotes = () => {
    const withNotes = here().find((goal) => notesFor(goal.id).length > 0)
    if (withNotes === undefined) throw new Error('No goal has progress notes')
    return withNotes
  }

  it('shows the statement, who set it, and every note oldest first', async () => {
    const goal = openGoalWithNotes()
    await openGoal(goal.id)
    expect(
      document.querySelector(`[data-goal-statement="${goal.id}"]`)?.textContent,
    ).toBe(`“${goal.statement}”`)
    expect(
      screen.getAllByText(new RegExp(`Set by ${goal.setBy.displayName}`)).length,
    ).toBeGreaterThan(0)

    const shown = [...document.querySelectorAll('[data-progress-note]')].map((note) =>
      note.getAttribute('data-progress-note'),
    )
    const expected = [...notesFor(goal.id)]
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map((note) => note.id)
    expect(shown).toEqual(expected)
  })

  it('says nobody has written anything, where nobody has', async () => {
    const bare = here().find((goal) => notesFor(goal.id).length === 0)
    if (bare === undefined) throw new Error('Every goal has a note')
    await openGoal(bare.id)
    const gap = screen.getByText('No progress notes yet')
    expect(gap.closest('[data-state="unrecorded"]')).not.toBeNull()
  })

  it('writes a progress note in the reader’s name, and shows it', async () => {
    const goal = openGoalWithNotes()
    const { user } = await openGoal(goal.id)
    const before = document.querySelectorAll('[data-progress-note]').length

    await user.type(
      screen.getByLabelText('Add a progress note'),
      'Walked to the dining room with one hand on the rail.',
    )
    await user.click(screen.getByRole('button', { name: /^Add this note to / }))

    await waitFor(() => expect(progressNotesThisSession()).toHaveLength(1))
    const written = progressNotesThisSession()[0]!
    expect(written.recordedBy.id).toBe(staffAkinyemi.id)
    expect(written.body).toBe('Walked to the dining room with one hand on the rail.')
    // It is on the timeline it was written into, not only in the store.
    await waitFor(() =>
      expect(document.querySelectorAll('[data-progress-note]')).toHaveLength(
        before + 1,
      ),
    )
    expect(document.querySelector('[data-progress-done]')?.textContent).toMatch(
      /held in this session only/,
    )
  })

  it('does not touch the goal’s outcome: that is a manager’s decision', async () => {
    const goal = openGoalWithNotes()
    const { user } = await openGoal(goal.id)
    await user.type(screen.getByLabelText('Add a progress note'), 'Tried again today.')
    await user.click(screen.getByRole('button', { name: /^Add this note to / }))
    await waitFor(() => expect(progressNotesThisSession()).toHaveLength(1))
    expect(goals.find((entry) => entry.id === goal.id)?.outcome.kind).toBe(
      goal.outcome.kind,
    )
  })

  it('says nothing is sent, where GOAL-02 claims a notification', async () => {
    const goal = openGoalWithNotes()
    await openGoal(goal.id)
    expect(
      screen.getByText(/the Family Portal — which is not built — receives nothing/),
    ).toBeInTheDocument()
  })

  it('draws the PRD’s question at the act for a resident off a care worker’s list', async () => {
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')

    const off = here().find(
      (goal) => !scope.residents.includes(goal.residentId as ResidentId),
    )
    const on = here().find((goal) =>
      scope.residents.includes(goal.residentId as ResidentId),
    )
    if (off === undefined || on === undefined)
      throw new Error('Eze needs a goal on and a goal off their list')

    await openGoal(off.id, staffEze.id)
    const question = document.querySelector('[data-act-line="not_stated"]')
    expect(question?.textContent).toMatch(/does not say/)
    expect(screen.queryByRole('button', { name: /^Add this note to / })).toBeNull()
    expect(screen.getByLabelText('Add a progress note')).toBeDisabled()
  })

  it('lets the same care worker write about a resident on their list', async () => {
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')
    const on = here().find((goal) =>
      scope.residents.includes(goal.residentId as ResidentId),
    )
    if (on === undefined) throw new Error('Eze has no resident with a goal')

    const { user } = await openGoal(on.id, staffEze.id)
    await user.type(screen.getByLabelText('Add a progress note'), 'Sat out for lunch.')
    expect(
      within(document.querySelector('[data-progress-form]') as HTMLElement).getByRole(
        'button',
        { name: /^Add this note to / },
      ),
    ).toBeEnabled()
  })
})
