import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetSessionNotes } from '@/data/access/note-store'
import { staffEze } from '@/data/fixtures/organisation'
import { residentsBySite } from '@/data/fixtures/residents'
import { resetNoteDrafts } from '@/features/notes/composer/draft-store'
import { listName } from '@/features/residents/list-name'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from '../shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

afterEach(() => {
  resetSessionNotes()
  resetNoteDrafts()
  window.history.replaceState(null, '', '/')
})

/* By the DOM: a modal sheet hides the tab bar from role queries while it is open. */
const nav = () =>
  document.querySelector('nav[aria-label="Main navigation"]') as HTMLElement
const tab = (id: 'today' | 'people') =>
  document.querySelector(`[data-tab="${id}"]`) as HTMLElement
const entriesOn = (id: 'today' | 'people') =>
  [...tab(id).querySelectorAll<HTMLElement>(':scope > [data-entry]')].map((entry) =>
    entry.getAttribute('data-entry'),
  )

/** Today, as Ngozi Eze, with the picker open from the centre action. */
async function pick() {
  window.history.replaceState(null, '', '/m')
  renderSignedIn(staffEze.id, <PhoneApp />)
  fireEvent.click(within(nav()).getByRole('button', { name: 'Write a care note' }))
  const sheet = await screen.findByRole('dialog', { name: 'Who is this note about?' })
  await within(sheet).findByText(/on your list\. Search reaches everyone else/)
  return sheet
}

const yours = (sheet: HTMLElement) =>
  within(sheet.querySelector('[data-picker]') as HTMLElement)
    .getAllByRole('button')
    .map((row) => row.querySelector('span span')?.textContent ?? '')

describe('the phone: who is this note about?', () => {
  it('opens from the centre action over the tab you are on, and moves nothing', async () => {
    await pick()
    expect(window.location.pathname).toBe('/m')
    expect(nav().querySelector('[aria-current="page"]')?.textContent).toBe('Today')
  })

  it('opens on the reader’s list, every row one they may write about', async () => {
    const sheet = await pick()
    expect(yours(sheet)).toHaveLength(4)
    expect(sheet.querySelector('[data-refused]')).toBeNull()
  })

  it('finds somebody off the list and says why they cannot be chosen, rather than nothing', async () => {
    const sheet = await pick()
    const listed = new Set(yours(sheet))
    const off = residentsBySite('site-rosewood-court').find(
      (person) => !listed.has(listName(person)),
    )
    if (off === undefined) throw new Error('every Rosewood resident is on this list')
    const surname = off.fullLegalName.split(' ').pop() ?? ''
    fireEvent.change(within(sheet).getByRole('searchbox'), {
      target: { value: surname },
    })
    const row = (
      await within(sheet).findByText('Ada Nwachukwu is not on your list.')
    ).closest('li') as HTMLElement
    expect(row.getAttribute('data-refused')).toBe('not_on_your_list')
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it('pushes the chosen record onto the tab you are on, with the composer over it', async () => {
    const sheet = await pick()
    const first = within(
      sheet.querySelector('[data-picker]') as HTMLElement,
    ).getAllByRole('button')[0] as HTMLElement
    const name = first.querySelector('span span')?.textContent ?? ''
    fireEvent.click(first)
    await waitFor(() => expect(entriesOn('today')).toEqual(['today', 'record']))
    expect(window.location.pathname).toMatch(/^\/m\/people\/res-/)
    const composer = await screen.findByRole('dialog', { name: /^Care note for / })
    expect(
      within(composer).getByRole('button', { name: `Save note for ${name}` }),
    ).toBeTruthy()
  })
})
