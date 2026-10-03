import type {
  IncidentId,
  IsoDate,
  IsoDateTime,
  ResidentId,
  SiteId,
  StaffRef,
} from './primitives'
import type { CarePlanDomainId, RiskTemplateId } from './reference'
import type { Recorded } from './state'

/**
 * Incidents. PRD §6.5.
 *
 * The module that feeds reviews and compliance, and the one where an
 * unrecorded decision is a regulatory failure rather than an untidy screen.
 */

/**
 * What happened. Twelve types, closed, and **deliberately no "other"**.
 *
 * A type nobody can name is a type the filter cannot work on, and "other"
 * becomes the bucket everything lands in — which turns the log's most useful
 * control into a list of one category. An incident that does not fit is a
 * conversation about this union, not a free-text field.
 *
 * Witnessed and unwitnessed falls are separate because they are different
 * findings: an unwitnessed fall has no account of what happened, which changes
 * both the clinical response and what the record can claim.
 */
/**
 * Each type carries **a name for a list and a phrase for a sentence**, and
 * they are not the same string.
 *
 * "Fall — witnessed" is the right label in a filter and a column: it sorts the
 * two falls together and puts the distinction where the eye scans. Dropped
 * into prose it produces "the fall — witnessed of 23/08", which is not
 * English. The phrase is what a person would say — "the witnessed fall of
 * 23/08" — and every consequence, confirmation and banner that names an
 * incident mid-sentence uses it.
 *
 * One entry, two forms, declared together. A second lookup table elsewhere
 * would be twelve ids repeated in a file that does not know when this one
 * changes.
 */
export const INCIDENT_TYPES = [
  { id: 'fall_witnessed', name: 'Fall: witnessed', phrase: 'witnessed fall' },
  { id: 'fall_unwitnessed', name: 'Fall: unwitnessed', phrase: 'unwitnessed fall' },
  { id: 'medication_error', name: 'Medication error', phrase: 'medication error' },
  {
    id: 'medication_stock_discrepancy',
    name: 'Medication stock discrepancy',
    phrase: 'medication stock discrepancy',
  },
  {
    id: 'injury_unexplained',
    name: 'Unexplained injury',
    phrase: 'unexplained injury',
  },
  {
    id: 'behaviour',
    name: 'Behaviour that challenges',
    phrase: 'incident of behaviour that challenges',
  },
  { id: 'absconding', name: 'Absconding', phrase: 'absconding' },
  { id: 'choking', name: 'Choking', phrase: 'choking incident' },
  {
    id: 'pressure_ulcer_acquired',
    name: 'Pressure ulcer acquired in care',
    phrase: 'pressure ulcer acquired in care',
  },
  {
    id: 'safeguarding_concern',
    name: 'Safeguarding concern',
    phrase: 'safeguarding concern',
  },
  { id: 'equipment_failure', name: 'Equipment failure', phrase: 'equipment failure' },
  { id: 'near_miss', name: 'Near miss', phrase: 'near miss' },
] as const

export type IncidentTypeId = (typeof INCIDENT_TYPES)[number]['id']

/**
 * How much harm was done. The NHS harm scale, four tiers.
 *
 * **Death is not a tier.** It is its own notification obligation and is
 * carried by `NotificationDecision`, because grading a death on a harm scale
 * says the wrong thing about what has to happen next.
 *
 * The words carry the meaning. Colour reinforces and never substitutes (§7).
 */
export const INCIDENT_SEVERITIES = [
  { id: 'no_harm', name: 'No harm' },
  { id: 'low_harm', name: 'Low harm' },
  { id: 'moderate_harm', name: 'Moderate harm' },
  { id: 'severe_harm', name: 'Severe harm' },
] as const

export type IncidentSeverityId = (typeof INCIDENT_SEVERITIES)[number]['id']

/** Somebody doing something, and when. The shape every signed act takes here. */
export interface IncidentAct {
  by: StaffRef
  at: IsoDateTime
}

/**
 * Where an incident is in the home's own process.
 *
 * **`reported_not_acknowledged` is the state the log exists for**, and it is
 * hatched: somebody wrote it down and nobody has picked it up. It is not a
 * milder "open" — open means a person has taken it on.
 *
 * Each later state carries the facts of the earlier ones, so an incident
 * cannot be under review without an acknowledgement to point at. The
 * repetition is the compiler holding the order of events.
 */
