import { useCallback, useState } from 'react'
import Link from 'next/link'
import type {
  CareNote,
  Incident,
  IsoDate,
  IsoDateTime,
  Medication,
  Resident,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import type { HandoverBoard } from '@/data/access/handover-store'
import type { Omission } from '@/data/access/client'
import {
  getCareNotesForSite,
  getHandoverBoard,
  getIncidents,
  getOmissions,
  getRound,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { ROUND_TIMES } from '@/data/fixtures/rounds'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  noListYetLine,
  scopeAssigned,
  scopeNote,
  scopeReaches,
} from '@/app/session/resident-scope'
import { ActionCard } from '@/components/layout/ActionCard'
import { PageHead } from '@/components/layout/PageHead'
import { CompletionBar } from '@/components/charts/CompletionBar'
import { RoundColumns } from '@/components/charts/RoundColumns'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { formatCount, formatLateness, pluralise, zonedDate } from '@/lib/format'
import { SHIFT_NAMES, greetingAt, shiftAt, shiftHours } from '@/lib/shift'
import { withoutNoteToday } from '@/features/notes/care-notes-views'
import {
  careNotesToday,
  carePlanDomains,
  consents,
  dosesPastTheirWindow,
  dueSoon,
  flaggedForAttention,
  incidentsAcknowledged,
  medicationToday,
  riskAssessments,
  roundCounts,
} from './dashboard-figures'
import {
  LATE_FILTERS,
  byOldest,
  fromHandovers,
  fromOmissions,
  fromReviews,
  ofKind,
  type LateKind,
} from './late-items'
import styles from './dashboard.module.css'

/** Said where the combined figure would have been, and not to be reworded. */
export const NO_COMBINED_LINE =
  'These three are not added together: a dose an hour late and a review four hundred days late are not one unit, and a handover belongs to a shift rather than to a resident.'

interface DashboardData {
  residents: Resident[]
  notes: CareNote[]
  medications: Medication[]
  records: MarRecord[]
  omissions: Omission[]
  incidents: Incident[]
  board: HandoverBoard | 'none'
}

/**
 * The dashboard. CW PRD DASH-01 and DASH-01a, the care home variant.
 *
 * The sentence: **this is what is late, what is about to fall due, and who
 * nobody has written about today.**
 *
 * **Every figure here is derived from a module that exists.** The dashboard is
 * built last for that reason: it holds no record of its own, adds no store, and
 * any number on it that disagreed with the screen it points into would be the
 * two-clocks defect with a summary on top.
 *
 * **Reach is this screen's own rule.** Table 3 filters a care worker's
 * dashboard to their assigned residents and states the count that way; a senior
 * carer sees the home. It is the one place the build scopes a whole screen
 * rather than asking per act, because that is what the table says for this
 * screen.
 */
export function DashboardRoute() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const [late, setLate] = useState<LateKind | 'everything'>('everything')

  const load = useCallback(
    () =>
      Promise.all([
        getRound(activeSite.id),
        getCareNotesForSite(activeSite.id),
        getOmissions(activeSite.id, ninetyDaysBefore(at)),
        getIncidents(activeSite.id),
        getHandoverBoard(activeSite.id).catch(() => 'none' as const),
      ]).then(([round, notes, omissions, incidents, board]): DashboardData => ({
        residents: round.residents,
        notes,
        medications: round.medications,
        records: round.records,
        omissions: omissions.omissions,
        incidents: incidents.incidents,
        board,
      })),
    [activeSite.id, at],
  )
  const resource = useResource<DashboardData>(load, [activeSite.id])

  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName
  const shift = shiftAt(at, activeSite.timeZone)
  const head = (lines: string[]) => (
    <PageHead
      title={greetingAt(at, activeSite.timeZone)}
      emphasis={firstName}
      lines={lines}
      aside={format.dateTime(at)}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head([activeSite.name])}
        <Card>
          <p className={styles.status} role="status">
            Loading today…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head([activeSite.name])}
        <Card>
          <EmptyState
            title="Today could not be loaded"
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

  const data = resource.data
  const everyone = data.residents
  const ids = everyone.map((resident) => resident.id)
  const headLines = [
    `${SHIFT_NAMES[shift]} shift`,
    shiftHours(shift),
    activeSite.name,
    scopeAssigned(viewer.scope, ids, activeSite.name),
  ]

  /*
   * **The whole screen is filtered, not each figure.** Table 3's rule for this
   * screen is the scope, so the residents are narrowed once and every figure
   * below counts over what is left — and the head says which population that
   * is, so no figure can be read as the home's.
   */
  if (viewer.scope.kind === 'not_decided')
    return (
      <div className={styles.page}>
        {head(headLines)}
        <Card>
          <CardHead
            title="Your dashboard"
            subtitle={scopeNote(viewer.scope, activeSite.name)}
            expand={{ kind: 'whole' }}
          />
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has residents, doses and records. Until somebody gives you a list, nothing here is counted for you: the figures would be the home's, and this screen is meant to be yours.`}
          />
        </Card>
      </div>
    )

  const mine = new Set(
    everyone
      .filter((resident) => scopeReaches(viewer.scope, resident.id))
      .map((resident) => resident.id),
  )
  const residents = everyone.filter((resident) => mine.has(resident.id))
  const notes = data.notes.filter((note) => mine.has(note.residentId))
  const records = data.records.filter((record) => mine.has(record.residentId))
  const medications = data.medications.filter((entry) => mine.has(entry.residentId))
  const omissions = data.omissions.filter((entry) => mine.has(entry.resident.id))
  const incidents = data.incidents.filter(
    (incident) =>
      incident.subject.kind !== 'resident' || mine.has(incident.subject.residentId),
  )

  const today: IsoDate = zonedDate(at, activeSite.timeZone)
  const todaysRecords = records.filter((record) => record.date === today)
  const quiet = withoutNoteToday(residents, notes, activeSite.timeZone, at)
  const soon = dueSoon(todaysRecords, at)
  const flagged = flaggedForAttention(notes)
  const pastWindow = dosesPastTheirWindow(todaysRecords)

  const lateItems = byOldest([
    ...fromOmissions(omissions),
    ...fromReviews(residents, today),
    ...fromHandovers(data.board === 'none' ? [] : data.board.unsigned, today),
  ])
  const shownLate = ofKind(lateItems, late)

  const rounds = ROUND_TIMES.map((roundTime) => {
    const counts = roundCounts(todaysRecords, medications, roundTime, at)
    return {
      round: roundTime,
      recorded: counts.recorded,
      dueNotRecorded: counts.dueNotRecorded,
      total: counts.total,
      current: roundTime === currentRound(at, activeSite.timeZone),
    }
  })

  return (
    <div className={styles.page}>
      {head(headLines)}

      {/* ---- what is late, what is coming, who is quiet ------------------ */}
      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker="Already late"
            figure={formatCount(lateItems.length)}
            of={`${lateItems.length === 1 ? 'thing' : 'things'} past its date, ${scopeNote(
              viewer.scope,
              activeSite.name,
            ).toLowerCase()}`}
            detail={
              <div className={styles.bannerDetail} data-late-breakdown>
                <p>
                  {pluralise(ofKind(lateItems, 'medication').length, 'dose')} with no
                  record · {pluralise(ofKind(lateItems, 'review').length, 'review')}{' '}
                  past its date ·{' '}
                  {pluralise(ofKind(lateItems, 'handover').length, 'handover')} never
                  countersigned
                </p>
                <p className={styles.bannerQuiet}>{NO_COMBINED_LINE}</p>
              </div>
            }
            footLabel="Read in this order"
            footValue="Longest past its date first"
            action={
              lateItems.length === 0 ? (
                <span className={styles.bannerQuiet}>Nothing is past its date</span>
              ) : (
                <a
                  href="#already-late"
                  className={buttonClassName({ variant: 'secondary' })}
                  data-go-late
                >
                  Go to the {lateItems.length} late
                </a>
              )
            }
          />
        </div>

        <MetricTiles label={`Today at ${activeSite.name}`}>
          <MetricTile
            label="Due now or in the next 2 hours"
            icon={metricIcons.doses}
            figure={<MetricValue>{formatCount(soon.doses)}</MetricValue>}
            of={`doses, across ${pluralise(soon.residents, 'resident')} of ${residents.length}`}
          />
          <MetricTile
            label="Not written up today"
            icon={metricIcons.notesMissing}
            figure={
              quiet.length === 0 ? (
                <MetricValue>{formatCount(0)}</MetricValue>
              ) : (
                <Unrecorded variant="chip" label={`${formatCount(quiet.length)}`} />
              )
            }
            of={`of ${pluralise(residents.length, 'resident')}`}
            note={
              quiet.length === 0
                ? 'Everybody counted here has a care note today.'
                : 'Nobody has recorded a care note for them today.'
            }
          />
          <MetricTile
            label="Flagged for a senior carer"
            icon={metricIcons.alert}
            figure={<MetricValue>{formatCount(flagged)}</MetricValue>}
            of={`of ${pluralise(notes.length, 'care note')} counted here`}
          />
          <MetricTile
            label="Doses past their window"
            icon={metricIcons.notesMissing}
            figure={
              pastWindow === 0 ? (
                <MetricValue>{formatCount(0)}</MetricValue>
              ) : (
                <Unrecorded variant="chip" label={`${formatCount(pastWindow)}`} />
              )
            }
            of={`of ${pluralise(todaysRecords.length, 'dose')} on today’s chart`}
          />
        </MetricTiles>
      </div>

      {/* ---- the rounds --------------------------------------------------- */}
      <Card>
        <CardHead
          title="Rounds today"
          subtitle="One column per round: filled is recorded, hatched is due with nothing recorded. The same records the MAR chart reads."
          expand={{ kind: 'link', href: '/medications/round' }}
        />
        <RoundColumns columns={rounds} />
        <ul className={styles.roundNotes}>
          {rounds.map((round) => (
            <li
              key={round.round}
              className={styles.roundNote}
              data-round-note={round.round}
            >
              <span className={styles.roundTime} data-numeric>
                {round.round}
              </span>
              <span>
                {round.total === 0
                  ? 'no doses on the chart'
                  : round.dueNotRecorded > 0
                    ? `${pluralise(round.dueNotRecorded, 'dose')} with no record`
                    : round.recorded === round.total
                      ? 'all recorded'
                      : `${round.total - round.recorded} not yet due`}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ---- module completeness ----------------------------------------- */}
      <Card>
        <CardHead
          title="What the record holds"
          subtitle={scopeNote(viewer.scope, activeSite.name)}
          expand={{ kind: 'whole' }}
        />
        <div className={styles.bars}>
          <CompletionBar
            label="Care notes today"
            {...careNotesToday(residents, residents.length - quiet.length)}
            of={`of ${pluralise(residents.length, 'resident')} counted here`}
          />
          <CompletionBar
            label="Medication today"
            {...medicationToday(todaysRecords)}
            of="of the doses on today’s chart"
          />
          <CompletionBar
            label="Risk assessments"
            {...riskAssessments(residents)}
            of={`of the assessments ${activeSite.name} carries out`}
          />
          <CompletionBar
            label="Care plan domains"
            {...carePlanDomains(residents)}
            of={`of the domains ${activeSite.name} keeps`}
          />
          <CompletionBar
            label="Consents"
            {...consents(residents)}
            of={`of the consent types ${activeSite.name} asks about`}
          />
          <IncidentsBar incidents={incidents} />
        </div>
      </Card>

      {/* ---- already late -------------------------------------------------- */}
      <Card>
        <div id="already-late" className={styles.anchor}>
          <CardHead
            title="Already late"
            subtitle="Oldest first: the wait is the finding. Every row opens the record it is about."
            expand={{ kind: 'whole' }}
          />
        </div>

        <div className={styles.pills} role="group" aria-label="What is late">
          {LATE_FILTERS.map((entry) => {
            const chosen = entry.id === late
            const count = ofKind(lateItems, entry.id).length
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => setLate(entry.id)}
                data-late-filter={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>

        <p className={styles.claim} data-late-claim>
          <span data-numeric>
            {shownLate.length} of {lateItems.length}
          </span>{' '}
          late {lateItems.length === 1 ? 'thing' : 'things'},{' '}
          {scopeNote(viewer.scope, activeSite.name).toLowerCase()}
        </p>

        {shownLate.length === 0 ? (
          <p className={styles.empty}>Nothing in this view is past its date.</p>
        ) : (
          <ul className={styles.rows}>
            {shownLate.slice(0, 20).map((item) => (
              <li
                key={item.id}
                className={styles.row}
                data-late={item.kind}
                data-late-due={item.dueAt}
              >
                <div className={styles.rowWhen}>
                  <span className={styles.rowDate} data-numeric>
                    {format.instantDate(item.dueAt)}
                  </span>
                  <span className={styles.rowAge}>
                    {item.daysLate > 0
                      ? `${formatLateness(item.daysLate)} past`
                      : 'today'}
                  </span>
                </div>
                <div className={styles.rowWhat}>
                  <p className={styles.rowTitle}>{item.what}</p>
                  <p className={styles.rowMeta}>{item.who}</p>
                </div>
                <div className={styles.rowAct}>
                  <Unrecorded variant="chip" label="Past its date" />
                  <Link
                    href={item.action.href}
                    className={buttonClassName({ variant: 'secondary' })}
                    data-late-action={item.id}
                  >
                    {item.action.label}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {shownLate.length > 20 ? (
          <p className={styles.empty} data-late-more>
            The twenty longest waiting are shown. The modules themselves hold the rest:
            omissions on Medications, reviews on a resident’s record, handovers on
            Handover.
          </p>
        ) : null}
      </Card>
    </div>
  )
}

/**
 * The incidents bar, whose third segment is a finding rather than a gap.
 *
 * Its own component because the shape differs: the other five have two
 * segments, and this one has to keep "recorded and nobody picked it up" apart
 * from "nobody recorded it" (DASH-01).
 */
function IncidentsBar({ incidents }: { incidents: Incident[] }) {
  const bar = incidentsAcknowledged(incidents)
  return (
    <CompletionBar
      label="Incidents acknowledged"
      recorded={bar.recorded}
      expected={bar.expected}
      finding={{
        count: bar.unacknowledged,
        words: 'reported and not acknowledged',
      }}
      of="of the incidents counted here"
    />
  )
}

/** Ninety days of omissions, the window the omissions screen itself reads. */
function ninetyDaysBefore(at: IsoDateTime): IsoDateTime {
  return new Date(new Date(at).getTime() - 90 * 86_400_000).toISOString() as IsoDateTime
}

/** The round whose hour the home is in, for the column that is marked current. */
function currentRound(at: IsoDateTime, timeZone: string): string | undefined {
  const wall = new Date(at)
  const minutes = wall.getHours() * 60 + wall.getMinutes()
  void timeZone
  return [...ROUND_TIMES].reverse().find((round) => {
    const [hours, mins] = round.split(':').map(Number)
    const start = (hours ?? 0) * 60 + (mins ?? 0)
    return minutes >= start && minutes < start + 60
  })
}
