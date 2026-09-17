import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import type { Medication, Resident, ResidentId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import {
  PRN_WITHOUT_MAXIMUM,
  dueWithinLookahead,
  medicationsFor,
} from '@/data/fixtures/medications'
import { recordPrn, stockBalanceFor } from '@/data/access/client'
import { resetSessionAdministrations } from '@/data/access/mar-store'
import { CARE_ACTS } from '@/app/session/capabilities'
import { renderProfileTab } from '@/test/render-signed-in'
import { quantityWithUnit } from '../register/units'
import { MedicationsTab } from './MedicationsTab'

/**
 * A resident's Medications tab.
 *
 * What is under test is that no prescription field can be blank: each is
 * answered or hatched, the 24-hour maximum keeps its three answers apart, and a
 * controlled drug nobody counted never reads as a balance of zero.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => {
  resetSessionAdministrations()
})

function residentOf(id: string): Resident {
  const resident = residents.find((entry) => entry.id === id)
  if (resident === undefined) throw new Error(`No fixture resident ${id}`)
  return resident
}

function medicationOf(residentId: string, test: (medication: Medication) => boolean) {
  const found = medicationsFor(residentId as ResidentId).find(test)
  if (found === undefined) throw new Error(`No such medication for ${residentId}`)
  return found
}

async function openTab(staffId: typeof staffEze.id, residentId: string) {
  const resident = residentOf(residentId)
  navigation.params = { residentId: resident.id }
  navigation.pathname = `/residents/${resident.id}/medications`
  const { container } = renderProfileTab(staffId, <MedicationsTab />, resident.siteId)
  await waitFor(() =>
    expect(container.querySelector('[data-tab-body="medications"]')).toBeTruthy(),
  )
  return container.querySelector('[data-tab-body="medications"]') as HTMLElement
}

const card = (tab: HTMLElement, medication: Medication) => {
  const found = tab.querySelector(`[data-medication="${medication.id}"]`)
  if (found === null) throw new Error(`No card for ${medication.id}`)
  return found as HTMLElement
}

const field = (scope: HTMLElement, id: string) => {
  const found = scope.querySelector(`[data-field="${id}"]`)
  if (found === null) throw new Error(`No field ${id}`)
  return found as HTMLElement
}

const hatched = (scope: Element) => scope.querySelector('[data-state="unrecorded"]')

const FIELDS = [
  'dose',
  'route',
  'form',
  'rounds',
  'interval',
  'instructions',
  'prescriber',
  'storage',
  'maximum',
  'started',
  'controlled',
]

describe('every medication prescribed, every field answered', () => {
  it('lists each medication with each field, none of them empty', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    const prescribed = medicationsFor('res-okafor' as ResidentId)

    expect(tab.querySelectorAll('[data-medication]')).toHaveLength(prescribed.length)
    for (const medication of prescribed) {
      const scope = card(tab, medication)
      expect(scope.textContent).toContain(medication.name)
      for (const id of FIELDS) {
        expect(field(scope, id).querySelector('dd')?.textContent?.trim(), id).not.toBe(
          '',
        )
      }
      expect(field(scope, 'dose').textContent).toContain(medication.dose)
      expect(field(scope, 'route').textContent).toContain(medication.route)
      expect(field(scope, 'form').textContent).toContain(medication.form)
      expect(field(scope, 'rounds').textContent).toContain(
        medication.isPrn ? 'As required' : medication.roundTimes[0],
      )
      expect(Boolean(scope.querySelector('[data-field="balance"]'))).toBe(
        medication.isControlledDrug,
      )
    }
  })

  it('hatches a prescriber, storage or instructions nobody recorded', async () => {
    const noPrescriber = medicationOf(
      'res-adeyemi',
      (medication) => medication.prescriber.kind === 'unrecorded',
    )
    const tab = await openTab(staffEze.id, 'res-adeyemi')
    const prescriber = field(card(tab, noPrescriber), 'prescriber')
    expect(hatched(prescriber)).toBeTruthy()
    expect(prescriber.textContent).toContain('Prescriber not recorded')
  })

  it('hatches storage nobody recorded, and leaves a recorded one plain', async () => {
    const noStorage = medicationOf(
      'res-pemberton',
      (medication) => medication.storage.kind === 'unrecorded',
    )
    const withStorage = medicationOf(
      'res-pemberton',
      (medication) => medication.storage.kind === 'recorded',
    )
    const tab = await openTab(staffEze.id, 'res-pemberton')
    expect(hatched(field(card(tab, noStorage), 'storage'))).toBeTruthy()
    expect(field(card(tab, noStorage), 'storage').textContent).toContain(
      'Storage not recorded',
    )
    expect(hatched(field(card(tab, withStorage), 'storage'))).toBeNull()
  })

  it('hatches instructions nobody recorded', async () => {
    const noInstructions = medicationOf(
      'res-kavanagh',
      (medication) => medication.instructions.kind === 'unrecorded',
    )
    const tab = await openTab(staffAkinyemi.id, 'res-kavanagh')
    const instructions = field(card(tab, noInstructions), 'instructions')
    expect(hatched(instructions)).toBeTruthy()
    expect(instructions.textContent).toContain('Instructions not recorded')
  })
})

describe('the maximum in 24 hours, in its three answers', () => {
  it('hatches a maximum nobody recorded, as a safety check that cannot run', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    const salbutamol = medicationOf('res-okafor', (m) => m.id === PRN_WITHOUT_MAXIMUM)
    const maximum = field(card(tab, salbutamol), 'maximum')
    expect(maximum.querySelector('[data-maximum="not_recorded"]')).toBeTruthy()
    expect(hatched(maximum)).toBeTruthy()
    expect(maximum.textContent).toMatch(/safety check that cannot run/)
  })

  it('states not applicable plainly, and a recorded maximum with its unit', async () => {
    const tab = await openTab(staffEze.id, 'res-adeyemi')
    const scheduled = medicationOf(
      'res-adeyemi',
      (m) => m.maximumIn24Hours.kind === 'not_applicable',
    )
    const recorded = medicationOf(
      'res-adeyemi',
      (m) => m.maximumIn24Hours.kind === 'recorded',
    )

    const plain = field(card(tab, scheduled), 'maximum')
    expect(plain.querySelector('[data-maximum="not_applicable"]')).toBeTruthy()
    expect(hatched(plain)).toBeNull()
    expect(plain.textContent).toMatch(/Not applicable/)

    const quantity = field(card(tab, recorded), 'maximum')
    expect(quantity.querySelector('[data-maximum="recorded"]')).toBeTruthy()
    expect(hatched(quantity)).toBeNull()
    if (recorded.maximumIn24Hours.kind !== 'recorded') throw new Error('Not recorded')
    expect(quantity.querySelector('dd')?.textContent).toBe(
      `${quantityWithUnit(recorded.maximumIn24Hours.quantity, recorded.stockUnit)} in any 24 hours`,
    )
  })
})

describe('a controlled drug’s balance', () => {
  it('hatches a balance nobody counted, and never shows it as zero', async () => {
    const uncounted = medicationOf(
      'res-adeyemi',
      (m) => m.isControlledDrug && stockBalanceFor(m.id).kind === 'no_balance_recorded',
    )
    const tab = await openTab(staffEze.id, 'res-adeyemi')
    const balance = field(card(tab, uncounted), 'balance')
    expect(balance.querySelector('[data-balance="no_balance_recorded"]')).toBeTruthy()
    expect(hatched(balance)).toBeTruthy()
    expect(balance.textContent).toContain('No balance recorded')
    expect(balance.querySelector('dd')?.textContent).not.toMatch(/\b0\b/)
  })

  it('states a counted balance with its unit, who counted it and when', async () => {
    const counted = medicationOf(
      'res-okafor',
      (m) => m.isControlledDrug && stockBalanceFor(m.id).kind === 'counted',
    )
    const tab = await openTab(staffEze.id, 'res-okafor')
    const balance = field(card(tab, counted), 'balance')
    expect(balance.querySelector('[data-balance="counted"]')).toBeTruthy()
    expect(hatched(balance)).toBeNull()
    expect(balance.textContent).toMatch(/Counted by .+, \d{2}\/\d{2}\/\d{4}/)
  })

  it('links a controlled drug to the register only for a viewer the table lets see it', async () => {
    const senior = await openTab(staffAkinyemi.id, 'res-okafor')
    expect(senior.querySelector('[data-register-link]')?.getAttribute('href')).toBe(
      '/medications/register',
    )
  })

  it('draws no register link and no refusal line for a viewer who may not see it', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    expect(tab.querySelector('[data-register-link]')).toBeNull()
    expect(tab.textContent).not.toMatch(/register is for/)
  })
})

describe('the acts at the head of the tab', () => {
  it('opens the MAR', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    expect(tab.querySelector('[data-open-mar]')?.getAttribute('href')).toBe(
      '/residents/res-okafor/medications/mar',
    )
  })

  it.each([
    ['Eze', staffEze.id],
    ['Akinyemi', staffAkinyemi.id],
  ] as const)(
    'refuses Add interim medication to %s, in the role table’s words',
    async (_who, staffId) => {
      const tab = await openTab(staffId, 'res-okafor')
      const point = tab.querySelector('[data-answer]') as HTMLElement
      expect(point.getAttribute('data-answer')).toBe('not_your_role')
      expect(
        within(point).getByRole('button', { name: 'Add interim medication' }),
      ).toBeDisabled()
      const reasons = Object.values(CARE_ACTS.add_interim_medication).flatMap((cell) =>
        typeof cell === 'object' && 'kind' in cell && cell.kind === 'may_not'
          ? [cell.reason]
          : [],
      )
      expect(reasons).toContain(
        point.querySelector('[data-act-line="refused"]')?.textContent?.trim(),
      )
    },
  )
})

describe('due now, and as-required doses this session', () => {
  it('lists what is due in the lookahead, or says nothing is', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    const due = dueWithinLookahead('res-okafor' as ResidentId)
    if (due.length === 0) expect(tab.querySelector('[data-due-none]')).toBeTruthy()
    else expect(tab.querySelectorAll('[data-due]')).toHaveLength(due.length)
  })

  it('says no as-required dose was given, in words', async () => {
    const tab = await openTab(staffEze.id, 'res-okafor')
    expect(tab.querySelector('[data-prn-none]')?.textContent).toMatch(
      /No as-required dose/,
    )
  })

  it('hatches the outcome of a PRN dose nobody has followed up', async () => {
    const salbutamol = medicationOf('res-okafor', (m) => m.isPrn)
    await recordPrn({
      residentId: 'res-okafor' as ResidentId,
      medicationId: salbutamol.id,
      reason: 'Short of breath after walking',
      symptom: 'Wheeze',
      by: staffEze,
      at: '2026-09-17T10:00:00+01:00',
    })
    const tab = await openTab(staffEze.id, 'res-okafor')
    const row = tab.querySelector('[data-prn]') as HTMLElement
    expect(row.textContent).toContain(salbutamol.name)
    expect(row.textContent).toContain('Wheeze')
    const outcome = row.querySelector('[data-prn-outcome="not_recorded"]')
    expect(outcome).toBeTruthy()
    expect(hatched(outcome!)).toBeTruthy()
    expect(outcome?.textContent).toContain('Outcome not recorded')
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const tab = await openTab(staffAkinyemi.id, 'res-adeyemi')
    expect(await axe(tab)).toHaveNoViolations()
  })
})
