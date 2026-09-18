import { useEffect } from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { memberById } from '@/data/access/team-store'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { TooltipProvider } from '@/components/primitives'
import { Rail } from './Rail'
import { NavPill } from './NavPill'
import { TopBar } from './TopBar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/specimens',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

    // Documents has no home-wide screen: filing lives on a resident's record.
    const documents = within(nav).getByRole('button', {
      name: 'Documents, not built',
    })
    expect(documents.getAttribute('data-built')).toBe('false')
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
