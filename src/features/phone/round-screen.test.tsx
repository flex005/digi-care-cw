import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 16/09/2026 at 20:20
 * BST, twenty minutes into the 20:00 round, the instant the round's own tests
 * use. A pin naming only the hour would take today's date and the machine's
 * zone (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m/round?at=2026-09-16T19:20:00Z')
})

import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, SiteId, StaffId } from '@/data/types'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { medications } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { patchedRecords } from '@/data/access/mar-store'
import { memberById } from '@/data/access/team-store'
import { residentScopeFor, scopeReaches } from '@/app/session/resident-scope'
import { zonedDate } from '@/lib/format'
import { renderSignedIn } from '@/test/render-signed-in'
import { listName } from './phone-data'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * Your round on the phone: who is at the round, and what the phone can and
 * cannot do about each. **Nobody at the round is left off it**, least of all a
 * person whose only open doses are controlled drugs.
 */

const ROUND = '20:00'
const ROSEWOOD = 'site-rosewood-court' as SiteId
const TODAY = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

afterEach(() =>
  window.history.replaceState(null, '', '/m/round?at=2026-09-16T19:20:00Z'),
)

function openRound(who: StaffId) {
  window.history.replaceState(null, '', '/m/round')
  return renderSignedIn(who, <PhoneApp />, ROSEWOOD)
}

const roundTab = () => document.querySelector('[data-tab="round"]') as HTMLElement
const rowOf = (id: string) =>
  roundTab().querySelector<HTMLElement>(`[data-round-row="${id}"]`)
const shownRows = () =>
  [...roundTab().querySelectorAll<HTMLElement>('[data-round-row]')]
    .map((row) => row.dataset.roundRow ?? '')
    .sort()

const medicationOf = (id: string) => {
  const found = medications.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No medication ${id}`)
  return found
}

/** Who has a scheduled dose on today's 20:00 chart, from the records, not the screen. */
function atRound(reaches: (id: string) => boolean): string[] {
  return [
    ...new Set(
      patchedRecords()
        .filter(
          (record) =>
            record.date === TODAY &&
            record.roundTime === ROUND &&
            record.state.kind !== 'not_due' &&
            !medicationOf(record.medicationId).isPrn &&
            reaches(record.residentId),
        )
        .map((record) => record.residentId),
    ),
  ].sort()
}

/** A person's doses at 20:00 that are still open, from the records. */
const openAt20 = (id: string) =>
  patchedRecords().filter(
    (record) =>
      record.residentId === id &&
      record.date === TODAY &&
      record.roundTime === ROUND &&
      record.state.kind === 'due' &&
      !medicationOf(record.medicationId).isPrn,
  )

function ezesList(): (id: string) => boolean {
  const member = memberById(staffEze.id)
  if (member === undefined) throw new Error('N. Eze is not on the team')
  const scope = residentScopeFor(member)
  return (id) => scope.kind !== 'not_decided' && scopeReaches(scope, id as never)
}

/** The names a reader sees in a row's sentence, written here rather than asked of `listName`. */
const LIST_NAMES: Record<string, string> = {
  'res-adeyemi': 'Grace Adeyemi',
  'res-okafor': 'Emmanuel Okafor',
  'res-pemberton': 'Arthur Pemberton',
}

describe('your round for a care worker whose open doses are all controlled drugs', () => {
  it('lists everybody on her list at the round, and the fixtures make every open dose controlled', async () => {
    const reaches = ezesList()
    const expected = atRound(reaches)
    expect(expected.length).toBeGreaterThan(0)
    const open = expected.flatMap(openAt20)
    expect(open.length).toBeGreaterThan(0)
    expect(
      open.every((record) => medicationOf(record.medicationId).isControlledDrug),
    ).toBe(true)

    openRound(staffEze.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    expect(shownRows()).toEqual(expected)
  })

  it('says on each such row that a senior carer records controlled drugs, and nothing about the PRD', async () => {
    const withOpen = atRound(ezesList()).filter((id) => openAt20(id).length > 0)
    expect(withOpen.length).toBeGreaterThan(0)
    openRound(staffEze.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    for (const id of withOpen) {
      const row = rowOf(id)
      if (row === null) throw new Error(`No row for ${id}`)
      // The list name, as the row's heading: the legal name under it reads as two people.
      const name = LIST_NAMES[id]
      if (name === undefined) throw new Error(`No list name written here for ${id}`)
      expect(row.querySelector('[data-controlled="only"]')?.textContent).toMatch(
        new RegExp(
          `^Nothing for you to record for ${name}: \\d+ controlled drugs? open\\. A senior carer records controlled drugs\\.$`,
        ),
      )
      expect(row.textContent).not.toMatch(/not built/)
      expect(row.querySelector('[data-to-record]')).toBeNull()
    }
    // The role table's open question is for the PRD's author, never printed at the reader.
    expect(roundTab().querySelector('[data-answer]')).toBeNull()
    expect(roundTab().textContent).not.toMatch(/PRD|role table/)
  })
})

describe('your round for a senior carer', () => {
  it('counts what the phone can record now, and draws no role question where the table says yes', async () => {
    const lonsdale = openAt20('res-lonsdale')
    expect(lonsdale.length).toBe(2)
    expect(
      lonsdale.some((record) => medicationOf(record.medicationId).isControlledDrug),
    ).toBe(false)
    openRound(staffAkinyemi.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    expect(rowOf('res-lonsdale')?.querySelector('[data-to-record]')?.textContent).toBe(
      '2 to record now',
    )
    expect(roundTab().querySelector('[data-answer="contradicted"]')).toBeNull()
    expect(shownRows()).toEqual(
      atRound((id) => residents.some((r) => r.id === id && r.siteId === ROSEWOOD)),
    )
  })

  it('names a person in the row’s sentence by the list name, where it differs from the legal name', async () => {
    const ashworth = residents.find((entry) => entry.id === 'res-ashworth')
    if (ashworth === undefined) throw new Error('No res-ashworth')
    // The case only exists where the two names differ; say so rather than pass vacuously.
    expect(listName(ashworth)).not.toBe(ashworth.fullLegalName)
    openRound(staffAkinyemi.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    const line = rowOf('res-ashworth')?.querySelector('[data-controlled="only"]')
    expect(line?.textContent).toContain('Nothing can be recorded for Ron Ashworth here')
    expect(line?.textContent).not.toContain(ashworth.fullLegalName)
  })

  it('opens a record from a row and has nothing on it that records', async () => {
    openRound(staffAkinyemi.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    const link = rowOf('res-lonsdale')?.closest('a')
    expect(link?.getAttribute('href')).toBe('/m/people/res-lonsdale')
    expect(
      within(roundTab()).queryByRole('button', { name: /^(Given|Not given|Record)/ }),
    ).toBeNull()
  })
})

describe('your round for a care worker with no list', () => {
  it('hatches the list nobody decided, rather than drawing an empty round', async () => {
    openRound(staffOsei.id)
    await waitFor(() =>
      expect(roundTab().querySelector('[data-scope="not_decided"]')).not.toBeNull(),
    )
    expect(roundTab().querySelector('[data-state="unrecorded"]')).not.toBeNull()
    expect(screen.queryByText(`${ROUND} round, 16/09/2026`)).toBeNull()
  })
})
