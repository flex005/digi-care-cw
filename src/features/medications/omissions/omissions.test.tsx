import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IsoDateTime, ResidentId, SiteId } from '@/data/types'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { fellDueAt, marRecordsFor } from '@/data/fixtures/medications'
import { residentsBySite } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { getOmissions } from '@/data/access/client'
import { resetSessionAdministrations } from '@/data/access/mar-store'
import { noListYetLine } from '@/app/session/resident-scope'
import { renderSignedIn } from '@/test/render-signed-in'
import { formatCount } from '@/lib/format'
import { weekBefore } from './omission-views'
import { OmissionsRoute } from './OmissionsRoute'

const navigation = vi.hoisted(() => ({ pathname: '/medications', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => resetSessionAdministrations())

const ROSEWOOD = 'site-rosewood-court' as SiteId
const EZE_LIST = [
  'res-okafor',
  'res-adeyemi',
  'res-hutchinson',
  'res-pemberton',
] as ResidentId[]

const since = () => weekBefore(now().toISOString() as IsoDateTime)

/** The week's omissions from the data layer, over a set of residents. */
async function expected(residents: ResidentId[]) {
  const week = await getOmissions(ROSEWOOD, since())
  const omissions = week.omissions.filter((entry) =>
    residents.includes(entry.resident.id),
  )
  // Counted here from the records, not with the screen's own helper.
  const floor = new Date(since()).getTime()
  const due = residents
    .flatMap((id) => marRecordsFor(id))
    .filter((record) => {
      const when = fellDueAt(record)
      return when !== 'not_due' && new Date(when).getTime() >= floor
    }).length
  return { omissions, due, homeDue: week.dueInRange }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-omission]')]
const loaded = () =>
  waitFor(() => expect(document.querySelector('[data-omissions-claim]')).toBeTruthy())
const tileOf = (label: string) =>
  document.querySelector(`[data-metric-tile="${label}"] [data-metric-of]`)?.textContent

describe('Omissions: scope', () => {
  it('shows a care worker only the residents on their list', async () => {
    renderSignedIn(staffEze.id, <OmissionsRoute />)
    await loaded()
    const { omissions } = await expected(EZE_LIST)
    expect(omissions.length).toBeGreaterThan(0)
    expect(rows()).toHaveLength(Math.min(omissions.length, 25))
    for (const row of rows()) {
      const id = row.querySelector('a')?.getAttribute('href')?.split('/')[2]
      expect(EZE_LIST).toContain(id)
    }
    expect(document.querySelector('[data-gap-count]')?.textContent).toContain(
      'across your 4 residents',
    )
  })

  it('tells a care worker with no list so, hatched, and counts nothing', async () => {
    renderSignedIn(staffOsei.id, <OmissionsRoute />)
    const panel = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-no-list]')
      expect(found).toBeTruthy()
      return found!
    })
    expect(panel.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      noListYetLine,
    )
    expect(document.querySelector('[data-action-card]')).toBeNull()
    expect(document.querySelector('[data-gap-count]')).toBeNull()
    expect(document.querySelector('[data-metric-tile]')).toBeNull()
    expect(rows()).toHaveLength(0)
  })
})

describe('Omissions: figures', () => {
  it('gives every figure its denominator, over the home for a senior carer', async () => {
    renderSignedIn(staffAkinyemi.id, <OmissionsRoute />)
    await loaded()
    const home = residentsBySite(ROSEWOOD).map((resident) => resident.id)
    const { omissions, due, homeDue } = await expected(home)
    // The screen's per-resident derivation agrees with the data layer's.
    expect(due).toBe(homeDue)

    const noRecord = omissions.length
    const escalated = omissions.filter((o) => o.escalatedAt !== 'not_escalated').length
    const closed = omissions.filter((o) => o.closure.kind === 'closed').length

    const gap = document.querySelector('[data-gap-count]')!
    expect(gap.getAttribute('data-state')).toBe('unrecorded')
    expect(gap.textContent).toContain(formatCount(noRecord))
    expect(gap.textContent).toContain(
      `of ${formatCount(due)} doses due this week, across 28 residents at Rosewood Court`,
    )
    expect(gap.textContent).toContain('the window closed and nobody wrote anything')

    const of = `of ${formatCount(noRecord)} doses with no record`
    expect(tileOf('Escalated')).toBe(of)
    expect(tileOf('Not yet escalated')).toBe(of)
    expect(tileOf('Closed')).toBe(of)
    const tile = (label: string) =>
      document.querySelector(`[data-metric-tile="${label}"]`)?.textContent
    expect(tile('Escalated')).toContain(formatCount(escalated))
    expect(tile('Not yet escalated')).toContain(formatCount(noRecord - escalated))
    expect(tile('Closed')).toContain(formatCount(closed))

    const card = document.querySelector('[data-action-card]')!
    expect(card.textContent).toContain('Open omissions')
    expect(card.textContent).toContain(formatCount(noRecord - closed))
    expect(card.textContent).toContain(`${of} this week`)
    expect(card.textContent).toContain('Oldest open')
  })

  it('switches the list to open omissions from the dark card', async () => {
    renderSignedIn(staffAkinyemi.id, <OmissionsRoute />)
    await loaded()
    await userEvent.click(screen.getByRole('button', { name: 'Show open omissions' }))
    expect(
      screen.getByRole('button', { name: 'Open', pressed: true }),
    ).toBeInTheDocument()
    expect(rows().every((row) => row.dataset.closure === 'open')).toBe(true)
    expect(document.querySelector('[data-omissions-claim]')?.textContent).toContain(
      'with no record, open, of',
    )
  })
})

