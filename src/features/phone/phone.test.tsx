import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { residentsBySite } from '@/data/fixtures/residents'
import type { SiteId, StaffId } from '@/data/types'
import { renderSignedIn } from '@/test/render-signed-in'
import { NOTHING_OUTSTANDING } from './OutstandingLine'
import { render } from '@testing-library/react'
import { PhoneApp } from './shell/PhoneApp'
import { PhoneStage } from './shell/PhoneStage'
import { PhoneSheet } from './sheet/PhoneSheet'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

const rosewood = residentsBySite('site-rosewood-court')
const roomOf = (name: string): string => {
  const person = rosewood.find((entry) => entry.fullLegalName === name)
  return person?.room.kind === 'recorded' ? person.room.value : 'none'
}

/** Arrive at an address, signed in as a named person, the way a link would. */
function openAt(path: string, who: StaffId, site?: SiteId) {
  window.history.replaceState(null, '', path)
  return renderSignedIn(who, <PhoneApp />, site)
}

const tab = (id: 'today' | 'people') =>
  document.querySelector(`[data-tab="${id}"]`) as HTMLElement
/** The screen in front on a tab: the last entry that is not leaving. */
const front = (id: 'today' | 'people') => {
  const entries = [
    ...tab(id).querySelectorAll<HTMLElement>(':scope > [data-entry]'),
  ].filter((entry) => entry.getAttribute('aria-hidden') !== 'true')
  return entries[entries.length - 1] as HTMLElement
}
const entriesOn = (id: 'today' | 'people') =>
  [...tab(id).querySelectorAll<HTMLElement>(':scope > [data-entry]')].map((entry) =>
    entry.getAttribute('data-entry'),
  )

afterEach(() => window.history.replaceState(null, '', '/'))

describe('the phone shell', () => {
  it('locks the document while it is mounted, and lets it go after', async () => {
    window.history.replaceState(null, '', '/m/people')
    const { unmount } = renderSignedIn(staffEze.id, <PhoneStage />)
    await waitFor(() => expect(document.documentElement.className).not.toBe(''))
    unmount()
    expect(document.documentElement.className).toBe('')
  })

  it('gives every screen exactly one pane that scrolls', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    await within(front('people')).findByText('Allergies')
    for (const entry of document.querySelectorAll('[data-entry]'))
      expect(entry.querySelectorAll('[data-scroll-pane]')).toHaveLength(1)
  })

  it('pushes a record over the list, and pops it back off', async () => {
    openAt('/m/people', staffEze.id)
    const row = await within(tab('people')).findByRole('link', {
      name: /Grace Adeyemi/,
    })
    fireEvent.click(row)
    expect(entriesOn('people')).toEqual(['people', 'record'])
    expect(window.location.pathname).toBe('/m/people/res-adeyemi')
    await within(front('people')).findByText('Allergies')

    fireEvent.click(within(front('people')).getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(entriesOn('people')).toEqual(['people']))
  })

  it('opens a linked record over its tab’s root, so back has somewhere to go', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    expect(entriesOn('people')).toEqual(['people', 'record'])
    // Today has not been shown, so it has not been mounted or read anything.
    expect(entriesOn('today')).toEqual([])
    fireEvent.click(
      await within(front('people')).findByRole('button', { name: 'Back' }),
    )
    await waitFor(() => expect(entriesOn('people')).toEqual(['people']))
    expect(window.location.pathname).toBe('/m/people')
  })

  it('keeps each tab’s stack while another tab is showing', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    fireEvent.click(within(nav).getByRole('link', { name: /Today/ }))
    expect(tab('people').hasAttribute('inert')).toBe(true)
    expect(entriesOn('people')).toEqual(['people', 'record'])
    fireEvent.click(within(nav).getByRole('link', { name: /Residents/ }))
    expect(tab('people').hasAttribute('inert')).toBe(false)
    expect(entriesOn('people')).toEqual(['people', 'record'])
  })

  it('pops a tab to its root when the tab you are on is tapped', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    fireEvent.click(within(nav).getByRole('link', { name: /Residents/ }))
    await waitFor(() => expect(entriesOn('people')).toEqual(['people']))
  })

  it('says an unbuilt tab is not built, in a sheet that rises inside the phone', async () => {
    window.history.replaceState(null, '', '/m')
    renderSignedIn(staffEze.id, <PhoneStage />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Medication, not built/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Medication' })
    expect(sheet.closest('[data-phone-frame]')).not.toBeNull()
    expect(
      within(sheet).getByText('Medication is not built yet on the phone.'),
    ).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Done' })).toBeTruthy()
  })

  it('names the home in the bar of every screen', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    await within(front('people')).findByText('Allergies')
    for (const entry of document.querySelectorAll('[data-entry]'))
      expect(within(entry as HTMLElement).getByText('Rosewood Court')).toBeTruthy()
  })
})

