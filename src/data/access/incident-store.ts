import { held, type SessionHolding } from './session-holding'
import { now as appNow } from '@/data/fixtures/clock'
import type {
  Incident,
  IncidentAct,
  IncidentEvidence,
  IncidentId,
  IncidentStatus,
  IncidentUrgency,
  IsoDateTime,
  ManagerReview,
  StaffRef,
} from '../types'

/**
 * Acknowledging an incident, and what the manager concluded. Phase 20.
 *
 * **The reporter's record and the manager's are two records by two people, and
 * this store never touches the first.** `ImmediateResponse.immediateAction` is
 * what the person who was there wrote at the time; `ManagerReview.actionsTaken`
 * is what somebody concluded later. The type has said so since Phase 4 and a
 * write path is where that quietly stops being true — one patch that spreads
 * over the whole incident, one helper that "fills in" a blank from the other
 * field, and the record now attributes one person's account to another.
 *
 * So the patch is typed field by field, and `response` is not one of them.
 * There is no way to reach it from here, which is stronger than remembering
 * not to. Evidence and urgency were added to the patch in Phase 21 and do not
 * weaken that: both are records *beside* the reporter's account, never edits
 * to it — a photograph attached an hour later and a judgement about how
 * urgent it is are two new facts with their own names and timestamps.
 *
 * **Everything is in memory and nothing is merged into the fixtures.** The
 * overlay is applied at read time, the same shape `resident-store` uses.
 */

interface Edit {
  status?: IncidentStatus
  review?: Partial<ManagerReview>
  evidence?: IncidentEvidence[]
  urgency?: IncidentUrgency
}

const edits = new Map<IncidentId, Edit>()
/**
 * Incidents reported in this session, newest first.
 *
 * **Held whole, not as a patch.** An edit is a change to a record the fixtures
 * hold; a report is a record that did not exist a minute ago, and there is
 * nothing underneath it to merge with. They are read together by
 * `patchedIncidents`, so a screen cannot see one and not the other.
 *
 * They go on the same overlay as everything else, which means **a reported
 * incident does not survive a sign-out**, and the sign-out list says so.
 */
const reported: Incident[] = []
let acknowledged = 0
let reviewed = 0
let closed = 0
let attached = 0
let urgencyRaised = 0

/**
 * Every object URL this store has minted.
 *
 * **Kept as a ledger rather than walked out of the records**, because freeing
 * them is the one thing that must still work when the records are gone: sign
 * out clears the overlay, and a URL whose record has been dropped is a handle
 * nothing can reach and nothing will release. The browser holds the file
 * alive until it is revoked.
 */
const objectUrls: string[] = []

const act = (by: StaffRef): IncidentAct => ({
  by,
  at: appNow().toISOString() as IsoDateTime,
})

/** The incident as it stands, fixtures plus whatever this session wrote. */
export function withIncidentEdits(incident: Incident): Incident {
  const edit = edits.get(incident.id)
  if (edit === undefined) return incident
  return {
    ...incident,
    status: edit.status ?? incident.status,
    review: { ...incident.review, ...edit.review },
    evidence: edit.evidence ?? incident.evidence,
    urgency: edit.urgency ?? incident.urgency,
  }
}

export const editedThisSession = (id: IncidentId): boolean => edits.has(id)

/** What this session reported, newest first. Never merged into the fixtures. */
export function reportedThisSession(): Incident[] {
  return [...reported]
}

export const reportedIn = (id: IncidentId): boolean =>
  reported.some((incident) => incident.id === id)

/**
 * Keeps a newly reported incident for the session.
 *
 * The id is drawn from a counter that starts above anything in the fixtures, so
 * a session's report can never collide with a record somebody else wrote.
 */
export function keepReportedIncident(incident: Omit<Incident, 'id'>): Incident {
  const id = `inc-session-${String(reported.length + 1).padStart(3, '0')}` as IncidentId
  const kept: Incident = { ...incident, id }
  reported.unshift(kept)
  return kept
}

