import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 20:20 BST on
 * 16/09/2026, inside the 20:00 round's windows. The time the PIN puts on the
 * record is this instant, which is what these tests hold (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import type { SiteId, StaffId } from '@/data/types'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { medications } from '@/data/fixtures/medications'
import { residents } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { patchedRecords } from '@/data/access/mar-store'
import { endSession } from '@/data/access/session-losses'
import { resetMedicationPins } from '@/app/session/medication-pins'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * Signing a round on the phone with the medication PIN: what it signs, the time
 * it will record said before the PIN, the record written at that time, and a
 * round the phone cannot sign whole said before the PIN rather than at it.
 */

const ROSEWOOD = 'site-rosewood-court' as SiteId
const DAY = '2026-09-16'

afterEach(() => {
  endSession()
  resetMedicationPins()
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

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
const at2000 = (id: string) =>
  patchedRecords().filter(
    (record) =>
      record.residentId === id && record.date === DAY && record.roundTime === '20:00',
  )
const ordinaryOpen = (id: string) =>
  at2000(id).filter(
    (record) =>
      record.state.kind === 'due' &&
      !drugOf(record.medicationId).isPrn &&
      !drugOf(record.medicationId).isControlledDrug,
  )

async function openSheet(
  user: ReturnType<typeof userEvent.setup>,
  id: string,
  who: StaffId,
) {
  window.history.replaceState(null, '', `/m/people/${id}/chart`)
  renderSignedIn(who, <PhoneApp />, ROSEWOOD)
  const people = document.querySelector('[data-tab="people"]') as HTMLElement
  await user.click(
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

const answerGivenToAll = async (
  user: ReturnType<typeof userEvent.setup>,
  sheet: HTMLElement,
  id: string,
) => {
  for (const record of ordinaryOpen(id)) {
    const drug = drugOf(record.medicationId)
    await user.click(
      within(
        within(sheet).getByRole('radiogroup', {
          name: `Answer for ${drug.name} ${drug.dose}`,
        }),
      ).getByRole('radio', { name: 'Given' }),
    )
  }
}

describe('signing a round with the medication PIN', () => {
  it('says what it signs and the time it will record before the PIN, with the subject and allergies still pinned', async () => {
    const user = userEvent.setup()
    const sheet = await openSheet(user, 'res-lonsdale', staffAkinyemi.id)
    await answerGivenToAll(user, sheet, 'res-lonsdale')
    await user.click(
      within(sheet).getByRole('button', { name: 'Sign with your medication PIN' }),
    )

    expect(sheet.querySelector('[data-sheet-step="pin"]')).not.toBeNull()
    expect(within(sheet).getByLabelText('Enter your medication PIN')).toBeTruthy()
    expect(sheet.querySelector('[data-records-at]')?.textContent).toBe(
      'This will be recorded as 20:20 BST: the time this page was opened at, not the moment you sign.',
    )
    const names = ordinaryOpen('res-lonsdale').map((r) => {
      const drug = drugOf(r.medicationId)
      return `Given: ${drug.name} ${drug.dose}`
    })
    expect(sheet.textContent).toContain(
      `For Vera Lonsdale, 20:00 round on 16/09/2026. ${names.join('; ')}.`,
    )
    // The head stays: who it is and their allergies, at the moment of signing.
    expect(sheet.querySelector('[data-subject-header]')).not.toBeNull()
    expect(sheet.querySelector('[data-sheet-allergies]')?.textContent).toMatch(
      /Nothing here checks these drugs against Vera Lonsdale’s allergies\./,
    )
  })

  it('records every answered dose at the time it said, by the signer, and the chart shows them once the sheet closes', async () => {
    const user = userEvent.setup()
    const open = ordinaryOpen('res-lonsdale')
    expect(open.length).toBe(2)
    const sheet = await openSheet(user, 'res-lonsdale', staffAkinyemi.id)
    await answerGivenToAll(user, sheet, 'res-lonsdale')
    await user.click(
      within(sheet).getByRole('button', { name: 'Sign with your medication PIN' }),
    )
    await user.type(within(sheet).getByLabelText('Enter your medication PIN'), '4821')
    await user.click(within(sheet).getByRole('button', { name: 'Record doses' }))

    expect((await within(sheet).findByRole('status')).textContent).toBe(
      'Recorded for Vera Lonsdale at 20:20 BST, held in this session only.',
    )
    const stamp = now().toISOString()
    for (const record of open) {
      const after = at2000('res-lonsdale').find(
        (r) => r.medicationId === record.medicationId,
      )
      expect(after?.state.kind).toBe('given')
      if (after?.state.kind !== 'given') continue
      expect(after.state.givenAt).toBe(stamp)
      expect(after.state.givenBy.id).toBe(staffAkinyemi.id)
    }

    await user.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    const people = document.querySelector('[data-tab="people"]') as HTMLElement
    // The chart reads the record again once the sheet has closed.
    await waitFor(() => {
      for (const record of open)
        expect(
          people
            .querySelector(
              `[data-chart-round="20:00"] [data-chart-dose="${record.medicationId}"]`,
            )
            ?.querySelector('[data-dose="given"]'),
        ).not.toBeNull()
    })
    expect(within(people).queryByRole('button', { name: /^Record the/ })).toBeNull()
  })

  it('goes back to the answers from the PIN without recording, and keeps them', async () => {
    const user = userEvent.setup()
    const before = JSON.stringify(at2000('res-lonsdale'))
    const sheet = await openSheet(user, 'res-lonsdale', staffAkinyemi.id)
    await answerGivenToAll(user, sheet, 'res-lonsdale')
    await user.click(
      within(sheet).getByRole('button', { name: 'Sign with your medication PIN' }),
    )
    const pinStep = sheet.querySelector('[data-sheet-step="pin"]') as HTMLElement
    // Not "Cancel": the sheet's own Cancel, beside it, closes everything.
    await user.click(
      within(pinStep).getByRole('button', { name: 'Back to the answers' }),
    )
    expect(sheet.querySelector('[data-sheet-step="pin"]')).toBeNull()
    expect(
      within(sheet).getAllByRole('radio', { name: 'Given', checked: true }),
    ).toHaveLength(ordinaryOpen('res-lonsdale').length)
    expect(JSON.stringify(at2000('res-lonsdale'))).toBe(before)
  })
})

describe('a round the phone cannot sign whole', () => {
  it('says so before the PIN, naming the dose it cannot record, and offers no signature', async () => {
    const user = userEvent.setup()
    const controlled = at2000('res-bello').filter(
      (record) =>
        record.state.kind === 'due' && drugOf(record.medicationId).isControlledDrug,
    )
    expect(controlled.length).toBeGreaterThan(0)
    const before = JSON.stringify(at2000('res-bello'))
    const sheet = await openSheet(user, 'res-bello', staffAkinyemi.id)
    await answerGivenToAll(user, sheet, 'res-bello')

    expect(within(sheet).queryByRole('button', { name: /medication PIN/ })).toBeNull()
    const held = sheet.querySelector('[data-sheet-held]')?.textContent ?? ''
    expect(held).toMatch(/^A round is signed all at once, and /)
    for (const record of controlled) {
      const drug = drugOf(record.medicationId)
      expect(held).toContain(`${drug.name} ${drug.dose}`)
    }
    expect(held).toMatch(
      /cannot be recorded on the phone, so this round cannot be signed here\.$/,
    )
    expect(JSON.stringify(at2000('res-bello'))).toBe(before)
  })
})
