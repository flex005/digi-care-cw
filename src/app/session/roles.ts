import type { StaffMember, StaffRole } from '@/data/types'

/**
 * The two roles that sign into this product.
 *
 * Every other role in the fixtures (managers, the auditor, the activities
 * coordinator) appears here only as a subject: an author on a record, the
 * person who set a goal. None of them signs in, and no branch in this build
 * exists for them.
 */
export const SIGN_IN_ROLES = ['care_worker', 'senior_carer'] as const
export type SignInRole = (typeof SIGN_IN_ROLES)[number]

export const isSignInRole = (role: StaffRole): role is SignInRole =>
  (SIGN_IN_ROLES as readonly StaffRole[]).includes(role)

/** The role of somebody signed in, narrowed. Throws for a role that cannot sign in. */
export function signInRoleOf(member: StaffMember): SignInRole {
  if (!isSignInRole(member.role))
    throw new Error(
      `${member.ref.fullName} holds the role ${member.role}, which does not sign into the Care Worker product.`,
    )
  return member.role
}
