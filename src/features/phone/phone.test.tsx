import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { residentsBySite } from '@/data/fixtures/residents'
import { renderSignedIn } from '@/test/render-signed-in'
import { EveryoneRoute } from './EveryoneRoute'
import { RecordRoute } from './RecordRoute'
import { SearchRoute } from './SearchRoute'
import { YourListRoute } from './YourListRoute'
import { PhoneShell } from './PhoneShell'
import { NOTHING_OUTSTANDING } from './OutstandingLine'

const navigation = vi.hoisted(() => ({
  pathname: '/m/list',
  params: {} as Record<string, string>,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

const rosewood = residentsBySite('site-rosewood-court')
const roomOf = (name: string): string => {
  const person = rosewood.find((entry) => entry.fullLegalName === name)
  return person?.room.kind === 'recorded' ? person.room.value : 'none'
}
const rowsIn = (list: HTMLElement) => within(list).getAllByRole('listitem')

describe('the phone: your list', () => {
  it('shows a care worker the four people on their list, in room order', async () => {
    navigation.pathname = '/m/list'
    renderSignedIn(staffEze.id, <YourListRoute />)
    const list = await screen.findByRole('list')
    const onList = [
      'Emmanuel Okafor',
      'Grace Adeyemi',
      'Beryl Hutchinson',
      'Arthur Pemberton',
    ]
    const names = rowsIn(list).map((row) =>
      onList.find((name) => row.textContent?.includes(name)),
    )
    const expected = [...onList].sort((a, b) =>
      roomOf(a).localeCompare(roomOf(b), 'en-GB', { numeric: true }),
    )
    expect(names).toEqual(expected)
    expect(screen.getByText('Rosewood Court: 4 residents on your list.')).toBeTruthy()
  })

  it('gives each row one line: a single outstanding thing, or quiet words naming what was checked', async () => {
    navigation.pathname = '/m/list'
    renderSignedIn(staffEze.id, <YourListRoute />)
    const list = await screen.findByRole('list')
    for (const row of rowsIn(list)) {
      const gaps = row.querySelectorAll('[data-state="unrecorded"]').length
      const recorded = row.querySelectorAll('[data-state="recorded"]').length
      const quiet = within(row).queryByText(NOTHING_OUTSTANDING)
      // One thing: a hatched gap, a given dose beside its missing signature,
      // a due dose in plain words, or the quiet line. Never a strip of badges.
      expect(gaps + recorded).toBeLessThanOrEqual(2)
      if (recorded === 1) expect(gaps).toBe(1)
      if (quiet !== null) expect(gaps + recorded).toBe(0)
    }
  })

  it('shows a senior carer every person at the home', async () => {
    navigation.pathname = '/m/list'
    renderSignedIn(staffAkinyemi.id, <YourListRoute />, 'site-rosewood-court')
    const list = await screen.findByRole('list')
    expect(rowsIn(list)).toHaveLength(rosewood.length)
  })

  it('tells a care worker with no list that nobody is assigned, that the home is not empty, and who sets it', async () => {
    navigation.pathname = '/m/list'
    renderSignedIn(staffOsei.id, <YourListRoute />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Rosewood Court has 28 residents\. Your list is empty because nobody/,
      ),
    ).toBeTruthy()
    expect(screen.getByText('Your list is set in Team Management.')).toBeTruthy()
    // The refusal is the role table's line, drawn at the point of the act.
    const refused = document.querySelector('[data-act-line="refused"]')
    expect(refused?.textContent?.trim()).toMatch(/^[A-Z].+\.$/)
    expect(screen.queryByText('No residents')).toBeNull()
    expect(screen.getAllByRole('link').map((link) => link.textContent)).not.toContain(
      'Change your list',
    )
    expect(screen.getByRole('link', { name: 'Find somebody in Everyone' })).toBeTruthy()
  })
})

describe('the phone: everyone', () => {
  it('lists the whole home by room with no status and no avatars, and opens only what the list reaches', async () => {
    navigation.pathname = '/m/everyone'
    renderSignedIn(staffEze.id, <EveryoneRoute />)
    await screen.findByText('28 residents at Rosewood Court, by room.')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(rosewood.length)
    expect(document.querySelectorAll('[role="img"]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-state="recorded"]')).toHaveLength(0)
    const opening = items.filter((item) => within(item).queryByRole('link') !== null)
    expect(opening).toHaveLength(4)
    expect(
      screen.getByText(
        '4 of these 28 residents open from here: the ones on your list.',
      ),
    ).toBeTruthy()
    const rooms = items.map((item) => item.textContent?.match(/\d+$/)?.[0] ?? '')
    expect(rooms).toEqual(
      [...rooms].sort((a, b) => a.localeCompare(b, 'en-GB', { numeric: true })),
    )
  })

  it('heads each group with a room range from the record, never a wing', async () => {
    navigation.pathname = '/m/everyone'
    renderSignedIn(staffEze.id, <EveryoneRoute />)
    await screen.findByText('28 residents at Rosewood Court, by room.')
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(headings.length).toBeGreaterThan(1)
    for (const heading of headings) expect(heading).toMatch(/^Rooms? \d+( to \d+)?$/)
  })
})

describe('the phone: search', () => {
  it('searches everyone, says so, and says what a result cannot show', async () => {
    navigation.pathname = '/m/search'
    renderSignedIn(staffEze.id, <SearchRoute />)
    expect(
      await screen.findByText(
        'Searches all 28 residents at Rosewood Court, not only your list.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(/It cannot show what is missing on that record\./),
    ).toBeTruthy()

    const field = screen.getByRole('searchbox', {
      name: 'Search everyone by name or room',
    })
    fireEvent.change(field, { target: { value: 'castledine' } })
    expect(screen.getByText('1 of 28 residents match “castledine”.')).toBeTruthy()
    const [found] = screen.getAllByRole('listitem')
    expect(found?.textContent).toContain('Winnie Castledine')
    expect(within(found as HTMLElement).queryByRole('link')).toBeNull()

    fireEvent.change(field, { target: { value: 'Pemberton' } })
    const [onList] = screen.getAllByRole('listitem')
    expect(within(onList as HTMLElement).getByRole('link')).toBeTruthy()
  })

  it('finds by preferred name and by room', async () => {
    navigation.pathname = '/m/search'
    renderSignedIn(staffAkinyemi.id, <SearchRoute />, 'site-rosewood-court')
    await screen.findByText(/^Searches all 28/)
    const field = screen.getByRole('searchbox')
    fireEvent.change(field, { target: { value: 'Emeka' } })
    expect(screen.getAllByRole('listitem')[0]?.textContent).toContain('Emeka Obi')
    const room = roomOf('Doris Kavanagh')
    fireEvent.change(field, { target: { value: room } })
    expect(
      screen
        .getAllByRole('listitem')
        .some((item) => item.textContent?.includes('Doris Kavanagh')),
    ).toBe(true)
  })

  it('says nobody matched, over the whole home, rather than going blank', async () => {
    navigation.pathname = '/m/search'
    renderSignedIn(staffEze.id, <SearchRoute />)
    await screen.findByText(/^Searches all 28/)
    const field = screen.getByRole('searchbox')
    fireEvent.change(field, { target: { value: 'zzz' } })
    expect(
      await screen.findByText(
        'Nobody at Rosewood Court matches “zzz”, out of 28 residents.',
      ),
    ).toBeTruthy()
  })
})

describe('the phone: one record', () => {
  it('opens under a subject header with photo, name, preferred name, room and date of birth', async () => {
    navigation.pathname = '/m/people/res-okafor'
    navigation.params = { residentId: 'res-okafor' }
    renderSignedIn(staffEze.id, <RecordRoute />)
    const header = await screen.findByRole('banner')
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Emmanuel Okafor',
    )
    expect(within(header).getByText('Known as Emmanuel')).toBeTruthy()
    expect(within(header).getByText(`Room ${roomOf('Emmanuel Okafor')}`)).toBeTruthy()
    expect(within(header).getByText(/^Born \d{2}\/\d{2}\/\d{4}$/)).toBeTruthy()
    expect(within(header).getByRole('img', { name: /Emmanuel Okafor/ })).toBeTruthy()
  })

  it('shows allergies, what is outstanding today, and the rest as rows that do not open', async () => {
    navigation.params = { residentId: 'res-okafor' }
    renderSignedIn(staffEze.id, <RecordRoute />)
    expect(await screen.findByRole('heading', { name: 'Allergies' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Outstanding today' })).toBeTruthy()
    const rest = screen.getByRole('heading', { name: 'The rest of the record' })
      .parentElement as HTMLElement
    const rows = within(rest).getAllByRole('listitem')
    expect(rows.length).toBeGreaterThanOrEqual(8)
    for (const row of rows) {
      expect(within(row).getByText('Not built yet')).toBeTruthy()
      expect(within(row).queryByRole('link')).toBeNull()
      expect(within(row).queryByRole('button')).toBeNull()
    }
  })

  it('names an allergy with its severity, and draws "not recorded" under the hatch', async () => {
    const withAllergy = rosewood.find((person) => person.allergies.kind === 'allergies')
    const notAsked = rosewood.find((person) => person.allergies.kind === 'not_recorded')
    if (withAllergy?.allergies.kind !== 'allergies' || notAsked === undefined)
      throw new Error('The fixtures no longer hold both allergy states at Rosewood.')
    const [first] = withAllergy.allergies.items

    navigation.params = { residentId: withAllergy.id }
    const { unmount } = renderSignedIn(
      staffAkinyemi.id,
      <RecordRoute />,
      'site-rosewood-court',
    )
    const section = (await screen.findByRole('heading', { name: 'Allergies' }))
      .parentElement as HTMLElement
    expect(within(section).getByText(first.substance)).toBeTruthy()
    expect(
      within(section).getAllByText(new RegExp(first.severity, 'i')).length,
    ).toBeGreaterThan(0)
    unmount()

    navigation.params = { residentId: notAsked.id }
    renderSignedIn(staffAkinyemi.id, <RecordRoute />, 'site-rosewood-court')
    const hatched = (await screen.findByRole('heading', { name: 'Allergies' }))
      .parentElement as HTMLElement
    expect(hatched.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'Not recorded',
    )
  })

  it('shows a record off the list by name only, with who sets the list', async () => {
    navigation.params = { residentId: 'res-castledine' }
    renderSignedIn(staffEze.id, <RecordRoute />)
    expect(
      await screen.findByText('Winnie Castledine is not on your list.'),
    ).toBeTruthy()
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByText(/^Born /)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Allergies' })).toBeNull()
  })
})

describe('the phone frame', () => {
  it('names the home in the bar and marks Medication and More as not built', async () => {
    navigation.pathname = '/m/list'
    renderSignedIn(staffEze.id, <PhoneShell />)
    expect(await screen.findByText('Rosewood Court')).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(
      within(nav)
        .getByRole('link', { name: /Residents/ })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(
      within(nav).getByRole('button', { name: 'Medication, not built' }),
    ).toBeTruthy()
    expect(within(nav).getByRole('button', { name: 'More, not built' })).toBeTruthy()
  })
})
