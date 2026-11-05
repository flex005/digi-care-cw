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
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from '../shell/PhoneApp'

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
  await within(front()).findByText(/care notes?, newest first\.$/)
  return front()
}

const shownIds = (screen: HTMLElement) =>
  [...screen.querySelectorAll<HTMLElement>('[data-note]')].map((note) =>
    note.getAttribute('data-note'),
  )

describe('the phone: a resident’s care notes', () => {
  it('pushes from the record, at an address of its own', async () => {
    await openNotes()
    expect(window.location.pathname).toBe('/m/people/res-okafor/notes')
  })

  it('shows every note, newest first', async () => {
    const screen = await openNotes()
    const expected = (await getCareNotes(OKAFOR))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((note) => note.id)
    expect(expected.length).toBeGreaterThan(1)
    expect(shownIds(screen)).toEqual(expected)
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
