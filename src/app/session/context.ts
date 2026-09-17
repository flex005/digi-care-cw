import { createContext } from 'react'
import type { IsoDateTime, Organisation, Site, StaffMember } from '@/data/types'

/**
 * Whether anybody has signed in, and who.
 *
 * **A closed union rather than a nullable member**, for the reason every other
 * status in this product is one: signed out and signed in as nobody must not
 * be able to look the same to a screen reading it.
 *
 * There is no authentication behind it. Nothing is checked, and every screen
 * that asks for credentials says so before anybody types.
 */
export type SignInState =
  | { kind: 'signed_out' }
  | {
      kind: 'signed_in'
      member: StaffMember
      /** When this session started, on the fixture clock. */
      at: IsoDateTime
    }

/**
 * A sign-in part-way through: the credentials are accepted and the next step
 * is not done yet.
 *
 * **Held here, in memory, rather than in the address.** A code screen reached
 * by typing its URL would be a step anybody could skip, and a reload would
 * leave a half-signed-in person nobody can see. So each step is reachable only
 * by passing the one before it, and a reload starts again at sign-in.
 */
export type PendingSignIn =
  | { kind: 'none' }
  | {
      kind: 'awaiting_code'
      member: StaffMember
      /** The address the code would have gone to. Nothing is sent. */
      address: string
      /** Signing in, or verifying the address while setting up an account. */
      purpose: 'sign_in' | 'set_up_account'
    }
  | { kind: 'choosing_home'; member: StaffMember }

/**
 * Who is looking, at which home, and in whose timezone.
 *
 * **There is no `currentUser` that exists while signed out.** The Admin build
 * kept one, defaulting to its registered manager, because a manager is who
 * wrote records before it had accounts. Nobody in this product writes anything
 * except the person signed in, so a default would be a name that could land on
 * a record without anybody having signed. Screens behind the sign-in gate ask
 * `useSignedIn()`, which cannot return nobody.
 */
export interface Session {
  organisation: Organisation
  /** The homes this viewer holds, or every home while signed out. */
  sites: Site[]
  activeSite: Site
  setActiveSite: (site: Site) => void
  signIn: SignInState
  /**
   * Signs somebody in as a named member, at a named home.
   *
   * The home is chosen here rather than afterwards because it decides the
   * timezone every record written today carries.
   */
  signInAs: (member: StaffMember, site: Site) => void
  /** Ends the session and destroys everything it wrote. */
  signOut: () => void
  /**
   * Minutes of inactivity before this session ends: twelve hours, or what
   * `?timeout=` asked for when the page loaded. See session-timeout.ts.
   */
  timeoutMinutes: number
  pending: PendingSignIn
  /** Credentials accepted: the code step comes next. */
  awaitCode: (
    member: StaffMember,
    address: string,
    purpose: 'sign_in' | 'set_up_account',
  ) => void
  /**
   * The code step passed. Somebody at one home is signed in there; somebody at
   * more than one chooses first. Returns which happened.
   */
  acceptCode: () => 'signed_in' | 'choosing_home'
  /** Abandons a sign-in part-way through. */
  cancelPending: () => void
}

export const SessionContext = createContext<Session | undefined>(undefined)

/**
 * The timezone clinical records render in.
 *
 * Nested deliberately: the app provides the active home's zone, and a
 * resident's subtree can provide *that resident's* home zone, so a record
 * renders in the time of the home that holds it.
 */
export const TimeZoneContext = createContext<string | undefined>(undefined)
