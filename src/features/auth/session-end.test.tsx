import { useEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memberById, resetSessionTeam, setStanding } from '@/data/access/team-store'
import { staffEze, staffOkonkwo } from '@/data/fixtures/organisation'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { SESSION_TIMEOUT_MINUTES } from '@/app/session/session-timeout'
import { TooltipProvider } from '@/components/primitives'
import { SessionExpiry } from '@/components/shell/SessionExpiry'
import { SignOutRoute } from './SignOutRoute'

const router = { push: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }))

function SignedInAs({ id, children }: { id: string; children: React.ReactNode }) {
  const { signIn, signInAs, sites } = useSession()
  useEffect(() => {
    if (signIn.kind === 'signed_in') return
    const member = memberById(id)!
    signInAs(
      member,
      sites.find((site) => member.siteIds.includes(site.id))!,
    )
  }, [id, signIn.kind, signInAs, sites])
  return signIn.kind === 'signed_in' ? <>{children}</> : null
}

/** Drops the query before rendering its children, as signing in does. */
function NavigateAway({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.history.replaceState({}, '', '/')
  }, [])
  return <>{children}</>
}

const wrap = (ui: React.ReactNode) =>
  render(
    <SessionProvider>
      <TooltipProvider>
        <SignedInAs id={staffEze.id}>{ui}</SignedInAs>
      </TooltipProvider>
    </SessionProvider>,
  )

beforeEach(() => {
  router.replace.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  resetSessionTeam()
})

describe('a session that ends', () => {
  /*
   * The regression the screenshot found: the timeout has to be read from the
   * address the page loaded at, even after navigation has dropped the query.
   */
  it('keeps a shortened timeout after the address changes', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 8, 17, 8, 0) })
    window.history.replaceState({}, '', '/sign-in?timeout=10')
    const view = render(
      <SessionProvider>
        <TooltipProvider>
          <NavigateAway>
            <SignedInAs id={staffEze.id}>
              <SessionExpiry />
            </SignedInAs>
          </NavigateAway>
        </TooltipProvider>
      </SessionProvider>,
    )
    await act(async () => {})
    expect(window.location.search).toBe('')
    expect(document.querySelector('[data-session-expiry]')?.textContent).toMatch(
      /10:00|9:59/,
    )
    view.unmount()
  })

  /*
   * Fake timers from a pinned instant: the warning is about how long is left,
   * and a test reading the real clock would depend on nothing moving under it.
   */
  it('stays silent until ten minutes are left, warns, and signs out at zero', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 8, 17, 8, 0) })
    wrap(<SessionExpiry />)
    await act(async () => {})
    expect(document.querySelector('[data-session-expiry]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime((SESSION_TIMEOUT_MINUTES - 10) * 60_000 + 1000)
    })
    expect(document.querySelector('[data-session-expiry]')?.textContent).toMatch(
      /Your session will expire in 9:59/,
    )
    expect(router.replace).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000)
    })
    expect(router.replace).toHaveBeenCalledWith('/signed-out')
  })
})

describe('signing out', () => {
  it('says there is nothing to lose when nothing was recorded', async () => {
    wrap(<SignOutRoute />)
    expect(
      (await screen.findByText(/Nothing has been recorded this session/)).textContent,
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('lists what would go, with its count, in the button as well', async () => {
    setStanding(staffOkonkwo.id, {
      kind: 'suspended',
      on: '2026-09-17',
      reason: 'a test',
      by: staffOkonkwo,
    })
    wrap(<SignOutRoute />)
    const list = await screen.findByText('What you would lose')
    expect(list).toBeTruthy()
    expect(document.querySelector('[data-loss-list]')?.textContent).toMatch(/1/)
    expect(
      screen.getByRole('button', { name: 'Sign out and discard 1 record' }),
    ).toBeTruthy()
  })
})
