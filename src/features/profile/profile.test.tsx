import { vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import {
  resetMedicationPins,
  setMedicationPin,
  medicationPinMatches,
} from '@/app/session/medication-pins'
import { renderSignedIn } from '@/test/render-signed-in'
import { resetNotificationPreferences } from './preference-store'
import { NOTIFICATIONS } from './notification-table'
import { SignOutDialog } from '@/features/auth/SignOutDialog'
import { ProfileRoute } from './ProfileRoute'

const navigation = vi.hoisted(() => ({ pathname: '/profile', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
  resetMedicationPins()
  resetNotificationPreferences()
})

/*
 * The screen and the sign-out dialog together, because that is how the shell
 * mounts them: the profile asks, and the dialog beside it answers. Rendering
 * the screen alone would leave "Sign out" pressing a button nothing hears.
 */
async function openProfile(id = staffEze.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(
    id,
    <>
      <ProfileRoute />
      <SignOutDialog />
    </>,
    ROSEWOOD,
  )
  await screen.findByRole('heading', { level: 1, name: 'Profile and settings' })
  return { user, ...rendered }
}

const field = (name: string) =>
  document.querySelector<HTMLElement>(`[data-field="${name}"]`)!

describe('what the record holds about you', () => {
  it('shows the name, role, derived address and homes', async () => {
    await openProfile()
    expect(within(field('name')).getByText(staffEze.fullName)).toBeTruthy()
    expect(within(field('email')).getByText(/@rosewoodcourt\.example$/)).toBeTruthy()
    expect(within(field('email')).getByText(/No email address is held/)).toBeTruthy()
    expect(within(field('homes')).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('offers neither role a way to change the email or the role', async () => {
    for (const id of [staffEze.id, staffAkinyemi.id]) {
      const { unmount } = await openProfile(id)
      for (const name of ['email', 'role']) {
        // The value is still shown; nothing offers to change it, and nothing
        // says whose job changing it is.
        expect(field(name).querySelector('[data-answer]')).toBeNull()
        expect(within(field(name)).queryByRole('button')).toBeNull()
        expect(field(name).textContent).not.toMatch(/An admin changes/)
      }
      unmount()
    }
  })

  it('offers no photograph control, because there is nowhere to put a file', async () => {
    await openProfile()
    expect(screen.queryByRole('button', { name: 'Add a photograph' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/No file is stored/)
  })
})

describe('changing a password', () => {
  it('asks for the three fields in a dialog, and claims nothing about storage', async () => {
    const { user } = await openProfile()
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Current password')).toBeTruthy()
    expect(within(dialog).getByLabelText('New password')).toBeTruthy()
    expect(within(dialog).getByLabelText('Confirm new password')).toBeTruthy()
    expect(document.querySelector('[data-act-line="not_built"]')).toBeNull()
    expect(document.querySelector('[data-act-line="not_performed"]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/no password is stored/)
  })

  it('stays unavailable until every rule is met, then saves nothing', async () => {
    const { user } = await openProfile()
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    const dialog = await screen.findByRole('dialog')
    const save = within(dialog).getByRole('button', { name: 'Save new password' })
    expect(save).toHaveProperty('disabled', true)

    await user.type(within(dialog).getByLabelText('Current password'), 'whatever')
    await user.type(within(dialog).getByLabelText('New password'), 'Harmattan!27')
    await user.type(
      within(dialog).getByLabelText('Confirm new password'),
      'Harmattan!27',
    )
    expect(save).toHaveProperty('disabled', false)

    await user.click(save)
    // The dialog closes and the card the reader is left on says what happened.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.querySelector('[data-password-done]')?.textContent).toMatch(
      /Nothing was saved/,
    )
  })
})

/** Open the PIN dialog, which is where the fields are. */
async function openPinWith() {
  const { user } = await openProfile()
  await user.click(screen.getByRole('button', { name: 'Change PIN' }))
  return { user, dialog: await screen.findByRole('dialog') }
}
const openPin = async () => (await openPinWith()).dialog

describe('changing the medication PIN', () => {
  it('asks for no current PIN where this session holds none', async () => {
    const dialog = await openPin()
    expect(within(dialog).queryByLabelText('Current medication PIN')).toBeNull()
    expect(within(dialog).getByLabelText('New medication PIN')).toBeTruthy()
  })

  it('changes the PIN a dose is confirmed with, for this session', async () => {
    setMedicationPin(staffEze.id, '2846')
    const { user, dialog } = await openPinWith()

    await user.type(within(dialog).getByLabelText('Current medication PIN'), '2846')
    await user.type(within(dialog).getByLabelText('New medication PIN'), '7391')
    await user.type(within(dialog).getByLabelText('Confirm new medication PIN'), '7391')
    await user.click(within(dialog).getByRole('button', { name: 'Save new PIN' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.querySelector('[data-pin-said]')?.textContent).toMatch(/changed/)
    expect(medicationPinMatches(staffEze.id, '7391')).toBe(true)
    expect(medicationPinMatches(staffEze.id, '2846')).toBe(false)
  })

  it('marks each rule with more than a colour', async () => {
    const { user, dialog } = await openPinWith()
    await user.type(within(dialog).getByLabelText('New medication PIN'), '2846')
    await user.type(within(dialog).getByLabelText('Confirm new medication PIN'), '2846')
    const rules = [...document.querySelectorAll('[data-pin-rules] [data-rule]')]
    expect(rules.length).toBeGreaterThan(0)
    for (const rule of rules) {
      expect(rule.getAttribute('data-met')).toBe('true')
      // A mark as well as the colour, so the state survives greyscale.
      expect(rule.querySelector('svg')).not.toBeNull()
    }
  })

  it('refuses a wrong current PIN and leaves the old one signing doses', async () => {
    setMedicationPin(staffEze.id, '2846')
    const { user, dialog } = await openPinWith()

    await user.type(within(dialog).getByLabelText('Current medication PIN'), '1111')
    await user.type(within(dialog).getByLabelText('New medication PIN'), '7391')
    await user.type(within(dialog).getByLabelText('Confirm new medication PIN'), '7391')
    await user.click(within(dialog).getByRole('button', { name: 'Save new PIN' }))

    expect(document.querySelector('[data-pin-said]')?.textContent).toMatch(
      /not your current PIN/,
    )
    expect(medicationPinMatches(staffEze.id, '2846')).toBe(true)
    expect(medicationPinMatches(staffEze.id, '7391')).toBe(false)
  })
})

describe('notification preferences', () => {
  /*
   * Both renderings, because they are the same twelve facts drawn twice — the
   * table for a desk, the list for a phone — and the failure to catch is one
   * of them quietly falling behind the other.
   */
  it('draws every row appendix D lists, in the table and in the list', async () => {
    await openProfile()
    for (const where of ['[data-notification-table]', '[data-notification-list]']) {
      const rows = document
        .querySelector(where)!
        .querySelectorAll('[data-notification]')
      expect(rows, where).toHaveLength(NOTIFICATIONS.length)
    }
  })

  it('gives a switch only where the table allows one, and words where it does not', async () => {
    await openProfile()
    for (const kind of NOTIFICATIONS) {
      const row = document.querySelector<HTMLElement>(
        `[data-notification="${kind.id}"]`,
      )!
      const fixed = row.querySelector('[data-fixed]')
      if (kind.canTurnOff === 'yes') {
        expect(fixed).toBeNull()
        expect(within(row).getByRole('switch')).toBeTruthy()
      } else {
        expect(within(row).queryByRole('switch')).toBeNull()
        expect(fixed?.textContent).toMatch(/Cannot be turned off/)
        expect(fixed?.getAttribute('data-fixed')).toBe(kind.canTurnOff)
      }
    }
  })

  it('says “safety critical” on exactly the two the table calls that', async () => {
    await openProfile()
    for (const where of ['[data-notification-table]', '[data-notification-list]']) {
      const named = [
        ...document.querySelectorAll(`${where} [data-fixed="no_safety_critical"]`),
      ].map((mark) =>
        mark.closest('[data-notification]')?.getAttribute('data-notification'),
      )
      expect(named, where).toEqual([
        'medication_round_due',
        'medication_window_closing',
      ])
    }
  })

  it('remembers a switch for the rest of the session', async () => {
    const { user } = await openProfile()
    const row = document.querySelector<HTMLElement>(
      '[data-notification="new_handover"]',
    )!
    const toggle = within(row).getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await user.click(toggle)
    expect(within(row).getByRole('switch').getAttribute('aria-checked')).toBe('false')
    expect(document.body.textContent).not.toMatch(/Nothing is sent either way/)
  })

  it('draws the two documents’ disagreement as a question, not a decision', async () => {
    await openProfile()
    const question = screen.getByText(/Which list is right is for the PRD’s author/)
    expect(question.closest('[data-act-line]')?.getAttribute('data-act-line')).toBe(
      'not_stated',
    )
  })
})

describe('device settings and sessions', () => {
  it('names both device features and draws no switch for either', async () => {
    await openProfile()
    for (const which of ['biometric', 'shared']) {
      const row = document.querySelector<HTMLElement>(`[data-device="${which}"]`)!
      expect(within(row).queryByRole('switch')).toBeNull()
      expect(row.textContent?.trim()).not.toBe('')
      expect(row.querySelector('[data-act-line]')).toBeNull()
    }
  })

  it('lists this tab with when it started, and asks before ending it', async () => {
    const { user } = await openProfile()
    const session = document.querySelector<HTMLElement>('[data-session="this"]')!
    expect(within(session).getByText(/^Signed in /)).toBeTruthy()
    expect(session.querySelector('[data-act-line]')).toBeNull()
    expect(session.closest('[data-card]')?.querySelector('[data-act-line]')).toBeNull()

    /*
     * It asks over the screen rather than at an address of its own: leaving the
     * screen to be asked whether you want to leave the screen loses what you
     * were looking at before you have agreed to lose anything.
     */
    const end = within(session).getByRole('button', { name: 'End this session' })
    expect(end.tagName).toBe('BUTTON')
    await user.click(end)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Sign out?' })).toBeTruthy()
    expect(dialog.querySelector('[data-confirm-sign-out]')).not.toBeNull()
  })

  /*
   * The hatch means nobody has recorded this, and it appears nowhere else. A
   * session on another device is not a record anybody failed to write, so
   * spending it here would blunt the one signal the product exists to carry.
   */
  it('spends no hatch on a device list', async () => {
    await openProfile()
    expect(document.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})