export type IncidentStatus =
  | { kind: 'reported_not_acknowledged' }
  | { kind: 'open'; acknowledged: IncidentAct }
  | { kind: 'under_review'; acknowledged: IncidentAct; reviewStarted: IncidentAct }
  | {
      kind: 'closed'
      acknowledged: IncidentAct
      reviewStarted: IncidentAct
      closed: IncidentAct
    }

/**
 * Whether the CQC has to be told, and — where it does — whether it has been.
 *
 * Four states, and the third is the point. "Required" with nothing recorded
 * against it is an obligation nobody can prove was met, which is the same
 * shape as a PRN with no 24-hour maximum: not merely missing data, a duty with
 * no evidence behind it. Both hatched states say what is missing.
 *
 * `not_yet_decided` is the default and it never silently becomes
 * `not_required`. A decision not to notify is a decision somebody made, and it
 * carries their name.
 */
export type NotificationDecision =
  | { kind: 'not_yet_decided' }
  | { kind: 'not_required'; decided: IncidentAct; reason: string }
  | { kind: 'required_not_yet_notified'; decided: IncidentAct }
  | {
      kind: 'notified'
      decided: IncidentAct
      notified: IncidentAct
      /** The CQC's own reference for the notification. */
      reference: string
    }

/**
 * A part of the body an injury was marked on.
 *
 * Closed, and the list is the record. `sacrum` and the heels are here because
 * they are the pressure-ulcer sites, and a body map that cannot mark them
 * cannot record the injury the home is most often judged on.
 *
 * **No `view` field.** It was here and it was wrong twice over: which view a
 * region is drawn on is presentation rather than data, and an upper arm is
 * markable from the front *and* the back while being one site — recording it
 * as belonging to one view would have made the same arm two regions. The
 * geometry in `src/assets/body-map/` owns where each is drawn.
 */
export const BODY_REGIONS = [
  { id: 'head', name: 'Head' },
  { id: 'face', name: 'Face' },
  { id: 'neck', name: 'Neck' },
  { id: 'shoulder_left', name: 'Left shoulder' },
  { id: 'shoulder_right', name: 'Right shoulder' },
  { id: 'upper_arm_left', name: 'Left upper arm' },
  { id: 'upper_arm_right', name: 'Right upper arm' },
  { id: 'elbow_left', name: 'Left elbow' },
  { id: 'elbow_right', name: 'Right elbow' },
  { id: 'forearm_left', name: 'Left forearm' },
  { id: 'forearm_right', name: 'Right forearm' },
  { id: 'hand_left', name: 'Left hand' },
  { id: 'hand_right', name: 'Right hand' },
  { id: 'chest', name: 'Chest' },
  { id: 'abdomen', name: 'Abdomen' },
  { id: 'back_upper', name: 'Upper back' },
  { id: 'back_lower', name: 'Lower back' },
  { id: 'hip_left', name: 'Left hip' },
  { id: 'hip_right', name: 'Right hip' },
  { id: 'buttock_left', name: 'Left buttock' },
  { id: 'buttock_right', name: 'Right buttock' },
  { id: 'sacrum', name: 'Sacrum' },
  { id: 'thigh_left', name: 'Left thigh' },
  { id: 'thigh_right', name: 'Right thigh' },
  { id: 'knee_left', name: 'Left knee' },
  { id: 'knee_right', name: 'Right knee' },
  { id: 'shin_left', name: 'Left shin' },
  { id: 'shin_right', name: 'Right shin' },
  { id: 'calf_left', name: 'Left calf' },
  { id: 'calf_right', name: 'Right calf' },
  { id: 'ankle_left', name: 'Left ankle' },
  { id: 'ankle_right', name: 'Right ankle' },
  { id: 'heel_left', name: 'Left heel' },
  { id: 'heel_right', name: 'Right heel' },
  { id: 'foot_left', name: 'Left foot' },
  { id: 'foot_right', name: 'Right foot' },
] as const

export type BodyRegionId = (typeof BODY_REGIONS)[number]['id']

/**
 * Where injuries were marked, or the fact that none were.
 *
 * Three states, not an array. An empty array cannot say the difference between
 * "the reporter looked and there were no injuries" and "nobody recorded any" —
 * which is the Evidence Invariant in its original form, applied to a body map.
 *
 * `marked` is non-empty by construction: `marked` with nothing in it is a lie.
 */
