import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(
    null,
    '',
    '/residents/res-hutchinson/risk-assessments/falls?at=20:20',
  )
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import {
  allResidents,
  resetSessionResidents,
  withResidentEdits,
} from '@/data/access/resident-store'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { resetMedicationPins } from '@/app/session/medication-pins'
import { renderSignedIn } from '@/test/render-signed-in'
import { AssessmentFormRoute } from './AssessmentFormRoute'
import { INSTRUMENT_ITEMS } from './instrument'
import { PLACEHOLDER_NOTICE } from './instrument'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-hutchinson/risk-assessments/falls',
  params: { residentId: 'res-hutchinson', templateId: 'falls' } as Record<
    string,
    string
  >,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const HUTCHINSON = 'res-hutchinson' as ResidentId

beforeEach(() => {
  endSession()
  resetSessionResidents()
  resetMedicationPins()
  navigation.params = { residentId: HUTCHINSON, templateId: 'falls' }
})

async function openForm(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <AssessmentFormRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1 })
  return { user, ...rendered }
}

const running = () => document.querySelector('[data-running-score]')?.textContent ?? ''

async function answerEvery(user: ReturnType<typeof userEvent.setup>, choice = 0) {
  for (const item of INSTRUMENT_ITEMS) {
    const button = document.querySelector<HTMLElement>(
      `[data-choice="${item.id}:${choice}"]`,
    )
    if (button === null) throw new Error(`No choice for ${item.id}`)
    await user.click(button)
  }
}

describe('the form', () => {
  it('says the instrument is a placeholder, on the form itself', async () => {
    await openForm()
    expect(screen.getAllByText(PLACEHOLDER_NOTICE).length).toBeGreaterThan(0)
  })

  it('shows the running score, what it is out of, and that it is not final', async () => {
    const { user } = await openForm()
    expect(running()).toContain(`0 of ${INSTRUMENT_ITEMS.length} items answered`)
    expect(running()).toContain('The score is not final until every item has an answer')
    // The band so far wears the hatch: it is not the band this assessment reaches.
    expect(
      document.querySelector('[data-running-score] [data-state="unrecorded"]'),
    ).not.toBeNull()

    const first = INSTRUMENT_ITEMS[0]!
    await user.click(document.querySelector(`[data-choice="${first.id}:2"]`)!)
    expect(running()).toContain(`1 of ${INSTRUMENT_ITEMS.length} items answered`)
    expect(running()).toContain(String(first.choices[2]!.points))
  })

  it('hatches every factor nobody has answered, and settles the answered one', async () => {
    const { user } = await openForm()
    const first = INSTRUMENT_ITEMS[0]!
    const item = document.querySelector<HTMLElement>(`[data-item="${first.id}"]`)!
    expect(within(item).getByText('Not answered')).toBeInTheDocument()

    await user.click(within(item).getByRole('button', { name: /Not present/ }))
    expect(within(item).queryByText('Not answered')).toBeNull()
    expect(item.querySelector('[data-state="recorded"]')).not.toBeNull()
  })

  it('holds the sign-off until every factor has an answer', async () => {
    const { user } = await openForm()
    const signOff = () =>
      screen.getByRole('button', { name: 'Sign off this assessment' })
    expect(signOff()).toBeDisabled()
    expect(document.querySelector('[data-assessment-waiting]')?.textContent).toContain(
      `an answer to ${INSTRUMENT_ITEMS.length} factors`,
    )

    await answerEvery(user)
    await waitFor(() => expect(signOff()).toBeEnabled())
    expect(document.querySelector('[data-assessment-waiting]')?.textContent).toContain(
      'Everything needed is here',
    )
  })

  it('takes off an intervention added by mistake, and keeps the last one', async () => {
    const user = userEvent.setup()
    await openForm()
    const rows = () => document.querySelectorAll('[data-intervention-what]')
    expect(rows()).toHaveLength(1)
    // The only row cannot be taken away, so nothing offers to.
    expect(document.querySelector('[data-remove-intervention]')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Add another intervention' }))
    expect(rows()).toHaveLength(2)

    await user.type(screen.getAllByLabelText('Responsible person')[1]!, 'N. Eze')
    await user.click(
      document.querySelector<HTMLElement>('[data-remove-intervention="1"]')!,
    )
    expect(rows()).toHaveLength(1)
    expect(document.querySelector('[data-remove-intervention]')).toBeNull()
  })

  it('draws no caution under the interventions, and no unavailable act', async () => {
    await openForm()
    expect(document.querySelector('[data-act-line="not_built"]')).toBeNull()
    expect(document.querySelector('[data-act-line="not_performed"]')).toBeNull()
    expect(document.body.textContent).not.toContain('Interventions are not kept')
  })

  it('offers a care worker no sign-off at all', async () => {
    await openForm(staffEze.id)
    expect(
      screen.queryByRole('button', { name: 'Sign off this assessment' }),
    ).toBeNull()
    expect(document.querySelector('[data-act-line="refused"]')).toBeNull()
  })
})

describe('signing it off', () => {
  it('names what the band does, signs with the medication PIN, and moves the record', async () => {
    // Through the overlay, as every screen reads it: the fixture object is
    // never touched.
    const asStored = () => {
      const found = allResidents().find((entry) => entry.id === HUTCHINSON)
      return found === undefined ? undefined : withResidentEdits(found)
    }
    const before = asStored()
    if (before === undefined) throw new Error('No Hutchinson in the fixtures')
    expect(before.risks.falls.kind).toBe('not_assessed')

    const { user } = await openForm()
    await answerEvery(user, 1)
    await user.click(screen.getByRole('button', { name: 'Sign off this assessment' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toMatch(/Beryl Hutchinson/)
    // Never assessed before, so the dialog says what signing puts on the record.
    expect(dialog.textContent).toMatch(/has never been assessed for Beryl Hutchinson/)
    expect(dialog.textContent).toMatch(/score \d+ of the placeholder instrument/)

    await user.type(within(dialog).getByLabelText('Enter your medication PIN'), '4821')
    await user.click(within(dialog).getByRole('button', { name: 'Sign off' }))

    await waitFor(() => expect(asStored()?.risks.falls.kind).toBe('assessed'))
    const after = asStored()!.risks.falls
    if (after.kind !== 'assessed') throw new Error('not assessed')
    expect(after.assessedBy.id).toBe(staffAkinyemi.id)
    expect(after.score.kind).toBe('scored')
    expect(after.reviewState.kind).toBe('scheduled')

    await waitFor(() =>
      expect(document.querySelector('[data-assessment-done]')?.textContent).toMatch(
        /The badge on their record says so from now, and nothing was sent\./,
      ),
    )
  })
})
