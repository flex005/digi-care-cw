import { useState, type ReactNode } from 'react'
import type { Incident, IncidentEvidence, IsoDateTime, Resident } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
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
            <p className={styles.rowName}>No {VOCABULARY.subject.one} was involved</p>
            <p className={styles.rowMeta}>
              {incident.subject.kind === 'no_resident_involved'
                ? `recorded by ${incident.subject.recordedBy.displayName}`
                : `the ${VOCABULARY.subject.one} this happened to is not at this home`}
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
          <UrgencyFact incident={incident} />
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

        <EvidenceStrip incident={incident} />
      </div>

      {act === undefined ? null : <div className={styles.rowAct}>{act}</div>}
    </li>
  )
}

/**
 * Whether anybody said this one cannot wait, and how it was answered.
 *
 * **An ordinary incident draws nothing**, because nothing is what it is. A
 * line reading "not urgent" on thirty-eight rows would make the two that are
 * harder to find, not easier, and §6 is explicit that nothing due and nothing
 * to show are plain words rather than a state.
 *
 * **A raise takes the caution ink and tint and never the fill**, which is the
 * one treatment `check-caution-carriers` allows outside `Toast` and which puts
 * the words inside the colour. Never a RAG colour: urgency is not harm, and
 * the severity pill beside it already owns harm. Never amber either — §6
 * reserves amber for findings, and this is a judgement somebody recorded.
 *
 * **A stood-down urgency renders in full and quietly, and never hatches.** It
 * is a complete record: one person raised it and gave a reason, another
 * answered it and gave theirs. The hatch would say nobody had looked, which is
 * the opposite of what happened.
 *
 * **No control, either way.** Raising happens on the report form, where the
 * person who was there is. Standing one down is asked of the role table and
 * refused for both roles that sign in, so nothing is drawn — the way this
 * build renders every act it does not offer.
 */
function UrgencyFact({ incident }: { incident: Incident }) {
  const format = useSiteFormat()
  const viewer = useViewer()
  const { urgency } = incident
  const standDown = viewer.ask('stand_down_urgency')

  switch (urgency.kind) {
    case 'ordinary':
      return null
    case 'needs_attention_now':
      return (
        <div className={styles.urgency} data-urgency="needs_attention_now">
          <StatusPill tone="caution" label="Needs attention now" />
          <p className={styles.urgencyBecause}>{urgency.because}</p>
          <p className={styles.urgencyWho}>
            {format.attribution(urgency.raised.by.displayName, urgency.raised.at)}
            {/*
             * Said twice only where two people are involved. On a first raise
             * the two acts are the same act, and the record says it once.
             */}
            {urgency.worded.by.id === urgency.raised.by.id &&
            urgency.worded.at === urgency.raised.at
              ? null
              : ` · reworded by ${format.attribution(
                  urgency.worded.by.displayName,
                  urgency.worded.at,
                )}`}
          </p>
          <ActPoint
            answer={standDown}
            label="Stand down this urgency"
            notBuilt="Standing an urgency down is not built."
          />
        </div>
      )
    case 'stood_down':
      return (
        <div className={styles.urgency} data-urgency="stood_down">
          <Settled
            label="Raised, and stood down"
            detail={format.attribution(
              urgency.stoodDown.by.displayName,
              urgency.stoodDown.at,
            )}
          />
          {/* Both halves, because losing the first is what returning to
              `ordinary` would have done. */}
          <p className={styles.urgencyBecause}>
            <strong>Raised:</strong> {urgency.because}{' '}
            <span className={styles.urgencyWho}>
              {format.attribution(urgency.raised.by.displayName, urgency.raised.at)}
            </span>
          </p>
          <p className={styles.urgencyBecause}>
            <strong>Stood down:</strong> {urgency.why}
          </p>
          <ActPoint
            answer={standDown}
            label="Stand down this urgency"
            notBuilt="Standing an urgency down is not built."
          />
        </div>
      )
    default:
      return assertNever(urgency)
  }
}

/**
 * What was attached, and where it lives.
 *
 * **Nothing attached draws nothing at all.** Most incidents have nothing, and
 * §1 is explicit that this is not a gap: hatching it would put the hatch on
 * nearly every row in the product and make it texture, which is the one thing
 * that would stop it meaning anything. A row with no evidence is not a row
 * missing evidence.
 *
 * **A dead object URL says so rather than showing a broken image.** A `blob:`
 * URL belongs to the tab that made it, so a record read after a reload has
 * handles that resolve to nothing — which would draw an empty box where a
 * photograph was, the `url(#…)` failure again: a gap that looks like a value.
 * `onError` turns it into words.
 */
function EvidenceStrip({ incident }: { incident: Incident }) {
  const format = useSiteFormat()
  if (incident.evidence.length === 0) return null

  return (
    <div className={styles.evidence} data-evidence-on={incident.id}>
      <ul className={styles.evidenceList}>
        {incident.evidence.map((entry) => (
          <li key={entry.id} className={styles.evidenceItem} data-evidence={entry.id}>
            <EvidenceThumb entry={entry} />
            <div className={styles.evidenceAbout}>
              <p className={styles.evidenceName}>{entry.fileName}</p>
              <p className={styles.evidenceMeta}>
                {entry.kind === 'photo' ? 'Photograph' : 'Video'} ·{' '}
                {format.attribution(entry.attached.by.displayName, entry.attached.at)}
              </p>
              {entry.kind === 'video' ? (
                /* Said rather than left to be discovered: a clip off a phone
                   has no captions, and nothing here can write them. */
                <p className={styles.evidenceMeta} data-evidence-no-captions>
                  Not captioned — this build cannot caption video.
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.evidenceWhere}>
        {pluralise(incident.evidence.length, 'file')} attached, held in this session
        only. The originals on the device are the only lasting copy.
      </p>
    </div>
  )
}

/** The thumbnail, or the account of why there is not one. */
function EvidenceThumb({ entry }: { entry: IncidentEvidence }) {
  const [dead, setDead] = useState(false)

  if (dead)
    return (
      <p className={styles.evidenceGone} data-evidence-gone={entry.id}>
        This file was attached in a session that has ended, so there is nothing left to
        show. The original is on the device it came from.
      </p>
    )

  return (
    <div className={styles.evidenceThumb}>
      {entry.kind === 'photo' ? (
        <img
          className={styles.evidenceImage}
          src={entry.url}
          alt={`Attached photograph: ${entry.fileName}`}
          onError={() => setDead(true)}
          data-evidence-image={entry.id}
        />
      ) : (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a clip filmed on a care worker's phone arrives with no caption track and this build cannot make one; an empty <track> would claim captions that do not exist, so the gap is said in words beside the clip and recorded in docs/DEPARTURES.md under Accessibility */}
          <video
            className={styles.evidenceImage}
            src={entry.url}
            controls
            onError={() => setDead(true)}
            aria-label={`Attached video: ${entry.fileName}`}
            data-evidence-video={entry.id}
          />
        </>
      )}
    </div>
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
