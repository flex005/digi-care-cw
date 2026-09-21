import { vi } from 'vitest'

/*
 * The fixture clock, set before any fixture loads. Twenty minutes into the
 * 20:00 round is the late shift, which is the shift the open handover belongs
 * to, so the board under test is the one a reader would be standing in front
 * of rather than whichever shift the suite happens to run in.
 */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/handover?at=20:20')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import { openHandoverFor } from '@/data/fixtures/handover'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { statusFor } from '@/data/access/handover-store'
import { endSession } from '@/data/access/session-losses'
import { memberById } from '@/data/access/team-store'
import { residentScopeFor } from '@/app/session/resident-scope'
import { resetMedicationPins } from '@/app/session/medication-pins'
import { renderSignedIn } from '@/test/render-signed-in'
import { WHOLE_HOME_LINE, HandoverRoute } from './HandoverRoute'

const navigation = vi.hoisted(() => ({ pathname: '/handover', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
  resetMedicationPins()
})

async function openBoard(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <HandoverRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Resident status' })
  return { user, ...rendered }
}

const session = () => {
  const open = openHandoverFor(ROSEWOOD)
  if (open === undefined) throw new Error('No open handover at Rosewood')
  return open
}

const rowsShown = () => [...document.querySelectorAll<HTMLElement>('[data-resident]')]

async function pill(user: ReturnType<typeof userEvent.setup>, id: string) {
  const found = document.querySelector<HTMLElement>(`[data-status-pill="${id}"]`)
  if (found === null) throw new Error(`No pill for ${id}`)
  await user.click(found)
  return found
}

/** A resident on the open handover with a given status, from the fixtures. */
function residentWith(kind: string): ResidentId {
  const open = session()
  const found = residentsBySite(ROSEWOOD).find(
    (resident) => statusFor(open, resident.id).kind === kind,
  )
  if (found === undefined) throw new Error(`No resident is ${kind} at Rosewood`)
  return found.id
}

describe('the fixtures reach the states this screen draws', () => {
  it('has an open handover with residents nobody has looked at, and an unsigned earlier one', () => {
    const open = session()
    const residents = residentsBySite(ROSEWOOD)
    const notReviewed = residents.filter(
      (resident) => statusFor(open, resident.id).kind === 'not_reviewed',
    )
    expect(notReviewed.length).toBeGreaterThan(0)
    expect(open.outgoing.kind).toBe('not_signed')
    expect(open.incoming.kind).toBe('not_signed')
    expect(document.querySelector('[data-unsigned]')).toBeNull()
  })
})

describe('the board', () => {
  it('counts the whole home and says so', async () => {
    await openBoard()
    const open = session()
    const total = residentsBySite(ROSEWOOD).length
    const notReviewed = residentsBySite(ROSEWOOD).filter(
      (resident) => statusFor(open, resident.id).kind === 'not_reviewed',
    ).length

    const banner = document.querySelector('[data-action-card]')
    expect(banner?.textContent).toContain(String(notReviewed))
    expect(banner?.textContent).toContain(`of ${total} residents living at`)
    expect(screen.getAllByText(WHOLE_HOME_LINE).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-act-line]')).toBeNull()
  })

  it('shows every resident at the home to a care worker, list or no list', async () => {
    await openBoard(staffEze.id)
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')

    const open = session()
    const notReviewed = residentsBySite(ROSEWOOD).filter(
      (resident) => statusFor(open, resident.id).kind === 'not_reviewed',
    ).length
    expect(rowsShown()).toHaveLength(notReviewed)
    // The board is the shift's, not a list's: residents off it are here too.
    const off = rowsShown().filter(
      (row) => !scope.residents.includes(row.dataset.resident as ResidentId),
    )
    expect(off.length).toBeGreaterThan(0)
  })

  it('keeps all four groups, with counts, and each claim carries its denominator', async () => {
    const { user } = await openBoard()
    const open = session()
    const residents = residentsBySite(ROSEWOOD)
    const total = residents.length
    const reviewed = residents.filter(
      (resident) => statusFor(open, resident.id).kind !== 'not_reviewed',
    ).length

    for (const id of ['not_reviewed', 'urgent', 'needs_attention', 'all_well'])
      expect(document.querySelector(`[data-status-pill="${id}"]`)).not.toBeNull()

    expect(document.querySelector('[data-group-claim]')?.textContent).toContain(
      `of ${total}`,
    )
    await pill(user, 'urgent')
    expect(document.querySelector('[data-group-claim]')?.textContent).toContain(
      `of ${reviewed}`,
    )
    expect(document.querySelector('[data-group-claim]')?.textContent).toContain(
      'residents somebody reviewed this shift',
    )
  })

  it('hatches a resident nobody reviewed and measures the silence beside it', async () => {
    await openBoard()
    const row = rowsShown()[0]!
    expect(row.dataset.status).toBe('not_reviewed')
    expect(within(row).getByText('Not reviewed')).toBeInTheDocument()
    expect(row.querySelector('[data-state="unrecorded"]')).not.toBeNull()
    const silence = row.querySelector('[data-silence]')
    expect(silence).not.toBeNull()
    if (silence?.getAttribute('data-silence') === 'gap')
      expect(silence.textContent).toMatch(
        /No care note recorded for .+\. Last written by/,
      )
  })

  it('draws a recorded urgent status with its note and its author', async () => {
    const { user } = await openBoard()
    await pill(user, 'urgent')
    const urgent = residentWith('urgent')
    const row = document.querySelector<HTMLElement>(`[data-resident="${urgent}"]`)
    expect(row).not.toBeNull()
    expect(row!.querySelector('[data-tone="critical"]')?.textContent).toContain(
      'Urgent',
    )
    // The note is the whole point of the status: never a bare claim.
    expect(row!.textContent?.length).toBeGreaterThan(40)
  })
})

/*
 * Ashgrove is the thinner home, and the only one where a group is empty. A
 * group with no rows keeps its pill, its zero and its own sentence: dropping it
 * would make "nobody is urgent" and "nobody has checked whether anybody is
 * urgent" the same absence.
 */
describe('a group with nobody in it', () => {
  it('keeps its pill and says its zero in words', async () => {
    const user = userEvent.setup()
    renderSignedIn(staffAkinyemi.id, <HandoverRoute />, 'site-ashgrove-lodge')
    await screen.findByRole('group', { name: 'Resident status' })

    const urgent = document.querySelector<HTMLElement>('[data-status-pill="urgent"]')
    expect(urgent?.textContent).toContain('Urgent · 0')
    await user.click(urgent!)
    expect(screen.getByText('Nobody who was reviewed is urgent.')).toBeInTheDocument()
    expect(rowsShown()).toHaveLength(0)
  })
})

describe('recording a status', () => {
  it('needs a choice, and needs words for urgent', async () => {
    const { user } = await openBoard()
    const row = rowsShown()[0]!
    const resident = row.dataset.resident!
    await user.click(within(row).getByRole('button', { name: 'Review' }))

    const dialog = await screen.findByRole('dialog')
    const confirm = within(dialog).getByRole('button', { name: /^Record this for / })
    expect(confirm).toBeDisabled()

    await user.click(within(dialog).getByRole('radio', { name: 'Urgent' }))
    expect(confirm).toBeDisabled()
    expect(dialog.querySelector('[data-act-line]')).toBeNull()

    await user.type(
      within(dialog).getByLabelText(/What does the incoming shift need to do\?/),
      'Chest sounds rattly, GP called',
    )
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() =>
      expect(statusFor(session(), resident as ResidentId).kind).toBe('urgent'),
    )
    await waitFor(() =>
      expect(document.querySelector('[data-handover-done]')?.textContent).toMatch(
        /recorded as urgent on this handover\. The incoming shift sees it here; nothing was sent\./,
      ),
    )
  })

  it('draws the PRD’s silence at the act for a care worker’s resident off their list', async () => {
    const { user } = await openBoard(staffEze.id)
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')

    const off = rowsShown().find(
      (row) => !scope.residents.includes(row.dataset.resident as ResidentId),
    )
    const on = rowsShown().find((row) =>
      scope.residents.includes(row.dataset.resident as ResidentId),
    )
    if (off === undefined || on === undefined)
      throw new Error('Eze needs a row on and a row off their list')

    // Off the list: the question, quoted, and no control at all.
    const question = off.querySelector('[data-act-line="not_stated"]')
    expect(question?.textContent).toMatch(/does not say/)
    expect(within(off).queryByRole('button', { name: 'Review' })).toBeNull()

    // On the list: the same act, live.
    expect(within(on).getByRole('button', { name: 'Review' })).toBeEnabled()
    await user.click(within(on).getByRole('button', { name: 'Review' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('tells a care worker with no list why, once, and still shows the board', async () => {
    await openBoard(staffOsei.id)
    const said = document.querySelector('[data-no-list]')
    expect(said?.textContent).toContain('nobody has given you any')
    // Said once on the board, not once per row, and the record is still readable.
    expect(document.querySelectorAll('[data-no-list]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-act-line]')).toHaveLength(0)
    expect(rowsShown().length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull()
  })
})

describe('the dual signature', () => {
  it('offers a care worker neither half to sign, and no reason either', async () => {
    await openBoard(staffEze.id)
    for (const side of ['outgoing', 'incoming']) {
      const half = document.querySelector<HTMLElement>(`[data-signature="${side}"]`)
      expect(half).toBeTruthy()
      expect(half?.querySelector('[data-act-line]')).toBeNull()
      expect(half?.querySelector('[data-sign]')).toBeNull()
      expect(half?.textContent).not.toContain('senior carer')
    }
  })

  it('signs one half with the medication PIN, and says what it covered', async () => {
    const { user } = await openBoard()
    const open = session()
    const residents = residentsBySite(ROSEWOOD)
    const notReviewed = residents.filter(
      (resident) => statusFor(open, resident.id).kind === 'not_reviewed',
    ).length

    const half = document.querySelector<HTMLElement>('[data-signature="outgoing"]')!
    expect(half.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'Not signed',
    )
    expect(half.textContent).toContain('complete only when the other shift has signed')

    await user.click(within(half).getByRole('button', { name: 'Sign as handing over' }))
    const dialog = await screen.findByRole('dialog')
    // The PIN says what it signs, including the holes it does not close.
    expect(dialog.textContent).toContain('Sign as handing over for the late shift')
    expect(dialog.textContent).toContain(
      `${notReviewed} of them have not been looked at at all: this records that, and does not say they are well`,
    )

    await user.type(within(dialog).getByLabelText('Enter your medication PIN'), '4821')
    await user.click(
      within(dialog).getByRole('button', { name: 'Sign as handing over' }),
    )

    await waitFor(() =>
      expect(
        document
          .querySelector('[data-signature="outgoing"]')
          ?.getAttribute('data-signed'),
      ).toBe('true'),
    )
    const signed = document.querySelector<HTMLElement>('[data-signature="outgoing"]')!
    expect(signed.textContent).toContain('residents reviewed when this was signed')
    expect(signed.textContent).toContain(`${notReviewed} had not been looked at`)
    expect(document.querySelector('[data-handover-done]')?.textContent).toContain(
      'Handed over, awaiting countersign',
    )
    // The other half is still a gap: one signature is half a handover.
    expect(
      document
        .querySelector('[data-signature="incoming"]')
        ?.getAttribute('data-signed'),
    ).toBe('false')
  })
})
