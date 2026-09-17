import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type {
  Incident,
  IncidentSeverityId,
  IncidentTypeId,
  IsoDateTime,
  Resident,
} from '@/data/types'
import { INCIDENT_SEVERITIES, INCIDENT_TYPES, subjectResidentId } from '@/data/types'
import { getIncidents } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActionCard } from '@/components/layout/ActionCard'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import {
  ActLine,
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  Select,
  SelectedMark,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NotYourHome } from '@/components/status'
import { formatCount, pluralise } from '@/lib/format'
import { AcknowledgeControl } from './AcknowledgeControl'
import { IncidentRow } from './IncidentRow'
import { incidentsIcons } from './incidents.icons'
import styles from './incidents.module.css'

/** The line the head carries, decided and not to be reworded. */
export const NOTHING_SENT_LINE =
  'Nothing is sent from this screen: no push to a manager, and no badge anywhere else.'

/** Why there is nowhere to open to, said where INC-01 puts its link. */
export const NO_DETAIL_LINE =
  'Each incident is shown whole here. The CW PRD has no screen for one incident on its own, so there is nowhere to open to.'

type StatusFilter = 'not_acknowledged' | 'open' | 'under_review' | 'closed' | 'all'

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'not_acknowledged', label: 'Not acknowledged' },
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under review' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
]

const matchesStatus = (incident: Incident, filter: StatusFilter): boolean =>
  filter === 'all' ||
  (filter === 'not_acknowledged'
    ? incident.status.kind === 'reported_not_acknowledged'
    : incident.status.kind === filter)

/**
 * The incidents list. CW PRD INC-01.
 *
 * The sentence: **these incidents have been written down and nobody has picked
 * them up.** Oldest first, because the wait is the finding.
 *
 * **The log is the home's, and it says so.** INC-01 gives a care worker every
 * incident at their site — an incident is an event in the building rather than
 * a record about somebody on a list — so nothing here is counted over the
 * viewer's residents. Reporting one is a different matter, and the act asks the
 * role table resident by resident.
 *
 * **Two findings, never summed and never one card.** Unacknowledged incidents
 * lead: they are what somebody looking at this screen can still change. The
 * undecided CQC notifications sit beside them, graver and usually older, and an
 * incident can be both — which is the arithmetic reason they cannot be added,
 * and their being different failures is the real one.
 */
export function IncidentsRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [status, setStatus] = useState<StatusFilter>('not_acknowledged')
  const [type, setType] = useState<IncidentTypeId | 'any'>('any')
  const [severity, setSeverity] = useState<IncidentSeverityId | 'any'>('any')
  const [written, setWritten] = useState(0)
  const [done, setDone] = useState('')
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(() => getIncidents(activeSite.id), [activeSite.id])
  const resource = useResource<{ incidents: Incident[]; residents: Resident[] }>(load, [
    activeSite.id,
    written,
  ])

  const reportAnswer = viewer.ask('report_incident')
  const head = (
    <PageHead
      title="Incidents"
      lines={[activeSite.name, 'every incident at this home']}
      action={
        reportAnswer.kind === 'yes' ? (
          <Link
            href="/incidents/new"
            className={buttonClassName({ variant: 'primary', size: 'large' })}
          >
            Report an incident
          </Link>
        ) : undefined
      }
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading incidents…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The incidents could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  return (
    <List
      head={head}
      data={resource.data}
      siteName={activeSite.name}
      at={at}
      status={status}
      onStatus={setStatus}
      type={type}
      onType={setType}
      severity={severity}
      onSeverity={setSeverity}
      done={done}
      onAcknowledged={(words) => {
        setDone(words)
        setWritten((count) => count + 1)
      }}
    />
  )
}

