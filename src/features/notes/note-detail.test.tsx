import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IsoDateTime } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { now } from '@/data/fixtures/clock'
import { resetSessionNotes } from '@/data/access/note-store'
import { recordNoteReview } from '@/data/access/client'
import { renderProfileTab } from '@/test/render-signed-in'
import { NoteDetailRoute } from './NoteDetailRoute'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/notes/note',
  params: { residentId: 'res-okafor', noteId: 'note' },
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

const open = (residentId: string, noteId: string) => {
  navigation.params = { residentId, noteId }
  navigation.pathname = `/residents/${residentId}/notes/${noteId}`
}

const detail = () =>
  waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-note-detail]')
    if (found === null) throw new Error('not loaded')
    return found
  })

describe('one care note', () => {
  it('says why it cannot be edited', async () => {
    open('res-okafor', GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    await detail()
    expect(
      screen.getByText(
        'A care note is never changed once saved. A correction is kept with it.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Edit|Delete/ })).toBeNull()
  })

  it('states the flag, its reason and the wait, and offers a care worker no review', async () => {
    open('res-okafor', GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    await detail()
    const supervision = document.querySelector(
      '[data-supervision="waiting"]',
    ) as HTMLElement
    expect(within(supervision).getByText(/^C\. Nwosu,/)).toBeTruthy()
    expect(
      within(supervision).getByText(
        /Third refusal this week\. Does the approach in the care plan still fit\?/,
      ),
    ).toBeTruthy()
    expect(within(supervision).getByText('Not reviewed')).toBeTruthy()
    expect(within(supervision).getByText(/^waiting .+ so far$/)).toBeTruthy()
    expect(
      screen.queryByText('Marking a flagged note reviewed is for a senior carer.'),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull()
  })

  it('gives a senior carer the review, and then shows its outcome', async () => {
    open('res-okafor', GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(staffAkinyemi.id, <NoteDetailRoute />, 'site-rosewood-court')
    await detail()
    await userEvent.click(screen.getByRole('button', { name: 'Mark reviewed' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Care plan updated' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark reviewed' }))

    const reviewed = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-supervision="reviewed"]')
      if (found === null) throw new Error('not reviewed yet')
      return found
    })
    expect(within(reviewed).getByText(/^T\. Akinyemi,/)).toBeTruthy()
    expect(
      reviewed.querySelector('[data-review-outcome="care_plan_updated"]')?.textContent,
    ).toBe('Care plan updated')
    expect(within(reviewed).getByText(/^C\. Nwosu,/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo review' })).toBeTruthy()
  })

  it('shows an outcome in the reviewer’s own words', async () => {
    await recordNoteReview({
      noteId: GAP_NOTE_IDS.flaggedNotReviewed,
      by: staffAkinyemi,
      at: now().toISOString() as IsoDateTime,
      outcome: { kind: 'other', text: 'Talked it through with the family' },
    })
    open('res-okafor', GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    await detail()
    expect(document.querySelector('[data-review-outcome="other"]')?.textContent).toBe(
      'Other: Talked it through with the family',
    )
    expect(screen.queryByRole('button', { name: 'Undo review' })).toBeNull()
  })

  it('links a correction to the note it corrects', async () => {
    open('res-okafor', GAP_NOTE_IDS.correctionNote)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    await detail()
    const link = document.querySelector('[data-chain="corrects"]') as HTMLElement
    expect(within(link).getByText('This note corrects')).toBeTruthy()
    expect(within(link).getByText(/right forearm/)).toBeTruthy()
    expect(
      within(link).getByRole('link', { name: 'Open that note' }).getAttribute('href'),
    ).toBe(`/residents/res-okafor/notes/${GAP_NOTE_IDS.supersededOriginal}`)
    // The one card here showing part of something else, so the one whose
    // expand button goes somewhere: the note it excerpts.
    expect(
      screen.getByRole('link', { name: 'Open Correction' }).getAttribute('href'),
    ).toBe(`/residents/res-okafor/notes/${GAP_NOTE_IDS.supersededOriginal}`)
    expect(screen.queryByRole('link', { name: 'Open Supervision' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Open .*, not built$/ })).toBeNull()
  })

  it('marks a superseded note, and links it to its correction', async () => {
    open('res-okafor', GAP_NOTE_IDS.supersededOriginal)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    const page = await detail()
    expect(within(page).getByText('Superseded by a correction')).toBeTruthy()
    expect(within(page).getByText(/right forearm/, { selector: 'p' })).toBeTruthy()
    const link = document.querySelector('[data-chain="corrected-by"]') as HTMLElement
    expect(within(link).getByText('This note was corrected by')).toBeTruthy()
    expect(
      within(link).getByRole('link', { name: 'Open that note' }).getAttribute('href'),
    ).toBe(`/residents/res-okafor/notes/${GAP_NOTE_IDS.correctionNote}`)
    expect(screen.queryByRole('button', { name: 'Add a correction' })).toBeNull()
  })

  it('refuses a note that is about another resident', async () => {
    open('res-adeyemi', GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(staffEze.id, <NoteDetailRoute />)
    expect(
      await screen.findByText('This note is not about Grace Adeyemi.'),
    ).toBeTruthy()
    expect(screen.queryByText(/Refused all support with personal care/)).toBeNull()
    expect(screen.queryByText(/Emmanuel/)).toBeNull()
    expect(document.querySelector('[data-note-detail]')).toBeNull()
  })
})