describe('the phone: your list', () => {
  it('shows a care worker the four people on their list, in room order', async () => {
    openAt('/m/people', staffEze.id)
    const list = await within(tab('people')).findByRole('list')
    const onList = [
      'Emmanuel Okafor',
      'Grace Adeyemi',
      'Beryl Hutchinson',
      'Arthur Pemberton',
    ]
    const names = within(list)
      .getAllByRole('listitem')
      .map((row) => onList.find((name) => row.textContent?.includes(name)))
    expect(names).toEqual(
      [...onList].sort((a, b) =>
        roomOf(a).localeCompare(roomOf(b), 'en-GB', { numeric: true }),
      ),
    )
    expect(
      within(tab('people')).getByText('Rosewood Court: 4 residents on your list.'),
    ).toBeTruthy()
  })

  it('gives each row one line: one outstanding thing, or quiet words naming what was checked', async () => {
    openAt('/m/people', staffEze.id)
    const list = await within(tab('people')).findByRole('list')
    for (const row of within(list).getAllByRole('listitem')) {
      const gaps = row.querySelectorAll('[data-state="unrecorded"]').length
      const recorded = row.querySelectorAll('[data-state="recorded"]').length
      expect(gaps + recorded).toBeLessThanOrEqual(2)
      if (recorded === 1) expect(gaps).toBe(1)
      if (within(row).queryByText(NOTHING_OUTSTANDING) !== null)
        expect(gaps + recorded).toBe(0)
    }
  })

  it('shows a senior carer every person at the home', async () => {
    openAt('/m/people', staffAkinyemi.id, 'site-rosewood-court')
    const list = await within(tab('people')).findByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(rosewood.length)
  })

  it('tells a care worker with no list that nobody is assigned, that the home is not empty, and where it is set', async () => {
    openAt('/m/people', staffOsei.id)
    const people = tab('people')
    expect(
      await within(people).findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(
      within(people).getByText(/Rosewood Court has 28 residents\. Your list is empty/),
    ).toBeTruthy()
    expect(
      within(people).getByText('Your list is set in Team Management.'),
    ).toBeTruthy()
    expect(
      people.querySelector('[data-act-line="refused"]')?.textContent?.trim(),
    ).toMatch(/^[A-Z].+\.$/)
    fireEvent.click(
      within(people).getByRole('button', { name: 'Find somebody in Everyone' }),
    )
    expect(
      await within(people).findByText('28 residents at Rosewood Court, by room.'),
    ).toBeTruthy()
  })
})

describe('the phone: everyone', () => {
  it('lists the whole home by room with no status and no avatars, and opens only what the list reaches', async () => {
    openAt('/m/people', staffEze.id)
    const people = tab('people')
    await within(people).findByRole('list')
    fireEvent.click(within(people).getByRole('button', { name: 'Everyone' }))
    await within(people).findByText('28 residents at Rosewood Court, by room.')
    const items = within(people).getAllByRole('listitem')
    expect(items).toHaveLength(rosewood.length)
    expect(people.querySelectorAll('li [role="img"]')).toHaveLength(0)
    expect(people.querySelectorAll('li [data-state="recorded"]')).toHaveLength(0)
    expect(
      items.filter((item) => within(item).queryByRole('link') !== null),
    ).toHaveLength(4)
    expect(
      within(people).getByText(
        '4 of these 28 residents open from here: the ones on your list.',
      ),
    ).toBeTruthy()
    const rooms = items.map((item) => item.textContent?.match(/\d+$/)?.[0] ?? '')
    expect(rooms).toEqual(
      [...rooms].sort((a, b) => a.localeCompare(b, 'en-GB', { numeric: true })),
    )
    const headings = within(people)
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    for (const heading of headings) expect(heading).toMatch(/^Rooms? \d+( to \d+)?$/)
  })
})

describe('the phone: search', () => {
  it('is pushed, searches everyone, says so, and says what a result cannot show', async () => {
    openAt('/m/people', staffEze.id)
    fireEvent.click(
      await within(tab('people')).findByRole('link', {
        name: /Search everyone by name or room/,
      }),
    )
    expect(entriesOn('people')).toEqual(['people', 'search'])
    const search = front('people')
    expect(
      await within(search).findByText(
        /^Searches all 28 residents at Rosewood Court, not only your list\./,
      ),
    ).toBeTruthy()
    expect(
      within(search).getByText(/It cannot show what is missing on that record\./),
    ).toBeTruthy()

    const field = within(search).getByRole('searchbox', {
      name: 'Search everyone by name or room',
    })
    expect(field.getAttribute('enterkeyhint')).toBe('search')
    expect(field.getAttribute('autocapitalize')).toBe('none')
    fireEvent.change(field, { target: { value: 'castledine' } })
    expect(
      within(search).getByText('1 of 28 residents match “castledine”.'),
    ).toBeTruthy()
    const [found] = within(search).getAllByRole('listitem')
    expect(found?.textContent).toContain('Winnie Castledine')
    expect(within(found as HTMLElement).queryByRole('link')).toBeNull()
  })

  it('finds by preferred name and by room, and says when nobody matched', async () => {
    openAt('/m/search', staffAkinyemi.id, 'site-rosewood-court')
    const search = front('people')
    await within(search).findByText(/^Searches all 28/)
    const field = within(search).getByRole('searchbox')
    fireEvent.change(field, { target: { value: 'Emeka' } })
    expect(within(search).getAllByRole('listitem')[0]?.textContent).toContain(
      'Emeka Obi',
    )
    fireEvent.change(field, { target: { value: roomOf('Doris Kavanagh') } })
    expect(
      within(search)
        .getAllByRole('listitem')
        .some((item) => item.textContent?.includes('Doris Kavanagh')),
    ).toBe(true)
    fireEvent.change(field, { target: { value: 'zzz' } })
    expect(
      within(search).getByText(
        'Nobody at Rosewood Court matches “zzz”, out of 28 residents.',
      ),
    ).toBeTruthy()
  })
})

describe('the phone: one record', () => {
  it('fixes a subject header outside the scrolling pane', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    const record = front('people')
    await within(record).findByText('Known as Emmanuel')
    const header = record.querySelector('[data-subject-header]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Emmanuel Okafor',
    )
    expect(header.closest('[data-scroll-pane]')).toBeNull()
    expect(within(header).getByText('Emmanuel Okafor')).toBeTruthy()
    expect(within(header).getByText('Known as Emmanuel')).toBeTruthy()
    expect(within(header).getByText(`Room ${roomOf('Emmanuel Okafor')}`)).toBeTruthy()
    expect(within(header).getByText(/^Born \d{2}\/\d{2}\/\d{4}$/)).toBeTruthy()
    expect(within(header).getByRole('img', { name: /Emmanuel Okafor/ })).toBeTruthy()
  })

  it('anchors the care note outside the pane, saying at the act that it is not built', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    const record = front('people')
    const act = await within(record).findByRole('button', { name: 'Write a care note' })
    expect(act.closest('[data-scroll-pane]')).toBeNull()
    expect(act.getAttribute('aria-disabled')).toBe('true')
    expect(record.querySelector('[data-act-line="not_built"]')?.textContent).toContain(
      'not built yet on the phone',
    )
  })

  it('lists the rest of the record as rows that do not open', async () => {
    openAt('/m/people/res-okafor', staffEze.id)
    const record = front('people')
    const rest = (
      await within(record).findByRole('heading', { name: 'The rest of the record' })
    ).closest('section') as HTMLElement
    const rows = within(rest).getAllByRole('listitem')
    expect(rows.length).toBeGreaterThanOrEqual(8)
    for (const row of rows) {
      expect(within(row).getByText('Not built yet')).toBeTruthy()
      expect(within(row).queryByRole('link')).toBeNull()
      expect(within(row).queryByRole('button')).toBeNull()
    }
  })

  const withAllergy = rosewood.find((person) => person.allergies.kind === 'allergies')
  const notAsked = rosewood.find((person) => person.allergies.kind === 'not_recorded')

  it('names an allergy with its severity', async () => {
    if (withAllergy?.allergies.kind !== 'allergies')
      throw new Error('The fixtures no longer hold an allergy at Rosewood.')
    const [first] = withAllergy.allergies.items
    openAt(`/m/people/${withAllergy.id}`, staffAkinyemi.id, 'site-rosewood-court')
    const section = (
      await within(front('people')).findByRole(
        'heading',
        { name: 'Allergies' },
        { timeout: 4000 },
      )
    ).parentElement as HTMLElement
    expect(within(section).getByText(first.substance)).toBeTruthy()
    expect(
      within(section).getAllByText(new RegExp(first.severity, 'i')).length,
    ).toBeGreaterThan(0)
  })

  it('draws allergies nobody recorded under the hatch', async () => {
    if (notAsked === undefined)
      throw new Error('The fixtures no longer hold an unrecorded allergy at Rosewood.')
    openAt(`/m/people/${notAsked.id}`, staffAkinyemi.id, 'site-rosewood-court')
    const hatched = (
      await within(front('people')).findByRole(
        'heading',
        { name: 'Allergies' },
        { timeout: 4000 },
      )
    ).parentElement as HTMLElement
    expect(hatched.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'Not recorded',
    )
  })

  it('shows a record off the list by name only, with where the list is set', async () => {
    openAt('/m/people/res-castledine', staffEze.id)
    const record = front('people')
    expect(
      await within(record).findByText('Winnie Castledine is not on your list.'),
    ).toBeTruthy()
    expect(record.querySelector('[data-subject-header]')).toBeNull()
    expect(within(record).queryByText(/^Born /)).toBeNull()
    expect(within(record).queryByRole('heading', { name: 'Allergies' })).toBeNull()
    expect(
      within(record).queryByRole('button', { name: 'Write a care note' }),
    ).toBeNull()
  })
})

