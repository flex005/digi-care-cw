import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 16/09/2026 at 20:20
 * BST, twenty minutes into the 20:00 round, the instant the round's tests use.
 * Which doses are due, given or omitted today is read from the clock, so an
 * hour-only pin would take the machine's date and zone (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

import { within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, SiteId, StaffId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { medications } from '@/data/fixtures/medications'
import { now } from '@/data/fixtures/clock'
import { patchedRecords } from '@/data/access/mar-store'
import { zonedDate } from '@/lib/format'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * Today's chart on the phone: every dose of the day at its round, read-only,
 * **and a dose the phone cannot record still on it, saying why.**
 */

const ROSEWOOD = 'site-rosewood-court' as SiteId
const TODAY = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

afterEach(() => window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z'))

function openChart(id: string, who: StaffId) {
  window.history.replaceState(null, '', `/m/people/${id}/chart`)
  return renderSignedIn(who, <PhoneApp />, ROSEWOOD)
}

const people = () => document.querySelector('[data-tab="people"]') as HTMLElement
/* A senior carer's root is the whole home's list, which loads first; the
   record tests in phone.test.tsx wait as long for the same reason. */
const loaded = () =>
  within(people()).findByText(/^Today, /, undefined, { timeout: 4000 })

const drugOf = (id: string) => {
  const found = medications.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No medication ${id}`)
  return found
}

/** A person's scheduled doses today, from the records, never from the screen. */
const dosesToday = (id: string) =>
  patchedRecords().filter(
    (record) =>
      record.residentId === id &&
      record.date === TODAY &&
      record.state.kind !== 'not_due' &&
      !drugOf(record.medicationId).isPrn,
  )

const doseIn = (round: string, drug: string) =>
  people().querySelector<HTMLElement>(
    `[data-chart-round="${round}"] [data-chart-dose="${drug}"]`,
  )

describe('today’s chart, as a care worker', () => {
  it('draws every scheduled dose of the day at its own round, and nothing else as a dose', async () => {
    const expected = dosesToday('res-pemberton')
      .map((record) => `${record.roundTime}|${record.medicationId}`)
      .sort()
    expect(expected.length).toBeGreaterThan(2)
    openChart('res-pemberton', staffEze.id)
    await loaded()
    const shown = [...people().querySelectorAll<HTMLElement>('[data-chart-dose]')]
      .map(
        (dose) =>
          `${dose.closest<HTMLElement>('[data-chart-round]')?.dataset.chartRound}|${dose.dataset.chartDose}`,
      )
      .sort()
    expect(shown).toEqual(expected)
  })

  it('keeps a controlled drug that is due on the chart, saying why it cannot be recorded here', async () => {
    const open = dosesToday('res-pemberton').filter(
      (record) => record.state.kind === 'due',
    )
    expect(open.length).toBeGreaterThan(0)
    expect(open.every((record) => drugOf(record.medicationId).isControlledDrug)).toBe(
      true,
    )
    openChart('res-pemberton', staffEze.id)
    await loaded()
    for (const record of open) {
      const dose = doseIn(record.roundTime, record.medicationId)
      if (dose === null) throw new Error(`No dose ${record.medicationId}`)
      expect(dose.querySelector('[data-cannot-record="controlled"]')?.textContent).toBe(
        'Recording a controlled drug — not built yet on the phone.',
      )
    }
    // The role table's open question is for the PRD's author, never printed at the reader.
    expect(people().querySelector('[data-answer]')).toBeNull()
    expect(people().textContent).not.toMatch(/PRD|role table/)
  })

  it('draws a given dose and its missing second signature as two facts', async () => {
    const half = dosesToday('res-pemberton').find(
      (record) =>
        record.state.kind === 'given' &&
        record.state.witness.kind === 'required_not_recorded',
    )
    if (half === undefined) throw new Error('No half-signed dose today for Pemberton')
    openChart('res-pemberton', staffEze.id)
    await loaded()
    const dose = doseIn(half.roundTime, half.medicationId)
    expect(dose?.querySelector('[data-dose="given"]')?.textContent).toContain('Given')
    const missing = dose?.querySelector('[data-second-signature="missing"]')
    expect(missing?.querySelector('[data-state="unrecorded"]')).not.toBeNull()
    expect(missing?.textContent).toContain('Second signature not recorded')
  })

  it('hatches an omission and says nobody has closed it', async () => {
    const omitted = dosesToday('res-adeyemi').find(
      (record) => record.state.kind === 'omitted',
    )
    if (omitted === undefined) throw new Error('No omission today for Adeyemi')
    openChart('res-adeyemi', staffEze.id)
    await loaded()
    const dose = doseIn(omitted.roundTime, omitted.medicationId)
    expect(
      dose?.querySelector('[data-dose="omitted"] [data-state="unrecorded"]'),
    ).not.toBeNull()
    expect(dose?.querySelector('[data-closure="open"]')).not.toBeNull()
  })

  // Adeyemi has PRN doses given today, which are not due and must not be counted.
  it.each(['res-pemberton', 'res-adeyemi'])(
    'counts what was recorded out of what was due today, for %s',
    async (id) => {
      const due = dosesToday(id)
      const recorded = due.filter(
        (record) => record.state.kind === 'given' || record.state.kind === 'not_given',
      )
      openChart(id, staffEze.id)
      await loaded()
      expect(people().querySelector('[data-chart-count]')?.textContent).toBe(
        `${recorded.length} of ${due.length} doses due today recorded`,
      )
    },
  )

  it('lists every PRN medicine, given today or not, and has no control that records', async () => {
    const prn = medications.filter(
      (drug) => drug.residentId === 'res-adeyemi' && drug.isPrn,
    )
    expect(prn.length).toBeGreaterThan(0)
    openChart('res-adeyemi', staffEze.id)
    await loaded()
    const card = people().querySelector<HTMLElement>('[data-chart-prn]')
    for (const drug of prn) expect(card?.textContent).toContain(drug.name)
    expect(
      within(people()).queryByRole('button', { name: /^(Given|Not given|Record)/ }),
    ).toBeNull()
    expect(people().querySelector('[data-chart-history]')?.textContent).toBe(
      'Earlier days — not built yet on the phone.',
    )
  })
})

describe('today’s chart, as a senior carer', () => {
  it('lists a scheduled medicine with no dose today under not due today, rather than leaving it off', async () => {
    const scheduled = medications.filter(
      (drug) => drug.residentId === 'res-kavanagh' && !drug.isPrn,
    )
    const withDose = new Set(dosesToday('res-kavanagh').map((r) => r.medicationId))
    const notDue = scheduled.filter((drug) => !withDose.has(drug.id))
    expect(notDue.length).toBeGreaterThan(0)
    openChart('res-kavanagh', staffAkinyemi.id)
    await loaded()
    const card = people().querySelector<HTMLElement>('[data-chart-not-due]')
    for (const drug of notDue) expect(card?.textContent).toContain(drug.name)
    // Every medicine is somewhere: at a round, as required, or not due today.
    const text = people().textContent ?? ''
    for (const drug of medications.filter(
      (entry) => entry.residentId === 'res-kavanagh',
    ))
      expect(text).toContain(drug.name)
  })

  it('offers the round in front as one act where an ordinary dose is open, and asks no role question', async () => {
    const open = dosesToday('res-lonsdale').filter((r) => r.state.kind === 'due')
    expect(open.length).toBeGreaterThan(0)
    expect(open.some((r) => drugOf(r.medicationId).isControlledDrug)).toBe(false)
    openChart('res-lonsdale', staffAkinyemi.id)
    await loaded()
    expect(
      within(people()).getByRole('button', { name: 'Record the 20:00 round' }),
    ).toBeTruthy()
    // Recording an ordinary dose has a way in now, so no dose says it is not built.
    expect(people().querySelector('[data-cannot-record]')).toBeNull()
    expect(people().querySelector('[data-answer]')).toBeNull()
  })
})
