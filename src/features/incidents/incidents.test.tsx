import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/incidents?at=20:20')
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { resetSessionIncidents } from '@/data/access/incident-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { NOTHING_SENT_LINE, NO_DETAIL_LINE, IncidentsRoute } from './IncidentsRoute'

const navigation = vi.hoisted(() => ({ pathname: '/incidents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
  resetSessionIncidents()
})

const here = () => incidents.filter((incident) => incident.siteId === ROSEWOOD)

async function openList(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <IncidentsRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Status' })
  return { user, ...rendered }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-incident]')]

async function filterTo(user: ReturnType<typeof userEvent.setup>, id: string) {
  const pill = document.querySelector<HTMLElement>(`[data-status-filter="${id}"]`)
  if (pill === null) throw new Error(`No status filter ${id}`)
  await user.click(pill)
}

describe('the fixtures reach the states this screen draws', () => {
  it('has INC-01’s own figures: 40 incidents, 2 unacknowledged, 8 undecided', () => {
    const all = here()
    expect(all).toHaveLength(40)
    expect(
      all.filter((i) => i.status.kind === 'reported_not_acknowledged'),
    ).toHaveLength(2)
    expect(all.filter((i) => i.notification.kind === 'not_yet_decided')).toHaveLength(8)
    // The three injury states, so each is drawn from the record rather than mocked.
    for (const kind of ['not_recorded', 'no_injuries_found', 'marked'])
      expect(all.some((i) => i.injuries.kind === kind)).toBe(true)
  })
})

describe('the two findings', () => {
  it('carries both denominators, and never adds them together', async () => {
    await openList()
    const banner = document.querySelector('[data-incidents-banner]')?.closest('section')
    expect(banner?.textContent).toContain(
      'of 40 incidents recorded at Rosewood Court in the last 90 days',
    )
    expect(banner?.textContent).toContain('2')

    const tiles = screen.getByRole('region', { name: /Incidents at Rosewood Court/ })
    expect(tiles.textContent).toContain('No CQC notification decision')
    expect(tiles.textContent).toContain('of 40 incidents at Rosewood Court')
    expect(tiles.textContent).toContain('8')
    // 2 + 8 is not a figure on this screen: an incident can be both.
    expect(document.body.textContent).not.toContain('10 incidents')
  })

  it('says nothing is sent', async () => {
    await openList()
    expect(screen.getByText(NOTHING_SENT_LINE)).toBeInTheDocument()
  })
})

describe('the list', () => {
  it('opens on the not acknowledged, oldest first, with the count against the whole', async () => {
    await openList()
    expect(
      document
        .querySelector('[data-status-filter="not_acknowledged"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(rows()).toHaveLength(2)
    expect(document.querySelector('[data-incidents-claim]')?.textContent).toContain(
      '2 of 40',
    )

    const dates = rows().map(
      (row) =>
        incidents.find((incident) => incident.id === row.dataset.incident)?.occurredAt,
    )
    expect([...dates].sort()).toEqual(dates)
  })

  it('draws the wait as a gap, and the words of the reporter', async () => {
    await openList()
    const row = rows()[0]!
    const hatched = row.querySelector('[data-state="unrecorded"]')
    expect(hatched?.textContent).toMatch(/Not acknowledged — waiting \d+ days?/)
    const incident = incidents.find((entry) => entry.id === row.dataset.incident)!
    expect(row.textContent).toContain(incident.description)
  })

  it('keeps every status filter, and reaches the closed ones', async () => {
    const { user } = await openList()
    for (const id of ['not_acknowledged', 'open', 'under_review', 'closed', 'all'])
      expect(document.querySelector(`[data-status-filter="${id}"]`)).not.toBeNull()

    await filterTo(user, 'all')
    expect(document.querySelector('[data-incidents-claim]')?.textContent).toContain(
      '40 of 40',
    )
    await filterTo(user, 'closed')
    expect(rows().length).toBeGreaterThan(0)
    for (const row of rows()) expect(row.dataset.status).toBe('closed')
  })

  it('says there is nowhere to open to, rather than drawing a link to nothing', async () => {
    await openList()
    expect(screen.getByText(new RegExp(NO_DETAIL_LINE))).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Open/ })).toBeNull()
  })

  it('tells "not checked yet" and "checked: no injury found" apart', async () => {
    const { user } = await openList()
    await filterTo(user, 'all')

    const notChecked = here().find((i) => i.injuries.kind === 'not_recorded')!
    const checked = here().find((i) => i.injuries.kind === 'no_injuries_found')!
    const find = async (id: string) => {
      for (;;) {
        const row = document.querySelector<HTMLElement>(`[data-incident="${id}"]`)
        if (row) return row
        const next = document.querySelector<HTMLButtonElement>('[data-pager-next]')
        if (!next || next.disabled) throw new Error(`No row for ${id}`)
        await user.click(next)
      }
    }

    const gap = within(await find(notChecked.id)).getByText('Not checked yet')
    expect(gap.closest('[data-state="unrecorded"]')).not.toBeNull()

    const negative = within(await find(checked.id)).getByText(
      'Checked: no injury found',
    )
    expect(negative.closest('[data-state="unrecorded"]')).toBeNull()
    expect(negative.closest('[data-state="recorded"]')).not.toBeNull()
  })
})

