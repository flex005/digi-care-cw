import type { Site, StaffMember } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { isSignInRole } from '@/app/session/capabilities'
import { addressFor } from './addresses'

/**
 * Who can sign into this product: a care worker or senior carer whose access
 * is live. Somebody suspended, gone, or never given access is not a way in.
 */
export const signInPeople = (): StaffMember[] =>
  teamMembers().filter(
    (member) => isSignInRole(member.role) && member.standing.kind === 'has_access',
  )

/** Who an address belongs to among them, or nobody. Any of their homes' addresses. */
export function personForAddress(
  typed: string,
  sites: Site[],
): StaffMember | undefined {
  const wanted = typed.trim().toLowerCase()
  if (wanted === '') return undefined
  return signInPeople().find((member) =>
    member.siteIds.some((siteId) => {
      const site = sites.find((entry) => entry.id === siteId)
      return site !== undefined && addressFor(member, site) === wanted
    }),
  )
}

/** Their first home's address: the one the sign-in list fills in. */
export function primaryAddress(member: StaffMember, sites: Site[]): string {
  const home = sites.find((site) => member.siteIds.includes(site.id))
  if (home === undefined)
    throw new Error(`${member.ref.fullName} holds no configured home.`)
  return addressFor(member, home)
}

/**
 * A password that meets every rule for anybody in the fixtures, for the sign-in
 * list to fill in beside an address. Nothing is stored, so any password that
 * meets the rules signs in; this is one of them, shown rather than hidden.
 */
export const DEMONSTRATION_PASSWORD = 'Kept-Safe-2026!'
