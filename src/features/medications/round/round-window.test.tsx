import { vi } from 'vitest'

/*
 * **Half an hour before the 20:00 round.** The doses are on the chart and due,
 * the window has not opened, and nothing about any of them can be recorded:
 * giving a drug early is a clinical decision and nothing in this product can
 * make one. `round.test.tsx` is the same screen twenty minutes *into* the
 * round, where the answers are live.
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=19:30')
})

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { GAP_MEDICATION_IDS, PEMBERTON_OXYCODONE } from '@/data/fixtures/medications'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { openDosesAt } from '@/data/access/client'
import { endSession } from '@/data/access/session-losses'
import { resetMedicationPins } from '@/app/session/medication-pins'
import { zonedDate } from '@/lib/format'
import { renderSignedIn } from '@/test/render-signed-in'
import { notOpenYetLine } from './DoseRow'
import { RoundRoute } from './RoundRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications/round', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const ROUND = '20:00'
const TODAY = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')
const OKAFOR = 'res-okafor' as ResidentId
/** What the home's clock is called tonight. Times render in the home's zone. */
const ZONE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  timeZoneName: 'short',
})
  .formatToParts(now())
  .find((part) => part.type === 'timeZoneName')!.value

beforeEach(() => {
  endSession()
  resetMedicationPins()
})

type User = ReturnType<typeof userEvent.setup>

async function openRound(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <RoundRoute />, ROSEWOOD)
  return { user, ...rendered }
}

async function atRound(user: User) {
  const pill = await screen.findByRole('button', { name: new RegExp(`^${ROUND} ·`) })
  await user.click(pill)
  return pill
}

const cardFor = (residentId: string) => {
  const card = document.querySelector<HTMLElement>(`[data-round-card="${residentId}"]`)
  if (card === null) throw new Error(`No round card for ${residentId}`)
  return card
}

const doseIn = (card: HTMLElement, medicationId: string) => {
  const dose = card.querySelector<HTMLElement>(`[data-dose="${medicationId}"]`)
  if (dose === null) throw new Error(`No dose ${medicationId}`)
  return dose
}

const actFor = (card: HTMLElement) =>
  within(card).getByRole('button', { name: /^Record .+’s 20:00 doses$/ })

describe('the fixtures reach the state this file is about', () => {
  it('has the 20:00 doses on the chart half an hour before the window opens', () => {
    expect(openDosesAt(OKAFOR, TODAY, ROUND)).toContain(
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
  })
})

describe('a dose whose window has not opened', () => {
  it('offers neither answer, and says why, with the hour it opens', async () => {
    const { user } = await openRound()
    await atRound(user)
    const dose = doseIn(
      cardFor(OKAFOR),
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
    expect(within(dose).getByText(notOpenYetLine(`20:00 ${ZONE}`))).toBeInTheDocument()
    expect(within(dose).getByRole('button', { name: 'Given' })).toBeDisabled()
    expect(within(dose).getByRole('button', { name: 'Not given' })).toBeDisabled()
    // The window is on the dose as well as in the sentence.
    expect(dose.textContent).toMatch(
      new RegExp(`Window 20:00 ${ZONE} to 21:00 ${ZONE}`),
    )
  })

  it('is not hatched: nothing is missing from the record, the dose is not due', async () => {
    const { user } = await openRound()
    await atRound(user)
    const dose = doseIn(
      cardFor(OKAFOR),
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
    expect(within(dose).queryByText('Not recorded yet')).toBeNull()
    expect(dose.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  it('tells the card and the banner, naming the resident and the hour', async () => {
    const { user } = await openRound()
    await atRound(user)
    const card = cardFor(OKAFOR)
    const line = card.querySelector('[data-card-not-open-yet]')
    expect(line?.textContent).toMatch(
      new RegExp(
        `The 20:00 window has not opened\\. Nothing can be recorded for Emmanuel Okafor until 20:00 ${ZONE}\\.`,
      ),
    )
    expect(actFor(card)).toBeDisabled()

    const banner = document.querySelector('[data-round-banner]')
    expect(banner?.querySelector('[data-round-not-open]')?.textContent).toMatch(
      new RegExp(
        `The 20:00 window opens at 20:00 ${ZONE}\\. Nothing on this round can be recorded before then\\.`,
      ),
    )
    // Nowhere to be sent: the card it would send somebody to refuses every answer.
    expect(screen.queryByRole('link', { name: /^Go to / })).toBeNull()
    expect(screen.getByText('The 20:00 round has not opened')).toBeInTheDocument()
  })

  it('draws the role table’s contradiction beside the window, not instead of it', async () => {
    const { user } = await openRound(staffEze.id)
    await atRound(user)
    const dose = doseIn(cardFor('res-pemberton'), PEMBERTON_OXYCODONE)
    expect(within(dose).getByText(notOpenYetLine(`20:00 ${ZONE}`))).toBeInTheDocument()
    const quoted = dose.querySelector('[data-act-line="not_stated"]')
    expect(quoted?.textContent).toMatch(/Medications — record Given\/Not Given\/PRN/)
    expect(quoted?.textContent).toMatch(/Medications — countersign controlled drugs/)
    expect(within(dose).getByRole('button', { name: 'Given' })).toBeDisabled()
  })
})

describe('an as-required dose before the round opens', () => {
  it('is recordable: a PRN is not due at a round, it is available', async () => {
    const { user } = await openRound()
    await atRound(user)
    const card = cardFor(OKAFOR)
    const inhaler = card.querySelector<HTMLElement>('[data-prn]')
    if (inhaler === null) throw new Error('Okafor has no PRN on the card')
    await user.click(within(inhaler).getByRole('button', { name: 'PRN' }))
    await user.type(
      within(inhaler).getByLabelText('Reason for giving it'),
      'Asked for it',
    )
    await user.type(within(inhaler).getByLabelText('Symptom observed'), 'wheeze')
    expect(actFor(cardFor(OKAFOR))).toBeEnabled()

    await user.click(actFor(cardFor(OKAFOR)))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/PRN: Salbutamol inhaler 2 puffs, for wheeze/)
    // Only the PRN: nothing scheduled at this round is in what the PIN signs.
    expect(dialog.textContent).not.toMatch(/Given: Morphine/)
  })
})
