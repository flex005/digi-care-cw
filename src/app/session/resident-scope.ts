import type { IsoDate, ResidentId, StaffMember, StaffRef } from '@/data/types'
import { pluralise } from '@/lib/format'
import { assertNever } from '@/lib/assert-never'
import { signInRoleOf } from './roles'

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

/**
 * How many residents a scope reaches at a home, out of the residents there.
 * The count behind "4 of your 9 residents".
 */
export function residentsInScope(
  scope: ResidentScope,
  residentIds: ResidentId[],
): number {
  return residentIds.filter((id) => scopeReaches(scope, id)).length
}

/**
 * The scope said out loud, for the head of a screen: "9 residents on your list".
 *
 * **The one owner of this wording.** Scope, never blame: it states what the
 * person can see, and never who is responsible for what is missing.
 */
export function scopeLine(
  scope: ResidentScope,
  residentIds: ResidentId[],
  homeName: string,
): string {
  switch (scope.kind) {
    case 'every_resident':
      return `every resident at ${homeName}, ${pluralise(residentIds.length, 'resident')}`
    case 'named_residents':
      return `${pluralise(residentsInScope(scope, residentIds), 'resident')} on your list`
    case 'not_decided':
      return 'nobody has given you a list of residents yet'
    default:
      return assertNever(scope)
  }
}

/**
 * The line under a figure counted over the viewer's residents, so the reader
 * knows what population it covers: "Counted over your list, not the home's."
 */
export function scopeNote(scope: ResidentScope, homeName: string): string {
  switch (scope.kind) {
    case 'every_resident':
      return scope.because === 'senior_carer'
        ? `Counted over every resident at ${homeName}.`
        : `Counted over your list, which is every resident at ${homeName}.`
    case 'named_residents':
      return "Counted over your list, not the home's."
    case 'not_decided':
      return 'Nothing is counted: nobody has given you a list.'
    default:
      return assertNever(scope)
  }
}

/**
 * A resident the viewer's list does not reach, said at the point it matters.
 *
 * **Scope, never blame, and never a claim that the record does not exist.** The
 * resident is real and has a record; it is not on this person's list.
 */
export const notOnYourListLine = (name: string): string =>
  `${name} is not on your list.`

/** A viewer nobody has given a list, at the point an act needed one. */
export const noListYetLine = 'Nobody has given you a list of residents yet.'

/**
 * What a figure counted over the viewer's residents is out of: "of your 4
 * residents", or "of 28 residents at Rosewood Court".
 *
 * **Throws for a viewer with no list**, because nothing is counted for them:
 * a denominator of nobody would put "0 of 0" on a screen, which reads as a
 * settled home rather than a list nobody has given.
 */
export function scopeDenominator(
  scope: ResidentScope,
  inScope: number,
  homeName: string,
): string {
  switch (scope.kind) {
    case 'every_resident':
      return `of ${pluralise(inScope, 'resident')} at ${homeName}`
    case 'named_residents':
      return `of your ${pluralise(inScope, 'resident')}`
    case 'not_decided':
      throw new Error('Nothing is counted for a viewer nobody has given a list.')
    default:
      return assertNever(scope)
  }
}

/**
 * The same population, for a count of one thing over residents: "7 flagged
 * notes, across your 4 residents", where "of" would state a ratio that does not
 * exist.
 */
export function scopeAcross(
  scope: ResidentScope,
  inScope: number,
  homeName: string,
): string {
  switch (scope.kind) {
    case 'every_resident':
      return `across ${pluralise(inScope, 'resident')} at ${homeName}`
    case 'named_residents':
      return `across your ${pluralise(inScope, 'resident')}`
    case 'not_decided':
      throw new Error('Nothing is counted for a viewer nobody has given a list.')
    default:
      return assertNever(scope)
  }
}
