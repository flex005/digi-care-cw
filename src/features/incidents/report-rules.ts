import type {
  BodyRegionId,
  CommunalAreaId,
  IncidentSeverityId,
  IncidentTypeId,
} from '@/data/types'

/**
 * What the report form is still waiting on, named item by item. CW PRD INC-02,
 * INC-03.
 *
 * **Named, not counted.** "Waiting on: who this happened to · how much harm"
 * tells somebody what to go and answer; "4 fields missing" makes them hunt.
 *
 * Pure, and exported on its own, because the rule is the thing under test
 * rather than the wiring.
 */

export type SubjectChoice = 'resident' | 'no_resident' | 'not_chosen'
export type InjuryChoice = 'not_checked' | 'none_found' | 'found' | 'not_chosen'
export type WitnessChoice = 'nobody' | 'witnessed' | 'not_chosen'
/**
 * Whether anybody dialled. **Two answers and no "not yet"**: calling is
 * instantaneous, so either somebody did or nobody did, and the record has no
 * third member for the form to leave it in.
 */
export type EmergencyChoice = 'not_called' | 'ambulance_999' | 'nhs_111' | 'not_chosen'

/**
 * The two types that can have happened to nobody (INC-02).
 *
 * A hoist found faulty during a check happened to no resident; a fall did not.
 * Attaching a fall to whoever was nearest would be a lost subject, so the
 * choice is offered only where it can be true.
 */
export const NO_RESIDENT_TYPES: IncidentTypeId[] = ['equipment_failure', 'near_miss']

export interface ReportDraft {
  subject: SubjectChoice
  residentId: string
  type: IncidentTypeId | 'not_chosen'
  occurredAt: string
  place: CommunalAreaId | 'resident_room' | 'not_chosen'
  description: string
  severity: IncidentSeverityId | 'not_chosen'
  injury: InjuryChoice
  marked: BodyRegionId[]
  witnesses: WitnessChoice
  witnessNames: string
  immediateAction: string
  emergency: EmergencyChoice
  emergencyOutcome: string
}

export const EMPTY_DRAFT: ReportDraft = {
  subject: 'not_chosen',
  residentId: '',
  type: 'not_chosen',
  occurredAt: '',
  place: 'not_chosen',
  description: '',
  severity: 'not_chosen',
  injury: 'not_chosen',
  marked: [],
  witnesses: 'not_chosen',
  witnessNames: '',
  immediateAction: '',
  emergency: 'not_chosen',
  emergencyOutcome: '',
}

/** Whether "no resident was involved" can be true of the type chosen so far. */
export const canHaveNoResident = (type: ReportDraft['type']): boolean =>
  type !== 'not_chosen' && NO_RESIDENT_TYPES.includes(type)

/**
 * The subject as it stands, with the choice taken back where the type no longer
 * allows it.
 *
 * Somebody who chooses "near miss", then "no resident was involved", then
 * changes the type to a fall would otherwise leave a fall recorded against
 * nobody, which is a lost subject rather than a statement.
 */
export function subjectOf(draft: ReportDraft): SubjectChoice {
  return draft.subject === 'no_resident' && !canHaveNoResident(draft.type)
    ? 'not_chosen'
    : draft.subject
}

/**
 * The injury question is only asked where somebody could have been hurt.
 *
 * An equipment failure with no resident involved has nobody to examine, and
 * asking would produce "not checked yet" against nobody — a gap in the record
 * of a person who is not in it.
 */
export const asksAboutInjury = (draft: ReportDraft): boolean =>
  subjectOf(draft) === 'resident'

/**
 * What is missing, in the order the form asks for it.
 *
 * **An injury choice is required and has three answers**, because "not checked
 * yet" is a documented gap and "checked: no injury found" is a recorded
 * negative (INC-03). A form that let somebody skip the question would produce
 * one blank meaning both.
 *
 * **"Injuries found" with nothing marked holds the form**, exactly as a missing
 * answer does: it is an incomplete record rather than an empty one.
 */
export function outstanding(draft: ReportDraft, now: string): string[] {
  const waiting: string[] = []
  const subject = subjectOf(draft)

  if (draft.type === 'not_chosen') waiting.push('what kind of incident it was')
  if (subject === 'not_chosen') waiting.push('who this happened to')
  else if (subject === 'resident' && draft.residentId === '')
    waiting.push('which resident')
  if (draft.occurredAt === '') waiting.push('when it happened')
  else if (new Date(draft.occurredAt).getTime() > new Date(now).getTime())
    waiting.push('a time that is not in the future')
  if (draft.place === 'not_chosen') waiting.push('where it happened')
  if (draft.description.trim() === '') waiting.push('what happened, in your own words')
  if (draft.severity === 'not_chosen') waiting.push('how much harm was caused')
  if (asksAboutInjury(draft)) {
    if (draft.injury === 'not_chosen')
      waiting.push('whether they were checked for injury')
    else if (draft.injury === 'found' && draft.marked.length === 0)
      waiting.push('at least one injury site')
  }
  if (draft.witnesses === 'not_chosen') waiting.push('whether anybody saw it')
  else if (draft.witnesses === 'witnessed' && draft.witnessNames.trim() === '')
    waiting.push('who saw it')
  if (draft.immediateAction.trim() === '') waiting.push('what you did about it')
  /*
   * Asked, never assumed. The record's own account of it has two members and
   * no unrecorded one, so a form that did not ask would be writing "nobody
   * called an ambulance" in somebody else's name.
   */
  if (draft.emergency === 'not_chosen')
    waiting.push('whether emergency services were called')
  else if (draft.emergency !== 'not_called' && draft.emergencyOutcome.trim() === '')
    waiting.push('what the emergency service said')

  return waiting
}