describe('Omissions: separate facts', () => {
  it('draws escalation and a controlled drug beside the gap, never inside it', async () => {
    renderSignedIn(staffAkinyemi.id, <OmissionsRoute />)
    await loaded()

    const escalated = rows().find((row) => row.dataset.escalated === 'true')!
    const gap = escalated.querySelector('[data-state="unrecorded"]')!
    expect(gap.textContent).toContain('No record')
    expect(gap.textContent).not.toMatch(/escalated/i)
    const pill = escalated.querySelector('[data-escalation="escalated"] [data-tone]')!
    expect(pill.getAttribute('data-tone')).toBe('caution')
    expect(pill.getAttribute('data-state')).toBe('recorded')
    expect(pill.textContent).toMatch(
      /^Escalated \d{2}:\d{2}( [A-Z]+)?, \d{2}\/\d{2}\/\d{4}$/,
    )

    const controlled = rows().find((row) =>
      row.querySelector('[data-controlled-drug]'),
    )!
    const cd = controlled.querySelector('[data-controlled-drug] [data-tone]')!
    expect(cd.getAttribute('data-tone')).toBe('critical')
    expect(cd.textContent).toBe('Controlled drug')
    expect(controlled.querySelector('[data-state="unrecorded"]')).toBeTruthy()

    // The recent ones are not escalated yet, and sort to the end of the week.
    await userEvent.click(screen.getByRole('button', { name: 'Not escalated' }))
    const notEscalated = rows()[0]!
    expect(notEscalated.dataset.escalated).toBe('false')
    const plain = notEscalated.querySelector('[data-escalation="not_escalated"]')!
    expect(plain.textContent).toBe('Not escalated')
    expect(plain.querySelector('[data-tone]')).toBeNull()
    expect(notEscalated.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('keeps a closed omission hatched, with who closed it, when and why', async () => {
    renderSignedIn(staffAkinyemi.id, <OmissionsRoute />)
    await loaded()
    const closed = rows().find((row) => row.dataset.closure === 'closed')!
    expect(closed).toBeTruthy()
    expect(closed.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'No record',
    )
    expect(closed.querySelector('[data-closed-by]')?.textContent).toMatch(
      /^Closed by M\. Halloran, \d{2}\/\d{2}\/\d{4}: .+/,
    )
    expect(closed.querySelector('[data-close-omission]')).toBeNull()
  })
})

describe('Omissions: closing', () => {
  it('refuses without a reason, records it, and moves the row to Closed', async () => {
    renderSignedIn(staffAkinyemi.id, <OmissionsRoute />)
    await loaded()
    const open = rows().find((row) => row.dataset.closure === 'open')!
    const key = open.dataset.omission!
    const name = open.querySelector('a')!.textContent!

    await userEvent.click(within(open).getByRole('button', { name: 'Close omission' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toMatch(
      /^Close the omission for .+’s .+ at \d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}\?$/,
    )
    expect(dialog.querySelector('[data-confirm-subject]')).toBeTruthy()
    expect(dialog.querySelector('[data-act-line]')).toBeNull()

    const confirm = dialog.querySelector<HTMLButtonElement>('[data-confirm-close]')!
    expect(confirm).toBeDisabled()
    const reason = within(dialog).getByLabelText('Why is it closed? (required)')
    await userEvent.type(reason, '   ')
    expect(confirm).toBeDisabled()
    await userEvent.type(reason, 'Resident was at a hospital appointment all morning.')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)

    const row = () =>
      document.querySelector<HTMLElement>(`[data-omission="${CSS.escape(key)}"]`)
    await waitFor(() => expect(row()?.dataset.closure).toBe('closed'))
    expect(document.querySelector('[data-just-closed]')).toBeTruthy()
    // Still on All, and still hatched.
    expect(row()?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(row()?.querySelector('[data-closed-by]')?.textContent).toContain(
      `Closed by ${staffAkinyemi.displayName}`,
    )
    expect(row()?.querySelector('[data-closed-by]')?.textContent).toContain(
      'Resident was at a hospital appointment all morning.',
    )
    expect(name).not.toBe('')

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(row()).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Closed' }))
    await waitFor(() => expect(row()).toBeTruthy())
  })

  it('leaves a care worker the list to read and no control on any row', async () => {
    renderSignedIn(staffEze.id, <OmissionsRoute />)
    await loaded()
    expect(document.querySelectorAll('[data-act-line]')).toHaveLength(0)
    expect(document.body.textContent).not.toContain(
      'Closing an omission is for a senior carer.',
    )
    expect(rows().some((row) => row.dataset.closure === 'open')).toBe(true)
    expect(document.querySelector('[data-close-omission]')).toBeNull()
  })
})