describe('the phone: today', () => {
  const figureOf = (card: HTMLElement) =>
    Number(card.querySelector('[data-numeric]')?.textContent?.replace(/,/g, ''))

  it('is headed by the reader, with the shift and the home under their name', async () => {
    openAt('/m', staffEze.id)
    const header = front('today').querySelector('header') as HTMLElement
    expect(within(header).getByRole('heading', { level: 1 }).textContent).toBe(
      'Hello, Ngozi',
    )
    expect(within(header).getByText(/^\w+ shift · Rosewood Court$/)).toBeTruthy()
    expect(within(header).getByRole('img', { name: /Ngozi Eze/ })).toBeTruthy()
    expect(within(header).queryByRole('button')).toBeNull()
  })

  it('counts over the reader’s list, with every figure out of something', async () => {
    openAt('/m', staffEze.id)
    const today = front('today')
    expect(await within(today).findByText('Already late')).toBeTruthy()
    expect(
      within(today).getByText("Counted over your list, not the home's."),
    ).toBeTruthy()
    expect(within(today).getByText('of your 4 residents')).toBeTruthy()
    expect(within(today).getByText(/^of [\d,]+ doses? on today’s chart$/)).toBeTruthy()
    expect(
      within(today).getByText(
        /^of [\d,]+ doses? on today’s chart, nothing recorded yet$/,
      ),
    ).toBeTruthy()
  })

  it('counts late only what this reader can act on now, and says what it leaves out', async () => {
    openAt('/m', staffEze.id)
    const card = (await within(front('today')).findByText('Already late')).closest(
      '[data-action-card]',
    ) as HTMLElement
    expect(
      within(card).getByText(/missed today, of [\d,]+ doses? on today’s chart$/),
    ).toBeTruthy()
    expect(within(card).getByText(/^Reviews are not counted: .+\.$/)).toBeTruthy()
    expect(within(card).getByText(/^Handovers are not counted: .+\.$/)).toBeTruthy()
    // Four residents and one day: a care worker's late figure is a handful.
    expect(figureOf(card)).toBeLessThan(40)
  })

  it('counts a senior carer’s reviews, and no history beyond today', async () => {
    openAt('/m', staffAkinyemi.id, 'site-rosewood-court')
    const card = (await within(front('today')).findByText('Already late')).closest(
      '[data-action-card]',
    ) as HTMLElement
    expect(within(card).getByText(/^[\d,]+ reviews? past its date$/)).toBeTruthy()
    expect(within(card).queryByText(/^Reviews are not counted/)).toBeNull()
    // Ninety days of omissions put 1,018 here; one day at one home cannot.
    expect(figureOf(card)).toBeLessThan(100)
  })

  it('pushes the record a late row is about, onto the Today stack', async () => {
    openAt('/m', staffAkinyemi.id, 'site-rosewood-court')
    const today = front('today')
    const late = (
      await within(today).findByRole('heading', { name: 'Already late, oldest first' })
    ).closest('section') as HTMLElement
    const [first] = within(late).getAllByRole('link')
    fireEvent.click(first as HTMLElement)
    expect(entriesOn('today')).toEqual(['today', 'record'])
    expect(entriesOn('people')).toEqual([])
  })

  it('filters the late list from a picker sheet', async () => {
    openAt('/m', staffAkinyemi.id, 'site-rosewood-court')
    const today = front('today')
    const late = (
      await within(today).findByRole('heading', { name: 'Already late, oldest first' })
    ).closest('section') as HTMLElement
    fireEvent.click(within(late).getByRole('button', { name: /Everything late/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Show' })
    const reviews = within(sheet)
      .getAllByRole('button')
      .find((option) => option.textContent?.startsWith('Reviews'))
    fireEvent.click(reviews as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const after = within(late).queryAllByRole('listitem')
    expect(after.length).toBeGreaterThan(0)
    for (const row of after) expect(row.textContent).toMatch(/past its (review )?date/)
  })

  it('counts nothing for a reader nobody has given a list', async () => {
    openAt('/m', staffOsei.id)
    const today = front('today')
    expect(
      await within(today).findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(within(today).queryByText('Already late')).toBeNull()
  })
})

describe('the phone tab bar', () => {
  it('carries a badge on Medication only, its denominator and scope in the name', async () => {
    // The fixture clock sits in the nearest round running, so a whole home has
    // doses in their window.
    openAt('/m/people', staffAkinyemi.id, 'site-rosewood-court')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const badge = await waitFor(
      () => {
        const found = nav.querySelector('[data-badge]')
        if (found === null) throw new Error('no badge yet')
        return found
      },
      { timeout: 4000 },
    )
    expect(nav.querySelectorAll('[data-badge]')).toHaveLength(1)
    const tabButton = badge.closest('button') as HTMLElement
    expect(tabButton.getAttribute('aria-label')).toBe(
      `Medication, not built. ${badge.textContent} of ${
        /of ([\d,]+ doses?) on/.exec(tabButton.getAttribute('aria-label') ?? '')?.[1]
      } on today’s chart due now or in the next 2 hours, on your list.`,
    )
    fireEvent.click(tabButton)
    const sheet = await screen.findByRole('dialog', { name: 'Medication' })
    expect(
      within(sheet).getByText(/due now or in the next 2 hours, on your list\.$/),
    ).toBeTruthy()
  })

  it('draws no badge for a reader with no list', async () => {
    openAt('/m/people', staffOsei.id)
    await within(tab('people')).findByText(
      'Nobody has given you a list of residents yet.',
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.querySelectorAll('[data-badge]')).toHaveLength(0)
    expect(
      within(nav).getByRole('button', { name: 'Medication, not built' }),
    ).toBeTruthy()
  })
})

describe('the capture sheet', () => {
  it('draws every phone screen in its own frame, each the real app, and leaves the address alone', async () => {
    window.history.replaceState(null, '', '/m/sheet')
    render(<PhoneSheet />)
    const captions = await screen.findAllByText(/ · (Ngozi Eze|Kwame Osei)$/)
    expect(captions.map((caption) => caption.textContent)).toEqual([
      'Today · Ngozi Eze',
      'Your list · Ngozi Eze',
      'Everyone · Ngozi Eze',
      'Search · Ngozi Eze',
      'Nobody assigned · Kwame Osei',
      'One resident · Ngozi Eze',
    ])
    const frames = [...document.querySelectorAll<HTMLElement>('[data-phone-frame]')]
    expect(frames).toHaveLength(6)
    await waitFor(() =>
      expect(
        frames.map((frame) => frame.querySelectorAll('[data-scroll-pane]').length),
      ).toEqual([1, 1, 1, 2, 1, 2]),
    )
    expect(window.location.pathname).toBe('/m/sheet')
    const [, , everyone, , nobody, record] = frames as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ]
    expect(
      await within(everyone).findByText('28 residents at Rosewood Court, by room.'),
    ).toBeTruthy()
    expect(
      await within(nobody).findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(record.querySelector('[data-entry="record"]')).not.toBeNull()
  })
})