function List({
  head,
  data,
  siteName,
  at,
  status,
  onStatus,
  type,
  onType,
  severity,
  onSeverity,
  done,
  onAcknowledged,
}: {
  head: React.ReactNode
  data: { incidents: Incident[]; residents: Resident[] }
  siteName: string
  at: IsoDateTime
  status: StatusFilter
  onStatus: (next: StatusFilter) => void
  type: IncidentTypeId | 'any'
  onType: (next: IncidentTypeId | 'any') => void
  severity: IncidentSeverityId | 'any'
  onSeverity: (next: IncidentSeverityId | 'any') => void
  done: string
  onAcknowledged: (words: string) => void
}) {
  const viewer = useViewer()
  const { incidents, residents } = data

  const ordered = useMemo(
    () => [...incidents].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    [incidents],
  )
  const shown = useMemo(
    () =>
      ordered
        .filter((incident) => matchesStatus(incident, status))
        .filter((incident) => type === 'any' || incident.type === type)
        .filter((incident) => severity === 'any' || incident.severity === severity),
    [ordered, status, type, severity],
  )
  const paged = usePaged(shown, 10)

  const total = incidents.length
  const unacknowledged = incidents.filter(
    (incident) => incident.status.kind === 'reported_not_acknowledged',
  )
  const undecided = incidents.filter(
    (incident) => incident.notification.kind === 'not_yet_decided',
  )

  const closeAnswer = viewer.ask('close_incident')
  const cqcAnswer = viewer.ask('decide_cqc_notification')
  const acknowledgeAnswer = viewer.ask('acknowledge_incident')

  return (
    <div className={styles.page}>
      {head}

      <div className={styles.headLines}>
        <ActLine kind="not_performed">{NOTHING_SENT_LINE}</ActLine>
      </div>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-incident-done>
          {done}
        </p>
      )}

      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker="Reported and not acknowledged"
            figure={formatCount(unacknowledged.length)}
            of={`of ${pluralise(total, 'incident')} recorded at ${siteName} in the last 90 days`}
            detail={
              <div className={styles.bannerDetail} data-incidents-banner>
                <p>Somebody wrote them down and nobody has picked them up.</p>
              </div>
            }
            footLabel="Oldest waiting"
            footValue={
              unacknowledged[0] === undefined
                ? 'Nothing waiting'
                : waitWords(unacknowledged[0], at)
            }
            action={
              unacknowledged.length === 0 ? (
                <span className={styles.bannerQuiet}>
                  Every incident here has been picked up
                </span>
              ) : (
                <button
                  type="button"
                  className={buttonClassName({ variant: 'secondary' })}
                  onClick={() => onStatus('not_acknowledged')}
                  data-show-unacknowledged
                >
                  Show the {unacknowledged.length} not acknowledged
                </button>
              )
            }
          />
        </div>

        <MetricTiles label={`Incidents at ${siteName}`}>
          <MetricTile
            label="No CQC notification decision"
            icon={incidentsIcons.notification}
            figure={
              undecided.length === 0 ? (
                <MetricValue>{formatCount(0)}</MetricValue>
              ) : (
                <MetricValue>{formatCount(undecided.length)}</MetricValue>
              )
            }
            of={`of ${pluralise(total, 'incident')} at ${siteName}`}
            note="Nobody has recorded whether these must be notified. Graver than an unacknowledged incident, and usually older."
          />
        </MetricTiles>
      </div>

      {/*
       * The acts this screen holds that this reader cannot perform, drawn once
       * rather than on every row: a refusal repeated down a list of forty is
       * noise, and the omissions screen settled that in Phase 4. Acknowledging
       * is drawn per row where the role table allows it, because it acts on one
       * incident.
       */}
      <Card>
        <CardHead
          title="What happens to an incident after it is reported"
          subtitle="Each of these is somebody else's act. They are drawn here so the record shows what is owed and who owes it."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.acts}>
          {acknowledgeAnswer.kind === 'yes' ? (
            <p className={styles.actNote}>
              <strong>Acknowledge</strong> is on each incident nobody has picked up yet,
              below.
            </p>
          ) : (
            <ActPoint
              answer={acknowledgeAnswer}
              label="Acknowledge"
              notBuilt="Acknowledging is on each row below."
            />
          )}
          <ActPoint
            answer={closeAnswer}
            label="Close"
            notBuilt="Closing an incident is not built."
          />
          <ActPoint
            answer={cqcAnswer}
            label="Record a CQC notification decision"
            notBuilt="Recording a notification decision is not built."
          />
        </div>
      </Card>

      <Card>
        <CardHead
          title="Incidents"
          subtitle={`Oldest first. ${NO_DETAIL_LINE}`}
          expand={{ kind: 'whole' }}
        />

        <div className={styles.pills} role="group" aria-label="Status">
          {STATUS_FILTERS.map((entry) => {
            const chosen = entry.id === status
            const count = ordered.filter((incident) =>
              matchesStatus(incident, entry.id),
            ).length
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => onStatus(entry.id)}
                data-status-filter={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>

        <div className={styles.selects}>
          <Select
            label="Type"
            placeholder="Any type"
            value={type === 'any' ? undefined : type}
            onValueChange={(value) => onType(value as IncidentTypeId | 'any')}
            options={[
              { value: 'any', label: 'Any type' },
              ...INCIDENT_TYPES.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
          <Select
            label="Severity"
            placeholder="Any severity"
            value={severity === 'any' ? undefined : severity}
            onValueChange={(value) => onSeverity(value as IncidentSeverityId | 'any')}
            options={[
              { value: 'any', label: 'Any severity' },
              ...INCIDENT_SEVERITIES.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
        </div>

        <p className={styles.claim} data-incidents-claim>
          <span data-numeric>
            {shown.length} of {total}
          </span>{' '}
          {total === 1 ? 'incident' : 'incidents'} at {siteName} · oldest first
        </p>

        {shown.length === 0 ? (
          <p className={styles.empty}>
            No incident at {siteName} matches this view. The filters above reach the
            rest.
          </p>
        ) : (
          <>
            <ul className={styles.rows}>
              {paged.shown.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  resident={residents.find(
                    (person) => person.id === subjectResidentId(incident),
                  )}
                  at={at}
                  act={
                    incident.status.kind === 'reported_not_acknowledged' &&
                    acknowledgeAnswer.kind === 'yes' ? (
                      <AcknowledgeControl
                        incident={incident}
                        resident={residents.find(
                          (person) => person.id === subjectResidentId(incident),
                        )}
                        onAcknowledged={onAcknowledged}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ul>
            <Pager paged={paged} total={shown.length} noun="incidents" />
          </>
        )}
      </Card>
    </div>
  )
}

/** How long an incident has waited to be picked up, in days and hours. */
function waitWords(incident: Incident, at: IsoDateTime): string {
  const hours =
    (new Date(at).getTime() - new Date(incident.reported.at).getTime()) / 3_600_000
  if (hours < 1) return 'under an hour'
  if (hours < 48) return pluralise(Math.floor(hours), 'hour')
  return pluralise(Math.floor(hours / 24), 'day')
}
