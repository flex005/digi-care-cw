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
import userEvent from '@testing-library/user-event'
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

/**
 * N. Eze's 20:00 round, the screen this all started from: her residents'
 * evening rounds held nothing but controlled drugs, so Given and Not given never
 * appeared for her anywhere in the build. The fixtures now carry an ordinary
 * evening medicine for each of her four (07/11/2026), and these hold what has
 * to stay true. Residents, doses and words are literals, from the records at
 * 20:20 BST on 16/09/2026.
 */
describe('your round for a care worker, N. Eze, at 20:00', () => {
  it('lists everybody on her list at the round', async () => {
    const expected = atRound(ezesList())
    expect(expected).toEqual([
      'res-adeyemi',
      'res-hutchinson',
      'res-okafor',
      'res-pemberton',
    ])
    openRound(staffEze.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    expect(shownRows()).toEqual(expected)
  })

  it('carries at least one ordinary dose she can record, and at least one controlled dose she cannot', async () => {
    // From the records: an ordinary dose open on her list, and a controlled one.
    const open = atRound(ezesList()).flatMap(openAt20)
    expect(
      open.some((record) => !medicationOf(record.medicationId).isControlledDrug),
    ).toBe(true)
    expect(
      open.some((record) => medicationOf(record.medicationId).isControlledDrug),
    ).toBe(true)

    // Beryl Hutchinson's atorvastatin is the only dose open on her round, and
    // the round row offers it.
    expect(openAt20('res-hutchinson').map((record) => record.medicationId)).toEqual([
      'med-res-hutchinson-atorvastatin',
    ])
    openRound(staffEze.id)
    await within(roundTab()).findByText(`${ROUND} round, 16/09/2026`)
    expect(
      rowOf('res-hutchinson')?.querySelector('[data-to-record]')?.textContent,
    ).toBe('1 to record now')
    expect(rowOf('res-hutchinson')?.querySelector('[data-controlled]')).toBeNull()

    // Arthur Pemberton's oxycodone is the only dose open on his, and she is told
    // who records it.
    expect(openAt20('res-pemberton').map((record) => record.medicationId)).toEqual([
      'med-res-pemberton-oxycodone-modified-release',
    ])
    expect(
      rowOf('res-pemberton')?.querySelector('[data-controlled="only"]')?.textContent,
    ).toBe(
      'Nothing for you to record for Arthur Pemberton: 1 controlled drug open. A senior carer records controlled drugs.',
    )
    expect(rowOf('res-pemberton')?.querySelector('[data-to-record]')).toBeNull()
    expect(roundTab().textContent).not.toMatch(/PRD|role table|not built/)
  })

  it('opens Hutchinson’s round with Given and Not given, and a signature she can give', async () => {
    const user = userEvent.setup()
    const sheet = await openSheet(user, 'res-hutchinson', 'Beryl')
    await user.click(
      within(
        within(sheet).getByRole('radiogroup', { name: 'Answer for Atorvastatin 20mg' }),
      ).getByRole('radio', { name: 'Given' }),
    )
    expect(within(sheet).getByRole('radio', { name: 'Not given' })).toBeTruthy()
    expect(
      within(sheet).getByRole('button', { name: 'Sign with your medication PIN' }),
    ).toBeEnabled()
    expect(sheet.querySelector('[data-sheet-held]')).toBeNull()
  })

  it('says why she cannot sign Okafor’s round, whose morphine is open beside his atorvastatin', async () => {
    const user = userEvent.setup()
    expect(
      openAt20('res-okafor')
        .map((record) => record.medicationId)
        .sort(),
    ).toEqual([
      'med-res-okafor-atorvastatin',
      'med-res-okafor-morphine-sulfate-oral-solution',
    ])
    const sheet = await openSheet(user, 'res-okafor', 'Emmanuel')
    expect(sheet.querySelector('[data-sheet-held]')?.textContent).toBe(
      'A senior carer records controlled drugs. A round is recorded all at once, so you cannot record this round.',
    )
    expect(within(sheet).queryByRole('button', { name: /medication PIN/ })).toBeNull()
  })
})

/** The sheet for one of N. Eze's residents, opened from their chart. */
async function openSheet(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
  preferred: string,
) {
  window.history.replaceState(null, '', `/m/people/${id}/chart`)
  renderSignedIn(staffEze.id, <PhoneApp />, ROSEWOOD)
  const people = document.querySelector('[data-tab="people"]') as HTMLElement
  await user.click(
    await within(people).findByRole(
      'button',
      { name: 'Record the 20:00 round' },
      { timeout: 4000 },
    ),
  )
  return screen.findByRole('dialog', { name: `20:00 round for ${preferred}` })
}

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
