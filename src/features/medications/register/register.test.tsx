import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { GAP_MEDICATION_IDS } from '@/data/fixtures/medications'
import { patchedRecords, resetSessionAdministrations } from '@/data/access/mar-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { COUNTERSIGN_QUOTED, RegisterRoute } from './RegisterRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications/register', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => resetSessionAdministrations())

const drugCard = (id: string) =>
  document.querySelector(`[data-register-drug="${id}"]`)?.closest('[data-card]') as
    HTMLElement | null | undefined

const loaded = () =>
  waitFor(() => expect(document.querySelector('[data-register-drug]')).toBeTruthy(), {
    timeout: 5000,
  })

const awaitingRows = () => [
  ...document.querySelectorAll<HTMLElement>('[data-awaiting]'),
]

/** Pages through the awaiting list until a row matches. */
async function findAwaiting(
  match: (row: HTMLElement) => boolean,
): Promise<HTMLElement> {
  for (;;) {
    const row = awaitingRows().find(match)
    if (row) return row
    const pager = screen.getByRole('navigation', {
      name: 'Pages of doses awaiting Witness 2',
    })
    const next = pager.querySelector<HTMLButtonElement>('[data-pager-next]')!
    if (next.disabled) throw new Error('No awaiting dose matched.')
    await userEvent.click(next)
  }
}

describe('Controlled drug register: a care worker', () => {
  it('draws the tab, refused in the table’s words, with the register named', async () => {
    renderSignedIn(staffEze.id, <RegisterRoute />)
    const page = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-register-refused]')
      expect(found).toBeTruthy()
      return found!
    })
    expect(page.textContent).toContain('Senior carers keep it.')
    expect(
      within(page).getByRole('button', { name: 'Open the register' }),
    ).toBeDisabled()
    expect(page.querySelector('[data-act-line="refused"]')?.textContent).toBe(
      'The controlled drug register is for senior carers.',
    )
    expect(document.querySelector('table')).toBeNull()
    expect(document.querySelector('[data-awaiting]')).toBeNull()
  })
})

