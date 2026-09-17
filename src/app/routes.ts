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
  { path: '/residents', screen: 'residents', module: 'residents', inShell: true },
  { path: '/care-notes', screen: 'careNotes', module: 'care-notes', inShell: true },
  { path: '/care-notes/new', screen: 'careNotePicker', inShell: true },
  {
    path: '/medications',
    screen: 'medicationsOmissions',
    module: 'medications',
    inShell: true,
  },
  { path: '/medications/round', screen: 'medicationsRound', inShell: true },
  { path: '/medications/register', screen: 'medicationsRegister', inShell: true },
  { path: '/medications/interim', screen: 'medicationsInterim', inShell: true },
  { path: '/residents/[residentId]', screen: 'residentGeneral', inShell: true },
  { path: '/residents/[residentId]/needs', screen: 'residentNeeds', inShell: true },
  { path: '/residents/[residentId]/people', screen: 'residentPeople', inShell: true },
  {
    path: '/residents/[residentId]/future-plans',
    screen: 'residentFuturePlans',
    inShell: true,
  },
  { path: '/residents/[residentId]/notes', screen: 'residentNotes', inShell: true },
  {
    path: '/residents/[residentId]/notes/new',
    screen: 'residentNoteNew',
    inShell: true,
  },
  {
    path: '/residents/[residentId]/notes/[noteId]',
    screen: 'residentNoteDetail',
    inShell: true,
  },
  {
    path: '/residents/[residentId]/medications',
    screen: 'residentMedications',
    inShell: true,
  },
  {
    path: '/residents/[residentId]/medications/mar',
    screen: 'residentMar',
    inShell: true,
  },
  {
    path: '/residents/[residentId]/risk-assessments',
    screen: 'residentRisk',
    inShell: true,
  },
  {
    path: '/residents/[residentId]/care-plan',
    screen: 'residentCarePlan',
    inShell: true,
  },
  { path: '/residents/[residentId]/goals', screen: 'residentGoals', inShell: true },
  { path: '/residents/[residentId]/consent', screen: 'residentConsent', inShell: true },
  {
    path: '/residents/[residentId]/documents',
    screen: 'residentDocuments',
    inShell: true,
  },
  { path: '/specimens', screen: 'specimens', module: 'specimens', inShell: true },
]

export const isBuilt = (module: NavModuleId): boolean =>
  ROUTES.some((route) => route.module === module)
