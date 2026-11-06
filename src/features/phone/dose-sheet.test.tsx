import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026, twenty minutes into the 20:00 round, so its windows are open
 * (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SiteId, StaffId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { medications } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { patchedRecords } from '@/data/access/mar-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * The phone's dose sheet: one person's round, every dose on it, Given or Not
 * given with no default, and **nothing recorded**, because signing is the next
 * step.
 */

const ROSEWOOD = 'site-rosewood-court' as SiteId
const DAY = '2026-09-16'

afterEach(() => window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z'))

const drugOf = (id: string) => {
  const found = medications.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No medication ${id}`)
  return found
}
const personOf = (id: string) => {
  const found = residents.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No resident ${id}`)
  return found
}

/** A person's 20:00 doses that are due and not controlled drugs, from the records. */
const ordinaryOpen = (id: string) =>
  patchedRecords().filter(
    (record) =>
      record.residentId === id &&
      record.date === DAY &&
      record.roundTime === '20:00' &&
      record.state.kind === 'due' &&
      !drugOf(record.medicationId).isPrn &&
      !drugOf(record.medicationId).isControlledDrug,
  )

async function openSheet(id: string, who: StaffId) {
  window.history.replaceState(null, '', `/m/people/${id}/chart`)
  renderSignedIn(who, <PhoneApp />, ROSEWOOD)
  const people = document.querySelector('[data-tab="people"]') as HTMLElement
  fireEvent.click(
    await within(people).findByRole(
      'button',
      { name: 'Record the 20:00 round' },
      { timeout: 4000 },
    ),
  )
  return screen.findByRole('dialog', {
    name: `20:00 round for ${personOf(id).preferredName}`,
  })
}

const answersFor = (sheet: HTMLElement, id: string) =>
  within(sheet).getByRole('radiogroup', {
    name: `Answer for ${drugOf(id).name} ${drugOf(id).dose}`,
  })

describe('the dose sheet', () => {
  it('pins who it is, their allergies and the line saying nothing checks them', async () => {
    const sheet = await openSheet('res-lonsdale', staffAkinyemi.id)
    expect(sheet.querySelector('[data-subject-header]')?.textContent).toContain(
      personOf('res-lonsdale').fullLegalName,
    )
    const allergies = sheet.querySelector<HTMLElement>('[data-sheet-allergies]')
    expect(allergies?.dataset.sheetAllergies).toBe('allergies')
    // Pinned: the substances alone. The reactions open the body (seven-allergies test).
    expect(allergies?.querySelector('[data-tone="critical"]')?.textContent).toBe(
      'Allergies: Penicillin, Latex',
    )
    expect(allergies?.textContent).toContain(
      'Nothing here checks these drugs against Vera Lonsdale’s allergies.',
    )
  })

  it('offers Given and Not given on every open ordinary dose, with neither chosen', async () => {
    const open = ordinaryOpen('res-lonsdale')
    expect(open.length).toBe(2)
    const sheet = await openSheet('res-lonsdale', staffAkinyemi.id)
    for (const record of open) {
      const group = answersFor(sheet, record.medicationId)
      const radios = within(group).getAllByRole('radio')
      expect(radios.map((radio) => radio.textContent)).toEqual(['Given', 'Not given'])
      expect(
        radios.every((radio) => radio.getAttribute('aria-checked') === 'false'),
      ).toBe(true)
    }
    for (const record of open)
      expect(
        sheet.querySelector(`[data-sheet-dose="${record.medicationId}"] [data-needed]`)
          ?.textContent,
      ).toBe('Still needed: nothing chosen.')
    expect(sheet.querySelector('[data-still-needed]')?.textContent).toBe(
      '2 of 2 doses still need something before the round can be signed.',
    )
    expect(sheet.querySelector('[data-sheet-sign]')).toBeNull()
  })

  it('needs a reason for Not given, and words for Other, before it offers the medication PIN — and records nothing before it', async () => {
    const [first, second] = ordinaryOpen('res-lonsdale')
    if (first === undefined || second === undefined)
      throw new Error('Two doses expected')
    const before = JSON.stringify(
      patchedRecords().filter((record) => record.residentId === 'res-lonsdale'),
    )
    const sheet = await openSheet('res-lonsdale', staffAkinyemi.id)
    const needed = () => sheet.querySelector('[data-still-needed]')?.textContent ?? ''
    const neededAt = (id: string) =>
      sheet.querySelector(`[data-sheet-dose="${id}"] [data-needed]`)?.textContent ?? ''

    fireEvent.click(
      within(answersFor(sheet, first.medicationId)).getByRole('radio', {
        name: 'Given',
      }),
    )
    fireEvent.click(
      within(answersFor(sheet, second.medicationId)).getByRole('radio', {
        name: 'Not given',
      }),
    )
    const secondName = drugOf(second.medicationId).name
    expect(neededAt(first.medicationId)).toBe('')
    expect(neededAt(second.medicationId)).toBe('Still needed: no reason chosen.')
    expect(needed()).toBe(
      '1 of 2 doses still needs something before the round can be signed.',
    )

    const reasons = within(sheet).getByRole('radiogroup', {
      name: `Why ${secondName} ${drugOf(second.medicationId).dose} was not given`,
    })
    fireEvent.click(within(reasons).getByRole('radio', { name: 'Other' }))
    expect(neededAt(second.medicationId)).toBe(
      'Still needed: say why it was not given.',
    )
    expect(sheet.querySelector('[data-sheet-sign]')).toBeNull()

    fireEvent.change(within(sheet).getByLabelText('Why was it not given? (required)'), {
      target: { value: 'Asleep and could not be woken safely' },
    })
    expect(sheet.querySelector('[data-still-needed]')).toBeNull()
    // The literal words, not a constant: the credential is named the medication PIN (CLAUDE.md §6).
    expect(sheet.querySelector('[data-sheet-sign]')?.textContent).toBe(
      'Sign with your medication PIN',
    )
    expect(sheet.querySelector('[data-sheet-answered]')?.textContent).toBe(
      '2 of 2 doses answered',
    )

    // Nothing reaches the record until the PIN is given.
    expect(
      JSON.stringify(
        patchedRecords().filter((record) => record.residentId === 'res-lonsdale'),
      ),
    ).toBe(before)
  })

  it('lists a dose already recorded at the round, and the PRN line, without answers for either', async () => {
    const recorded = patchedRecords().find(
      (record) =>
        record.residentId === 'res-kavanagh' &&
        record.date === DAY &&
        record.roundTime === '20:00' &&
        record.state.kind === 'given' &&
        !drugOf(record.medicationId).isPrn,
    )
    if (recorded === undefined) throw new Error('No dose given at 20:00 for Kavanagh')
    const sheet = await openSheet('res-kavanagh', staffAkinyemi.id)
    const row = sheet.querySelector(`[data-sheet-dose="${recorded.medicationId}"]`)
    expect(row?.getAttribute('data-sheet-kind')).toBe('recorded')
    expect(row?.querySelector('[role="radio"]')).toBeNull()
    expect(row?.querySelector('[data-dose="given"]')).not.toBeNull()
    expect(row?.querySelector('[data-cannot-correct]')?.textContent).toBe(
      'Correcting a recorded dose — not built yet.',
    )
    expect(sheet.textContent).toContain('as required — not built yet on the phone.')
  })
})

describe('a round with a controlled drug and an ordinary dose open together', () => {
  it('lists the controlled drug on the sheet, saying why, with no answers, and still asks only for the ordinary dose', async () => {
    const controlled = patchedRecords().filter(
      (record) =>
        record.residentId === 'res-bello' &&
        record.date === DAY &&
        record.roundTime === '20:00' &&
        record.state.kind === 'due' &&
        drugOf(record.medicationId).isControlledDrug,
    )
    expect(controlled.length).toBeGreaterThan(0)
    expect(ordinaryOpen('res-bello').length).toBeGreaterThan(0)
    const sheet = await openSheet('res-bello', staffAkinyemi.id)
    for (const record of controlled) {
      const row = sheet.querySelector(`[data-sheet-dose="${record.medicationId}"]`)
      expect(row?.getAttribute('data-sheet-kind')).toBe('controlled')
      expect(row?.querySelector('[role="radio"]')).toBeNull()
      expect(row?.textContent).toContain(
        'Recording a controlled drug — not built yet on the phone.',
      )
    }
    expect(ordinaryOpen('res-bello')).toHaveLength(1)
    expect(sheet.querySelector('[data-still-needed]')?.textContent).toBe(
      '1 of 1 dose still needs something before the round can be signed.',
    )
  })
})

describe('where the round in front has nothing the phone can record', () => {
  it('offers no act, and the chart still says why at the dose', async () => {
    expect(ordinaryOpen('res-pemberton')).toHaveLength(0)
    window.history.replaceState(null, '', '/m/people/res-pemberton/chart')
    renderSignedIn(staffEze.id, <PhoneApp />, ROSEWOOD)
    const people = document.querySelector('[data-tab="people"]') as HTMLElement
    await within(people).findByText(/^Today, /)
    expect(within(people).queryByRole('button', { name: /^Record the/ })).toBeNull()
    expect(people.querySelector('[data-cannot-record="controlled"]')).not.toBeNull()
  })
})