export type InjuryMap =
  | { kind: 'not_recorded' }
  | { kind: 'no_injuries_found'; recorded: IncidentAct }
  | {
      kind: 'marked'
      regions: [BodyRegionId, ...BodyRegionId[]]
      recorded: IncidentAct
    }

/**
 * Where in the home it happened.
 *
 * A resident's own room is named by its number rather than by the resident,
 * because an incident in room 14 that happened to somebody else is a fact the
 * record has to be able to hold.
 */
export const COMMUNAL_AREAS = [
  { id: 'lounge', name: 'Lounge' },
  { id: 'dining_room', name: 'Dining room' },
  { id: 'corridor', name: 'Corridor' },
  { id: 'bathroom', name: 'Shared bathroom' },
  { id: 'stairs', name: 'Stairs' },
  { id: 'garden', name: 'Garden' },
  { id: 'clinic_room', name: 'Clinic room' },
  { id: 'reception', name: 'Reception' },
  { id: 'off_site', name: 'Off site' },
] as const

export type CommunalAreaId = (typeof COMMUNAL_AREAS)[number]['id']

export type IncidentLocation =
  | { kind: 'not_recorded' }
  | { kind: 'resident_room'; room: string }
  | { kind: 'communal'; area: CommunalAreaId }

/**
 * Who saw it, or the recorded fact that nobody did.
 *
 * **No unrecorded member, and the form asks.** The reference's own hint said
 * "leave blank if nobody saw it", which would have made a blank mean either
 * "nobody saw it" or "nobody recorded who saw it" — the defect the product
 * exists to prevent, in the field where it decides whether an unwitnessed fall
 * was actually unwitnessed.
 *
 * Same shape as `no_resident_involved`: a claim somebody made, carrying their
 * name.
 */
export type WitnessRecord =
  | { kind: 'nobody_witnessed'; recordedBy: StaffRef }
  | { kind: 'witnessed'; people: [string, ...string[]]; recordedBy: StaffRef }

/**
 * Whether somebody outside the home was told, for the GP and for the family.
 *
 * **`not_yet` and `not_required` are different facts.** One is unfinished and
 * renders unsettled; the other is a decision somebody took and renders settled
 * with its reason and their name. Collapsing them would let an unmade call
 * look like a considered one.
 *
 * There is deliberately no "family asked not to be contacted" member: that is
 * a standing communication preference and already lives on `ImportantPeople`.
 * At report time it is `not_required` with that as the reason, which points at
 * the existing record instead of duplicating it — and a duplicate of a
 * preference is a preference that can go out of date in one place.
 */
export type ContactState =
  | { kind: 'not_yet' }
  | {
      kind: 'not_required'
      reason: string
      recordedBy: StaffRef
      recordedAt: IsoDateTime
    }
  | { kind: 'contacted'; at: IsoDateTime; by: StaffRef; outcome: string }

/**
 * Whether emergency services were called.
 *
 * Two members, not three: **calling is instantaneous, so there is no "not
 * yet".** Either somebody dialled or they did not, and a pending state would
 * be a decision that cannot exist.
 */
export type EmergencyServicesRecord =
  | { kind: 'not_called' }
  | {
      kind: 'called'
      service: 'ambulance_999' | 'nhs_111'
      at: IsoDateTime
      by: StaffRef
      outcome: string
    }

/**
 * What the reporter did in the minutes after.
 *
 * **Not `ManagerReview.actionsTaken`.** The reporter's account written at the
 * time and the manager's written later are two records by two people, and
 * merging them attributes one to the other. `immediateAction` is required and
 * non-empty — the form gates on it, so there is no blank to interpret.
 */
export interface ImmediateResponse {
  immediateAction: string
  witnesses: WitnessRecord
  gp: ContactState
  family: ContactState
  emergencyServices: EmergencyServicesRecord
}

/**
 * What the manager concluded. PRD §6.5.
 *
 * Each field is `Recorded<string>` rather than a plain one, because **a closed
 * incident with no root cause recorded is a real state in a real home** and
 * the screen has to be able to show it as the gap it is. Making these
 * mandatory at the type level would force the fixtures to invent a root cause
 * for every incident, which would hide the thing the review screen exists to
 * surface.
 */
