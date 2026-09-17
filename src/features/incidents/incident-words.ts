import type {
  Incident,
  IncidentSeverityId,
  IncidentStatus,
  IncidentTypeId,
  InjuryMap,
  NotificationDecision,
} from '@/data/types'
import {
  BODY_REGIONS,
  COMMUNAL_AREAS,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
} from '@/data/types'
import type { StatusTone } from '@/components/status'
import { assertNever } from '@/lib/assert-never'

/**
 * What an incident is called, wherever it is named. CW PRD INC-01 to INC-03.
 *
 * **One owner for every word on this module's screens**, so the list, the form
 * and the confirmation cannot disagree about what a record says.
 */

export const typeName = (id: IncidentTypeId): string =>
  INCIDENT_TYPES.find((entry) => entry.id === id)?.name ?? id

/** "the witnessed fall of 23/08", never "the fall — witnessed of 23/08". */
export const typePhrase = (id: IncidentTypeId): string =>
  INCIDENT_TYPES.find((entry) => entry.id === id)?.phrase ?? 'incident'

export const severityName = (id: IncidentSeverityId): string =>
  INCIDENT_SEVERITIES.find((entry) => entry.id === id)?.name ?? id

export const regionName = (id: string): string =>
  BODY_REGIONS.find((entry) => entry.id === id)?.name ?? id

const HARM_GLOSS_SOURCE = {
  no_harm: 'nothing came of it',
  low_harm: 'minor treatment, no lasting effect',
  moderate_harm: 'treatment needed, recovery expected',
  severe_harm: 'permanent or long-term effect',
} as const satisfies Record<IncidentSeverityId, string>

/**
 * Keyed by severity rather than listed, so a tier with no gloss is a compile
 * error rather than a tier that renders without its words.
 */
export const HARM_GLOSS: Record<IncidentSeverityId, string> = HARM_GLOSS_SOURCE

/**
 * The harm scale, with the words INC-03 gives each tier.
 *
 * **Four tiers and no fifth.** INC-01's badge text says "HIGH HARM", which is
 * not one of them; one harm vocabulary throughout is already recorded in
 * `docs/DEPARTURES.md` under Rulings on the PRD, and this is the only list of
 * them on these screens.
 *
 * Declared after the gloss it reads, not before: a const that runs at module
 * load and reaches forward to another gets a blank screen and a reference
 * error, and the typechecker does not say so.
 */
export const HARM_SCALE: { id: IncidentSeverityId; name: string; gloss: string }[] =
  INCIDENT_SEVERITIES.map((entry) => ({
    id: entry.id,
    name: entry.name,
    gloss: HARM_GLOSS[entry.id],
  }))

/**
 * The tone each harm tier is drawn in.
 *
 * **Colour reinforces, never carries**: every pill has the tier's name inside
 * it. `no_harm` is positive because it is a recorded finding that nothing came
 * of it, not an empty state.
 */
export const SEVERITY_TONE: Record<IncidentSeverityId, StatusTone> = {
  no_harm: 'positive',
  low_harm: 'info',
  moderate_harm: 'caution',
  severe_harm: 'critical',
}

/** Where it happened. Never blank: a place nobody recorded says so. */
export function placeOf(incident: Incident): string {
  const { location } = incident
  switch (location.kind) {
    case 'not_recorded':
      return 'place not recorded'
    case 'resident_room':
      return `Room ${location.room}`
    case 'communal':
      return (
        COMMUNAL_AREAS.find((entry) => entry.id === location.area)?.name ??
        location.area
      )
    default:
      return assertNever(location)
  }
}

/** Where the incident has got to in the home's own process. */
export function statusWords(status: IncidentStatus): string {
  switch (status.kind) {
    case 'reported_not_acknowledged':
      return 'Not acknowledged'
    case 'open':
      return 'Open'
    case 'under_review':
      return 'Under review'
    case 'closed':
      return 'Closed'
    default:
      return assertNever(status)
  }
}

/**
 * What the CQC decision says, in the row's own words.
 *
 * Four states and they are four different facts: nobody has decided, somebody
 * decided it is not notifiable, somebody decided it is and has not sent it, and
 * it has been sent with a reference.
 */
export function notificationWords(decision: NotificationDecision): string {
  switch (decision.kind) {
    case 'not_yet_decided':
      return 'Notification decision not recorded'
    case 'not_required':
      return 'Notification not required'
    case 'required_not_yet_notified':
      return 'Notification required, not yet sent'
    case 'notified':
      return 'Notified'
    default:
      return assertNever(decision)
  }
}

/**
 * What the injury record says.
 *
 * **"Not checked yet" and "Checked: no injury found" are not the same state**
 * (INC-03). One is unfinished and wears the unrecorded treatment; the other is
 * a complete record and looks settled.
 */
export function injuryWords(injuries: InjuryMap): string {
  switch (injuries.kind) {
    case 'not_recorded':
      return 'Not checked yet'
    case 'no_injuries_found':
      return 'Checked: no injury found'
    case 'marked':
      return `Checked: ${injuries.regions.length === 1 ? 'one injury' : `${injuries.regions.length} injuries`} found`
    default:
      return assertNever(injuries)
  }
}
