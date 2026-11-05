import { fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getCareNotes,
  submitCareNote,
  submitCorrectionNote,
} from '@/data/access/client'
import { resetSessionNotes } from '@/data/access/note-store'
import { now } from '@/data/fixtures/clock'
import { staffEze } from '@/data/fixtures/organisation'
import type { CareNote, IsoDateTime, ResidentId } from '@/data/types'
import { ROWS_PER_PAGE } from '@/components/primitives/Pager'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from '../shell/PhoneApp'
import { showingLine } from '../screens/NotesScreen'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

afterEach(() => {
  resetSessionNotes()
  window.history.replaceState(null, '', '/')
})

const OKAFOR = 'res-okafor' as ResidentId
const people = () => document.querySelector('[data-tab="people"]') as HTMLElement
const entries = () =>
  [...people().querySelectorAll<HTMLElement>(':scope > [data-entry]')].map((entry) =>
    entry.getAttribute('data-entry'),
  )
const front = () => {
  const all = people().querySelectorAll<HTMLElement>(':scope > [data-entry]')
  return all[all.length - 1] as HTMLElement
}

const write = (body: string) =>
  submitCareNote({
    residentId: OKAFOR,
    category: 'general',
    body,
    mood: { kind: 'not_recorded' },
    shift: { kind: 'auto', value: 'late' },
    author: staffEze,
    at: now().toISOString() as IsoDateTime,
    flag: { kind: 'not_flagged' },
  })

async function openNotes() {
  window.history.replaceState(null, '', '/m/people/res-okafor')
  renderSignedIn(staffEze.id, <PhoneApp />)
  fireEvent.click(await within(people()).findByRole('link', { name: /Care notes/ }))
  await waitFor(() => expect(entries()).toEqual(['people', 'record', 'notes']))
  await within(front()).findByText(/^Showing /)
  return front()
}

const shownIds = (screen: HTMLElement) =>
  [...screen.querySelectorAll<HTMLElement>('[data-note]')].map((note) =>
    note.getAttribute('data-note'),
  )

describe('what the notes list says it is showing', () => {
  it('says the batch and the whole while there is more', () => {
    expect(showingLine(25, 395)).toBe('Showing the newest 25 of 395 care notes.')
  })

  it('says all, when it is all, so the end of the list is not mistaken for a batch', () => {
    expect(showingLine(395, 395)).toBe('Showing all 395 care notes, newest first.')
    expect(showingLine(25, 3)).toBe('Showing all 3 care notes, newest first.')
    expect(showingLine(25, 1)).toBe('Showing the only care note.')
  })
})

describe('the phone: a resident’s care notes', () => {
  it('pushes from the record, at an address of its own', async () => {
    await openNotes()
    expect(window.location.pathname).toBe('/m/people/res-okafor/notes')
  })

  it('shows the newest batch, says how many of how many, and adds the next on request', async () => {
    const screen = await openNotes()
    const expected = (await getCareNotes(OKAFOR))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((note) => note.id)
    // Okafor has more than two batches, so both the batch and the rest are real.
    expect(expected.length).toBeGreaterThan(ROWS_PER_PAGE * 2)
    expect(shownIds(screen)).toEqual(expected.slice(0, ROWS_PER_PAGE))
    expect(screen.querySelector('[data-showing]')?.textContent).toBe(
      `Showing the newest ${ROWS_PER_PAGE} of ${expected.length} care notes.`,
    )
    fireEvent.click(
      within(screen).getByRole('button', { name: `Show the next ${ROWS_PER_PAGE}` }),
    )
    expect(shownIds(screen)).toEqual(expected.slice(0, ROWS_PER_PAGE * 2))
    expect(screen.querySelector('[data-showing]')?.textContent).toBe(
      `Showing the newest ${ROWS_PER_PAGE * 2} of ${expected.length} care notes.`,
    )
  })

  it('puts the note above where it came from, with all five facts in sentence case', async () => {
    const screen = await openNotes()
    for (const card of screen.querySelectorAll<HTMLElement>('[data-note]')) {
      const body = card.firstElementChild as HTMLElement
      const meta = card.querySelector('[data-note-meta]') as HTMLElement
      expect(
        body.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      for (const fact of ['category', 'author', 'when', 'shift'])
        expect(meta.querySelector(`[data-meta="${fact}"]`)?.textContent).not.toBe('')
      const mood =
        meta.querySelector('[data-meta="mood"]') ??
        meta.querySelector('[data-state="unrecorded"]')
      expect(mood).not.toBeNull()
      const category = meta.querySelector('[data-meta="category"]')?.textContent ?? ''
      expect(category.slice(1)).toBe(category.slice(1).toLowerCase())
    }
  })

  it('shows a correction and the note it corrects, each saying which it is', async () => {
    const original = await write('Ate all of lunch.')
    const correction = await submitCorrectionNote({
      corrects: original.id,
      residentId: OKAFOR,
      category: 'general',
      body: 'Ate half of lunch, not all of it.',
      mood: { kind: 'not_recorded' },
      shift: { kind: 'auto', value: 'late' },
      author: staffEze,
      at: now().toISOString() as IsoDateTime,
      flag: { kind: 'not_flagged' },
    })
    const screen = await openNotes()
    const shown = (id: string) =>
      screen.querySelector(`[data-note="${id}"]`) as HTMLElement
    expect(within(shown(original.id)).getByText('Ate all of lunch.')).toBeTruthy()
    expect(shown(original.id).querySelector('[data-superseded]')).not.toBeNull()
    expect(shown(correction.id).querySelector('[data-corrects]')).not.toBeNull()
  })

  it('says correcting is not built on the reader’s own notes, and nothing on anybody else’s', async () => {
    await write('Settled after tea.')
    const screen = await openNotes()
    const authors = new Map(
      (await getCareNotes(OKAFOR)).map((note) => [note.id, note.recordedBy.id]),
    )
    // Both kinds are on this record, so neither half passes empty.
    expect([...authors.values()]).toContain(staffEze.id)
    expect([...authors.values()].some((author) => author !== staffEze.id)).toBe(true)
    for (const note of screen.querySelectorAll<HTMLElement>('[data-note]')) {
      const line = note.querySelector('[data-act-line="not_built"]')
      if (authors.get(note.getAttribute('data-note') as CareNote['id']) === staffEze.id)
        expect(line?.textContent).toContain(
          'Correcting a care note — not built yet on the phone.',
        )
      else expect(line).toBeNull()
    }
  })
})
