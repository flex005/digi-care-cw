import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
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
import { PIN_NOT_HELD } from './credentials'
import { ONE_SESSION_LINE, ProfileRoute } from './ProfileRoute'

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

async function openProfile(id = staffEze.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <ProfileRoute />, ROSEWOOD)
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

  it('refuses both roles the email and the role, and names who does it', async () => {
    for (const id of [staffEze.id, staffAkinyemi.id]) {
      const { unmount } = await openProfile(id)
      for (const name of ['email', 'role']) {
        const point = field(name).querySelector('[data-answer]')
        expect(point?.getAttribute('data-answer')).toBe('not_your_role')
        expect(within(point as HTMLElement).getByRole('button')).toHaveProperty(
          'disabled',
          true,
        )
        expect(within(point as HTMLElement).getByText(/An admin changes/)).toBeTruthy()
      }
      unmount()
    }
  })

  it('draws the photograph control and says no file is stored', async () => {
    await openProfile()
    const choose = screen.getByRole('button', { name: 'Add a photograph' })
    expect(choose).toHaveProperty('disabled', true)
    expect(screen.getByText(/No file is stored/)).toBeTruthy()
  })
})

describe('changing a password', () => {
  it('says the current one is not checked, and that nothing is saved', async () => {
    await openProfile()
    expect(screen.getByText(/Your current password is not checked/)).toBeTruthy()
    expect(
      screen.getByText(/no password is stored, no other session ends/),
    ).toBeTruthy()
  })

  it('stays unavailable until every rule is met, then saves nothing', async () => {
    const { user } = await openProfile()
    const change = screen.getByRole('button', { name: 'Change password' })
    expect(change).toHaveProperty('disabled', true)

    await user.type(screen.getByLabelText('Current password'), 'whatever')
    await user.type(screen.getByLabelText('New password'), 'Harmattan!27')
    await user.type(screen.getByLabelText('Confirm new password'), 'Harmattan!27')
    expect(change).toHaveProperty('disabled', false)

    await user.click(change)
    expect(document.querySelector('[data-password-done]')?.textContent).toMatch(
      /Nothing was saved/,
    )
  })
})

describe('changing the medication PIN', () => {
  it('says so before anybody types where this session holds none', async () => {
    await openProfile()
    expect(screen.getByText(PIN_NOT_HELD)).toBeTruthy()
    expect(screen.queryByLabelText('Current medication PIN')).toBeNull()
  })

  it('changes the PIN a dose is confirmed with, for this session', async () => {
    setMedicationPin(staffEze.id, '2846')
    const { user } = await openProfile()

    await user.type(screen.getByLabelText('Current medication PIN'), '2846')
    await user.type(screen.getByLabelText('New medication PIN'), '7391')
    await user.type(screen.getByLabelText('Confirm new medication PIN'), '7391')
    await user.click(screen.getByRole('button', { name: 'Change PIN' }))

    expect(document.querySelector('[data-pin-said]')?.textContent).toMatch(/changed/)
    expect(medicationPinMatches(staffEze.id, '7391')).toBe(true)
    expect(medicationPinMatches(staffEze.id, '2846')).toBe(false)
  })

  it('marks each rule with more than a colour', async () => {
    const { user } = await openProfile()
    await user.type(screen.getByLabelText('New medication PIN'), '2846')
    await user.type(screen.getByLabelText('Confirm new medication PIN'), '2846')
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
    const { user } = await openProfile()

    await user.type(screen.getByLabelText('Current medication PIN'), '1111')
    await user.type(screen.getByLabelText('New medication PIN'), '7391')
    await user.type(screen.getByLabelText('Confirm new medication PIN'), '7391')
    await user.click(screen.getByRole('button', { name: 'Change PIN' }))

    expect(document.querySelector('[data-pin-said]')?.textContent).toMatch(
      /not your current PIN/,
    )
    expect(medicationPinMatches(staffEze.id, '2846')).toBe(true)
    expect(medicationPinMatches(staffEze.id, '7391')).toBe(false)
  })
})

describe('notification preferences', () => {
  it('draws every row appendix D lists, not only the ones that switch', async () => {
    await openProfile()
    const rows = document.querySelectorAll('[data-notification]')
    expect(rows).toHaveLength(NOTIFICATIONS.length)
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
    const named = [
      ...document.querySelectorAll('[data-fixed="no_safety_critical"]'),
    ].map((mark) =>
      mark.closest('[data-notification]')?.getAttribute('data-notification'),
    )
    expect(named).toEqual(['medication_round_due', 'medication_window_closing'])
  })

  it('remembers a switch, and says nothing is sent either way', async () => {
    const { user } = await openProfile()
    const row = document.querySelector<HTMLElement>(
      '[data-notification="new_handover"]',
    )!
    const toggle = within(row).getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    await user.click(toggle)
    expect(within(row).getByRole('switch').getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText(/Nothing is sent either way/)).toBeTruthy()
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
  it('draws both device toggles unavailable, with the reason beside each', async () => {
    await openProfile()
    for (const which of ['biometric', 'shared']) {
      const row = document.querySelector<HTMLElement>(`[data-device="${which}"]`)!
      expect(within(row).getByRole('switch')).toHaveProperty('disabled', true)
      expect(row.querySelector('[data-act-line]')?.textContent?.trim()).not.toBe('')
    }
  })

  it('lists this tab with when it started, and refuses to claim it is the only one', async () => {
    await openProfile()
    const session = document.querySelector<HTMLElement>('[data-session="this"]')!
    expect(within(session).getByText(/^Signed in /)).toBeTruthy()
    expect(
      within(session).getByRole('link', { name: 'End this session' }),
    ).toHaveProperty('href', expect.stringContaining('/sign-out'))
    expect(screen.getByText(ONE_SESSION_LINE)).toBeTruthy()
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
