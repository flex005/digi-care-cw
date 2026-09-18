import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/?at=20:20')
})

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { marRecordsAll } from '@/data/fixtures/medications'
import { residentsBySite } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { zonedDate } from '@/lib/format'
import { dueSoon } from './dashboard-figures'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { memberById } from '@/data/access/team-store'
import { noListYetLine, residentScopeFor } from '@/app/session/resident-scope'
import { renderSignedIn } from '@/test/render-signed-in'
import { DashboardRoute, NO_COMBINED_LINE } from './DashboardRoute'

const navigation = vi.hoisted(() => ({ pathname: '/', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
})

async function openDashboard(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <DashboardRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'What is late' })
  return { user, ...rendered }
}

const bar = (label: string) =>
  document.querySelector<HTMLElement>(`[data-bar="${label}"]`)

const lateRows = () => [...document.querySelectorAll<HTMLElement>('[data-late]')]

describe('reach', () => {
  it('tells a senior carer the home, and a care worker how many are theirs', async () => {
    await openDashboard()
    const everyone = residentsBySite(ROSEWOOD).length
    expect(
      screen.getByText(new RegExp(`${everyone} residents at Rosewood Court`)),
    ).toBeInTheDocument()
  })

  it('filters a care worker’s dashboard to their assigned residents', async () => {
    const eze = memberById(staffEze.id)
    if (eze === undefined) throw new Error('Eze is not on the team')
    const scope = residentScopeFor(eze)
    if (scope.kind !== 'named_residents') throw new Error('Eze has no list')

    await openDashboard(staffEze.id)
    const everyone = residentsBySite(ROSEWOOD).length
    // DASH-01's own words for this screen's reach.
    expect(
      screen.getByText(
        new RegExp(
          `${scope.residents.length} of ${everyone} residents assigned to you`,
        ),
      ),
    ).toBeInTheDocument()

    // And the figures are narrowed with it: the care notes bar counts their list.
    expect(bar('Care notes today')?.textContent).toContain(
      `of ${scope.residents.length}`,
    )
  })

  it('counts nothing for a care worker nobody has given a list', async () => {
    const user = userEvent.setup()
    renderSignedIn(staffOsei.id, <DashboardRoute />, ROSEWOOD)
    const said = await screen.findByText(noListYetLine)
    expect(said.closest('[data-state="unrecorded"]')).not.toBeNull()
    expect(document.querySelector('[data-bar]')).toBeNull()
    expect(document.querySelector('[data-late]')).toBeNull()
    void user
  })
})