function patch(id: IncidentId, next: Edit): void {
  edits.set(id, { ...edits.get(id), ...next })
}

/**
 * The record as this store has it, for a write that builds on what it wrote.
 *
 * **Both writes below would otherwise read the caller's copy and lose their own
 * last answer.** Attaching a second photograph read `evidence` off the incident
 * it was handed, which a screen may well have taken from the fixtures, so the
 * new list was "the fixture's empty list plus one" and the first photograph
 * vanished. Rewording an urgency is the same shape and worse: it would have
 * found `ordinary` there, treated a reword as a first raise, and re-stamped
 * `raised` — destroying the original raise, which is the one thing `worded`
 * exists to protect. Caught by a test attaching twice; the urgency half had no
 * symptom to notice because every caller happened to pass the patched record
 * back in.
 *
 * So a write asks this store what it holds rather than trusting its argument.
 * `withIncidentEdits` is already that answer and already the screens' reader,
 * which keeps one overlay with one owner.
 */
const current = (incident: Incident): Incident => withIncidentEdits(incident)

/**
 * Somebody has picked this up.
 *
 * **It cannot be un-acknowledged**, which is why it is its own act rather than
 * a field somebody sets. A name against an incident is a person saying they
 * have it; taking that back is not an edit, it is a second fact, and this
 * build has no shape for one because no home has ever needed it.
 */
export function acknowledge(incident: Incident, by: StaffRef): IncidentStatus {
  if (incident.status.kind !== 'reported_not_acknowledged')
    throw new Error(
      `${incident.id} was acknowledged by ${incident.status.acknowledged.by.fullName}.`,
    )
  const status: IncidentStatus = { kind: 'open', acknowledged: act(by) }
  patch(incident.id, { status })
  acknowledged += 1
  return status
}

/** What the manager concluded, field by field, never as one form. */
export function recordReview(
  incident: Incident,
  fields: Partial<ManagerReview>,
  by: StaffRef,
): void {
  if (incident.status.kind === 'reported_not_acknowledged')
    throw new Error(`${incident.id} has not been acknowledged.`)
  patch(incident.id, {
    review: fields,
    status:
      incident.status.kind === 'open'
        ? {
            kind: 'under_review',
            acknowledged: incident.status.acknowledged,
            reviewStarted: act(by),
          }
        : undefined,
  })
  reviewed += 1
}

/**
 * Closing it, which two things have to be true for.
 *
 * **A decision about the CQC, and a root cause.** The first was already the
 * rule and the screen already said it: a decision either way is required, and
 * "not required" is a recorded judgement with a name on it. The second is this
 * phase's, and it is the same argument — an incident closed with no root cause
 * recorded is a home saying it is finished with something it never explained.
 *
 * Both are checked here rather than only on the screen, because a rule that
 * lives in a form is a rule the next form forgets.
 */
export function close(
  incident: Incident,
  by: StaffRef,
  notificationDecided: boolean,
): IncidentStatus {
  if (incident.status.kind !== 'under_review')
    throw new Error(
      `${incident.id} is ${incident.status.kind}. Closing runs through a review: the order is what the status union holds.`,
    )
  if (!notificationDecided)
    throw new Error(
      `Nobody has recorded whether ${incident.id} must be notified to the CQC, and it cannot close without a decision.`,
    )
  if (incident.review.rootCause.kind !== 'recorded')
    throw new Error(`${incident.id} has no root cause recorded.`)

  const status: IncidentStatus = {
    kind: 'closed',
    acknowledged: incident.status.acknowledged,
    reviewStarted: incident.status.reviewStarted,
    closed: act(by),
  }
  patch(incident.id, { status })
  closed += 1
  return status
}

/**
 * A photograph or a video, attached to a report.
 *
 * **The object URL is minted here and freed here.** The component that chose
 * the file does not hold it: creation and revocation are one fact with one
 * owner, and splitting them is how a file ends up alive with nothing pointing
 * at it. `resetSessionIncidents` is the other half and runs on sign-out.
 *
 * **It refuses anything that is not a photograph or a video**, rather than
 * filing it under the nearer of the two. The type has exactly two kinds
 * because a reader looking at an incident wants to know which they are about
 * to open; a spreadsheet recorded as a photo is a record that lies about
 * itself. The screen says what it takes, and this says so again, because a
 * rule that lives in a form is a rule the next form forgets.
 */
