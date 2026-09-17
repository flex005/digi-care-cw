import type { SiteId, StaffId, StaffMember } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { answerFor, isSignInRole, signInRoleOf } from '@/app/session/capabilities'
import { residentScopeFor } from '@/app/session/resident-scope'

/**
 * Who may witness an opening count of a controlled drug, besides the person
 * giving it: somebody at this home, with access, whom the role table lets
 * countersign a controlled drug.
 *
 * **Asked of the role table, never of a role.** The same row that decides who is
 * Witness 2 on the register decides who may stand beside the first count, so a
 * row that moves on review moves both.
 */
export function witnessesFor(siteId: SiteId, viewer: StaffId): StaffMember[] {
  return teamMembers().filter(
    (member) =>
      member.id !== viewer &&
      member.siteIds.includes(siteId) &&
      member.standing.kind === 'has_access' &&
      isSignInRole(member.role) &&
      answerFor(
        signInRoleOf(member),
        residentScopeFor(member),
        'countersign_controlled_drug',
        { kind: 'role_only' },
        member.id,
      ).kind === 'yes',
  )
}
