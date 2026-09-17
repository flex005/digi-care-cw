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