export interface ManagerReview {
  rootCause: Recorded<string>
  actionsTaken: Recorded<string>
  preventiveMeasures: Recorded<string>
}

/**
 * What closing an incident obliges somebody to re-check, within 48 hours.
 *
 * **The flag lives on the incident, not on the record it points at.** A
 * resident who falls and has never had a falls risk assessment is the case
 * that matters most, and `RiskStatus`'s `not_assessed` has nowhere to hang
 * anything. The event owns its consequence.
 */
export type PostIncidentReviewTarget =
  | { kind: 'risk_assessment'; templateId: RiskTemplateId }
  | { kind: 'care_plan_domain'; domainId: CarePlanDomainId }

/**
 * Overdue is **derived** from `dueBy` against now, never stored.
 *
 * A stored "overdue" is a figure that was true when it was written and is
 * wrong the next morning. `ReviewState` stores `daysOverdue` and gets away
 * with it because its fixtures are regenerated against `NOW`; a flag raised
 * during a session would not be.
 */
export interface PostIncidentReviewFlag {
  target: PostIncidentReviewTarget
  raised: IncidentAct
  /** 48 hours after it was raised. PRD §6.5. */
  dueBy: IsoDateTime
  state: { kind: 'awaiting' } | { kind: 'completed'; completed: IncidentAct }
}

/**
 * A link back to the record that caused this incident.
 *
 * A stock discrepancy is raised by a controlled drug count, and the incident
 * has to say which one — otherwise the register shows a discrepancy and the
 * log shows an incident and nothing joins them.
 */
export type IncidentOrigin =
  | { kind: 'reported' }
  | {
      kind: 'stock_count'
      medicationId: `med-${string}`
      countedAt: IsoDateTime
      expected: number
      counted: number
      countedBy: StaffRef
      witnessedBy: StaffRef
    }

/**
 * Who an incident happened to, or the recorded fact that it happened to
 * nobody.
 *
 * **`no_resident_involved` is a positive claim, not an absence**, and that is
 * why there is no unrecorded member here: somebody looked at a faulty hoist
 * found during a check, or a trolley noticed before anybody reached it, and
 * recorded that no resident was involved. It is the same shape as "no
 * consultants involved" on a best-interest decision.
 *
 * So the form must ask and cannot be left blank — and the wrong-subject rule
 * gets stronger rather than weaker (§2.4). An incident with a resident names
 * them everywhere; one without says plainly that nobody was involved, rather
 * than leaving a reader to infer it from an empty field.
 *
 * Attaching an equipment failure to whichever resident happened to be nearby
 * would be a worse record than attaching it to nobody.
 */
export type IncidentSubject =
  | { kind: 'resident'; residentId: ResidentId }
  | { kind: 'no_resident_involved'; recordedBy: StaffRef }

/**
 * A photograph or a video somebody attached when they reported it.
 *
 * **Live for this session and nowhere else, and the screen says so where the
 * evidence is.** There is no backend here, so the file sits on an object URL
 * that dies with the tab. Every write in this build is the same, and the one
 * thing this must not do is imply otherwise: a reader who believes a
 * photograph of a bruise is filed somewhere will not take another one. It is
 * said as a statement of fact beside the list, not as a caution — the 19/09
 * sweep took those out.
 *
 * **This is the first file control in the build that is real.** A disabled
 * "Choose a file" and a line explaining that nothing is stored were removed
 * from `UploadDocumentRoute` in that sweep, because a control that does
 * nothing is not drawn here. An object URL is a live capability: the thumbnail
 * renders and the reader sees what they attached.
 *
 * **An empty list is not a gap and never takes the hatch** (§1). "No
 * photographs attached" is not "nobody looked at whether there were
 * photographs" — it is an incident with nothing to attach, which is most of
 * them. Hatching it would put the hatch on nearly every incident in the
 * product and make it texture, which is the one thing §1 forbids by name.
 *
 * Stamped like every other act on this type. A photograph with no name against
 * it is a photograph nobody can ask about.
 */
export interface IncidentEvidence {
  id: string
  kind: 'photo' | 'video'
  /** As the file was named on the device it came off. */
  fileName: string
  /** Bytes, so the screen can say how big a thing it is holding. */
  size: number
  /** An object URL. Alive for this session only. */
  url: string
  attached: IncidentAct
}

