import type { IsoDate, IsoDateTime, Site, StaffMember } from '@/data/types'
import { now } from '@/data/fixtures/clock'
import {
  invitationHasExpired,
  invitations,
  type Invitation,
} from '@/data/fixtures/invitations'
import { memberById } from '@/data/access/team-store'
import { isSignInRole } from '@/app/session/capabilities'
import { zonedDate } from '@/lib/format'

export interface CareInvitation {
  invitation: Invitation
  member: StaffMember
  home: Site
  /** The home's day, which access granted today would be dated. */
  today: IsoDate
  expired: boolean
}

/**
 * The invitations somebody would accept in this product: a care worker's or a
 * senior carer's. The governance invitations are accepted in the Admin build.
 *
 * **Expiry is judged by the home's day, not the viewer's**, because an
 * invitation with a day left in London and none in the viewer's zone is the
 * timezone defect this product takes seriously, on a screen that grants access.
 */
export function careInvitations(sites: Site[]): CareInvitation[] {
  return invitations().flatMap((invitation) => {
    const member = memberById(invitation.staffId)
    if (member === undefined || !isSignInRole(member.role)) return []
    const home = sites.find((site) => member.siteIds.includes(site.id))
    if (home === undefined) return []
    const today: IsoDate = zonedDate(now().toISOString() as IsoDateTime, home.timeZone)
    return [
      {
        invitation,
        member,
        home,
        today,
        expired: invitationHasExpired(invitation, today),
      },
    ]
  })
}

export const careInvitationFor = (
  staffId: string,
  sites: Site[],
): CareInvitation | undefined =>
  careInvitations(sites).find((entry) => entry.member.id === staffId)
