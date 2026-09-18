import type { ConsentMethod, ConsentTypeId } from '@/data/types'

/**
 * Recording a consent decision, as rules. Table 3: "Consent — record", senior
 * carers.
 *
 * Pure, so the gate can be tested without driving a form: what it refuses is
 * the point of it.
 */

export type CapacityAnswer = 'has_capacity' | 'lacks_capacity' | 'not_answered'
export type AuthorityChoice =
  'the_resident' | 'best_interests' | 'lpa_holder' | 'not_chosen'
export type Outcome = 'given' | 'refused' | 'not_chosen'

export interface DecisionDraft {
  capacity: CapacityAnswer
  /** Stage 1 of the Mental Capacity Act's test: the impairment. */
  diagnostic: string
  /** Stage 2: which part of deciding they cannot do, because of it. */
  functional: string
  /** What was said and seen. A record of the conversation, not a conclusion. */
  assessmentNote: string
  authority: AuthorityChoice
  consulted: string
  rationale: string
  outcome: Outcome
  method: ConsentMethod | 'not_chosen'
  refusalNote: string
}

export const EMPTY_DECISION: DecisionDraft = {
  capacity: 'not_answered',
  diagnostic: '',
  functional: '',
  assessmentNote: '',
  authority: 'not_chosen',
  consulted: '',
  rationale: '',
  outcome: 'not_chosen',
  method: 'not_chosen',
  refusalNote: '',
}

export const CONSENT_METHODS: { id: ConsentMethod; label: string }[] = [
  { id: 'verbal', label: 'Verbally, and recorded here' },
  { id: 'written', label: 'In writing, signed' },
  { id: 'digital_signature', label: 'Digitally signed' },
]

/**
 * Which authorities can be offered, and why one cannot.
 *
 * **Only a health-and-welfare LPA can consent to care.** A financial LPA
 * consenting to photography is a real-world error, so the authority is not
 * offered where there is no health-and-welfare LPA on record, and the screen
 * says why rather than presenting it and failing on submit.
 *
 * **Capacity decides the rest.** Somebody with capacity decides for themselves;
 * where they lack it, somebody else does, and the record says who.
 */
export function authoritiesFor(
  capacity: CapacityAnswer,
  hasWelfareLpa: boolean,
): { id: AuthorityChoice; label: string; available: boolean; why: string }[] {
  if (capacity === 'not_answered') return []
  const theResident = capacity === 'has_capacity'
  return [
    {
      id: 'the_resident',
      label: 'The resident decided',
      available: theResident,
      why: theResident
        ? ''
        : 'They were assessed as lacking capacity for this decision.',
    },
    {
      id: 'lpa_holder',
      label: 'The holder of a health and welfare LPA decided',
      available: !theResident && hasWelfareLpa,
      why: theResident
        ? 'They have capacity for this decision, so it is theirs to make.'
        : 'No health and welfare LPA is on this record. A financial LPA cannot consent to care.',
    },
    {
      id: 'best_interests',
      label: 'A best-interests decision was made',
      available: !theResident,
      why: theResident
        ? 'They have capacity for this decision, so it is theirs to make.'
        : '',
    },
  ]
}

/**
 * What is missing, named in the order the screen asks for it.
 *
 * **Both MCA stages are required where somebody lacks capacity**: a conclusion
 * with no impairment recorded and no functional finding is not an assessment.
 * **A best-interests decision needs somebody consulted**, because one reached
 * without consulting anybody is not a best-interests decision.
 */
export function outstanding(draft: DecisionDraft): string[] {
  const waiting: string[] = []

  if (draft.capacity === 'not_answered')
    waiting.push('whether they have capacity for this decision')
  if (draft.capacity === 'lacks_capacity') {
    if (draft.diagnostic.trim() === '')
      waiting.push('the impairment or disturbance of mind or brain')
    if (draft.functional.trim() === '')
      waiting.push('which part of deciding they cannot do')
  }
  if (draft.capacity !== 'not_answered' && draft.assessmentNote.trim() === '')
    waiting.push('what was said and seen in the assessment')

  if (draft.capacity !== 'not_answered' && draft.authority === 'not_chosen')
    waiting.push('who made this decision')
  if (draft.authority === 'best_interests') {
    if (splitConsulted(draft.consulted).length === 0) waiting.push('who was consulted')
    if (draft.rationale.trim() === '') waiting.push('why this is in their interests')
  }

  if (draft.outcome === 'not_chosen') waiting.push('what was decided')
  if (draft.outcome === 'given' && draft.method === 'not_chosen')
    waiting.push('how consent was given')
  if (draft.outcome === 'refused' && draft.refusalNote.trim() === '')
    waiting.push('what they said')

  return waiting
}

/** Names typed one per line or separated by commas, emptied of blanks. */
export function splitConsulted(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter((name) => name !== '')
}

/** Whether this type of consent already has a decision that must be withdrawn first. */
export const alreadyDecided = (kind: string): boolean =>
  kind === 'given' || kind === 'refused'

/** The one sentence a decision that cannot be recorded here carries. */
export const decidedLine = (typeName: string): string =>
  `${typeName} already has a decision on this record. Withdrawing it is a separate act, and this build does not do it here.`

export type { ConsentTypeId }