/**
 * Whether anybody has said this one needs attention now.
 *
 * **Not a duplicate of the unacknowledged queue.** Every incident already
 * starts `reported_not_acknowledged` and already leads the log, so a plain
 * "tell the manager" toggle would restate a signal the product already sends —
 * and this build has a rule against exactly that: no screen may claim a
 * notification was sent (§6). What is missing is *urgency*: somebody saying
 * this one is not like the other nine waiting, with a reason attached.
 *
 * **The reason is required, not optional beside the member.** "Needs attention
 * now" with nothing behind it tells somebody to hurry and not what about, and
 * this build already refuses that shape — a flagged care note needs its reason,
 * an urgent handover needs words before it can be recorded.
 *
 * **`ordinary` is a recorded negative, which is only true because the form
 * asks.** §1 is explicit that a recorded negative is not an unrecorded value:
 * it looks settled, not unfinished. So urgency is a question with two answers
 * and never a checkbox somebody can walk past — an unticked box would be a
 * default nobody chose, which is the fallback §1 names as the bug this product
 * exists to prevent. That is also why there is no unrecorded member: the
 * fixtures are a depiction rather than a migration, so there is no record here
 * that predates the question, and a member only a fixture could hold is a state
 * the product cannot reach.
 *
 * **`stood_down` answers a raise rather than deleting it.** Going back to
 * `ordinary` would have erased the fact that somebody raised this and what they
 * said, leaving the record unable to tell "nobody thought this urgent" from
 * "somebody did and was overruled". So the member keeps `raised` and `because`
 * in full and adds the second judgement beside them: Amara raised this because
 * X, Chidi stood it down because Y. `ordinary` therefore still means exactly
 * what it meant before — nobody raised it — and no record already on file
 * changes meaning.
 *
 * **Neither of these roles stands one down, and the member ships anyway.**
 * Reviewing somebody else's clinical judgement is a manager's act, like
 * closing, so no control for it is drawn — the state renders in full and the
 * screen says who does take it, through `mayNot`. The member exists so the
 * record can say what happened, which is not the same question as who can do
 * it here.
 *
 * **It is a decision, not a gap**, so it renders quietly and in full and never
 * takes the hatch (§1). A stood-down incident is a complete record.
 *
 * **`worded` is a second act, and it is the member easiest to drop.** With one
 * act, rewording had to choose between recording who first raised the alarm and
 * who stands behind the words on screen now. It also reset the only timestamp
 * there was, so an urgency raised six hours ago and reworded a minute ago read
 * as a minute old — the screen understating how long something urgent had been
 * sitting. On a first raise the two are the same act, and the screen says it
 * once rather than twice.
 */
export type IncidentUrgency =
  | { kind: 'ordinary' }
  | {
      kind: 'needs_attention_now'
      raised: IncidentAct
      because: string
      /** Who wrote the wording that is there now. Equals `raised` at first. */
      worded: IncidentAct
    }
  | {
      kind: 'stood_down'
      /** Kept in full. Standing down answers a judgement, it does not erase one. */
      raised: IncidentAct
      because: string
      stoodDown: IncidentAct
      why: string
    }

export interface Incident {
  id: IncidentId
  siteId: SiteId
  subject: IncidentSubject

  type: IncidentTypeId
  severity: IncidentSeverityId
  occurredAt: IsoDateTime
  location: IncidentLocation

  /** What happened, in the reporter's words. */
  description: string
  reported: IncidentAct

  /** What the reporter did and who they told, at the time. */
  response: ImmediateResponse

  /** Photographs and video attached to the report. Empty is not a gap. */
  evidence: IncidentEvidence[]
  /** Whether anybody said this one cannot wait its turn. */
  urgency: IncidentUrgency

  status: IncidentStatus
  injuries: InjuryMap
  review: ManagerReview
  notification: NotificationDecision

  /** Empty until the incident is closed. */
  reviewFlags: PostIncidentReviewFlag[]
  origin: IncidentOrigin
}

/** A day's worth of incidents, for the log's date filter. */
export type IncidentDate = IsoDate

/** The resident an incident is about, where it is about one. */
export function subjectResidentId(incident: Incident): ResidentId | 'none' {
  return incident.subject.kind === 'resident' ? incident.subject.residentId : 'none'
}
