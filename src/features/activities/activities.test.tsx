import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/activities?at=20:20')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ActivityId, IsoDateTime } from '@/data/types'
import { activities } from '@/data/fixtures/activities'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { getActivity } from '@/data/access/client'
import { endSession } from '@/data/access/session-losses'
import { resetSessionActivities } from '@/data/access/activity-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { ActivitiesRoute, invitedLine } from './ActivitiesRoute'
import { AttendanceRoute, ENGAGEMENT_LINE, PHOTOS_LINE } from './AttendanceRoute'
import {
  countsOf,
  mondayOf,
  sessionState,
  sessionsInWeek,
  summariseWeek,
} from './activity-week'

const navigation = vi.hoisted(() => ({
  pathname: '/activities',
  params: {} as Record<string, string>,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const at = now().toISOString() as IsoDateTime
const LONDON = 'Europe/London' as const

beforeEach(() => {
  endSession()
  resetSessionActivities()
  navigation.params = {}
})

const week = () =>
  sessionsInWeek(
    activities.filter((activity) => activity.siteId === ROSEWOOD),
    mondayOf(at, LONDON),
    LONDON,
  )

async function openCalendar(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <ActivitiesRoute />, ROSEWOOD)
  await screen.findByRole('radiogroup', { name: 'How to show the week' })
  return { user, ...rendered }
}

async function openSession(activityId: ActivityId, id = staffAkinyemi.id) {
  navigation.pathname = `/activities/${activityId}`
  navigation.params = { activityId }
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <AttendanceRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1 })
  return { user, ...rendered }
}

describe('the week', () => {
  it('counts the sessions that happened with nobody recorded, and the people invited', async () => {
    await openCalendar()
    const summary = summariseWeek(week(), at)
    const banner = document
      .querySelector('[data-activities-banner]')
      ?.closest('section')
    expect(banner?.textContent).toContain(String(summary.happenedWithNoRecord))
    expect(banner?.textContent).toContain(
      `of ${summary.sessions} sessions at Rosewood Court this week happened with nobody recorded`,
    )
    expect(banner?.textContent).toContain(invitedLine(summary.residentsInvited))
  })

  it('draws seven days, and says so where nothing is planned', async () => {
    await openCalendar()
    const days = document.querySelectorAll('[data-day]')
    expect(days).toHaveLength(7)
    // A day with nothing planned states it: a blank column and a column nobody
    // filled in would look identical.
    for (const day of days) {
      const sessions = day.querySelectorAll('[data-session]')
      if (sessions.length === 0) expect(day.textContent).toContain('Nothing planned')
    }
  })

  it('hatches a session that happened with nobody recorded, and leaves a future one plain', async () => {
    await openCalendar()
    for (const activity of week()) {
      const card = document.querySelector<HTMLElement>(
        `[data-session="${activity.id}"]`,
      )
      if (card === null) continue
      const state = sessionState(activity, at)
      expect(card.dataset.sessionState).toBe(state.kind)
      if (state.kind === 'happened_nothing_recorded')
        expect(card.querySelector('[data-state="unrecorded"]')).not.toBeNull()
      if (state.kind === 'ahead') {
        expect(card.querySelector('[data-state="unrecorded"]')).toBeNull()
        expect(card.textContent).toContain('invited')
      }
    }
  })

  it('shows the same sessions as a list, which is the same records arranged differently', async () => {
    const { user } = await openCalendar()
    const inCalendar = [...document.querySelectorAll('[data-session]')].map((card) =>
      card.getAttribute('data-session'),
    )
    await user.click(screen.getByRole('radio', { name: 'List' }))
    const inList = [...document.querySelectorAll('[data-session]')].map((card) =>
      card.getAttribute('data-session'),
    )
    expect([...inList].sort()).toEqual([...inCalendar].sort())
  })

  it('refuses a care worker the planning acts, in the role table’s words', async () => {
    await openCalendar(staffEze.id)
    expect(document.querySelector('[data-act-line="refused"]')?.textContent).toBe(
      'Creating a session is for a senior carer.',
    )
  })
})

describe('one session', () => {
  const sessionWithGaps = () => {
    const found = week().find((activity) => countsOf(activity).notRecorded > 0)
    if (found === undefined) throw new Error('Every session this week is recorded')
    return found
  }

  it('lists everybody invited, including the people nobody has answered for', async () => {
    const activity = sessionWithGaps()
    await openSession(activity.id)
    expect(document.querySelectorAll('[data-attendance-for]')).toHaveLength(
      activity.invited.length,
    )
    const counts = countsOf(activity)
    expect(
      screen.getAllByText(`${counts.recorded} of ${counts.invited} recorded`).length,
    ).toBeGreaterThan(0)
  })

  it('records only the people answered for, and leaves the rest as gaps', async () => {
    const activity = sessionWithGaps()
    const { user } = await openSession(activity.id)
    const before = countsOf(activity)

    const row = document.querySelector<HTMLElement>(
      '[data-attendance-for] [data-answer="attended"]',
    )
    if (row === null) throw new Error('No unanswered resident on this session')
    await user.click(row)
    await user.click(screen.getByRole('button', { name: 'Record attendance' }))

    await waitFor(async () => {
      const { activity: after } = await getActivity(activity.id)
      expect(countsOf(after).recorded).toBe(before.recorded + 1)
      expect(countsOf(after).notRecorded).toBe(before.notRecorded - 1)
    })
  })

  it('needs a reason before "did not attend" can be recorded', async () => {
    const activity = sessionWithGaps()
    const { user } = await openSession(activity.id)
    const row = document.querySelector<HTMLElement>(
      '[data-attendance-for]:has([data-answer="did_not_attend"])',
    )
    if (row === null) throw new Error('No unanswered resident on this session')

    await user.click(within(row).getByRole('button', { name: 'Did not attend' }))
    expect(document.querySelector('[data-attendance-waiting]')?.textContent).toMatch(
      /Waiting on: a reason for/,
    )
    expect(screen.getByRole('button', { name: 'Record attendance' })).toBeDisabled()
  })

  it('says the photo upload stores nothing and sends nothing', async () => {
    const activity = sessionWithGaps()
    await openSession(activity.id)
    expect(screen.getByRole('button', { name: /Upload photos/ })).toBeDisabled()
    expect(screen.getByText(PHOTOS_LINE)).toBeInTheDocument()
  })

  it('says the engagement level is not kept, where the record has no field for it', async () => {
    const activity = sessionWithGaps()
    const { user } = await openSession(activity.id)
    const attended = document.querySelector<HTMLElement>('[data-answer="attended"]')
    if (attended === null) throw new Error('No unanswered resident on this session')
    await user.click(attended)
    expect(screen.getByText(ENGAGEMENT_LINE)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Fully engaged' })).toBeDisabled()
  })
})
