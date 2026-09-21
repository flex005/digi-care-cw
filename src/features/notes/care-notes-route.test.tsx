import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { GAP_NOTE_IDS } from '@/data/fixtures/care-notes'
import { residentsBySite } from '@/data/fixtures/residents'
import { notesForResidents, resetSessionNotes } from '@/data/access/note-store'
import { submitCareNote } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { renderSignedIn } from '@/test/render-signed-in'
import { formatCount } from '@/lib/format'
import { waitingSince } from './note-parts'
import { CareNotesRoute } from './CareNotesRoute'

const navigation = vi.hoisted(() => ({ pathname: '/care-notes', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => resetSessionNotes())

const EZE_LIST = [
  'res-okafor',
  'res-adeyemi',
  'res-hutchinson',
  'res-pemberton',
] as ResidentId[]
const ROSEWOOD = residentsBySite('site-rosewood-court').map((resident) => resident.id)

const flaggedAbout = (ids: ResidentId[]) =>
  notesForResidents(ids)
    .flatMap((note) =>
      note.review.kind === 'flagged_not_reviewed' ? [note.review.flaggedAt] : [],
    )
    .sort()

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-note]')]
const flaggedRow = (id: string) =>
  document.querySelector<HTMLElement>(`[data-note="${id}"]`)

/** A note Eze writes about Grace Adeyemi and flags, giving no reason. */
const flagANote = () =>
  submitCareNote({
    residentId: 'res-adeyemi' as ResidentId,
    category: 'behaviour',
    body: 'Unsettled after lunch and asked more than once when her daughter was coming.',
    mood: { kind: 'not_recorded' },
    shift: { kind: 'auto', value: 'late' },
    author: staffEze,
    at: now().toISOString() as IsoDateTime,
    flag: { kind: 'flagged', reason: { kind: 'not_given' } },
  })

const openView = async (label: string) => {
  await userEvent.click(screen.getByRole('button', { name: label }))
}

describe('care notes, scoped to the viewer’s list', () => {
  it('shows a care worker notes about their four residents only', async () => {
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    await openView('All notes')
    const expected = notesForResidents(EZE_LIST).length
    expect(document.querySelector('[data-everything-claim]')?.textContent).toMatch(
      new RegExp(
        `^${expected.toLocaleString('en-GB')} notes on the record, across your 4 residents\\.`,
      ),
    )
    const names = rows().map(
      (row) => within(row).getAllByRole('link')[0]?.getAttribute('href') ?? '',
    )
    expect(names.length).toBeGreaterThan(0)
    for (const href of names)
      expect(EZE_LIST.some((id) => href === `/residents/${id}/notes`)).toBe(true)
    expect(screen.getByText("Counted over your list, not the home's.")).toBeTruthy()
  })

  it('counts the record over a care worker’s list, not the home', async () => {
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    const tile = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(
        '[data-metric-tile="On the record here"]',
      )
      if (found === null) throw new Error('not loaded')
      return found
    })
    const onList = notesForResidents(EZE_LIST)
    const authors = new Set(onList.map((note) => note.recordedBy.id)).size
    expect(within(tile).getByText(formatCount(onList.length))).toBeTruthy()
    expect(within(tile).getByText(`written by ${authors} people`)).toBeTruthy()
  })

  it('states that nobody has given a care worker a list, rather than an empty queue', async () => {
    renderSignedIn(staffOsei.id, <CareNotesRoute />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(document.querySelector('[data-metric-tile]')).toBeNull()
    expect(document.querySelector('[data-action-card]')).toBeNull()
    expect(document.querySelector('[data-state="unrecorded"]')).not.toBeNull()
    expect(rows()).toHaveLength(0)
  })
})

describe('the dark card', () => {
  it('counts flagged notes over a care worker’s list, with the longest wait', async () => {
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    const card = await screen.findByText('Flagged, not reviewed', { selector: 'p' })
    const section = card.closest('[data-action-card]') as HTMLElement
    const flagged = flaggedAbout(EZE_LIST)
    expect(flagged.length).toBeGreaterThan(0)
    expect(within(section).getByText(String(flagged.length))).toBeTruthy()
    expect(
      within(section).getByText(
        `${flagged.length === 1 ? 'flagged note' : 'flagged notes'}, across your 4 residents`,
      ),
    ).toBeTruthy()
    expect(within(section).getByText('Oldest waiting')).toBeTruthy()
    expect(
      within(section).getByText(waitingSince(flagged[0] as IsoDateTime)),
    ).toBeTruthy()
  })

  it('counts over the home for a senior carer', async () => {
    renderSignedIn(staffAkinyemi.id, <CareNotesRoute />, 'site-rosewood-court')
    const card = await screen.findByText('Flagged, not reviewed', { selector: 'p' })
    const section = card.closest('[data-action-card]') as HTMLElement
    const flagged = flaggedAbout(ROSEWOOD)
    expect(within(section).getByText(String(flagged.length))).toBeTruthy()
    expect(
      within(section).getByText(
        `flagged notes, across ${ROSEWOOD.length} residents at Rosewood Court`,
      ),
    ).toBeTruthy()
  })
})

