import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CareNote, IsoDateTime } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { notesFor } from '@/data/access/note-store'
import { endSession } from '@/data/access/session-losses'
import { ToastViewport } from '@/components/primitives'
import { renderProfileTab, renderSignedIn } from '@/test/render-signed-in'
import { SignOutRoute } from '@/features/auth/SignOutRoute'
import { shiftAt, SHIFT_NAMES } from '@/lib/shift'
import { NoteComposerRoute } from './NoteComposerRoute'
import { SavedNoteToast } from './SavedNoteToast'
import { draftHoldings, keptDraft, resetNoteDrafts } from './draft-store'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/notes/new',
  params: { residentId: 'res-okafor' },
}))
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => router,
}))

beforeEach(() => {
  endSession()
  resetNoteDrafts()
  router.push.mockReset()
  router.replace.mockReset()
})

const composer = () => (
  <>
    <NoteComposerRoute />
    <SavedNoteToast />
    <ToastViewport />
  </>
)

const openAs = async (id = staffEze.id) => {
  const rendered = renderProfileTab(id, composer(), 'site-rosewood-court')
  const form = (await screen.findByRole('form', {
    name: 'Care note for Emmanuel',
  })) as HTMLFormElement
  return { ...rendered, form }
}

const textArea = (form: HTMLElement) =>
  within(form).getByPlaceholderText(
    'What you found, what you saw, what the resident said.',
  ) as HTMLTextAreaElement

const submitButton = (form: HTMLElement) =>
  within(form).getByRole('button', { name: 'Save note for Emmanuel Okafor' })

type User = ReturnType<typeof userEvent.setup>

/*
 * Opened from the keyboard. Once any Radix Select has opened in a file,
 * user-event's pointer no longer opens the next one in jsdom, though keyboard
 * and a dispatched pointerdown both do; the component is fine, the pointer
 * simulation is not.
 */
const openSelect = async (user: User, trigger: HTMLElement) => {
  trigger.focus()
  await user.keyboard('{Enter}')
}

const chooseCategory = async (user: User, form: HTMLElement, name: string) => {
  await openSelect(user, within(form).getByRole('combobox', { name: /category/i }))
  await user.click(await screen.findByRole('option', { name }))
}

const written = (): CareNote[] =>
  notesFor('res-okafor').filter((note) => note.id.startsWith('note-session'))

const writtenByBody = (body: string): CareNote => {
  const found = notesFor('res-okafor').find((note) => note.body === body)
  if (found === undefined) throw new Error(`No note reading "${body}"`)
  return found
}

