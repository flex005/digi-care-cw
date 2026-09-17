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

/**
 * Whether a role may perform an act, and if not, the one line that says why.
 *
 * **The reason is part of the answer, not decoration added by a screen.** Where
 * a refused act is drawn at all, it is drawn with this line at the point of the
 * act, and a screen that wrote its own would be a second owner of a fact that
 * belongs to the role table.
 */
export type Holding = { kind: 'holds' } | { kind: 'refused'; reason: string }

const holds: Holding = { kind: 'holds' }
const refused = (reason: string): Holding => ({ kind: 'refused', reason })

export interface CareAct {
  /** What the act is, as the role table names it. */
  name: string
  care_worker: Holding
  senior_carer: Holding
  /**
   * Confirmed with the person's medication PIN.
   *
   * **The name is the medication PIN, and it signs more than medication.** It
   * is chosen by the person at account setup, and it also signs a handover and
   * a risk assessment. The Admin build's "signing code" was a different thing,
   * derived from a staff id, and is not this.
   */
  confirmedWithMedicationPin: boolean
}

/**
 * The Care Worker PRD's role table, Table 3, row by row, plus the two rows its
 * screen specifications add: viewing the controlled drug register (MED-03) and
 * updating a resident's handover status (HO-01).
 *
 * **Which residents a role reaches is not here.** "Assigned only" and "all
 * residents" are a scope, and scope has one owner: `resident-scope.ts`.
 */
export const CARE_ACTS = {
  edit_resident_profile: {
    name: 'Edit a resident’s profile',
    care_worker: refused('A manager or an admin edits a resident’s profile.'),
    senior_carer: refused('A manager or an admin edits a resident’s profile.'),
    confirmedWithMedicationPin: false,
  },
  write_care_note: {
    name: 'Write a care note',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  mark_flagged_note_reviewed: {
    name: 'Mark a flagged care note reviewed',
    care_worker: refused('Marking a flagged note reviewed is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  write_care_plan: {
    name: 'Write or finalise a care plan',
    care_worker: refused('A manager writes and finalises the care plan.'),
    senior_carer: refused('A manager writes and finalises the care plan.'),
    confirmedWithMedicationPin: false,
  },
  update_handover_status: {
    name: 'Update a resident’s handover status',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  sign_handover: {
    name: 'Sign a handover',
    care_worker: refused('Signing a handover is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: true,
  },
  record_medication: {
    name: 'Record a dose given, not given or PRN',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: true,
  },
  view_controlled_drug_register: {
    name: 'View the controlled drug register',
    care_worker: refused('The controlled drug register is for senior carers.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  countersign_controlled_drug: {
    name: 'Countersign a controlled drug as second witness',
    care_worker: refused('Countersigning a controlled drug is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: true,
  },
  add_interim_medication: {
    name: 'Add an interim medication',
    care_worker: refused('Only a clinician or a manager adds an interim medication.'),
    senior_carer: refused('Only a clinician or a manager adds an interim medication.'),
    confirmedWithMedicationPin: false,
  },
  report_incident: {
    name: 'Report an incident',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  acknowledge_incident: {
    name: 'Acknowledge an incident',
    care_worker: refused('Acknowledging an incident is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  close_incident: {
    name: 'Close an incident',
    care_worker: refused('A manager closes an incident.'),
    senior_carer: refused('A manager closes an incident.'),
    confirmedWithMedicationPin: false,
  },
  score_risk_assessment: {
    name: 'Score or re-score a risk assessment',
    care_worker: refused('Scoring a risk assessment is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: true,
  },
  conduct_review: {
    name: 'Conduct a review',
    care_worker: refused('Conducting a review is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  add_goal_progress_note: {
    name: 'Add a goal progress note',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  set_or_close_goal: {
    name: 'Create or close a goal',
    care_worker: refused('A manager sets and closes goals.'),
    senior_carer: refused('A manager sets and closes goals.'),
    confirmedWithMedicationPin: false,
  },
  record_attendance: {
    name: 'Record activity attendance',
    care_worker: holds,
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  create_activity_session: {
    name: 'Create an activity session',
    care_worker: refused('Creating a session is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  record_consent: {
    name: 'Record a consent decision',
    care_worker: refused('Recording consent is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  upload_document: {
    name: 'Upload a document',
    care_worker: refused('Uploading a document is for a senior carer.'),
    senior_carer: holds,
    confirmedWithMedicationPin: false,
  },
  open_compliance_and_reports: {
    name: 'Open compliance and reports',
    care_worker: refused('Compliance and reports are for managers.'),
    senior_carer: refused('Compliance and reports are for managers.'),
    confirmedWithMedicationPin: false,
  },
  open_settings_and_team: {
    name: 'Open settings and team management',
    care_worker: refused('Settings and team management are for an admin.'),
    senior_carer: refused('Settings and team management are for an admin.'),
    confirmedWithMedicationPin: false,
  },
} as const satisfies Record<string, CareAct>

export type CareActId = keyof typeof CARE_ACTS

export const holdingFor = (role: SignInRole, act: CareActId): Holding =>
  CARE_ACTS[act][role]
