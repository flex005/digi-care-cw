import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareNote, IsoDateTime } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { residentById } from '@/data/fixtures/residents'
import { GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { now } from '@/data/fixtures/clock'
import { submitCareNote } from '@/data/access/client'
import { noteById } from '@/data/access/note-store'
import { endSession } from '@/data/access/session-losses'
import { renderProfileTab } from '@/test/render-signed-in'
import { CorrectNoteAct } from '../CorrectNoteAct'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/notes/note',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

beforeEach(() => {
  endSession()
})

const okafor = () => {
  const found = residentById('res-okafor')
  if (found === undefined) throw new Error('no Okafor')
  return found
}

const note = (id: CareNote['id']) => {
  const found = noteById(id)
  if (found === undefined) throw new Error(`no note ${id}`)
  return found
}

describe('correcting a care note', () => {
  it('gives the author the composer’s form, and writes a correction linked to the note', async () => {
    const user = userEvent.setup()
    const original = await submitCareNote({
      residentId: 'res-okafor',
      category: 'nutrition',
      body: 'Ate all of the lunch.',
      mood: { kind: 'not_recorded' },
      shift: { kind: 'auto', value: 'late' },
      author: staffEze,
      at: now().toISOString() as IsoDateTime,
      flag: { kind: 'not_flagged' },
    })
    const onWritten = vi.fn()
    renderProfileTab(
      staffEze.id,
      <CorrectNoteAct note={original} resident={okafor()} onWritten={onWritten} />,
    )

    await user.click(await screen.findByRole('button', { name: 'Add a correction' }))
    const form = screen.getByRole('form', { name: 'Correction for Emmanuel' })
    expect(form.querySelector('[data-subject-strip="res-okafor"]')).not.toBeNull()
    expect(
      within(form).getByRole('combobox', { name: /category/i }).textContent,
    ).toContain('Nutrition and Hydration')
    const text = within(form).getByPlaceholderText(
      'What you found, what you saw, what the resident said.',
    )
    expect(text).toHaveValue('')
    await user.type(text, 'Ate half of the lunch; the rest went back.')
    await user.click(within(form).getByRole('radio', { name: 'Not recorded' }))
    await user.click(
      within(form).getByRole('button', { name: 'Save correction for Emmanuel Okafor' }),
    )

    await waitFor(() => expect(onWritten).toHaveBeenCalledTimes(1))
    const correction = onWritten.mock.calls[0]![0] as CareNote
    expect(correction.corrects).toBe(original.id)
    expect(correction.recordedBy.id).toBe(staffEze.id)
    expect(correction.residentId).toBe('res-okafor')
    expect(note(original.id).supersededBy).toBe(correction.id)
    expect(note(original.id).body).toBe('Ate all of the lunch.')
  })

  /*
   * **Somebody else's note offers the act that is theirs, and says nothing
   * about whose note it is.** It used to draw a disabled "Add a correction"
   * with the role table's reason and a line naming the author — but the author
   * is already on the note a line above, so the refusal told a reader about
   * somebody else's job rather than about their own.
   */
  it('offers somebody else a note of their own, and no correction', async () => {
    const user = userEvent.setup()
    const flagged = note(GAP_NOTE_IDS.flaggedNotReviewed)
    renderProfileTab(
      staffAkinyemi.id,
      <CorrectNoteAct note={flagged} resident={okafor()} onWritten={vi.fn()} />,
      'site-rosewood-court',
    )

    const own = await screen.findByRole('button', {
      name: 'Write your own note about Emmanuel',
    })
    expect(screen.queryByRole('button', { name: 'Add a correction' })).toBeNull()
    expect(screen.queryByText(/who wrote it, can correct it/)).toBeNull()
    expect(screen.queryByText(/speak to C. Nwosu/)).toBeNull()
    expect(document.querySelector('[data-act-line]')).toBeNull()
    // A button, not a link away: it opens over the note.
    expect(screen.queryByRole('link', { name: /Write your own note/ })).toBeNull()

    await user.click(own)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/Write a care note for Emmanuel Okafor/)
  })

  it('offers no correction on a note already corrected, and links to the correction', async () => {
    const original = note(GAP_NOTE_IDS.supersededOriginal)
    renderProfileTab(
      staffAkinyemi.id,
      <CorrectNoteAct note={original} resident={okafor()} onWritten={vi.fn()} />,
      'site-rosewood-court',
    )
    expect(
      await screen.findByRole('link', { name: 'Read the correction' }),
    ).toHaveAttribute(
      'href',
      `/residents/res-okafor/notes/${GAP_NOTE_IDS.correctionNote}`,
    )
    expect(screen.queryByRole('button', { name: 'Add a correction' })).toBeNull()
  })
})
