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
    () => import('@/features/home/HomeRoute').then((module) => module.HomeRoute),
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
