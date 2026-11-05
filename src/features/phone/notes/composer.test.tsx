import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetSessionNotes } from '@/data/access/note-store'
import { staffEze } from '@/data/fixtures/organisation'
import { resetNoteDrafts } from '@/features/notes/composer/draft-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from '../shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/* A saved note and a kept draft both live for the session; each test starts clean. */
afterEach(() => {
  resetSessionNotes()
  resetNoteDrafts()
  window.history.replaceState(null, '', '/')
})

const people = () => document.querySelector('[data-tab="people"]') as HTMLElement

/** Okafor's record, as Ngozi Eze, whose list he is on, with the composer open. */
async function compose() {
  window.history.replaceState(null, '', '/m/people/res-okafor')
  renderSignedIn(staffEze.id, <PhoneApp />)
  fireEvent.click(
    await within(people()).findByRole('button', { name: 'Write a care note' }),
  )
  return screen.findByRole('dialog', { name: 'Care note for Emmanuel' })
}

function fill(sheet: HTMLElement) {
  fireEvent.click(within(sheet).getByRole('button', { name: /Choose a category/ }))
  const categories = screen.getByRole('dialog', { name: 'Category' })
  fireEvent.click(within(categories).getByRole('button', { name: 'General' }))
  fireEvent.change(
    within(sheet).getByRole('textbox', { name: /Written for whoever/ }),
    {
      target: { value: 'Sat in the garden for an hour and chatted with his daughter.' },
    },
  )
  fireEvent.click(within(sheet).getByRole('radio', { name: 'Settled' }))
}

describe('the phone: writing a care note', () => {
  it('rises as a full-height sheet with the subject pinned outside its scrolling body', async () => {
    const sheet = await compose()
    expect(sheet.getAttribute('data-sheet')).toBe('full')
    const head = sheet.querySelector('[data-subject-header]') as HTMLElement
    expect(within(head).getByText('Emmanuel Okafor')).toBeTruthy()
    expect(within(head).getByText('Known as Emmanuel')).toBeTruthy()
    expect(within(head).getByText(/^Born \d{2}\/\d{2}\/\d{4}$/)).toBeTruthy()
    expect(head.closest('[data-sheet-pane]')).toBeNull()
    // The save button names the subject, for when the keyboard has slid the head away.
    expect(
      within(sheet).getByRole('button', { name: 'Save note for Emmanuel Okafor' }),
    ).toBeTruthy()
  })

  it('locks the record beneath while it is open, and lets it go when it closes', async () => {
    const sheet = await compose()
    const pane = people().querySelector('[data-scroll-pane]') as HTMLElement
    expect(people().hasAttribute('inert')).toBe(true)
    expect(pane.style.overflowY).toBe('hidden')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(people().hasAttribute('inert')).toBe(false)
    expect(pane.style.overflowY).toBe('')
  })

  it('chooses nothing for you, and will not save until everything is answered', async () => {
    const sheet = await compose()
    expect(
      within(sheet).getByRole('button', { name: /Choose a category/ }),
    ).toBeTruthy()
    expect(
      within(sheet)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-checked')),
    ).toEqual(Array(6).fill('false'))
    const save = within(sheet).getByRole('button', { name: /^Save note for/ })
    expect(save.getAttribute('aria-disabled')).toBe('true')
    expect(sheet.querySelector('[data-still-needed]')?.textContent).toBe(
      'Still needed: a category, what you found and a mood, or Not recorded.',
    )
    fireEvent.click(save)
    expect(screen.getByRole('dialog', { name: 'Care note for Emmanuel' })).toBeTruthy()
  })

  it('draws Not recorded as the absence of a mood, hatched and apart from the five', async () => {
    const sheet = await compose()
    const none = within(sheet).getByRole('radio', { name: 'Not recorded' })
    expect(none.getAttribute('data-state')).toBe('unrecorded')
    const grid = within(sheet).getByRole('radio', { name: 'Settled' })
      .parentElement as HTMLElement
    expect(within(grid).getAllByRole('radio')).toHaveLength(5)
    expect(grid.contains(none)).toBe(false)
  })

  it('saves onto the record it is about, which says so and reads itself again', async () => {
    const sheet = await compose()
    fill(sheet)
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Save note for Emmanuel Okafor' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const saved = await within(people()).findByRole('status')
    expect(saved.textContent).toBe('Note saved for Emmanuel Okafor.')
    expect(people().querySelector('[data-not-on-list]')).toBeNull()
    await waitFor(() =>
      expect(within(people()).queryByText('No care note today')).toBeNull(),
    )
  })

  it('says a flagged note waits, in the desktop’s words, and that nobody is told', async () => {
    const sheet = await compose()
    fill(sheet)
    fireEvent.click(
      within(sheet).getByRole('checkbox', { name: 'Flag for a senior to review' }),
    )
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Save note for Emmanuel Okafor' }),
    )
    const saved = await within(people()).findByRole('status')
    expect(saved.textContent).toBe(
      'Note saved for Emmanuel Okafor.Flagged for a senior to review. Nobody is notified: it waits in the flagged queue.',
    )
  })
})
