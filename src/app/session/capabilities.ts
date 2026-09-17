import type { ResidentId, StaffId, StaffRef } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { scopeReaches, type ResidentScope } from './resident-scope'
import type { SignInRole } from './roles'

export { SIGN_IN_ROLES, isSignInRole, signInRoleOf, type SignInRole } from './roles'

/**
 * Whether a role may perform an act, and over which residents.
 *
 * **`over` is where "assigned residents only" lives**, which a level per module
 * cannot hold:
 *
 * - `your_list`: the residents the viewer can see, their `ResidentScope`. For a
 *   senior carer that is every resident at the home; for a care worker it is
 *   the residents somebody gave them.
 * - `every_resident`: every resident at the home, whatever the viewer's list.
 * - `no_resident`: the act is about the home, not a person (the controlled drug
 *   register, signing a handover).
 * - `records_you_wrote`: a record the viewer wrote, about a resident on their
 *   list. Correcting a care note is this: only its author may, because a
 *   senior carer rewriting a colleague's record is a different act from
 *   correcting your own.
 * - `not_stated`: **the PRD says the role may, and does not say over whom.** A
 *   screen reaching this has found a question for review, not a default. Where
 *   Table 3 says only "Can" for a senior carer, the answer is `your_list`
 *   without a question, because Table 3's first row gives a senior carer the
 *   whole home and there is no narrower list to be silent about. For a care
 *   worker there is.
 *
 * **The refusal is part of the answer, not decoration added by a screen.** Where
 * a refused act is drawn at all, it is drawn with this line at the point of the
 * act, and a screen writing its own would be a second owner of a fact that
 * belongs to the role table.
 */
export type Grant =
  | {
      kind: 'may'
      over:
        | 'your_list'
        | 'every_resident'
        | 'no_resident'
        | 'records_you_wrote'
        | 'not_stated'
    }
  | { kind: 'may_not'; reason: string; whoDoes: WhoDoes }

export type WhoDoes =
  'senior_carer' | 'manager' | 'clinician_or_manager' | 'manager_or_admin' | 'admin'

/**
 * Whether finishing the act needs somebody else.
 *
 * **One signature is half a record, not a finished one.** A handover signed by
 * one shift and a controlled drug witnessed by one person are both incomplete,
 * and a screen can only draw that if the act says so.
 */
export type Completion =
  | { kind: 'done_when_done' }
  | {
      kind: 'needs_a_second_signature'
      by: 'the_other_shift' | 'a_second_senior_witness'
      /** Whether every instance needs one, or only a controlled drug. */
      when: 'always' | 'controlled_drug'
    }
  | { kind: 'handed_on'; next: string; by: 'manager' }

/** Where a rule came from, so a row that moves on review is found by name. */
export type Source =
  | { kind: 'role_table'; row: string }
  | { kind: 'screen'; screen: string; says: string }
  /**
   * An act the PRD does not name, decided here and recorded as a departure.
   * The first is correcting a care note: the CW PRD says only that a note
   * "cannot be edited after submission".
   */
  | { kind: 'departure'; see: string }

export interface CareAct {
  /** What the act is, as a person would say it. */
  name: string
  source: Source
  care_worker: Grant
  senior_carer: Grant
  /**
   * **The name is the medication PIN, and it signs more than medication.** It
   * is chosen by the person at account setup, and it also signs a handover and
   * a risk assessment. The Admin build's "signing code" was a different thing,
   * derived from a staff id, and is not this.
   */
  confirmation: 'none' | 'medication_pin'
  completion: Completion
}

const may = (over: Extract<Grant, { kind: 'may' }>['over']): Grant => ({
  kind: 'may',
  over,
})
const mayNot = (reason: string, whoDoes: WhoDoes): Grant => ({
  kind: 'may_not',
  reason,
  whoDoes,
})
const row = (name: string): Source => ({ kind: 'role_table', row: name })
const done: Completion = { kind: 'done_when_done' }

/**
 * **The authority is the Care Worker PRD's role table**, over the Admin build's
 * permission table, decided 17/09/2026 (CLAUDE.md, Scope). **And it is a draft**:
 * "For Design and Engineering Review", with no approvers named. Every role rule
 * lives here, and `check-role-names.mjs` fails the build if a screen names a
 * role, so a row that moves on review moves in one place.
 *
 * Table 3 row by row, with the rows it holds together split where they are two
 * acts ("acknowledge or close", "create or close"), and the acts the screen
 * specifications add, each naming its screen.
 */
