import type { IsoDate, ResidentId, StaffMember, StaffRef } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { signInRoleOf } from './capabilities'

/**
 * Which residents somebody signed in can see. The only reader of a care
 * worker's resident assignment.
 *
 * **Scope, never blame.** "1 of your 9 residents" is a fact about what a
 * person can see. The same assignment read anywhere that counts gaps would
 * turn a record nobody wrote into a mark against whoever was assigned, which is
 * a performance record about a person dressed as a finding about a home. So the
 * assignment is read here and nowhere else, and `check-assignment-reach.mjs`
 * fails the build if any other file reaches for it. Screens receive a scope,
 * never the assignment.
 */
export type ResidentScope =
  /** A senior carer sees every resident at the home they are signed in at. */
  | { kind: 'every_resident'; because: 'senior_carer' }
  /** A care worker somebody gave the whole home, with that decision's name on it. */
  | { kind: 'every_resident'; because: 'decided'; decidedBy: StaffRef; on: IsoDate }
  /** A care worker given named residents. */
  | {
      kind: 'named_residents'
      residents: ResidentId[]
      decidedBy: StaffRef
      on: IsoDate
    }
  /**
   * A care worker nobody has given any residents.
   *
   * **Not "every resident" and not "none"**: nobody has decided, and a care
   * worker in this state sees that stated rather than an empty list that reads
   * as a home with no residents in it.
   */
  | { kind: 'not_decided' }

export function residentScopeFor(member: StaffMember): ResidentScope {
  const role = signInRoleOf(member)
  if (role === 'senior_carer')
    return { kind: 'every_resident', because: 'senior_carer' }

  const assignment = member.residentAssignment
  switch (assignment.kind) {
    case 'never_set':
      return { kind: 'not_decided' }
    case 'all_residents_at_site':
      return {
        kind: 'every_resident',
        because: 'decided',
        decidedBy: assignment.decidedBy,
        on: assignment.on,
      }
    case 'assigned':
      return {
        kind: 'named_residents',
        residents: assignment.residents,
        decidedBy: assignment.decidedBy,
        on: assignment.on,
      }
    default:
      return assertNever(assignment)
  }
}

/** Whether a resident is inside a scope. */
export function scopeReaches(scope: ResidentScope, residentId: ResidentId): boolean {
  switch (scope.kind) {
    case 'every_resident':
      return true
    case 'named_residents':
      return scope.residents.includes(residentId)
    case 'not_decided':
      return false
    default:
      return assertNever(scope)
  }
}
