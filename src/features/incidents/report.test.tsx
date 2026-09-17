import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/incidents/new?at=20:20')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { now } from '@/data/fixtures/clock'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import {
  reportedThisSession,
  resetSessionIncidents,
} from '@/data/access/incident-store'
import { memberById } from '@/data/access/team-store'
import { residentScopeFor } from '@/app/session/resident-scope'
import { residentById } from '@/data/fixtures/residents'
import { renderSignedIn } from '@/test/render-signed-in'
import { NOT_NOTIFIED_LINE, ReportIncidentRoute } from './ReportIncidentRoute'

const push = vi.hoisted(() => vi.fn())
const navigation = vi.hoisted(() => ({ pathname: '/incidents/new', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
  resetSessionIncidents()
  push.mockClear()
})

type User = ReturnType<typeof userEvent.setup>

async function openForm(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <ReportIncidentRoute />, ROSEWOOD)
  await screen.findByRole('radiogroup', { name: 'Who this happened to' })
  return { user, ...rendered }
}

const waiting = () => document.querySelector('[data-report-waiting]')?.textContent ?? ''

async function chooseSelect(user: User, name: RegExp | string, option: RegExp) {
  const trigger = screen.getByRole('combobox', { name })
  trigger.focus()
  await user.keyboard('{Enter}')
  const choice = await screen.findByRole('option', { name: option })
  await user.click(choice)
}

/** Everything a complete report needs, for a resident on Eze's list. */
async function fillIn(user: User, resident: { name: RegExp }) {
  await chooseSelect(user, 'Type', /^Fall: witnessed$/)
  await user.click(screen.getByRole('radio', { name: /^A resident/ }))
  await chooseSelect(user, 'Resident', resident.name)
  await chooseSelect(user, 'Where it happened', /^Lounge$/)
  await user.click(screen.getByRole('radio', { name: /^Nobody saw it/ }))
  await user.type(
    screen.getByLabelText('In your own words'),
    'He slipped by the window and sat down heavily.',
  )
  await user.click(screen.getByRole('radio', { name: /^Low harm/ }))
  await user.click(screen.getByRole('radio', { name: /^Checked: no injury found/ }))
  await user.click(screen.getByRole('radio', { name: 'Nobody called them' }))
  await user.type(
    screen.getByLabelText('Immediate action taken'),
    'Stayed with him, checked him over, told the senior.',
  )
}

describe('the form', () => {
  it('names what it is waiting on, and will not submit until nothing is', async () => {
    const { user } = await openForm()
    expect(waiting()).toContain('what kind of incident it was')
    expect(waiting()).toContain('who this happened to')
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeDisabled()

    await fillIn(user, { name: /Emmanuel Okafor/ })
    await waitFor(() => expect(waiting()).toContain('Everything needed is here'))
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeEnabled()
  })

  it('defaults the time to now in the home’s clock, and says so', async () => {
    await openForm()
    const field = document.querySelector<HTMLInputElement>('[data-occurred-at]')!
    // 20:20 at Rosewood, which is 19:20 UTC: the home's clock, not the machine's.
    expect(field.value).toBe('2026-09-18T20:20')
    expect(screen.getByText(/The clock is Rosewood Court’s\./)).toBeInTheDocument()
  })

  it('offers "no resident was involved" only once the type allows it', async () => {
    const { user } = await openForm()
    const group = screen.getByRole('radiogroup', { name: 'Who this happened to' })
    expect(
      within(group).getByRole('radio', { name: /^No resident was involved/ }),
    ).toBeDisabled()
    expect(group.textContent).toMatch(/Choose the type first/)

    await chooseSelect(user, 'Type', /^Equipment failure$/)
    const unlocked = screen.getByRole('radio', { name: /^No resident was involved/ })
    expect(unlocked).toBeEnabled()
    await user.click(unlocked)
    // And the injury question is not asked about a hoist.
    expect(screen.queryByRole('radiogroup', { name: 'Injury' })).toBeNull()
  })

  it('asks the three injury answers, and holds "injuries found" until a site is marked', async () => {
    const { user } = await openForm()
    await user.click(screen.getByRole('radio', { name: /^A resident/ }))
    await chooseSelect(user, 'Resident', /Emmanuel Okafor/)

    const injury = screen.getByRole('radiogroup', { name: 'Injury' })
    expect(within(injury).getByRole('radio', { name: /^Not checked yet/ })).toBeTruthy()
    expect(
      within(injury).getByRole('radio', { name: /^Checked: no injury found/ }),
    ).toBeTruthy()

    await user.click(
      within(injury).getByRole('radio', { name: /^Checked: injuries found/ }),
    )
    expect(document.querySelector('[data-body-map]')).not.toBeNull()
    expect(waiting()).toContain('at least one injury site')
    expect(screen.getByText('No injury site marked yet')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Head/ }))
    expect(document.querySelector('[data-marked-sites]')?.textContent).toContain('Head')
    expect(waiting()).not.toContain('at least one injury site')
  })

  it('refuses a time in the future', async () => {
    const { user } = await openForm()
    await fillIn(user, { name: /Emmanuel Okafor/ })
    const field = document.querySelector<HTMLInputElement>('[data-occurred-at]')!
    await user.clear(field)
    await user.type(field, '2026-09-19T08:00')
    await waitFor(() => expect(waiting()).toContain('a time that is not in the future'))
  })

  it('says nothing is sent, where INC-03 says a manager has been notified', async () => {
    await openForm()
    expect(screen.getAllByText(NOT_NOTIFIED_LINE).length).toBeGreaterThan(0)
  })
})