export const CARE_ACTS = {
  open_resident_record: {
    name: 'Open a resident’s record',
    source: row('Dashboard — view all residents'),
    care_worker: may('your_list'),
    senior_carer: may('every_resident'),
    confirmation: 'none',
    completion: done,
  },
  edit_resident_profile: {
    name: 'Edit a resident’s profile',
    source: row('Residents — edit profile'),
    care_worker: mayNot(
      'A manager or an admin edits a resident’s profile.',
      'manager_or_admin',
    ),
    senior_carer: mayNot(
      'A manager or an admin edits a resident’s profile.',
      'manager_or_admin',
    ),
    confirmation: 'none',
    completion: done,
  },
  write_care_note: {
    name: 'Write a care note',
    source: row('Care Notes — write'),
    care_worker: may('your_list'),
    senior_carer: may('every_resident'),
    confirmation: 'none',
    completion: done,
  },
  correct_care_note: {
    name: 'Correct a care note',
    source: {
      kind: 'departure',
      see: 'docs/DEPARTURES.md, Care notes: only the author corrects a note',
    },
    care_worker: may('records_you_wrote'),
    senior_carer: may('records_you_wrote'),
    confirmation: 'none',
    completion: done,
  },
  mark_flagged_note_reviewed: {
    name: 'Mark a flagged care note reviewed',
    source: row('Care Notes — mark flagged reviewed'),
    care_worker: mayNot(
      'Marking a flagged note reviewed is for a senior carer.',
      'senior_carer',
    ),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  write_care_plan: {
    name: 'Write or finalise a care plan',
    source: row('Care Plan — view'),
    care_worker: mayNot('A manager writes and finalises the care plan.', 'manager'),
    senior_carer: mayNot('A manager writes and finalises the care plan.', 'manager'),
    confirmation: 'none',
    completion: done,
  },
  update_handover_status: {
    name: 'Update a resident’s handover status',
    source: {
      kind: 'screen',
      screen: 'HO-01',
      says: 'both roles update a resident’s status on the board',
    },
    care_worker: may('not_stated'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  sign_handover: {
    name: 'Sign a handover',
    source: row('Handover — sign off'),
    care_worker: mayNot('Signing a handover is for a senior carer.', 'senior_carer'),
    senior_carer: may('no_resident'),
    confirmation: 'medication_pin',
    completion: {
      kind: 'needs_a_second_signature',
      by: 'the_other_shift',
      when: 'always',
    },
  },
  record_medication: {
    name: 'Record a dose given, not given or PRN',
    source: row('Medications — record Given/Not Given/PRN'),
    care_worker: may('not_stated'),
    senior_carer: may('your_list'),
    confirmation: 'medication_pin',
    completion: {
      kind: 'needs_a_second_signature',
      by: 'a_second_senior_witness',
      when: 'controlled_drug',
    },
  },
  view_controlled_drug_register: {
    name: 'View the controlled drug register',
    source: {
      kind: 'screen',
      screen: 'MED-03',
      says: 'the register is for senior carers',
    },
    care_worker: mayNot(
      'The controlled drug register is for senior carers.',
      'senior_carer',
    ),
    senior_carer: may('no_resident'),
    confirmation: 'none',
    completion: done,
  },
  countersign_controlled_drug: {
    name: 'Countersign a controlled drug as second witness',
    source: row('Medications — countersign controlled drugs'),
    care_worker: mayNot(
      'Countersigning a controlled drug is for a senior carer.',
      'senior_carer',
    ),
    senior_carer: may('your_list'),
    confirmation: 'medication_pin',
    completion: done,
  },
  add_interim_medication: {
    name: 'Add an interim medication',
    source: row('Medications — add interim'),
    care_worker: mayNot(
      'Only a clinician or a manager adds an interim medication.',
      'clinician_or_manager',
    ),
    senior_carer: mayNot(
      'Only a clinician or a manager adds an interim medication.',
      'clinician_or_manager',
    ),
    confirmation: 'none',
    completion: done,
  },
  report_incident: {
    name: 'Report an incident',
    source: row('Incidents — report'),
    care_worker: may('not_stated'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  acknowledge_incident: {
    name: 'Acknowledge an incident',
    source: row('Incidents — acknowledge or close'),
    care_worker: mayNot(
      'Acknowledging an incident is for a senior carer.',
      'senior_carer',
    ),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: { kind: 'handed_on', next: 'closing it', by: 'manager' },
  },
  close_incident: {
    name: 'Close an incident',
    source: row('Incidents — acknowledge or close'),
    care_worker: mayNot('A manager closes an incident.', 'manager'),
    senior_carer: mayNot('A manager closes an incident.', 'manager'),
    confirmation: 'none',
    completion: done,
  },
  score_risk_assessment: {
    name: 'Score or re-score a risk assessment',
    source: row('Risk Assessments — score/re-score'),
    care_worker: mayNot(
      'Scoring a risk assessment is for a senior carer.',
      'senior_carer',
    ),
    senior_carer: may('your_list'),
    confirmation: 'medication_pin',
    completion: done,
  },
  conduct_review: {
    name: 'Conduct a review',
    source: row('Reviews — conduct'),
    care_worker: mayNot('Conducting a review is for a senior carer.', 'senior_carer'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  add_goal_progress_note: {
    name: 'Add a goal progress note',
    source: row('Goals — add progress note'),
    care_worker: may('not_stated'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  set_or_close_goal: {
    name: 'Create or close a goal',
    source: row('Goals — create or close'),
    care_worker: mayNot('A manager sets and closes goals.', 'manager'),
    senior_carer: mayNot('A manager sets and closes goals.', 'manager'),
    confirmation: 'none',
    completion: done,
  },
  record_attendance: {
    name: 'Record activity attendance',
    source: row('Activities — record attendance'),
    care_worker: may('not_stated'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  create_activity_session: {
    name: 'Create an activity session',
    source: row('Activities — create session'),
    care_worker: mayNot('Creating a session is for a senior carer.', 'senior_carer'),
    senior_carer: may('no_resident'),
    confirmation: 'none',
    completion: done,
  },
  record_consent: {
    name: 'Record a consent decision',
    source: row('Consent — record'),
    care_worker: mayNot('Recording consent is for a senior carer.', 'senior_carer'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  upload_document: {
    name: 'Upload a document',
    source: row('Documents — upload'),
    care_worker: mayNot('Uploading a document is for a senior carer.', 'senior_carer'),
    senior_carer: may('your_list'),
    confirmation: 'none',
    completion: done,
  },
  open_compliance_and_reports: {
    name: 'Open compliance and reports',
    source: row('Compliance and Reports'),
    care_worker: mayNot('Compliance and reports are for managers.', 'manager'),
    senior_carer: mayNot('Compliance and reports are for managers.', 'manager'),
    confirmation: 'none',
    completion: done,
  },
  open_settings_and_team: {
    name: 'Open settings and team management',
    source: row('Settings / Team Management'),
    care_worker: mayNot('Settings and team management are for an admin.', 'admin'),
    senior_carer: mayNot('Settings and team management are for an admin.', 'admin'),
    confirmation: 'none',
    completion: done,
  },
} as const satisfies Record<string, CareAct>

export type CareActId = keyof typeof CARE_ACTS

/**
 * What a screen is told when it asks whether the viewer may act.
 *
 * **In terms a screen can draw, never a role.** A screen that received the role
 * would have to decide what the role means, and that decision would then live
 * in the screen.
 */
export type Answer =
  | { kind: 'yes'; confirmation: CareAct['confirmation']; completion: Completion }
  /** The role cannot. `reason` is the one line drawn at the act. */
  | { kind: 'not_your_role'; reason: string }
  /** The role can, and this resident is not on the viewer's list. Scope, never blame. */
  | { kind: 'not_on_your_list' }
  /**
   * The act is on a record only its author may act on, and somebody else wrote
   * this one. Carries who did, so the screen can say who to speak to.
   */
  | { kind: 'not_the_author'; author: StaffRef; reason: string }
  /** The role can over a list, and nobody has given this viewer one. */
  | { kind: 'no_list_yet' }
  /**
   * The role can, and the PRD does not say over which residents. `question` is
   * written for review, and a screen draws it rather than choosing an answer.
   */
  | { kind: 'not_stated'; question: string }

/** What an act is asked about: one resident, a record about one, or the role alone. */
export type Subject =
  | { kind: 'resident'; id: ResidentId }
  | { kind: 'record'; resident: ResidentId; writtenBy: StaffRef }
  | { kind: 'role_only' }

/**
 * Whether a viewer with this role and this scope may perform an act.
 *
 * Asked about `role_only`, it answers for the role: a button on a list that
 * opens nothing yet. Asked about a resident, it answers for that resident, and
 * asked about a record, for that record and the resident it is about. That is
 * the answer to draw at the act.
 */
export function answerFor(
  role: SignInRole,
  scope: ResidentScope,
  act: CareActId,
  subject: Subject,
  viewer: StaffId,
): Answer {
  const declared: CareAct = CARE_ACTS[act]
  const grant = declared[role]
  if (grant.kind === 'may_not') return { kind: 'not_your_role', reason: grant.reason }

  const yes: Answer = {
    kind: 'yes',
    confirmation: declared.confirmation,
    completion: declared.completion,
  }
  if (subject.kind === 'role_only') return yes
  const resident = subject.kind === 'resident' ? subject.id : subject.resident
  const onList = (): Answer => {
    if (scope.kind === 'not_decided') return { kind: 'no_list_yet' }
    return scopeReaches(scope, resident) ? yes : { kind: 'not_on_your_list' }
  }

  switch (grant.over) {
    case 'every_resident':
      return yes
    case 'no_resident':
      throw new Error(
        `${declared.name} is not an act on a resident, and was asked about ${resident}.`,
      )
    case 'not_stated':
      return {
        kind: 'not_stated',
        question: `The PRD lets a ${ROLE_WORDS[role]} “${declared.name}” and does not say for which residents.`,
      }
    case 'your_list':
      return onList()
    case 'records_you_wrote':
      if (subject.kind !== 'record')
        throw new Error(
          `${declared.name} is asked of a record, and was asked of a resident.`,
        )
      return subject.writtenBy.id === viewer
        ? onList()
        : {
            kind: 'not_the_author',
            author: subject.writtenBy,
            reason: `Only ${subject.writtenBy.displayName}, who wrote it, can ${declared.name.split(' ')[0]?.toLowerCase() ?? 'change'} it.`,
          }
    default:
      return assertNever(grant.over)
  }
}

/** How a role is said inside a sentence. Only this file's questions use it. */
const ROLE_WORDS: Record<SignInRole, string> = {
  care_worker: 'care worker',
  senior_carer: 'senior carer',
}
