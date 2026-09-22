'use client'

import dynamic from 'next/dynamic'
import type { ComponentType, ReactNode } from 'react'

/**
 * Every screen in the product, loaded in the browser and never on a server.
 *
 * **This is a rule, not a workaround.** The fixtures are generated against a
 * moment — the instant the page loads, or the one `?at=` asks for — and every
 * figure on every screen is true of that moment. A server rendering the same
 * screen renders it against a different moment, in a different process, with
 * no `?at=`, so the page would arrive holding two records of the same fact:
 * the server's HTML and the browser's regeneration. At best that is a
 * hydration error; at worst it is a figure that says one thing in the HTML and
 * another a second later, which is the two-clocks defect with the server as the
 * second clock.
 *
 * So route files (`page.tsx`, `layout.tsx`) import nothing but this component
 * and name a screen by id, and every product module is reached only through a
 * `dynamic(…, { ssr: false })` below. `scripts/check-client-only.mjs` fails the
 * build on any other import from a route file, and on any import here that is
 * not one of these. The fixture clock also throws if it is ever evaluated
 * without a window, so a boundary broken some other way fails loudly rather
 * than quietly producing a second record.
 */
type Screen = ComponentType<{ children?: ReactNode }>

const SCREENS = {
  product: dynamic(() => import('./Product').then((module) => module.Product), {
    ssr: false,
  }),
  shell: dynamic(
    () => import('@/components/shell/AppShell').then((module) => module.AppShell),
    { ssr: false },
  ),
  signIn: dynamic(
    () => import('@/features/auth/SignInRoute').then((module) => module.SignInRoute),
    {
      ssr: false,
    },
  ),
  signInCode: dynamic(
    () => import('@/features/auth/CodeStep').then((module) => module.SignInCodeRoute),
    {
      ssr: false,
    },
  ),
  signInHome: dynamic(
    () =>
      import('@/features/auth/HomeChoiceRoute').then(
        (module) => module.HomeChoiceRoute,
      ),
    {
      ssr: false,
    },
  ),
  signedOut: dynamic(
    () =>
      import('@/features/auth/SignedOutRoute').then((module) => module.SignedOutRoute),
    {
      ssr: false,
    },
  ),
  signOut: dynamic(
    () => import('@/features/auth/SignOutRoute').then((module) => module.SignOutRoute),
    {
      ssr: false,
    },
  ),
  forgotPassword: dynamic(
    () =>
      import('@/features/auth/ForgotPassword').then(
        (module) => module.ForgotPasswordRoute,
      ),
    {
      ssr: false,
    },
  ),
  forgotPasswordSent: dynamic(
    () =>
      import('@/features/auth/ForgotPassword').then(
        (module) => module.ForgotPasswordSentRoute,
      ),
    {
      ssr: false,
    },
  ),
  forgotPasswordReset: dynamic(
    () =>
      import('@/features/auth/ForgotPassword').then(
        (module) => module.ForgotPasswordResetRoute,
      ),
    {
      ssr: false,
    },
  ),
  forgotPasswordDone: dynamic(
    () =>
      import('@/features/auth/ForgotPassword').then(
        (module) => module.ForgotPasswordDoneRoute,
      ),
    {
      ssr: false,
    },
  ),
  invitations: dynamic(
    () =>
      import('@/features/auth/InvitationRoutes').then(
        (module) => module.InvitationIndexRoute,
      ),
    {
      ssr: false,
    },
  ),
  invitationEmail: dynamic(
    () =>
      import('@/features/auth/InvitationRoutes').then(
        (module) => module.InvitationEmailRoute,
      ),
    {
      ssr: false,
    },
  ),
  invitationSetup: dynamic(
    () =>
      import('@/features/auth/InvitationRoutes').then(
        (module) => module.InvitationSetupRoute,
      ),
    {
      ssr: false,
    },
  ),
  invitationVerify: dynamic(
    () =>
      import('@/features/auth/CodeStep').then((module) => module.InvitationVerifyRoute),
    {
      ssr: false,
    },
  ),
  home: dynamic(
    () =>
      import('@/features/dashboard/DashboardRoute').then(
        (module) => module.DashboardRoute,
      ),
    { ssr: false },
  ),
  residents: dynamic(
    () =>
      import('@/features/residents/ResidentsRoute').then(
        (module) => module.ResidentsRoute,
      ),
    {
      ssr: false,
    },
  ),
  residentProfile: dynamic(
    () =>
      import('@/features/residents/profile/ResidentProfileLayout').then(
        (module) => module.ResidentProfileLayout,
      ),
    {
      ssr: false,
    },
  ),
  residentGeneral: dynamic(
    () =>
      import('@/features/residents/tabs/GeneralInformationTab').then(
        (module) => module.GeneralInformationTab,
      ),
    {
      ssr: false,
    },
  ),
  residentNeeds: dynamic(
    () =>
      import('@/features/residents/tabs/NeedsTab').then((module) => module.NeedsTab),
    {
      ssr: false,
    },
  ),
  residentPeople: dynamic(
    () =>
      import('@/features/residents/tabs/ImportantPeopleTab').then(
        (module) => module.ImportantPeopleTab,
      ),
    {
      ssr: false,
    },
  ),
  residentFuturePlans: dynamic(
    () =>
      import('@/features/residents/tabs/FuturePlansTab').then(
        (module) => module.FuturePlansTab,
      ),
    {
      ssr: false,
    },
  ),
  residentNotes: dynamic(
    () => import('@/features/notes/NotesTab').then((module) => module.NotesTab),
    { ssr: false },
  ),
  residentNoteNew: dynamic(
    () =>
      import('@/features/notes/composer/NoteComposerRoute').then(
        (module) => module.NoteComposerRoute,
      ),
    { ssr: false },
  ),
  residentNoteDetail: dynamic(
    () =>
      import('@/features/notes/NoteDetailRoute').then(
        (module) => module.NoteDetailRoute,
      ),
    { ssr: false },
  ),
  reviewQueue: dynamic(
    () =>
      import('@/features/reviews/ReviewQueueRoute').then(
        (module) => module.ReviewQueueRoute,
      ),
    { ssr: false },
  ),
  wholePlanReview: dynamic(
    () =>
      import('@/features/reviews/WholePlanReviewRoute').then(
        (module) => module.WholePlanReviewRoute,
      ),
    { ssr: false },
  ),
  uploadDocument: dynamic(
    () =>
      import('@/features/documents/UploadDocumentRoute').then(
        (module) => module.UploadDocumentRoute,
      ),
    { ssr: false },
  ),
  consentDecision: dynamic(
    () =>
      import('@/features/consent/ConsentDecisionRoute').then(
        (module) => module.ConsentDecisionRoute,
      ),
    { ssr: false },
  ),
  assessmentForm: dynamic(
    () =>
      import('@/features/risk/AssessmentFormRoute').then(
        (module) => module.AssessmentFormRoute,
      ),
    { ssr: false },
  ),
  goals: dynamic(
    () => import('@/features/goals/GoalsRoute').then((module) => module.GoalsRoute),
    { ssr: false },
  ),
  goalDetail: dynamic(
    () =>
      import('@/features/goals/GoalDetailRoute').then(
        (module) => module.GoalDetailRoute,
      ),
    { ssr: false },
  ),
  activities: dynamic(
    () =>
      import('@/features/activities/ActivitiesRoute').then(
        (module) => module.ActivitiesRoute,
      ),
    { ssr: false },
  ),
  activityAttendance: dynamic(
    () =>
      import('@/features/activities/AttendanceRoute').then(
        (module) => module.AttendanceRoute,
      ),
    { ssr: false },
  ),
  incidents: dynamic(
    () =>
      import('@/features/incidents/IncidentsRoute').then(
        (module) => module.IncidentsRoute,
      ),
    { ssr: false },
  ),
  reportIncident: dynamic(
    () =>
      import('@/features/incidents/ReportIncidentRoute').then(
        (module) => module.ReportIncidentRoute,
      ),
    { ssr: false },
  ),
  handover: dynamic(
    () =>
      import('@/features/handover/HandoverRoute').then(
        (module) => module.HandoverRoute,
      ),
    { ssr: false },
  ),
  careNotes: dynamic(
    () =>
      import('@/features/notes/CareNotesRoute').then((module) => module.CareNotesRoute),
    { ssr: false },
  ),
  careNotePicker: dynamic(
    () =>
      import('@/features/notes/composer/ResidentPickerRoute').then(
        (module) => module.ResidentPickerRoute,
      ),
    { ssr: false },
  ),
  residentMedications: dynamic(
    () =>
      import('@/features/medications/resident/MedicationsTab').then(
        (module) => module.MedicationsTab,
      ),
    { ssr: false },
  ),
  residentMar: dynamic(
    () =>
      import('@/features/medications/mar/MarChartRoute').then(
        (module) => module.MarChartRoute,
      ),
    { ssr: false },
  ),
  medicationsLayout: dynamic(
    () =>
      import('@/features/medications/MedicationsLayout').then(
        (module) => module.MedicationsLayout,
      ),
    { ssr: false },
  ),
  medicationsOmissions: dynamic(
    () =>
      import('@/features/medications/omissions/OmissionsRoute').then(
        (module) => module.OmissionsRoute,
      ),
    { ssr: false },
  ),
  medicationsRound: dynamic(
    () =>
      import('@/features/medications/round/RoundRoute').then(
        (module) => module.RoundRoute,
      ),
    { ssr: false },
  ),
  medicationsRegister: dynamic(
    () =>
      import('@/features/medications/register/RegisterRoute').then(
        (module) => module.RegisterRoute,
      ),
    { ssr: false },
  ),
  residentRisk: dynamic(
    () =>
      import('@/features/residents/tabs/RiskAssessmentsTab').then(
        (module) => module.RiskAssessmentsTab,
      ),
    {
      ssr: false,
    },
  ),
  residentCarePlan: dynamic(
    () =>
      import('@/features/residents/tabs/CarePlanTab').then(
        (module) => module.CarePlanTab,
      ),
    {
      ssr: false,
    },
  ),
  residentGoals: dynamic(
    () => import('@/features/goals/GoalsTab').then((module) => module.GoalsTab),
    { ssr: false },
  ),
  residentConsent: dynamic(
    () =>
      import('@/features/residents/tabs/ConsentTab').then(
        (module) => module.ConsentTab,
      ),
    {
      ssr: false,
    },
  ),
  residentDocuments: dynamic(
    () =>
      import('@/features/residents/tabs/DocumentsTab').then(
        (module) => module.DocumentsTab,
      ),
    {
      ssr: false,
    },
  ),
  riskAssessments: dynamic(
    () =>
      import('@/features/risk/RiskListRoute').then((module) => module.RiskListRoute),
    { ssr: false },
  ),
  consentList: dynamic(
    () =>
      import('@/features/consent/ConsentListRoute').then(
        (module) => module.ConsentListRoute,
      ),
    { ssr: false },
  ),
  documents: dynamic(
    () =>
      import('@/features/documents/DocumentsRoute').then(
        (module) => module.DocumentsRoute,
      ),
    { ssr: false },
  ),
  documentExpiry: dynamic(
    () =>
      import('@/features/documents/ExpiryQueueRoute').then(
        (module) => module.ExpiryQueueRoute,
      ),
    { ssr: false },
  ),
  documentViewer: dynamic(
    () =>
      import('@/features/documents/DocumentViewerRoute').then(
        (module) => module.DocumentViewerRoute,
      ),
    { ssr: false },
  ),
  profile: dynamic(
    () =>
      import('@/features/profile/ProfileRoute').then((module) => module.ProfileRoute),
    { ssr: false },
  ),
  specimens: dynamic(
    () =>
      import('@/features/specimens/SpecimensRoute').then(
        (module) => module.SpecimensRoute,
      ),
    { ssr: false },
  ),
  notFound: dynamic(
    () =>
      import('@/features/home/NotFoundRoute').then((module) => module.NotFoundRoute),
    { ssr: false },
  ),
} satisfies Record<string, Screen>

export type ScreenId = keyof typeof SCREENS

export function ClientOnly({
  screen,
  children,
}: {
  screen: ScreenId
  children?: ReactNode
}) {
  const Loaded = SCREENS[screen]
  return <Loaded>{children}</Loaded>
}
