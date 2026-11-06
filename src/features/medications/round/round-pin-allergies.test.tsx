import { vi } from 'vitest'

/*
 * **Pinned to a full instant before any fixture loads**: 16/09/2026 at 20:20
 * BST, twenty minutes into the 20:00 round, so a dose can be answered and the
 * PIN step reached. A pin naming only the hour would take today's date and the
 * machine's zone (CLAUDE.md §8).
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/medications/round?at=2026-09-16T19:20:00Z')
})

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { openDosesAt } from '@/data/access/client'
import { endSession } from '@/data/access/session-losses'
import { resetMedicationPins } from '@/app/session/medication-pins'
import { zonedDate } from '@/lib/format'
import { renderSignedIn } from '@/test/render-signed-in'
import { RoundRoute } from './RoundRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications/round', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

/**
 * The round's PIN step carries the resident's allergies, in all three of their
 * states, and says that nothing compared the drugs with them.
 *
 * **The dialog covers the card head**, so allergies shown only there are out of
 * sight at the one moment a drug goes on the record as given.
 */

const ROUND = '20:00'
const TODAY = zonedDate(now().toISOString() as IsoDateTime, 'Europe/London')

beforeEach(() => {
  endSession()
  resetMedicationPins()
})

const residentOf = (id: string) => {
  const found = residents.find((resident) => resident.id === id)
  if (found === undefined) throw new Error(`No resident ${id}`)
  return found
}

/** Answers every open dose on a resident's card "refused", then opens the PIN step. */
async function pinStepFor(residentId: string) {
  const user = userEvent.setup()
  renderSignedIn(staffAkinyemi.id, <RoundRoute />, 'site-rosewood-court')
  await user.click(
    await screen.findByRole('button', { name: new RegExp(`^${ROUND} ·`) }),
  )
  const card = document.querySelector<HTMLElement>(`[data-round-card="${residentId}"]`)
  if (card === null) throw new Error(`No round card for ${residentId}`)
  const open = openDosesAt(residentId as ResidentId, TODAY, ROUND)
  expect(open.length).toBeGreaterThan(0)
  for (const medicationId of open) {
    const dose = card.querySelector<HTMLElement>(`[data-dose="${medicationId}"]`)
    if (dose === null) throw new Error(`No dose ${medicationId}`)
    await user.click(within(dose).getByRole('button', { name: 'Not given' }))
    await user.click(
      within(dose).getByRole('radio', {
        name: 'Resident refused',
      }),
    )
  }
  await user.click(
    within(card).getByRole('button', { name: /^Record .+’s 20:00 doses$/ }),
  )
  const dialog = await screen.findByRole('dialog')
  const allergies = dialog.querySelector<HTMLElement>('[data-signing-allergies]')
  if (allergies === null) throw new Error('No allergies in the PIN step')
  return { dialog, allergies }
}

describe('the round’s PIN step shows the resident’s allergies', () => {
  it('names every recorded allergy, each in the critical pill, with the reaction', async () => {
    const lonsdale = residentOf('res-lonsdale')
    if (lonsdale.allergies.kind !== 'allergies')
      throw new Error('Lonsdale has allergies')
    const { allergies } = await pinStepFor('res-lonsdale')
    const pills = [...allergies.querySelectorAll<HTMLElement>('[data-tone="critical"]')]
    expect(pills.map((pill) => pill.textContent)).toEqual(
      lonsdale.allergies.items.map((item) =>
        expect.stringContaining(`Allergy: ${item.substance}`),
      ),
    )
    expect(lonsdale.allergies.items.length).toBe(2)
  })

  it('shows "No known allergies" as a settled record, not as a gap', async () => {
    const { allergies } = await pinStepFor('res-castledine')
    expect(allergies.querySelector('[data-tone="positive"]')?.textContent).toMatch(
      /No known allergies/,
    )
    expect(allergies.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  it('hatches allergies nobody recorded, and says so', async () => {
    expect(residentOf('res-pemberton').allergies.kind).toBe('not_recorded')
    const { allergies } = await pinStepFor('res-pemberton')
    expect(allergies.querySelector('[data-state="unrecorded"]')?.textContent).toMatch(
      /Allergies not recorded/,
    )
  })

  it('says beside them that nothing checked these drugs against them, naming the resident', async () => {
    const { allergies } = await pinStepFor('res-lonsdale')
    expect(allergies.textContent).toContain(
      'Nothing here checks these drugs against Vera Lonsdale’s allergies.',
    )
    expect(allergies.textContent).toMatch(/Nothing here checks these drugs against/)
  })
})
