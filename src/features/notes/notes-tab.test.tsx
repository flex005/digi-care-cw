import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareNote, IsoDateTime, ResidentId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { now } from '@/data/fixtures/clock'
import { notesFor, resetSessionNotes } from '@/data/access/note-store'
import { recordNoteReview, submitCareNote } from '@/data/access/client'
import { renderProfileTab } from '@/test/render-signed-in'
import { formatCount } from '@/lib/format'
import { NotesTab } from './NotesTab'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/notes',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => resetSessionNotes())

const okafor = 'res-okafor' as ResidentId

const loaded = () =>
  waitFor(() => {
    if (document.querySelector('[data-tab-claim]') === null)
      throw new Error('not loaded')
  })

const noteElement = (id: string) =>
  document.querySelector<HTMLElement>(`[data-note="${id}"]`)

/** Pages forward until the note is on the page. The tab is newest first. */
async function pageTo(id: string): Promise<HTMLElement> {
  for (let page = 0; page < 200; page += 1) {
    const found = noteElement(id)
    if (found !== null) return found
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
  throw new Error(`${id} never came into view`)
}

const writeFlagged = (overrides: Partial<Parameters<typeof submitCareNote>[0]> = {}) =>
  submitCareNote({
    residentId: okafor,
    category: 'health_observation',
    body: 'Complained of pain in the left hip when standing. Walked with the frame.',
    mood: { kind: 'not_recorded' },
    shift: { kind: 'auto', value: 'late' },
    author: staffEze,
    at: now().toISOString() as IsoDateTime,
    flag: {
      kind: 'flagged',
      reason: { kind: 'given', text: 'New pain since yesterday.' },
    },
    ...overrides,
  })

describe('a resident’s care notes tab', () => {
  it('lists every note on the record, newest first, a page at a time', async () => {
    renderProfileTab(staffEze.id, <NotesTab />)
    const all = notesFor(okafor)
    await screen.findByText('Emmanuel’s care notes')
    const claim = await waitFor(() => {
      const found = document.querySelector('[data-tab-claim]')
      if (found === null) throw new Error('not loaded')
      return found
    })
    expect(claim.textContent).toBe(
      `${formatCount(all.length)} care notes on the record for Emmanuel, newest first`,
    )
    const first = document.querySelector('[data-note]')
    expect(first?.getAttribute('data-note')).toBe((all[0] as CareNote).id)
    expect(document.querySelector('[data-pager-slice]')?.textContent).toBe(
      `Showing 1 to 25 of ${formatCount(all.length)} care notes`,
    )
  })

  /*
   * Writing opens a dialog over the record rather than a second screen: the
   * note is about the resident already open, and leaving the list loses the
   * reader's place in it.
   */
  it.each([
    ['a care worker whose list names the resident', staffEze.id, undefined],
    ['a senior carer', staffAkinyemi.id, 'site-rosewood-court'],
  ] as const)(
    'offers %s the act of writing, in a dialog',
    async (_who, staffId, site) => {
      const user = userEvent.setup()
      renderProfileTab(staffId, <NotesTab />, site)
      const act = await screen.findByRole('button', { name: 'Write a care note' })
      // Not a link: nothing navigates away from the record.
      expect(screen.queryByRole('link', { name: 'Write a care note' })).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()

      await user.click(act)
      const dialog = await screen.findByRole('dialog')
      expect(dialog.textContent).toMatch(/Write a care note for Emmanuel Okafor/)
      // The subject travels with the write surface (CLAUDE.md §2).
      expect(within(dialog).getAllByText(/Emmanuel/).length).toBeGreaterThan(0)
    },
  )

  /*
   * **The list behind the dialog re-reads after a save.** The page this
   * replaced got a fresh read by navigating; a dialog closes over a list that
   * would otherwise still be the record as it stood before the note somebody
   * just wrote — a screen showing a note's absence a moment after it was
   * written is the blank that means two things.
   */
  it('closes on save, and the note is in the list behind it', async () => {
    const user = userEvent.setup()
    renderProfileTab(staffEze.id, <NotesTab />)
    await user.click(await screen.findByRole('button', { name: 'Write a care note' }))

    const dialog = await screen.findByRole('dialog')
    const category = within(dialog).getByRole('combobox', { name: /category/i })
    category.focus()
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('option', { name: 'Personal Care' }))

    const body = 'Walked to the dining room with one person assisting, and ate well.'
    await user.type(
      within(dialog).getByPlaceholderText(
        'What you found, what you saw, what the resident said.',
      ),
      body,
    )
    await user.click(within(dialog).getByRole('radio', { name: 'Not recorded' }))
    await user.click(
      within(dialog).getByRole('button', { name: /^Save note for Emmanuel/ }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(document.querySelector('[data-notes-tab]')?.textContent).toContain(body),
    )
  })

  it('shows the flag with its reason, and a review with who, when and what was done', async () => {
    const waiting = await writeFlagged()
    const reviewed = await writeFlagged({
      body: 'Refused lunch, said the soup was too hot. Offered it again later and finished it.',
      flag: { kind: 'flagged', reason: { kind: 'not_given' } },
    })
    await recordNoteReview({
      noteId: reviewed.id,
      by: staffAkinyemi,
      at: now().toISOString() as IsoDateTime,
      outcome: { kind: 'other', text: 'Asked the kitchen to serve it cooler' },
    })
    renderProfileTab(staffEze.id, <NotesTab />)
    await loaded()

    const flagged = noteElement(waiting.id) as HTMLElement
    expect(within(flagged).getByText('Flagged, not reviewed')).toBeTruthy()
    expect(within(flagged).getByText(/New pain since yesterday\./)).toBeTruthy()

    const done = noteElement(reviewed.id) as HTMLElement
    expect(within(done).getByText('Reviewed')).toBeTruthy()
    expect(within(done).getByText(/^T\. Akinyemi, /)).toBeTruthy()
    expect(done.querySelector('[data-review-outcome="other"]')?.textContent).toContain(
      'Other: Asked the kitchen to serve it cooler',
    )
    expect(done.querySelector('[data-flag-reason="not_given"]')?.textContent).toContain(
      'No reason given',
    )
  })

  it('shows a changed shift with what the clock said and why', async () => {
    const moved = await writeFlagged({
      shift: {
        kind: 'overridden',
        value: 'late',
        clockSaid: 'night',
        reason: 'Handover overran',
      },
      flag: { kind: 'not_flagged' },
    })
    renderProfileTab(staffEze.id, <NotesTab />)
    await loaded()
    const element = noteElement(moved.id) as HTMLElement
    expect(element.querySelector('[data-shift-override]')?.textContent).toMatch(
      /The clock said night, recorded as late: “Handover overran”/,
    )
  })

  it('keeps a superseded note, marked, and links a correction both ways', async () => {
    renderProfileTab(staffEze.id, <NotesTab />)
    await loaded()

    const correction = await pageTo(GAP_NOTE_IDS.correctionNote)
    expect(within(correction).getByText('Correction')).toBeTruthy()
    expect(
      within(correction)
        .getByRole('link', { name: 'Open the note it corrects' })
        .getAttribute('href'),
    ).toBe(`/residents/res-okafor/notes/${GAP_NOTE_IDS.supersededOriginal}`)

    const original = await pageTo(GAP_NOTE_IDS.supersededOriginal)
    expect(original.getAttribute('data-superseded')).toBe('true')
    expect(within(original).getByText('Superseded by a correction')).toBeTruthy()
    expect(
      within(original)
        .getByRole('link', { name: 'Open the correction' })
        .getAttribute('href'),
    ).toBe(`/residents/res-okafor/notes/${GAP_NOTE_IDS.correctionNote}`)
    expect(within(original).getByText(/right forearm/)).toBeTruthy()
  })
})