export function attachEvidence(
  incident: Incident,
  file: File,
  by: StaffRef,
): IncidentEvidence {
  const kind = file.type.startsWith('image/')
    ? 'photo'
    : file.type.startsWith('video/')
      ? 'video'
      : undefined
  if (kind === undefined)
    throw new Error(
      `${file.name} is a ${file.type || 'file of no stated type'}. Evidence on an incident is a photograph or a video.`,
    )

  const url = URL.createObjectURL(file)
  objectUrls.push(url)
  const entry: IncidentEvidence = {
    id: `evi-${incident.id}-${String(attached + 1).padStart(3, '0')}`,
    kind,
    fileName: file.name,
    size: file.size,
    url,
    attached: act(by),
  }
  patch(incident.id, { evidence: [...current(incident).evidence, entry] })
  attached += 1
  return entry
}

/**
 * Saying an incident needs attention now.
 *
 * **Raising and rewording are the same call and different records.** A first
 * raise stamps `raised` and `worded` with the same act. A reword keeps
 * `raised` exactly as it was and moves `worded` only, which is why the union
 * carries two: with one act, rewording had to choose between recording who
 * first raised the alarm and who stands behind the words on screen now, and it
 * reset the only timestamp there was — an urgency raised six hours ago and
 * reworded a minute ago read as a minute old, the screen understating how long
 * something urgent had been sitting.
 *
 * **It will not re-raise something already stood down.** The union holds one
 * raise and one stand-down, not a chain, so raising again would overwrite the
 * stand-down and erase a judgement somebody recorded — which is the thing the
 * member exists to prevent. Refused here rather than in the screen.
 *
 * **There is no stand-down here on purpose.** Overruling somebody else's
 * judgement is a manager's act, like closing, and neither role this build signs
 * in can take it. The screen says who does, through `mayNot`. A store function
 * nothing may call would be a control in waiting.
 */
export function raiseUrgency(incident: Incident, because: string, by: StaffRef): void {
  if (because.trim() === '')
    throw new Error('Saying an incident needs attention now means saying why.')

  const urgency = current(incident).urgency
  if (urgency.kind === 'stood_down')
    throw new Error(
      `${incident.id} was stood down by ${urgency.stoodDown.by.fullName}, and raising it again would erase who stood it down and why.`,
    )

  const stamp = act(by)
  patch(incident.id, {
    urgency: {
      kind: 'needs_attention_now',
      // The original raise survives a reword. Only the wording is re-stamped.
      raised: urgency.kind === 'needs_attention_now' ? urgency.raised : stamp,
      because: because.trim(),
      worded: stamp,
    },
  })
  urgencyRaised += 1
}

export function incidentHoldings(): SessionHolding[] {
  return [
    ...held('incidents you acknowledged', acknowledged),
    ...held('review findings you recorded', reviewed),
    ...held('incidents you closed', closed),
    ...held('incidents you reported', reported.length),
    ...held('photographs and video you attached', attached),

    ...held('incidents you marked as needing attention now', urgencyRaised),
  ]
}

/**
 * Emptied on sign out, and by tests.
 *
 * **The object URLs are revoked, not merely dropped.** Clearing the overlay
 * removes the records that pointed at them; the browser goes on holding each
 * file until something calls `revokeObjectURL`, so forgetting here is a leak
 * that lasts as long as the tab. No guard can see this — `check-session-losses`
 * reads whether the holdings are declared, not whether memory was handed back —
 * so it is review's to check, and this comment is where it is written down.
 */
export function resetSessionIncidents(): void {
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.length = 0
  edits.clear()
  reported.length = 0
  acknowledged = 0
  reviewed = 0
  closed = 0
  attached = 0
  urgencyRaised = 0
}
