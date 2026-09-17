import { useEffect, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { SiteId, StaffId } from '@/data/types'
import { memberById } from '@/data/access/team-store'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { ToastProvider, TooltipProvider } from '@/components/primitives'
import { ResidentProfileLayout } from '@/features/residents/profile/ResidentProfileLayout'

/**
 * Render a screen signed in as a named person from the fixtures.
 *
 * **By person, never by role.** A test that built "a senior carer" would be a
 * second owner of what a role is; naming Akinyemi or Eze asks the fixtures and
 * the role table the same question the product asks. `check-role-names.mjs`
 * reads test files too.
 *
 * A test using this mocks `next/navigation` itself, because `vi.mock` is hoisted
 * per file:
 *
 *     const navigation = vi.hoisted(() => ({ pathname: '/residents', params: {} }))
 *     vi.mock('next/navigation', () => ({
 *       usePathname: () => navigation.pathname,
 *       useParams: () => navigation.params,
 *       useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
 *     }))
 */
function SignedInAs({
  id,
  siteId,
  children,
}: {
  id: StaffId
  siteId: SiteId | undefined
  children: ReactNode
}) {
  const { signIn, signInAs, sites } = useSession()
  useEffect(() => {
    if (signIn.kind === 'signed_in') return
    const member = memberById(id)
    const site = sites.find(
      (entry) =>
        member?.siteIds.includes(entry.id) &&
        (siteId === undefined || entry.id === siteId),
    )
    if (member === undefined || site === undefined)
      throw new Error(
        `Cannot sign in ${id}${siteId === undefined ? '' : ` at ${siteId}`}.`,
      )
    signInAs(member, site)
  }, [id, siteId, signIn, signInAs, sites])
  return signIn.kind === 'signed_in' ? <>{children}</> : null
}

export function renderSignedIn(id: StaffId, ui: ReactNode, siteId?: SiteId) {
  return render(
    <SessionProvider>
      <TooltipProvider>
        <ToastProvider>
          <SignedInAs id={id} siteId={siteId}>
            {ui}
          </SignedInAs>
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>,
  )
}

/**
 * Render one tab of a resident's record inside the real profile layout, so the
 * tab reads the record the way it does in the product: loaded by the route
 * parameter, after the role table has been asked.
 *
 * The test's `next/navigation` mock must return `{ residentId }` from
 * `useParams`.
 */
export function renderProfileTab(id: StaffId, tab: ReactNode, siteId?: SiteId) {
  return renderSignedIn(
    id,
    <ResidentProfileLayout>{tab}</ResidentProfileLayout>,
    siteId,
  )
}