describe('what this reader cannot do', () => {
  it('refuses a care worker all three, in the role table’s words, drawn once', async () => {
    await openList(staffEze.id)
    const refusals = [...document.querySelectorAll('[data-act-line="refused"]')].map(
      (line) => line.textContent,
    )
    expect(refusals).toEqual([
      'Acknowledging an incident is for a senior carer.',
      'A manager closes an incident.',
      'A manager records whether the CQC must be notified.',
    ])
    // Not one per row: forty rows of the same refusal is noise.
    expect(document.querySelector('[data-acknowledge]')).toBeNull()
  })

  it('refuses a senior carer closing and the CQC decision, and lets them acknowledge', async () => {
    await openList()
    const refusals = [...document.querySelectorAll('[data-act-line="refused"]')].map(
      (line) => line.textContent,
    )
    expect(refusals).toEqual([
      'A manager closes an incident.',
      'A manager records whether the CQC must be notified.',
    ])
    expect(document.querySelectorAll('[data-acknowledge]')).toHaveLength(2)
  })

  it('reports an incident only where the role table says the reader may', async () => {
    await openList(staffEze.id)
    expect(screen.getByRole('link', { name: 'Report an incident' })).toBeInTheDocument()
  })
})

describe('acknowledging', () => {
  it('names the subject, says a manager closes it, and records who picked it up', async () => {
    const { user } = await openList()
    const row = rows()[0]!
    const id = row.dataset.incident!
    await user.click(within(row).getByRole('button', { name: 'Acknowledge' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toMatch(/^Acknowledge /)
    expect(dialog.textContent).toMatch(/closing it is a manager’s act/)
    expect(dialog.textContent).toMatch(/Nobody is notified/)
    await user.click(within(dialog).getByRole('button', { name: 'Acknowledge' }))

    await waitFor(() =>
      expect(document.querySelector('[data-incident-done]')?.textContent).toMatch(
        /You acknowledged .+\. Acknowledging is not the end of it/,
      ),
    )
    // It has left the queue, and the figure moved with it.
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(document.querySelector(`[data-incident="${id}"]`)).toBeNull()
  })
})

describe('an incident reported this session', () => {
  it('waits with the others, newest last, because oldest first is the rule', async () => {
    const { reportOne } = await import('./report-one')
    const at = new Date().toISOString() as IsoDateTime
    await reportOne(at)
    await openList()

    const shown = rows()
    expect(shown).toHaveLength(3)
    // Reported a minute ago, so it is the newest, so it is last: the queue is
    // ordered by how long somebody has waited, not by when it arrived here.
    const last = shown[shown.length - 1]!
    expect(last.dataset.incident).toMatch(/^inc-session-/)
    expect(last.dataset.status).toBe('reported_not_acknowledged')
    expect(document.querySelector('[data-incidents-claim]')?.textContent).toContain(
      'of 41',
    )
  })
})
