import type { ReactNode } from 'react'
import type { Incident, IsoDateTime, Resident } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import {
  SEVERITY_TONE,
  injuryWords,
  notificationWords,
  placeOf,
  regionName,
  severityName,
  statusWords,
  typeName,
} from './incident-words'
import styles from './incidents.module.css'

/**
 * One incident on the list. CW PRD INC-01.
 *
 * **The row is the record.** INC-01 gives each row an "Open >" link and the CW
 * PRD specifies no screen for a single incident, so there is nowhere to open
 * to: the row carries what the record holds, the reporter's own words
 * included. A log that shows a severity and hides what happened cannot make
 * anybody aware of anything, and a link to a screen that does not exist is the
 * grey-link problem with a chevron on it.
 *
 * **Every state is drawn, and the gaps are drawn as gaps**: an incident nobody
 * has acknowledged is hatched with how long it has waited, a notification
 * decision nobody has recorded is hatched, and "Not checked yet" is hatched
 * while "Checked: no injury found" is settled.
 */
export function IncidentRow({
  incident,
  resident,
  at,
  act,
}: {
  incident: Incident
  resident: Resident | undefined
  at: IsoDateTime
  /** The one act this row carries, where the role table allows it. */
  act?: ReactNode
}) {
  const format = useSiteFormat()

  return (
    <li
      className={styles.row}
      data-incident={incident.id}
      data-status={incident.status.kind}
    >
      <div className={styles.rowWho}>
        {resident === undefined ? (
          <>
            {/* Never an empty column: where nobody was involved, that is the
                content, with who recorded it. A claim, not a blank. */}
            <p className={styles.rowName}>No resident was involved</p>
            <p className={styles.rowMeta}>
              {incident.subject.kind === 'no_resident_involved'
                ? `recorded by ${incident.subject.recordedBy.displayName}`
                : 'the resident this happened to is not at this home'}
            </p>
          </>
        ) : (
          <>
            <p className={styles.rowName}>{resident.preferredName}</p>
            <p className={styles.rowMeta}>
              {resident.fullLegalName}
              {resident.room.kind === 'recorded'
                ? ` · Room ${resident.room.value}`
                : ' · Room not recorded'}
            </p>
          </>
        )}
      </div>

      <div className={styles.rowMain}>
        <p className={styles.rowWhat}>
          {typeName(incident.type)}
          <span className={styles.rowMeta}>
            {' · '}
            <span data-numeric>{format.dateTime(incident.occurredAt)}</span> ·{' '}
            {placeOf(incident)} · reported by {incident.reported.by.displayName}
          </span>
        </p>

        <div className={styles.rowFacts}>
          <StatusPill
            tone={SEVERITY_TONE[incident.severity]}
            label={severityName(incident.severity)}
          />
          <StateFact incident={incident} at={at} />
          <NotificationFact incident={incident} />
          <InjuryFact incident={incident} />
        </div>

        {/* The reporter's own words, because there is nowhere else to read
            them. INC-02: "Written for whoever reads this next." */}
        <p className={styles.rowWords}>{incident.description}</p>
      </div>

      {act === undefined ? null : <div className={styles.rowAct}>{act}</div>}
    </li>
  )
}

/** Where the incident has got to, and how long it has waited if nobody has it. */
function StateFact({ incident, at }: { incident: Incident; at: IsoDateTime }) {
  const format = useSiteFormat()
  const { status } = incident

  switch (status.kind) {
    case 'reported_not_acknowledged': {
      const hours =
        (new Date(at).getTime() - new Date(incident.reported.at).getTime()) / 3_600_000
      return (
        <Unrecorded
          variant="chip"
          label={`Not acknowledged — waiting ${
            hours < 48
              ? pluralise(Math.max(1, Math.floor(hours)), 'hour')
              : pluralise(Math.floor(hours / 24), 'day')
          }`}
        />
      )
    }
    case 'open':
      return (
        <Settled
          label={statusWords(status)}
          detail={format.attribution(
            status.acknowledged.by.displayName,
            status.acknowledged.at,
          )}
        />
      )
    case 'under_review':
      return (
        <Settled
          label={statusWords(status)}
          detail={format.attribution(
            status.reviewStarted.by.displayName,
            status.reviewStarted.at,
          )}
        />
      )
    case 'closed':
      return (
        <Settled
          label={statusWords(status)}
          detail={format.attribution(status.closed.by.displayName, status.closed.at)}
        />
      )
    default:
      return assertNever(status)
  }
}

/** Whether the CQC has to be told, and whether it has been. */
function NotificationFact({ incident }: { incident: Incident }) {
  const format = useSiteFormat()
  const decision = incident.notification

  switch (decision.kind) {
    case 'not_yet_decided':
      return <Unrecorded variant="chip" label={notificationWords(decision)} />
    case 'not_required':
      return (
        <Settled
          label={notificationWords(decision)}
          detail={`${decision.reason} · ${format.attribution(
            decision.decided.by.displayName,
            decision.decided.at,
          )}`}
        />
      )
    case 'required_not_yet_notified':
      return (
        <div className={styles.rowCompound}>
          <StatusPill
            tone="critical"
            label="Notification required"
            detail={format.attribution(
              decision.decided.by.displayName,
              decision.decided.at,
            )}
          />
          <Unrecorded variant="chip" label="Not yet sent to the CQC" />
        </div>
      )
    case 'notified':
      return (
        <Settled
          label={notificationWords(decision)}
          detail={`${decision.reference} · ${format.attribution(
            decision.notified.by.displayName,
            decision.notified.at,
          )}`}
        />
      )
    default:
      return assertNever(decision)
  }
}

/**
 * The injury record. INC-03's three states, kept apart.
 *
 * "Not checked yet" is a gap and wears the hatch; "Checked: no injury found" is
 * a complete record and looks settled; injuries found name their sites, because
 * a count with no sites cannot be acted on.
 */
function InjuryFact({ incident }: { incident: Incident }) {
  const format = useSiteFormat()
  const { injuries } = incident

  switch (injuries.kind) {
    case 'not_recorded':
      return (
        <Unrecorded
          variant="chip"
          label={injuryWords(injuries)}
          detail="nobody has examined them"
        />
      )
    case 'no_injuries_found':
      return (
        <Settled
          label={injuryWords(injuries)}
          detail={format.attribution(
            injuries.recorded.by.displayName,
            injuries.recorded.at,
          )}
        />
      )
    case 'marked':
      return (
        <Settled
          label={injuryWords(injuries)}
          detail={`${injuries.regions.map(regionName).join(', ')} · ${format.attribution(
            injuries.recorded.by.displayName,
            injuries.recorded.at,
          )}`}
        />
      )
    default:
      return assertNever(injuries)
  }
}