describe('Controlled drug register: a senior carer', () => {
  it('shows the running balance, and a drug nobody counted as hatched, never 0', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()

    const counted = drugCard(GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy)!
    const balance = counted.querySelector('[data-balance="counted"]')!
    expect(balance.textContent).toMatch(/Running balance[\d.]+ml remaining/)
    expect(balance.textContent).toContain('Last counted')

    const never = drugCard(GAP_MEDICATION_IDS.controlledDrugNeverCounted)!
    const none = never.querySelector('[data-balance="no_balance_recorded"]')!
    expect(none.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'No balance recorded',
    )
    expect(none.textContent).not.toMatch(/\d/)
    expect(never.querySelector('table')).toBeNull()
  })

  it('puts both witnesses on every entry, and a missing second signature as its own hatched fact', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()

    const table = drugCard(
      GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy,
    )!.querySelector('table')!
    const headers = [...table.querySelectorAll('th')].map((th) => th.textContent)
    expect(headers).toEqual([
      'Date',
      'Time',
      'What happened',
      'Quantity',
      'Running balance',
      'Witness 1',
      'Witness 2',
    ])
    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = row.querySelectorAll('td')
      expect(cells[5]?.textContent).not.toBe('')
      expect(cells[6]?.textContent).not.toBe('')
    }

    // Every dose the page names as waiting: Given, and beside it the gap.
    const row = awaitingRows()[0]!
    expect(row.querySelector('[data-tone="positive"]')?.textContent).toContain('Given')
    const gap = row.querySelector('[data-state="unrecorded"]')!
    expect(gap.textContent).toBe('Second signature not recorded')
    expect(gap.closest('[data-tone]')).toBeNull()
    expect(row.textContent).toContain(
      'Witness 1 has recorded. Awaiting Witness 2 signature.',
    )

    // And in a ledger, the hatch sits in Witness 2 beside "Given" in its own cell.
    const hatchedCells = [
      ...document.querySelectorAll(
        'tr[data-entry="given"] td [data-state="unrecorded"]',
      ),
    ]
    expect(hatchedCells.length).toBeGreaterThan(0)
    for (const cell of hatchedCells) {
      const tr = cell.closest('tr')!
      expect(tr.querySelectorAll('td')[2]?.textContent).toBe('Given')
      expect(tr.querySelectorAll('td')[6]?.contains(cell)).toBe(true)
    }
  })

  it('quotes MED-03’s silence about how old a dose may be, and refuses nothing', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()

    const quoted = document.querySelector('[data-countersign-silence]')
    expect(quoted?.textContent).toContain(COUNTERSIGN_QUOTED)
    expect(quoted?.textContent).toContain(
      'It does not say how long after a dose a second signature may still be added',
    )
    // A silence, not a refusal: nothing here is drawn as decided.
    expect(quoted?.closest('[data-state="unrecorded"]')).toBeNull()
    expect(quoted?.querySelector('[data-act-line]')).toBeNull()

    const row = await findAwaiting((candidate) =>
      Boolean(candidate.querySelector('[data-countersign]')),
    )
    expect(row.querySelector('[data-dose-silence]')?.textContent).toMatch(
      /^Waiting .+\. How long after a dose a second signature may still be added is not stated in MED-03\.$/,
    )
    // The act itself is untouched by the silence.
    expect(row.querySelector('[data-countersign]')).toBeEnabled()
  })

  it('countersigns another person’s dose with the medication PIN', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()

    const row = await findAwaiting((candidate) =>
      Boolean(candidate.querySelector('[data-countersign]')),
    )
    const key = row.dataset.awaiting!
    const [medicationId, date, roundTime] = key.split('|')

    await userEvent.click(within(row).getByRole('button', { name: 'Countersign' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-confirm-subject]')).toBeTruthy()
    expect(dialog.textContent).toMatch(/Countersign: .+ given to .+ at .+ by .+/)

    await userEvent.type(
      within(dialog).getByLabelText('Enter your medication PIN'),
      '4821',
    )
    await userEvent.click(
      dialog.querySelector<HTMLButtonElement>('[data-pin-confirm]')!,
    )

    await waitFor(() =>
      expect(document.querySelector('[data-countersigned]')?.textContent).toContain(
        'Both signatures are on the register.',
      ),
    )
    await waitFor(() =>
      expect(document.querySelector(`[data-awaiting="${CSS.escape(key)}"]`)).toBeNull(),
    )
    const record = patchedRecords().find(
      (entry) =>
        entry.medicationId === medicationId &&
        entry.date === date &&
        entry.roundTime === roundTime,
    )!
    expect(record.state.kind === 'given' && record.state.witness).toEqual({
      kind: 'witnessed',
      by: staffAkinyemi,
    })
  })

  it('does not offer to countersign a dose the viewer gave', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()
    const own = await findAwaiting((candidate) =>
      Boolean(candidate.querySelector('[data-own-dose]')),
    )
    expect(own.querySelector('[data-countersign]')).toBeNull()
    expect(own.querySelector('[data-own-dose]')?.textContent).toBe(
      'The second signature has to be another senior carer: you gave this dose.',
    )
    expect(own.querySelector('[data-tone="positive"]')?.textContent).toContain(
      staffAkinyemi.displayName,
    )
    expect(own.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('bans further administration in a red banner where a count does not reconcile, and says no alert is sent', async () => {
    renderSignedIn(staffAkinyemi.id, <RegisterRoute />)
    await loaded()
    const card = drugCard(GAP_MEDICATION_IDS.controlledDrugWithDiscrepancy)!
    const banner = card.querySelector('[data-discrepancy]')!
    expect(banner.textContent).toContain(
      'Stock count does not match the running balance. This must be resolved before any further administration.',
    )
    expect(banner.querySelector('[data-act-line="not_performed"]')?.textContent).toBe(
      'No alert is sent to the manager.',
    )
    expect(document.querySelectorAll('[data-discrepancy]')).toHaveLength(1)
  })
})
