import { useEffect } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { memberById } from '@/data/access/team-store'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { TooltipProvider } from '@/components/primitives'
import { SignOutDialog } from '@/features/auth/SignOutDialog'
import { AppList } from './AppSwitcher'
import { NotificationsSummary } from './NotificationsMenu'
import { DIGI_APPS, NOT_IN_THIS_BUILD } from '@/app/digi-apps'
import { NOTHING_IS_SENT, NOTIFICATIONS } from '@/features/profile/notification-table'
import { Rail } from './Rail'
import { NavPill } from './NavPill'
import { TopBar } from './TopBar'

const pushed = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  usePathname: () => '/specimens',
  useRouter: () => ({ replace: vi.fn(), push: pushed }),
}))

function SignedInAs({ id, children }: { id: string; children: React.ReactNode }) {
  const { signIn, signInAs, sites } = useSession()
  useEffect(() => {
    if (signIn.kind === 'signed_in') return
    const member = memberById(id)
    const site = sites.find((entry) => member?.siteIds.includes(entry.id))
    if (member === undefined || site === undefined)
      throw new Error(`cannot sign in ${id}`)
    signInAs(member, site)
  }, [id, signIn, signInAs, sites])
  return signIn.kind === 'signed_in' ? <>{children}</> : null
}

const renderAs = (id: string, ui: React.ReactNode) =>
  render(
    <SessionProvider>
      <TooltipProvider>
        <SignedInAs id={id}>{ui}</SignedInAs>
      </TooltipProvider>
    </SessionProvider>,
  )

