import { vi } from 'vitest'

/*
 * **The fixture clock, set before any fixture loads.** At 19:30 the 20:00 round
 * is on the chart for every resident and nobody has signed for any of it, so
 * each state below is reachable on a fresh load rather than on whichever half
 * of a round the hour the suite runs happens to leave open.
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=19:30')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, MedicationId, ResidentId } from '@/data/types'
import {
  GAP_MEDICATION_IDS,
  NEWLY_PRESCRIBED_CD,
  PEMBERTON_OXYCODONE,
  marRecordsAll,
  medications,
} from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { openDosesAt, prnGivenThisSession, stockBalanceFor } from '@/data/access/client'
import { patchedRecords } from '@/data/access/mar-store'
import { endSession } from '@/data/access/session-losses'
import { memberById } from '@/data/access/team-store'
import { resetMedicationPins, setMedicationPin } from '@/app/session/medication-pins'
import { noListYetLine, residentScopeFor } from '@/app/session/resident-scope'
import { zonedDate } from '@/lib/format'
import { renderSignedIn } from '@/test/render-signed-in'
import { DISCREPANCY_LINE } from './DoseRow'
import { NO_REMINDER_LINE, OFF_LIST_LINE, RoundRoute } from './RoundRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications/round', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const ROUND = '20:00'
const TODAY = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

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

async function signWith(user: User, pin: string) {
  const dialog = await screen.findByRole('dialog')
  await user.type(within(dialog).getByLabelText('Enter your medication PIN'), pin)
  await user.click(within(dialog).getByRole('button', { name: 'Record doses' }))
  return dialog
}

/** Residents at Rosewood with a scheduled dose on today's 20:00 chart, from the fixtures. */
function expectedAtRound(): string[] {
  const atHome = new Set(
    residents.filter((resident) => resident.siteId === ROSEWOOD).map((r) => r.id),
  )
  const scheduled = new Map(
    medications
      .filter(
        (medication) => !medication.isPrn && medication.roundTimes.includes(ROUND),
      )
      .map((medication) => [medication.id, medication]),
  )
  return [
    ...new Set(
      marRecordsAll
        .filter(
          (record) =>
            record.date === TODAY &&
            record.roundTime === ROUND &&
            record.state.kind !== 'not_due' &&
            scheduled.has(record.medicationId) &&
            atHome.has(record.residentId),
        )
        .map((record) => record.residentId),
    ),
  ].sort()
}

const shownCards = () =>
  [...document.querySelectorAll<HTMLElement>('[data-round-card]')]
    .map((card) => card.dataset.roundCard ?? '')
    .sort()

function doseOn(residentId: string, predicate: (id: MedicationId) => boolean) {
  const found = medications.find(
    (medication) =>
      medication.residentId === residentId &&
      !medication.isPrn &&
      medication.roundTimes.includes(ROUND) &&
      predicate(medication.id),
  )
  if (!found) throw new Error(`No 20:00 dose for ${residentId}`)
  return found
}

