import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { IsoDateTime, Resident } from '@/data/types'
import {
  getMarRecords,
  getOmissions,
  getResidentsBySite,
  type Omission,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import {
  ActLine,
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  usePaged,
} from '@/components/primitives'
import { GapCount, NotYourHome, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { ActionCard } from '@/components/layout/ActionCard'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  noListYetLine,
  scopeAcross,
  scopeNote,
  type ResidentScope,
} from '@/app/session/resident-scope'
import { formatCount, pluralise } from '@/lib/format'
import { waitingSince } from '@/features/notes/note-parts'
import { medicationsIcons } from '../medications.icons'
import { CloseOmissionControl } from './CloseOmissionControl'
import {
  CLOSURE_FILTERS,
  ESCALATION_FILTERS,
  dosesDueSince,
  filterOmissions,
  filterWords,
  isClosed,
  isEscalated,
  oldestOpen,
  weekBefore,
  type ClosureFilter,
  type EscalationFilter,
} from './omission-views'
import { RowSubject, drugInSentence } from './subject'
import styles from '../medications.module.css'

/**
 * Doses with no record, over the residents this person can see. CW PRD MED-01.
 *
 * **Scoped to the viewer's list, and it says so.** Which residents is asked of
 * the role table per resident, never decided by a role here, and every figure
 * carries what it is out of and the population it covers.
 *
 * **Escalation is its own fact, beside the gap** (docs/DEPARTURES.md): the PRD's
 * one amber, hatched, dashed pill merged a record nobody made with a finding
 * somebody raised. A controlled drug is a third fact.
 *
 * **A closed omission stays hatched.** Closing records who looked and why; it
 * does not make a record of the dose.
 */
export function OmissionsRoute() {
  const viewer = useViewer()
  const { activeSite } = useSession()

  if (viewer.scope.kind === 'not_decided')
    return (
      <Card>
        <CardHead
          title="Omissions"
          subtitle={scopeNote(viewer.scope, activeSite.name)}
          expand={{ kind: 'whole' }}
        />
        <div data-no-list>
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has doses due every day. Until somebody gives you a list, no omission is shown here and nothing is counted for you.`}
          />
        </div>
      </Card>
    )

  return <Omissions scope={viewer.scope} />
}

interface Loaded {
  omissions: Omission[]
  due: number
  onList: Resident[]
}

type LastClosed = { kind: 'none' } | { kind: 'closed'; words: string }

function Omissions({ scope }: { scope: ResidentScope }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [escalation, setEscalation] = useState<EscalationFilter>('all')
  const [closure, setClosure] = useState<ClosureFilter>('open_and_closed')
  const [reloads, setReloads] = useState(0)
  const [lastClosed, setLastClosed] = useState<LastClosed>({ kind: 'none' })

  /*
   * One moment for the life of the screen, so the week and every "how long ago"
   * agree. A lazy state rather than a memo: reading the clock is impure.
   */
  const [since] = useState<IsoDateTime>(() =>
    weekBefore(now().toISOString() as IsoDateTime),
  )

  const load = useCallback(async (): Promise<Loaded> => {
    const [residents, week] = await Promise.all([
      getResidentsBySite(activeSite.id),
      getOmissions(activeSite.id, since),
    ])
    const onList = residents.filter(
      (resident) => viewer.ask('open_resident_record', resident.id).kind === 'yes',
    )
    const reached = new Set(onList.map((resident) => resident.id))
    const charts = await Promise.all(
      onList.map((resident) => getMarRecords(resident.id)),
    )
    return {
      omissions: week.omissions.filter((omission) => reached.has(omission.resident.id)),
      due: charts.reduce((sum, chart) => sum + dosesDueSince(chart.records, since), 0),
      onList,
    }
  }, [activeSite.id, since, viewer])
  const resource = useResource<Loaded>(load, [activeSite.id, since, viewer, reloads])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />
  if (resource.kind === 'loading')
    return (
      <Card>
        <p className={styles.status} role="status">
          Loading omissions…
        </p>
      </Card>
    )
  if (resource.kind === 'error')
    return (
      <Card>
        <EmptyState
          title="The omissions could not be loaded"
          body="Nothing has been lost: this is a read."
          actions={
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          }
        />
      </Card>
    )

  const { omissions, due, onList } = resource.data
  const across = scopeAcross(scope, onList.length, activeSite.name)
  const escalated = omissions.filter(isEscalated).length
  const closed = omissions.filter(isClosed).length
  const open = omissions.length - closed
  const oldest = oldestOpen(omissions)
  const visible = filterOmissions(omissions, escalation, closure)

  const onClosed = (omission: Omission) => {
    setLastClosed({
      kind: 'closed',
      words: `You closed the omission for ${omission.resident.fullLegalName}’s ${drugInSentence(omission.medication)} at ${omission.record.roundTime}. It stays on the list, now under Closed.`,
    })
    setReloads((count) => count + 1)
  }

  const noRecordOf = `of ${pluralise(omissions.length, 'dose')} with no record`
  const closeAnswer = viewer.ask('close_omission')

  return (
    <div className={styles.page}>
      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker="Open omissions"
            figure={formatCount(open)}
            of={`${noRecordOf} this week`}
            footLabel="Oldest open"
            footValue={oldest === 'none' ? 'Nothing open' : waitingSince(oldest.dueAt)}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setEscalation('all')
                  setClosure('open')
                }}
                aria-pressed={escalation === 'all' && closure === 'open'}
                data-show-open
              >
                Show open omissions
              </Button>
            }
          />
        </div>

        <div className={styles.tileColumn}>
          {/*
           * A zero is a finding, not a gap: hatching "0 with no record" would
           * claim a gap the record says is not there.
           */}
          {omissions.length > 0 ? (
            <GapCount
              label="Doses with no record"
              value={omissions.length}
              of={`of ${pluralise(due, 'dose')} due this week, ${across}`}
              detail={`${formatCount(omissions.length)} with no record — the window closed and nobody wrote anything`}
            />
          ) : (
            <MetricTiles label="Doses with no record">
              <MetricTile
                label="Doses with no record"
                icon={metricIcons.notesMissing}
                figure={<MetricValue>0</MetricValue>}
                of={`of ${pluralise(due, 'dose')} due this week, ${across}`}
              />
            </MetricTiles>
          )}
          <MetricTiles label={`Omission figures this week, ${across}`}>
            <MetricTile
              label="Escalated"
              icon={metricIcons.alert}
              figure={<MetricValue>{formatCount(escalated)}</MetricValue>}
              of={noRecordOf}
            />
            <MetricTile
              label="Not yet escalated"
              icon={metricIcons.waiting}
              figure={
                <MetricValue>{formatCount(omissions.length - escalated)}</MetricValue>
              }
              of={noRecordOf}
            />
            <MetricTile
              label="Closed"
              icon={metricIcons.settled}
              figure={<MetricValue>{formatCount(closed)}</MetricValue>}
              of={noRecordOf}
            />
          </MetricTiles>
          <p className={styles.scopeNote}>
            This week: the seven days to now. {scopeNote(scope, activeSite.name)}
          </p>
        </div>
      </div>

      <Card>
        <CardHead
          title="Doses with no record"
          subtitle="Every dose this week whose window closed with nothing written, the longest ago first."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.viewHead}>
          <div className={styles.pillGroups}>
            <div className={styles.pills} role="group" aria-label="Escalation">
              {ESCALATION_FILTERS.map((entry) => (
                <FilterPill
                  key={entry.id}
                  label={entry.label}
                  chosen={escalation === entry.id}
                  onChoose={() => setEscalation(entry.id)}
                  data={`escalation-${entry.id}`}
                />
              ))}
            </div>
            <div className={styles.pills} role="group" aria-label="Open or closed">
              {CLOSURE_FILTERS.map((entry) => (
                <FilterPill
                  key={entry.id}
                  label={entry.label}
                  chosen={closure === entry.id}
                  onChoose={() => setClosure(entry.id)}
                  data={`closure-${entry.id}`}
                />
              ))}
            </div>
          </div>
          <p className={styles.claim} data-omissions-claim>
            <span data-numeric>{formatCount(visible.length)}</span>{' '}
            {visible.length === 1 ? 'dose' : 'doses'} with no record
            {filterWords(escalation, closure)}, of{' '}
            <span data-numeric>{formatCount(omissions.length)}</span> this week,{' '}
            {across} · oldest first
          </p>
          {/* One refusal, at the head. A refusal repeated down a list is noise. */}
          {closeAnswer.kind === 'not_your_role' ? (
            <ActLine kind="refused">{closeAnswer.reason}</ActLine>
          ) : null}
        </div>

        {lastClosed.kind === 'closed' ? (
          <p className={styles.justDone} role="status" data-just-closed>
            {lastClosed.words}
          </p>
        ) : null}

        <OmissionList
          visible={visible}
          filtered={escalation !== 'all' || closure !== 'open_and_closed'}
          onClosed={onClosed}
        />
      </Card>
    </div>
  )
}

function FilterPill({
  label,
  chosen,
  onChoose,
  data,
}: {
  label: string
  chosen: boolean
  onChoose: () => void
  data: string
}) {
  return (
    <button
      type="button"
      className={chosen ? styles.pillChosen : styles.pill}
      aria-pressed={chosen}
      onClick={onChoose}
      data-omissions-filter={data}
    >
      <SelectedMark selected={chosen} />
      {label}
    </button>
  )
}

function OmissionList({
  visible,
  filtered,
  onClosed,
}: {
  visible: Omission[]
  filtered: boolean
  onClosed: (omission: Omission) => void
}) {
  const paged = usePaged(visible)
  if (visible.length === 0)
    return (
      <p className={styles.plain} data-omissions-empty>
        {filtered
          ? 'Nothing matches this filter. That is a statement about the filter, not about the record.'
          : 'Every dose due this week has a record against it.'}
      </p>
    )
  return (
    <>
      <ul className={styles.rows}>
        {paged.shown.map((omission) => (
          <OmissionRow key={rowKey(omission)} omission={omission} onClosed={onClosed} />
        ))}
      </ul>
      <Pager paged={paged} total={visible.length} noun="doses with no record" />
    </>
  )
}

const rowKey = (omission: Omission) =>
  `${omission.record.medicationId}|${omission.record.date}|${omission.record.roundTime}`

function OmissionRow({
  omission,
  onClosed,
}: {
  omission: Omission
  onClosed: (omission: Omission) => void
}) {
  const format = useSiteFormat()
  const { resident, medication, record, closure, escalatedAt } = omission

  return (
    <li
      className={styles.row}
      data-omission={rowKey(omission)}
      data-escalated={isEscalated(omission)}
      data-closure={closure.kind}
    >
      <RowSubject resident={resident} />

      {/* Separate facts, never one pill: the gap, whether anybody escalated it,
          whether it is a controlled drug, and whether somebody closed it. */}
      <div className={styles.rowState}>
        <Unrecorded
          label="No record"
          detail={`${record.roundTime}, ${format.instantDate(omission.dueAt)} · ${waitingSince(omission.dueAt)} ago`}
        />
        {escalatedAt === 'not_escalated' ? (
          <span className={styles.quietFact} data-escalation="not_escalated">
            Not escalated
          </span>
        ) : (
          <span data-escalation="escalated">
            <StatusPill
              tone="caution"
              label={`Escalated ${format.time(escalatedAt)}, ${format.instantDate(escalatedAt)}`}
            />
          </span>
        )}
        {medication.isControlledDrug ? (
          <span data-controlled-drug>
            <StatusPill tone="critical" label="Controlled drug" />
          </span>
        ) : null}
      </div>

      <div className={styles.rowMain}>
        <p className={styles.rowDrug}>
          {medication.name} {medication.dose}
          <span className={styles.rowDrugMeta}>
            {' '}
            · {medication.route.toLowerCase()}
          </span>
        </p>
        {closure.kind === 'closed' ? (
          <p className={styles.closure} data-closed-by>
            Closed by {staffLabel(closure.by)},{' '}
            <span data-numeric>{format.instantDate(closure.at)}</span>: {closure.reason}
          </p>
        ) : null}
        <div className={styles.rowActs}>
          <CloseOmissionControl omission={omission} onClosed={onClosed} />
          <Link
            className={styles.openLink}
            href={`/residents/${resident.id}/medications/mar`}
          >
            Open MAR
            <Icon name={medicationsIcons.open} size={16} />
          </Link>
        </div>
      </div>
    </li>
  )
}