describe('the icon rail', () => {
  it('lists every module as an icon named for it, links the built ones and marks the rest not built', async () => {
    renderAs(staffEze.id, <Rail />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    const specimens = within(nav).getByRole('link', { name: 'Specimens' })
    expect(specimens.getAttribute('href')).toBe('/specimens')
    expect(specimens.getAttribute('aria-current')).toBe('page')
    expect(
      within(nav).getByRole('link', { name: 'Residents' }).getAttribute('href'),
    ).toBe('/residents')

    expect(
      within(nav).getByRole('link', { name: 'Care notes' }).getAttribute('href'),
    ).toBe('/care-notes')

    expect(
      within(nav).getByRole('link', { name: 'Medications' }).getAttribute('href'),
    ).toBe('/medications')

    // Phase 9 put the dashboard at the root, so Today is a link like the rest.
    expect(within(nav).getByRole('link', { name: 'Today' }).getAttribute('href')).toBe(
      '/',
    )

    // Every module has a screen now, so nothing in the rail is a popover.
    expect(
      within(nav).getByRole('link', { name: 'Documents' }).getAttribute('href'),
    ).toBe('/documents')
    expect(
      within(nav).getByRole('link', { name: 'Risk assessments' }).getAttribute('href'),
    ).toBe('/risk-assessments')
    expect(
      within(nav).getByRole('link', { name: 'Consent' }).getAttribute('href'),
    ).toBe('/consent')
    expect(nav.querySelectorAll('[data-built="false"]')).toHaveLength(0)
  })

  it('holds the account and signing out in its second group', async () => {
    renderAs(staffEze.id, <Rail />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    const groups = nav.querySelectorAll(':scope > ul')
    expect(groups).toHaveLength(2)
    // Phase 10 built PROF-01, so the account is a link like every other module.
    expect(
      within(groups[1] as HTMLElement)
        .getByRole('link', { name: 'Profile and settings' })
        .getAttribute('href'),
    ).toBe('/profile')
    expect(
      within(groups[1] as HTMLElement).getByRole('button', { name: 'Sign out' }),
    ).toBeTruthy()
  })

  it('offers nothing a care worker or senior carer has no access to', async () => {
    renderAs(staffEze.id, <Rail />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(nav.innerHTML).not.toMatch(/Reports|Compliance|Team/)
  })

  /*
   * Signing out asks over the screen rather than going to one: leaving the
   * screen to be asked whether you want to leave the screen loses what you
   * were looking at before you have agreed to lose anything. The rail asks and
   * the dialog the shell mounts beside it answers.
   */
  it('asks about signing out over the screen, and does not navigate to it', async () => {
    const user = userEvent.setup()
    renderAs(
      staffEze.id,
      <>
        <Rail />
        <SignOutDialog />
      </>,
    )
    await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Sign out?' })).toBeTruthy()
    expect(dialog.querySelector('[data-confirm-sign-out]')).not.toBeNull()
    expect(pushed).not.toHaveBeenCalled()
  })
})

/**
 * The bell and the grid, which the Admin build's bar carries and this one now
 * does. The hazard they bring is a bell that implies somebody sent something:
 * nothing in this build sends anything, and the menu has to say so where a
 * reader expects an inbox.
 *
 * **What the menus say is tested here; that they open is tested in a browser.**
 * Radix opens on `pointerdown` and both triggers carry a tooltip, which jsdom
 * cannot drive — a probe that fired `click()` reported both menus shut in
 * Chrome too, and the same probe with a real pointer sequence opened both. The
 * instrument was wrong, not the component, so the bodies are read directly and
 * the opening is left to the library that owns it.
 */
describe('the bell and the grid', () => {
  it('draws both triggers, and no count on the bell', async () => {
    renderAs(staffEze.id, <TopBar />)
    const bell = await screen.findByRole('button', { name: 'Notifications' })
    // A number on a bell says somebody sent you that many things.
    expect(bell.textContent).toBe('')
    expect(screen.getByRole('button', { name: 'diGi apps' })).toBeTruthy()
  })

  it('says how many notifications are on, and that nothing is sent', () => {
    render(<NotificationsSummary />)
    const said = screen.getByText(/notifications this product defines/)
    expect(said.textContent).toContain(String(NOTIFICATIONS.length))
    expect(screen.getByText(NOTHING_IS_SENT)).toBeInTheDocument()
  })

  it('lists the diGi family, and offers none of them as a control', () => {
    render(<AppList />)
    const rows = [...document.querySelectorAll('[data-app]')]
    expect(rows.map((row) => row.getAttribute('data-app'))).toEqual(
      DIGI_APPS.map((app) => app.name),
    )

    // Exactly one is this one, and the others say so in visible text rather
    // than by being drawn as controls that refuse.
    expect(rows.filter((row) => row.textContent?.includes('This app'))).toHaveLength(1)
    expect(screen.getAllByText(NOT_IN_THIS_BUILD)).toHaveLength(DIGI_APPS.length - 1)
    for (const row of rows)
      expect(within(row as HTMLElement).queryByRole('menuitem')).toBeNull()
  })
})

describe('the navigation pill', () => {
  it('holds the five modules a shift moves between, and no others', async () => {
    renderAs(staffEze.id, <NavPill />)
    const nav = await screen.findByRole('navigation', { name: 'Shift navigation' })
    const names = [...nav.querySelectorAll('[data-nav-module]')].map((entry) =>
      entry.getAttribute('data-nav-module'),
    )
    expect(names).toEqual([
      'dashboard',
      'residents',
      'medications',
      'handover',
      'activities',
    ])
  })
})

describe('the top bar', () => {
  it('gives Tolu Akinyemi, at both homes, a site switcher', async () => {
    renderAs(staffAkinyemi.id, <TopBar />)
    expect(
      await screen.findByRole('button', { name: 'Site: Rosewood Court. Change site.' }),
    ).toBeTruthy()
  })

  it('gives Ngozi Eze, at one home, the home without a switcher', async () => {
    const { container } = renderAs(staffEze.id, <TopBar />)
    await screen.findByRole('banner')
    expect(container.querySelector('[data-site-label]')?.textContent).toBe(
      'Site: Rosewood Court',
    )
    expect(container.querySelector('[data-site-switcher]')).toBeNull()
  })
})