describe('the composer', () => {
  it('names the subject in a strip above the form, and on the save button', async () => {
    const { form } = await openAs()
    const strip = form.querySelector('[data-subject-strip="res-okafor"]') as HTMLElement
    expect(strip).not.toBeNull()
    expect(within(strip).getByText('Emmanuel')).toBeTruthy()
    expect(within(strip).getByText('Emmanuel Okafor')).toBeTruthy()
    expect(within(strip).getByText(/^Born \d\d\/\d\d\/\d{4}/)).toBeTruthy()
    expect(submitButton(form)).toBeDisabled()
  })

  it('keeps the text closed until a category is chosen', async () => {
    const user = userEvent.setup()
    const { form } = await openAs()
    expect(textArea(form)).toBeDisabled()
    expect(within(form).getByText('Choose a category first.')).toBeTruthy()
    expect(form.querySelector('[data-phrases]')).toBeNull()

    await chooseCategory(user, form, 'Nutrition and Hydration')
    expect(textArea(form)).toBeEnabled()
    expect(
      within(form).getByText(
        'Written for whoever reads this next: a manager tonight, an inspector in a year.',
      ),
    ).toBeTruthy()
    expect(form.querySelector('[data-phrases="nutrition"]')).not.toBeNull()
  })

  it('puts a suggested opener where the cursor is, and keeps focus in the text', async () => {
    const user = userEvent.setup()
    const { form } = await openAs()
    await chooseCategory(user, form, 'Personal Care')
    const text = textArea(form)
    await user.type(text, 'the morning wash.')
    text.setSelectionRange(0, 0)

    await user.click(within(form).getByRole('button', { name: 'Declined…' }))

    expect(text.value).toBe('Declined the morning wash.')
    expect(document.activeElement).toBe(text)
    expect(text.selectionStart).toBe('Declined '.length)
  })

  it('offers no voice-to-text, because it is not offered at all', async () => {
    const { form } = await openAs()
    expect(within(form).queryByRole('button', { name: 'Voice to text' })).toBeNull()
    expect(form.textContent).not.toContain('Voice-to-text')
  })

  it('chooses no mood, and will not save until one is chosen', async () => {
    const user = userEvent.setup()
    const { form } = await openAs()
    const moods = within(form).getAllByRole('radio')
    expect(moods.map((radio) => radio.getAttribute('aria-checked'))).toEqual(
      Array(6).fill('false'),
    )
    expect(within(form).getByRole('radio', { name: 'Not recorded' })).toBeTruthy()

    await chooseCategory(user, form, 'General')
    await user.type(textArea(form), 'Slept through.')
    expect(submitButton(form)).toBeDisabled()
    expect(
      within(form).getByText('Still needed: a mood, or Not recorded.'),
    ).toBeTruthy()

    await user.click(within(form).getByRole('radio', { name: 'Not recorded' }))
    expect(submitButton(form)).toBeEnabled()
  })

  it('takes the shift from the home’s clock, and will not change it without a reason', async () => {
    const user = userEvent.setup()
    const { form } = await openAs()
    const clock = shiftAt(now().toISOString() as IsoDateTime, 'Europe/London')
    expect(
      within(form).getByText(`${SHIFT_NAMES[clock]} shift`, { exact: false }),
    ).toBeTruthy()
    expect(
      within(form).getByText(
        'The shift comes from the home’s clock, because there is no clock-in to read it from.',
      ),
    ).toBeTruthy()

    await chooseCategory(user, form, 'General')
    await user.type(textArea(form), 'Written up late.')
    await user.click(within(form).getByRole('radio', { name: 'Settled' }))
    expect(submitButton(form)).toBeEnabled()

    await user.click(within(form).getByRole('button', { name: 'Change shift' }))
    await openSelect(
      user,
      within(form).getByRole('combobox', { name: /shift this note/i }),
    )
    const [other] = await screen.findAllByRole('option')
    await user.click(other!)
    expect(submitButton(form)).toBeDisabled()
    expect(within(form).getByText('Still needed: why the shift changed.')).toBeTruthy()

    await user.type(
      within(form).getByLabelText(/^Why is this not the/),
      'Handover overran.',
    )
    expect(submitButton(form)).toBeEnabled()
    await user.click(submitButton(form))

    await waitFor(() => expect(router.push).toHaveBeenCalled())
    const note = writtenByBody('Written up late.')
    expect(note.shift).toMatchObject({
      kind: 'overridden',
      clockSaid: clock,
      reason: 'Handover overran.',
    })
    expect(note.shift.value).not.toBe(clock)
  })

  it('claims no notification beside the flag, and does not deny one either', async () => {
    const { form } = await openAs()
    expect(form.querySelector('[data-act-line]')).toBeNull()
    expect(form.textContent).not.toMatch(/notified|is sent/i)
  })

  it('sends a flag with an empty reason as not given, and a typed one as given', async () => {
    const user = userEvent.setup()
    const { form, unmount } = await openAs()
    await chooseCategory(user, form, 'Behaviour')
    await user.type(textArea(form), 'Called out at night.')
    await user.click(within(form).getByRole('radio', { name: 'Low' }))
    await user.click(
      within(form).getByRole('checkbox', { name: 'Flag for a senior to review' }),
    )
    expect(
      within(form).getByLabelText('Why are you flagging this? (optional)'),
    ).toBeTruthy()
    await user.click(submitButton(form))
    await waitFor(() => expect(router.push).toHaveBeenCalled())
    expect(writtenByBody('Called out at night.').review).toMatchObject({
      kind: 'flagged_not_reviewed',
      reason: { kind: 'not_given' },
    })
    unmount()

    const again = await openAs()
    await chooseCategory(user, again.form, 'Behaviour')
    await user.type(textArea(again.form), 'Called out again.')
    await user.click(within(again.form).getByRole('radio', { name: 'Low' }))
    await user.click(
      within(again.form).getByRole('checkbox', { name: 'Flag for a senior to review' }),
    )
    await user.type(
      within(again.form).getByLabelText('Why are you flagging this? (optional)'),
      'Second night running.',
    )
    await user.click(submitButton(again.form))
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2))
    expect(writtenByBody('Called out again.').review).toMatchObject({
      kind: 'flagged_not_reviewed',
      reason: { kind: 'given', text: 'Second night running.' },
    })
  })

  it('writes the note as the person signed in, confirms it, and goes to the Care Notes tab', async () => {
    const user = userEvent.setup()
    const { form } = await openAs()
    await chooseCategory(user, form, 'Nutrition and Hydration')
    await user.type(textArea(form), 'Ate half the soup.')
    await user.click(within(form).getByRole('radio', { name: 'Good' }))
    await user.click(submitButton(form))

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/residents/res-okafor/notes'),
    )
    const note = writtenByBody('Ate half the soup.')
    expect(note.recordedBy.id).toBe(staffEze.id)
    expect(note.category).toBe('nutrition')
    expect(note.mood).toMatchObject({
      kind: 'recorded',
      score: 4,
      recordedBy: { id: staffEze.id },
    })
    expect(note.review).toEqual({ kind: 'not_flagged' })
    expect(await screen.findByText('Note saved for Emmanuel Okafor.')).toBeTruthy()
    expect(screen.queryByText(/has been notified|was notified|sent to/i)).toBeNull()
    expect(keptDraft(staffEze.id, 'res-okafor')).toBe('none')
  })

  it('says a note cannot be changed before the save button, not after it', async () => {
    const { form } = await openAs()
    const line = within(form).getByText(
      'A note cannot be changed once saved. A mistake is fixed with a correction, which keeps both.',
    )
    expect(
      line.compareDocumentPosition(submitButton(form)) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('drafts', () => {
  const startNote = async (user: User) => {
    const opened = await openAs()
    await chooseCategory(user, opened.form, 'Mobility')
    await user.type(textArea(opened.form), 'Walked to the garden')
    return opened
  }

  it('keeps what was typed, and says so on the way back', async () => {
    const user = userEvent.setup()
    const { unmount } = await startNote(user)
    unmount()

    const { form } = await openAs()
    expect(textArea(form).value).toBe('Walked to the garden')
    expect(textArea(form)).toBeEnabled()
    expect(
      within(form).getByText(
        /^Draft from \d\d:\d\d( [A-Z+0-9:]+)? kept for this session\.$/,
      ),
    ).toBeTruthy()
    expect(written()).toHaveLength(0)
  })

  it('throws the draft away on discard', async () => {
    const user = userEvent.setup()
    const { unmount } = await startNote(user)
    unmount()

    const { form } = await openAs()
    await user.click(within(form).getByRole('button', { name: 'Discard draft' }))
    expect(textArea(form).value).toBe('')
    expect(textArea(form)).toBeDisabled()
    expect(form.querySelector('[data-draft-restored]')).toBeNull()
    expect(keptDraft(staffEze.id, 'res-okafor')).toBe('none')
  })

  it('keeps one person’s draft from another', async () => {
    const user = userEvent.setup()
    const { unmount } = await startNote(user)
    unmount()

    const { form } = await openAs(staffAkinyemi.id)
    expect(textArea(form).value).toBe('')
    expect(form.querySelector('[data-draft-restored]')).toBeNull()
  })

  it('lists the draft among what signing out loses, and destroys it', async () => {
    const user = userEvent.setup()
    const { unmount } = await startNote(user)
    unmount()
    expect(draftHoldings()).toEqual([
      { what: 'care note drafts you had not saved', count: 1 },
    ])

    const signOut = renderSignedIn(staffEze.id, <SignOutRoute />)
    const losses = await screen.findByText('Care note drafts you had not saved')
    expect(losses).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Sign out and discard/ }))
    expect(keptDraft(staffEze.id, 'res-okafor')).toBe('none')
    expect(draftHoldings()).toEqual([])
    act(() => signOut.unmount())

    const { form } = await openAs()
    expect(textArea(form).value).toBe('')
    expect(form.querySelector('[data-draft-restored]')).toBeNull()
  })
})