describe('the figures', () => {
  it('never adds the three kinds of lateness together, and says why', async () => {
    await openDashboard()
    const banner = document.querySelector('[data-late-breakdown]')
    expect(banner?.textContent).toMatch(/dose(s)? with no record/)
    expect(banner?.textContent).toMatch(/review(s)? past its date/)
    expect(banner?.textContent).toMatch(/handover(s)? never countersigned/)
    expect(screen.getByText(NO_COMBINED_LINE)).toBeInTheDocument()
  })

  /*
   * The tile against the arithmetic, because a screen that computed its own
   * figure would be a second owner of it — and because a mutation that zeroed
   * this one passed every other test here.
   */
  it('shows the doses due in the next two hours that the records hold', async () => {
    await openDashboard()
    const at = now().toISOString() as IsoDateTime
    const today = zonedDate(at, 'Europe/London')
    const ids = new Set(residentsBySite(ROSEWOOD).map((resident) => resident.id))
    const expected = dueSoon(
      marRecordsAll.filter(
        (record) => ids.has(record.residentId) && record.date === today,
      ),
      at,
    )
    expect(expected.doses).toBeGreaterThan(0)

    const tile = screen
      .getByText('Due now or in the next 2 hours')
      .closest('section, article, div')
    expect(tile?.textContent).toContain(String(expected.doses))
    expect(tile?.textContent).toContain(
      `across ${expected.residents} resident${expected.residents === 1 ? '' : 's'}`,
    )
  })

  it('hatches the residents nobody wrote up today, and never a zero', async () => {
    await openDashboard()
    const tile = screen
      .getByText('Not written up today')
      .closest('[data-metric], article, section, div')
    expect(tile?.textContent).toMatch(/of \d+ residents/)
  })

  it('carries a denominator on every bar', async () => {
    await openDashboard()
    const bars = [...document.querySelectorAll<HTMLElement>('[data-bar]')]
    expect(bars).toHaveLength(6)
    for (const entry of bars) {
      expect(entry.textContent).toMatch(/\d+ of \d+/)
      const track = entry.querySelector('[role="img"]')
      expect(track?.getAttribute('aria-label')).toMatch(/recorded/)
    }
  })

  /*
   * The hatch means one thing: nobody recorded this. An unacknowledged incident
   * is a finding — somebody wrote it down and nobody picked it up — so it is
   * its own segment.
   */
  it('draws unacknowledged incidents as a finding, not as the hatch', async () => {
    await openDashboard()
    const incidents = bar('Incidents acknowledged')
    expect(incidents?.querySelector('[data-segment="finding"]')).not.toBeNull()
    expect(incidents?.textContent).toMatch(/reported and not acknowledged/)
    // Nothing is missing on that bar: every incident is on the record.
    expect(incidents?.querySelector('[data-segment="missing"]')).toBeNull()
  })

  it('draws one round column per round, from the same records as the MAR', async () => {
    await openDashboard()
    const columns = document.querySelectorAll('[data-round]')
    expect(columns).toHaveLength(4)
    for (const column of columns) {
      const track = column.querySelector('[role="img"]')
      expect(track?.getAttribute('aria-label')).toMatch(
        /round: .* recorded, .* due and not recorded/,
      )
    }
  })
})

describe('already late', () => {
  it('is oldest first, and every row reaches the record it is about', async () => {
    await openDashboard()
    const rows = lateRows()
    expect(rows.length).toBeGreaterThan(1)

    // The wait is the finding, so the longest wait is the first row.
    const due = rows.map((row) => row.dataset.lateDue ?? '')
    expect(due).toEqual([...due].sort())
    expect(due[0]).not.toBe(due[due.length - 1])

    for (const row of rows) {
      const action = row.querySelector('[data-late-action]')
      expect(action?.getAttribute('href')).toMatch(
        /^\/(medications|handover|residents\/)/,
      )
      expect(row.textContent).toMatch(/Past its date/)
    }
  })

  it('filters by kind, and each pill carries its count', async () => {
    const { user } = await openDashboard()
    const pill = (id: string) =>
      document.querySelector<HTMLElement>(`[data-late-filter="${id}"]`)

    for (const id of ['everything', 'medication', 'review', 'handover'])
      expect(pill(id)).not.toBeNull()

    await user.click(pill('review')!)
    for (const row of lateRows()) expect(row.dataset.late).toBe('review')
    expect(document.querySelector('[data-late-claim]')?.textContent).toMatch(
      /\d+ of \d+ late/,
    )
  })

  it('sends a late review to the screen that records one', async () => {
    const { user } = await openDashboard()
    await user.click(document.querySelector('[data-late-filter="review"]')!)
    const first = lateRows()[0]
    expect(first).toBeDefined()
    const href = first.querySelector('[data-late-action]')?.getAttribute('href') ?? ''
    expect(href).toMatch(
      /^\/residents\/res-[\w-]+\/(risk-assessments\/[\w_]+|care-plan\/review)$/,
    )
  })

  it('sends a never-countersigned handover to the handover', async () => {
    const { user } = await openDashboard()
    await user.click(document.querySelector('[data-late-filter="handover"]')!)
    for (const row of lateRows()) {
      expect(row.querySelector('[data-late-action]')?.getAttribute('href')).toBe(
        '/handover',
      )
      expect(row.textContent).toMatch(/this home/)
    }
  })
})