describe('the fixtures reach the states this screen draws', () => {
  it('has the 20:00 round open to answer, with the controlled drugs the tests need', () => {
    expect(openDosesAt('res-okafor' as ResidentId, TODAY, ROUND)).toContain(
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
    expect(openDosesAt('res-pemberton' as ResidentId, TODAY, ROUND)).toContain(
      PEMBERTON_OXYCODONE,
    )
    expect(openDosesAt('res-adeyemi' as ResidentId, TODAY, ROUND)).toContain(
      NEWLY_PRESCRIBED_CD,
    )
    expect(stockBalanceFor(NEWLY_PRESCRIBED_CD)).toEqual({
      kind: 'no_balance_recorded',
    })
  })
})

describe('scope', () => {
  it('shows a care worker only their residents, with the line saying the rest are not shown', async () => {
    const { user } = await openRound(staffEze.id)
    await atRound(user)
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const list = residentScopeFor(eze)
    if (list.kind !== 'named_residents')
      throw new Error('Eze has no list in the fixtures')
    const shown = shownCards()
    expect(shown.length).toBeGreaterThan(0)
    for (const id of shown) expect(list.residents).toContain(id)
    expect(screen.getByText(OFF_LIST_LINE)).toBeInTheDocument()
    expect(screen.getByText(NO_REMINDER_LINE)).toBeInTheDocument()
  })

  it('tells a care worker with no list so, hatched, and shows no round', async () => {
    await openRound(staffOsei.id)
    const gap = await screen.findByText(noListYetLine)
    expect(gap.closest('[data-state="unrecorded"]')).not.toBeNull()
    expect(document.querySelector('[data-round-card]')).toBeNull()
    expect(screen.queryByRole('button', { name: /^20:00 ·/ })).toBeNull()
  })

  it('shows a senior carer every resident at the home with a dose at the round', async () => {
    const { user } = await openRound()
    await atRound(user)
    expect(shownCards()).toEqual(expectedAtRound())
    expect(screen.queryByText(OFF_LIST_LINE)).toBeNull()
  })
})

describe('a controlled drug', () => {
  it('draws the contradiction for a care worker, quoting both rows, with no usable Given', async () => {
    const { user } = await openRound(staffEze.id)
    await atRound(user)
    const card = cardFor('res-pemberton')
    const dose = doseIn(card, PEMBERTON_OXYCODONE)
    const line = dose.querySelector('[data-act-line="not_stated"]')
    expect(line?.textContent).toMatch(/Medications — record Given\/Not Given\/PRN/)
    expect(line?.textContent).toMatch(/Medications — countersign controlled drugs/)
    const given = within(dose).getByRole('button', { name: 'Given' })
    expect(given).toBeDisabled()
    expect(within(dose).queryByRole('button', { name: 'Not given' })).toBeNull()
    expect(card.querySelector('[data-round-blocked]')?.textContent).toMatch(
      /This round cannot be recorded for .+ while the controlled drug is unanswered\./,
    )
    expect(openDosesAt('res-pemberton' as ResidentId, TODAY, ROUND)).toContain(
      PEMBERTON_OXYCODONE,
    )
  })

  it('records a senior carer’s Given as Given, and the missing second signature beside it', async () => {
    const { user } = await openRound()
    await atRound(user)
    const card = cardFor('res-pemberton')
    // Every open dose on the card, answered: Given for the controlled drug.
    for (const id of openDosesAt('res-pemberton' as ResidentId, TODAY, ROUND)) {
      await user.click(within(doseIn(card, id)).getByRole('button', { name: 'Given' }))
    }
    await user.click(actFor(card))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toMatch(/Pemberton/)
    expect(dialog.textContent).toMatch(
      /Given: Oxycodone modified release 10mg, controlled drug, second signature to follow on the register/,
    )
    await signWith(user, '4821')

    await waitFor(() =>
      expect(doseIn(cardFor('res-pemberton'), PEMBERTON_OXYCODONE).dataset.record).toBe(
        'given',
      ),
    )
    const dose = doseIn(cardFor('res-pemberton'), PEMBERTON_OXYCODONE)
    const half = dose.querySelector('[data-half-record]')!
    expect(within(half as HTMLElement).getByText('Given')).toBeInTheDocument()
    const gap = within(half as HTMLElement).getByText('Second signature not recorded')
    expect(gap.closest('[data-state="unrecorded"]')).not.toBeNull()
    // Two facts, not one pill with the gap in small print.
    expect(
      within(half as HTMLElement)
        .getByText('Given')
        .closest('[data-state="recorded"]'),
    ).not.toBeNull()

    const written = patchedRecords().find(
      (record) =>
        record.medicationId === PEMBERTON_OXYCODONE &&
        record.date === TODAY &&
        record.roundTime === ROUND,
    )
    expect(written?.state).toMatchObject({
      kind: 'given',
      givenBy: { id: staffAkinyemi.id },
      witness: { kind: 'required_not_recorded' },
    })
  })

  it('blocks giving a drug whose count does not reconcile, and leaves Not given open', async () => {
    const { user } = await openRound()
    await atRound(user)
    const dose = doseIn(
      cardFor('res-okafor'),
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )
    expect(within(dose).getByText(DISCREPANCY_LINE)).toBeInTheDocument()
    expect(within(dose).getByRole('button', { name: 'Given' })).toBeDisabled()
    expect(within(dose).getByRole('button', { name: 'Not given' })).toBeEnabled()
  })

  it('asks for an opening count and a witness where the register holds no balance', async () => {
    const { user } = await openRound()
    await atRound(user)
    const card = cardFor('res-adeyemi')
    for (const id of openDosesAt('res-adeyemi' as ResidentId, TODAY, ROUND)) {
      await user.click(within(doseIn(card, id)).getByRole('button', { name: 'Given' }))
    }
    const dose = doseIn(card, NEWLY_PRESCRIBED_CD)
    expect(
      within(dose).getByText('No balance recorded for this drug'),
    ).toBeInTheDocument()
    expect(actFor(card)).toBeDisabled()

    await user.type(within(dose).getByLabelText(/Opening balance/), '40')
    expect(actFor(card)).toBeDisabled()
    const witness = within(dose).getByRole('combobox', { name: /Witness/ })
    witness.focus()
    await user.keyboard('{Enter}')
    const options = await screen.findAllByRole('option')
    expect(options.map((option) => option.textContent)).not.toContain(
      staffAkinyemi.fullName,
    )
    await user.click(options[0]!)
    await waitFor(() => expect(actFor(cardFor('res-adeyemi'))).toBeEnabled())

    await user.click(actFor(cardFor('res-adeyemi')))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(
      /Opening balance: 40 ml of Oxycodone oral solution, witnessed by/,
    )
    await signWith(user, '4821')
    await waitFor(() =>
      expect(stockBalanceFor(NEWLY_PRESCRIBED_CD)).toMatchObject({
        kind: 'counted',
        value: 40,
      }),
    )
  })
})

describe('the medication PIN', () => {
  it('refuses a wrong PIN where one is held, and records nothing', async () => {
    setMedicationPin(staffAkinyemi.id, '1234')
    const { user } = await openRound()
    await atRound(user)
    const castledine = doseOn('res-castledine', () => true)
    const card = cardFor('res-castledine')
    await user.click(
      within(doseIn(card, castledine.id)).getByRole('button', { name: 'Given' }),
    )
    await user.click(actFor(card))
    const dialog = await signWith(user, '9999')
    expect(dialog.textContent).toMatch(/That is not your medication PIN/)
    expect(openDosesAt('res-castledine' as ResidentId, TODAY, ROUND)).toContain(
      castledine.id,
    )
  })

  it('accepts any four digits where none is held, and says so first', async () => {
    const { user } = await openRound()
    await atRound(user)
    const castledine = doseOn('res-castledine', () => true)
    const card = cardFor('res-castledine')
    await user.click(
      within(doseIn(card, castledine.id)).getByRole('button', { name: 'Given' }),
    )
    await user.click(actFor(card))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/No medication PIN is held for you/)
    expect(dialog.textContent).toMatch(/Given: Atorvastatin/)
    await signWith(user, '0000')
    await waitFor(() =>
      expect(openDosesAt('res-castledine' as ResidentId, TODAY, ROUND)).not.toContain(
        castledine.id,
      ),
    )
  })
})