describe('the questions the CW PRD does not ask but the record has no blank for', () => {
  it('asks whether emergency services were called, and records what they said', async () => {
    const { user } = await openForm()
    await fillIn(user, { name: /Emmanuel Okafor/ })
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeEnabled()

    await user.click(screen.getByRole('radio', { name: '999 — ambulance' }))
    await waitFor(() => expect(waiting()).toContain('what the emergency service said'))
    await user.type(
      screen.getByLabelText('What they said or did'),
      'Paramedics checked him over and left him at home.',
    )
    await user.click(screen.getByRole('button', { name: 'Report this incident' }))

    await waitFor(() => expect(reportedThisSession()).toHaveLength(1))
    expect(reportedThisSession()[0]!.response.emergencyServices).toMatchObject({
      kind: 'called',
      service: 'ambulance_999',
      outcome: 'Paramedics checked him over and left him at home.',
    })
  })

  it('leaves the GP and the family as not yet contacted, which is what is true', async () => {
    const { user } = await openForm()
    await fillIn(user, { name: /Emmanuel Okafor/ })
    await user.click(screen.getByRole('button', { name: 'Report this incident' }))
    await waitFor(() => expect(reportedThisSession()).toHaveLength(1))
    const { response } = reportedThisSession()[0]!
    expect(response.gp.kind).toBe('not_yet')
    expect(response.family.kind).toBe('not_yet')
    expect(response.emergencyServices.kind).toBe('not_called')
  })
})

describe('reporting it', () => {
  it('records the reporter’s account, unacknowledged, with nothing decided', async () => {
    const { user } = await openForm()
    await fillIn(user, { name: /Emmanuel Okafor/ })
    await user.click(screen.getByRole('button', { name: 'Report this incident' }))

    await waitFor(() => expect(reportedThisSession()).toHaveLength(1))
    const incident = reportedThisSession()[0]!
    expect(incident.subject).toEqual({
      kind: 'resident',
      residentId: 'res-okafor' as ResidentId,
    })
    expect(incident.status.kind).toBe('reported_not_acknowledged')
    expect(incident.notification.kind).toBe('not_yet_decided')
    expect(incident.injuries.kind).toBe('no_injuries_found')
    expect(incident.review.rootCause.kind).toBe('unrecorded')
    expect(incident.reported.by.id).toBe(staffAkinyemi.id)
    // The home's clock: 20:20 at Rosewood is 19:20 UTC.
    expect(incident.occurredAt).toBe(now().toISOString() as IsoDateTime)

    // And the screen says what it did and did not do.
    expect(await screen.findByText('Not acknowledged')).toBeInTheDocument()
    expect(screen.getByText(NOT_NOTIFIED_LINE)).toBeInTheDocument()
  })
})

describe('the PRD’s silence about whose residents', () => {
  it('draws the question at the act for a resident off a care worker’s list', async () => {
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')
    const off = residentById(
      ['res-okafor', 'res-pemberton', 'res-adeyemi', 'res-kavanagh']
        .map((id) => id as ResidentId)
        .find((id) => !scope.residents.includes(id))!,
    )
    if (off === undefined) throw new Error('No resident off Eze’s list')

    const { user } = await openForm(staffEze.id)
    await fillIn(user, { name: new RegExp(off.fullLegalName) })

    // Nothing is missing, and the act is still unavailable: the build does not
    // choose what the PRD leaves open.
    expect(waiting()).toContain('Everything needed is here')
    const question = document.querySelector('[data-act-line="not_stated"]')
    expect(question?.textContent).toMatch(/does not say/)
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeDisabled()
    expect(reportedThisSession()).toHaveLength(0)
  })

  it('lets the same care worker report about a resident on their list', async () => {
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')
    const on = residentById(scope.residents[0]!)
    if (on === undefined) throw new Error('Eze’s first resident is not in the fixtures')

    const { user } = await openForm(staffEze.id)
    await fillIn(user, { name: new RegExp(on.fullLegalName) })
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeEnabled()
  })

  it('asks nothing about a list where no resident is involved', async () => {
    const { user } = await openForm(staffOsei.id)
    await chooseSelect(user, 'Type', /^Near miss$/)
    await user.click(screen.getByRole('radio', { name: /^No resident was involved/ }))
    await chooseSelect(user, 'Where it happened', /^Corridor$/)
    await user.click(screen.getByRole('radio', { name: /^Nobody saw it/ }))
    await user.type(
      screen.getByLabelText('In your own words'),
      'The trolley was left across the fire door.',
    )
    await user.click(screen.getByRole('radio', { name: /^No harm/ }))
    await user.click(screen.getByRole('radio', { name: 'Nobody called them' }))
    await user.type(
      screen.getByLabelText('Immediate action taken'),
      'Moved it back and told the senior.',
    )

    // Osei has no list at all, and this report is about nobody, so the question
    // never arises.
    expect(waiting()).toContain('Everything needed is here')
    expect(document.querySelector('[data-act-line]')?.textContent).toBe(
      NOT_NOTIFIED_LINE,
    )
    expect(screen.getByRole('button', { name: 'Report this incident' })).toBeEnabled()
  })
})
