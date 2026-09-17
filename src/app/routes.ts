import type { NavModuleId } from '@/components/shell/nav.icons'
import type { ScreenId } from './client-only'

/**
 * Every page in the product, and the module each one builds.
 *
 * **A nav item is live exactly when a route here names its module**, so the
 * navigation cannot say a module exists before its screen does, or go on saying
 * it is missing after it lands. `routes.test.ts` holds this list against the
 * `page.tsx` files on disk in both directions: a declared route with no file,
 * and a file with no declaration, both fail.
 */
export interface RouteDeclaration {
  path: string
  screen: ScreenId
  /** The navigation module this page builds. Absent for a page no nav item points at. */
  module?: NavModuleId
  /** Whether it renders inside the signed-in shell. */
  inShell: boolean
}

export const ROUTES: RouteDeclaration[] = [
  { path: '/sign-in', screen: 'signIn', inShell: false },
  { path: '/sign-in/code', screen: 'signInCode', inShell: false },
  { path: '/sign-in/home', screen: 'signInHome', inShell: false },
  { path: '/signed-out', screen: 'signedOut', inShell: false },
  { path: '/forgot-password', screen: 'forgotPassword', inShell: false },
  { path: '/forgot-password/sent', screen: 'forgotPasswordSent', inShell: false },
  { path: '/forgot-password/reset', screen: 'forgotPasswordReset', inShell: false },
  { path: '/forgot-password/done', screen: 'forgotPasswordDone', inShell: false },
  { path: '/invitation', screen: 'invitations', inShell: false },
  { path: '/invitation/[staffId]', screen: 'invitationSetup', inShell: false },
  { path: '/invitation/[staffId]/email', screen: 'invitationEmail', inShell: false },
  { path: '/invitation/[staffId]/verify', screen: 'invitationVerify', inShell: false },
  { path: '/sign-out', screen: 'signOut', inShell: true },
  { path: '/', screen: 'home', inShell: true },
  { path: '/specimens', screen: 'specimens', module: 'specimens', inShell: true },
]

export const isBuilt = (module: NavModuleId): boolean =>
  ROUTES.some((route) => route.module === module)