describe('not given', () => {
  it('needs a reason, Other needs words, and one write moves the round’s count', async () => {
    const { user } = await openRound()
    const pill = await atRound(user)
    const before = pill.textContent ?? ''
    const [, recordedBefore] = /· (\d+) of (\d+) recorded/.exec(before) ?? []
    const kavanaghOpen = openDosesAt('res-kavanagh' as ResidentId, TODAY, ROUND)

    const castledine = doseOn('res-castledine', () => true)
    const card = cardFor('res-castledine')
    const dose = doseIn(card, castledine.id)
    await user.click(within(dose).getByRole('button', { name: 'Not given' }))
    expect(actFor(card)).toBeDisabled()
    expect(card.querySelector('[data-waiting]')?.textContent).toMatch(
      /no reason chosen/,
    )

    await user.click(within(dose).getByRole('radio', { name: 'Other' }))
    expect(actFor(card)).toBeDisabled()
    expect(card.querySelector('[data-waiting]')?.textContent).toMatch(
      /say why it was not given/,
    )

    await user.type(
      within(dose).getByLabelText('Say why it was not given'),
      'Resident at the GP',
    )
    expect(actFor(card)).toBeEnabled()
    await user.click(actFor(card))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/Not given: Atorvastatin .+, Resident at the GP/)
    await signWith(user, '1111')

    await waitFor(() =>
      expect(doseIn(cardFor('res-castledine'), castledine.id).dataset.record).toBe(
        'not_given',
      ),
    )
    const after = screen.getByRole('button', { name: /^20:00 ·/ }).textContent ?? ''
    const [, recordedAfter] = /· (\d+) of (\d+) recorded/.exec(after) ?? []
    expect(Number(recordedAfter)).toBe(Number(recordedBefore) + 1)
    // One resident's round, and nobody else's.
    expect(openDosesAt('res-kavanagh' as ResidentId, TODAY, ROUND)).toEqual(
      kavanaghOpen,
    )
    expect(document.querySelector('[data-round-banner]')?.textContent).toMatch(
      /not yet recorded/,
    )
  })
})

describe('PRN', () => {
  it('needs a reason and a symptom, then shows the outcome as not recorded, and records one', async () => {
    const { user } = await openRound()
    await atRound(user)
    const card = cardFor('res-okafor')
    const inhaler = card.querySelector<HTMLElement>('[data-prn]')!
    await user.click(within(inhaler).getByRole('button', { name: 'PRN' }))
    expect(actFor(card)).toBeDisabled()

    await user.type(
      within(inhaler).getByLabelText('Reason for giving it'),
      'Asked for it',
    )
    expect(actFor(card)).toBeDisabled()
    await user.type(within(inhaler).getByLabelText('Symptom observed'), 'wheeze')
    expect(actFor(card)).toBeEnabled()

    await user.click(actFor(card))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(
      /PRN: Salbutamol inhaler 2 puffs, for wheeze, Asked for it/,
    )
    await signWith(user, '2222')

    await waitFor(() =>
      expect(prnGivenThisSession('res-okafor' as ResidentId)).toHaveLength(1),
    )
    const outcome = await screen.findByText('Outcome not recorded yet')
    expect(outcome.closest('[data-state="unrecorded"]')).not.toBeNull()
    expect(
      screen.getByText('No reminder is sent after 30 minutes.'),
    ).toBeInTheDocument()

    await user.type(
      screen.getByLabelText('What happened afterwards'),
      'Breathing eased',
    )
    await user.click(screen.getByRole('button', { name: 'Record outcome' }))
    expect(await screen.findByText('Outcome: Breathing eased')).toBeInTheDocument()
  })
})
