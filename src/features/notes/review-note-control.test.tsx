import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CareNoteId, ResidentId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { residentById } from '@/data/fixtures/residents'
import { noteById, resetSessionNotes } from '@/data/access/note-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { ReviewNoteControl, type ReviewChange } from './ReviewNoteControl'

vi.mock('next/navigation', () => ({
  usePathname: () => '/care-notes',
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => resetSessionNotes())

const okafor = residentById('res-okafor' as ResidentId)
if (okafor === undefined) throw new Error('no Okafor fixture')

/** The control over the pinned flagged note, re-read from the store on every change. */
function Harness({ onChanged }: { onChanged: (change: ReviewChange) => void }) {
  const [, setChanges] = useState(0)
  const note = noteById(GAP_NOTE_IDS.flaggedNotReviewed as CareNoteId)
  if (note === undefined || okafor === undefined) throw new Error('no pinned note')
  return (
    <ReviewNoteControl
      note={note}
      resident={okafor}
      onChanged={(change) => {
        onChanged(change)
        setChanges((count) => count + 1)
      }}
    />
  )
}

const openDialog = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Mark reviewed' }))
  return screen.findByRole('dialog', { name: 'Mark Emmanuel Okafor’s note reviewed?' })
}

const confirmIn = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Mark reviewed' })

describe('the review control', () => {
  it('is not drawn for a care worker', async () => {
    renderSignedIn(
      staffEze.id,
      <>
        <p>Signed in</p>
        <Harness onChanged={vi.fn()} />
      </>,
    )
    await screen.findByText('Signed in')
    expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull()
  })

  it('names the resident, and chooses no outcome for the reviewer', async () => {
    renderSignedIn(
      staffAkinyemi.id,
      <Harness onChanged={vi.fn()} />,
      'site-rosewood-court',
    )
    const dialog = await openDialog()
    expect(within(dialog).getByText(/Room/)).toBeTruthy()
    for (const radio of within(dialog).getAllByRole('radio'))
      expect(radio.getAttribute('aria-checked')).toBe('false')
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.nextSibling?.textContent),
    ).toEqual([
      'No further action needed',
      'Care plan updated',
      'Incident raised',
      'Other',
    ])
    expect(confirmIn(dialog)).toBeDisabled()
  })

  it('refuses Other until it says what was done, and records it in those words', async () => {
    const onChanged = vi.fn()
    renderSignedIn(
      staffAkinyemi.id,
      <Harness onChanged={onChanged} />,
      'site-rosewood-court',
    )
    const dialog = await openDialog()

    await userEvent.click(within(dialog).getByRole('radio', { name: 'Other' }))
    expect(confirmIn(dialog)).toBeDisabled()
    const field = within(dialog).getByLabelText('What was done?')
    await userEvent.type(field, '   ')
    expect(confirmIn(dialog)).toBeDisabled()
    await userEvent.type(field, 'Asked the GP to review the approach')
    expect(confirmIn(dialog)).toBeEnabled()

    await userEvent.click(confirmIn(dialog))
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'recorded',
          noteId: GAP_NOTE_IDS.flaggedNotReviewed,
        }),
      ),
    )
    const review = noteById(GAP_NOTE_IDS.flaggedNotReviewed as CareNoteId)?.review
    expect(review).toMatchObject({
      kind: 'reviewed',
      reviewedBy: { id: staffAkinyemi.id },
      outcome: { kind: 'other', text: 'Asked the GP to review the approach' },
      reason: {
        kind: 'given',
        text: 'Third refusal this week. Does the approach in the care plan still fit?',
      },
    })
  })

  it('claims no notification, whatever the outcome chosen', async () => {
    renderSignedIn(
      staffAkinyemi.id,
      <Harness onChanged={vi.fn()} />,
      'site-rosewood-court',
    )
    const dialog = await openDialog()
    expect(dialog.querySelectorAll('[data-act-line]')).toHaveLength(0)
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Incident raised' }),
    )
    expect(dialog.querySelectorAll('[data-act-line]')).toHaveLength(0)
    expect(screen.queryByText(/has been notified|was sent|we have told/i)).toBeNull()
  })

  it('takes back a review recorded in this session', async () => {
    const onChanged = vi.fn()
    renderSignedIn(
      staffAkinyemi.id,
      <Harness onChanged={onChanged} />,
      'site-rosewood-court',
    )
    const dialog = await openDialog()
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'No further action needed' }),
    )
    await userEvent.click(confirmIn(dialog))

    const undo = await screen.findByRole('button', { name: 'Undo review' })
    expect(
      screen.getByText(
        /You recorded this review in this session, so you can take it back/,
      ),
    ).toBeTruthy()
    await userEvent.click(undo)
    expect(await screen.findByRole('button', { name: 'Mark reviewed' })).toBeTruthy()
    expect(noteById(GAP_NOTE_IDS.flaggedNotReviewed as CareNoteId)?.review.kind).toBe(
      'flagged_not_reviewed',
    )
    expect(onChanged).toHaveBeenLastCalledWith({
      kind: 'undone',
      noteId: GAP_NOTE_IDS.flaggedNotReviewed,
    })
  })
})
