import { useEffect } from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { memberById } from '@/data/access/team-store'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { TooltipProvider } from '@/components/primitives'
import { Sidebar } from './Sidebar'
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

describe('the sidebar', () => {
  it('lists every module, links the built one and marks the rest not built', async () => {
    renderAs(staffEze.id, <Sidebar />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    const specimens = within(nav).getByRole('link', { name: 'Specimens' })
    expect(specimens.getAttribute('href')).toBe('/specimens')
    expect(specimens.getAttribute('aria-current')).toBe('page')

    for (const label of [
      'Dashboard',
      'Residents',
      'Care notes',
      'Medications',
      'Documents',
    ]) {
      const entry = within(nav).getByRole('button', { name: `${label}, not built` })
      expect(entry.getAttribute('data-built')).toBe('false')
    }
  })

  it('offers nothing a care worker or senior carer has no access to', async () => {
    renderAs(staffEze.id, <Sidebar />)
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(nav.textContent).not.toMatch(/Reports|Compliance|Settings|Team/)
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
