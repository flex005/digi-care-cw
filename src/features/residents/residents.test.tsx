import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { residentsBySite } from '@/data/fixtures/residents'
import {
  staffAkinyemi,
  staffEze,
  staffOsei,
  staffPatel,
} from '@/data/fixtures/organisation'
import { recordCompleteness } from '@/data/completeness'
import { renderSignedIn } from '@/test/render-signed-in'
import { ResidentsRoute } from './ResidentsRoute'

const navigation = vi.hoisted(() => ({ pathname: '/residents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const rosewood = residentsBySite('site-rosewood-court')
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

describe('the residents list', () => {
  it('shows a senior carer every resident at the home, and says so', async () => {
    renderSignedIn(staffAkinyemi.id, <ResidentsRoute />, 'site-rosewood-court')
    const table = await screen.findByRole('table')
    expect(rowsOf(table)).toHaveLength(rosewood.length)
    expect(
      within(table).getByText(
        `${rosewood.length} of ${rosewood.length} residents at Rosewood Court, sorted by name, ascending.`,
      ),
    ).toBeTruthy()
  })

  it('shows a care worker the residents on their list, counted over it', async () => {
    renderSignedIn(staffEze.id, <ResidentsRoute />)
    const table = await screen.findByRole('table')
    expect(
      rowsOf(table).map((row) => within(row).getAllByRole('link')[0]?.textContent),
    ).toEqual([
      'Arthur Pemberton',
      'Beryl Hutchinson',
      'Emmanuel Okafor',
      'Grace Adeyemi',
    ])
    expect(
      within(table).getByText('4 of your 4 residents, sorted by name, ascending.'),
    ).toBeTruthy()
    expect(screen.getByText("Counted over your list, not the home's.")).toBeTruthy()
  })

  it('counts critical gaps over the list with the denominator on the card', async () => {
    renderSignedIn(staffEze.id, <ResidentsRoute />)
    await screen.findByRole('table')
    const onList = rosewood.filter((resident) =>
      ['res-okafor', 'res-adeyemi', 'res-hutchinson', 'res-pemberton'].includes(
        resident.id,
      ),
    )
    const expected = onList.filter(
      (resident) => recordCompleteness(resident).hasCriticalGaps,
    )
    const tile = document.querySelector(
      '[data-metric-tile="Critical gaps"]',
    ) as HTMLElement
    expect(within(tile).getByText(String(expected.length))).toBeTruthy()
    expect(within(tile).getByText('of your 4 residents')).toBeTruthy()
  })

  it('states that nobody has given a care worker a list, rather than an empty table', async () => {
    renderSignedIn(staffOsei.id, <ResidentsRoute />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(document.querySelector('[data-metric-tile]')).toBeNull()
    expect(document.querySelector('[data-state="unrecorded"]')).not.toBeNull()
  })

  it('says whose decision gave a care worker the whole home', async () => {
    renderSignedIn(staffPatel.id, <ResidentsRoute />)
    const table = await screen.findByRole('table')
    expect(rowsOf(table)).toHaveLength(residentsBySite('site-ashgrove-lodge').length)
    // Ismail Sowande was admitted yesterday, so the line goes on to say who
    // left the 48-hour count and why.
    expect(
      screen.getByText(
        /^Counted over your list, which is every resident at Ashgrove Lodge\. 1 admitted under 48 hours ago/,
      ),
    ).toBeTruthy()
  })

  it('narrows by name or room as somebody types', async () => {
    renderSignedIn(staffAkinyemi.id, <ResidentsRoute />, 'site-rosewood-court')
    const table = await screen.findByRole('table')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Pemberton' } })
    expect(rowsOf(table)).toHaveLength(1)
    expect(within(table).getByRole('link', { name: 'Arthur Pemberton' })).toBeTruthy()
  })

  it('sorts residents nobody has written up first when the dark card is used', async () => {
    renderSignedIn(staffAkinyemi.id, <ResidentsRoute />, 'site-rosewood-court')
    const table = await screen.findByRole('table')
    const sort = screen.getByRole('button', { name: 'Sort by oldest care note' })
    fireEvent.click(sort)
    expect(sort.getAttribute('aria-pressed')).toBe('true')
    expect(
      within(table).getByText(/sorted by oldest care note, ascending\.$/),
    ).toBeTruthy()
  })

  it('draws no Add resident act, and no period control', async () => {
    renderSignedIn(staffAkinyemi.id, <ResidentsRoute />, 'site-rosewood-court')
    await screen.findByRole('table')
    expect(screen.queryByText(/Add resident/)).toBeNull()
    expect(screen.queryByText(/Last 30 days/)).toBeNull()
    expect(screen.queryByText(/this month/)).toBeNull()
  })
})