describe('the views', () => {
  it('has no By author view and no colleague picker', async () => {
    renderSignedIn(staffAkinyemi.id, <CareNotesRoute />, 'site-rosewood-court')
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    expect(screen.queryByRole('button', { name: /author/i })).toBeNull()
    expect(screen.queryByText(/All staff/)).toBeNull()
    await openView('Your notes')
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(document.querySelector('[data-author-tab]')).toBeNull()
  })

  it('shows only the viewer’s own notes under Your notes', async () => {
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    await openView('Your notes')
    const mine = notesForResidents(EZE_LIST).filter(
      (note) => note.recordedBy.id === staffEze.id,
    )
    expect(mine.length).toBeGreaterThan(0)
    expect(document.querySelector('[data-yours-claim]')?.textContent).toMatch(
      new RegExp(`^${mine.length} notes? you wrote, across your 4 residents`),
    )
    const shown = rows()
    expect(shown.length).toBe(Math.min(mine.length, 25))
    for (const row of shown)
      expect(row.querySelector('[data-note-meta]')?.textContent).toContain('N. Eze')
  })

  it('lists the flagged notes with the reason in the flagger’s words, or says none was given', async () => {
    const written = await flagANote()
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })

    const pinned = flaggedRow(GAP_NOTE_IDS.flaggedNotReviewed) as HTMLElement
    expect(
      within(pinned).getByText(/Refused all support with personal care/),
    ).toBeTruthy()
    expect(
      within(pinned).getByText(
        /Third refusal this week\. Does the approach in the care plan still fit\?/,
      ),
    ).toBeTruthy()
    expect(within(pinned).getByText('Flagged, not reviewed')).toBeTruthy()
    expect(within(pinned).getByText(/^waiting /)).toBeTruthy()
    expect(within(pinned).getByText('C. Nwosu')).toBeTruthy()

    const unexplained = flaggedRow(written.id) as HTMLElement
    expect(
      unexplained.querySelector('[data-flag-reason="not_given"]')?.textContent,
    ).toContain('No reason given')
  })
})

describe('marking a flagged note reviewed', () => {
  it('gives a care worker the queue to read and no control on any row', async () => {
    // A second flagged note, so the queue has rows for a control to appear on.
    await flagANote()
    renderSignedIn(staffEze.id, <CareNotesRoute />)
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    expect(rows().length).toBeGreaterThan(1)
    expect(screen.queryByRole('button', { name: 'Mark reviewed' })).toBeNull()
    // Read-only, and nothing said about whose job the review is.
    expect(document.querySelector('[data-act-line]')).toBeNull()
    expect(
      screen.queryByText('Marking a flagged note reviewed is for a senior carer.'),
    ).toBeNull()
  })

  it('gives a senior carer the control on every row, and no refusal', async () => {
    renderSignedIn(staffAkinyemi.id, <CareNotesRoute />, 'site-rosewood-court')
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    expect(screen.getAllByRole('button', { name: 'Mark reviewed' })).toHaveLength(
      rows().length,
    )
    expect(document.querySelector('[data-act-line="refused"]')).toBeNull()
  })

  it('takes the note off the Flagged view, and puts it back on undo', async () => {
    renderSignedIn(staffAkinyemi.id, <CareNotesRoute />, 'site-rosewood-court')
    await screen.findByText('Flagged, not reviewed', { selector: 'h2' })
    const before = rows().length
    const row = flaggedRow(GAP_NOTE_IDS.flaggedNotReviewed) as HTMLElement

    await userEvent.click(within(row).getByRole('button', { name: 'Mark reviewed' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Mark Emmanuel Okafor’s note reviewed?',
    })
    await userEvent.click(
      within(dialog).getByRole('radio', { name: 'Care plan updated' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark reviewed' }))

    expect(
      await screen.findByText(
        /You marked Emmanuel Okafor’s note reviewed: Care plan updated\./,
      ),
    ).toBeTruthy()
    expect(flaggedRow(GAP_NOTE_IDS.flaggedNotReviewed)).toBeNull()
    expect(rows()).toHaveLength(before - 1)

    await userEvent.click(screen.getByRole('button', { name: 'Undo review' }))
    expect(
      await screen.findByText('Mark reviewed', {
        selector: `[data-note="${GAP_NOTE_IDS.flaggedNotReviewed}"] button`,
      }),
    ).toBeTruthy()
    expect(rows()).toHaveLength(before)
    expect(document.querySelector('[data-just-reviewed]')).toBeNull()
  })
})
