import { useCallback, useState } from 'react'
import { getMarRecords, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { staffLabel } from '@/data/access/team-store'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActLine } from '@/components/primitives'
import { doseName } from '@/features/medications/round/round'
import { formatDate, pluralise } from '@/lib/format'
import { notBuiltOnPhone } from '../not-built'
import { phoneRefusalOf } from '../phone-refusal'
import {
  todaysChart,
  type ChartDose,
  type Drug,
  type TodaysChart,
} from '../phone-chart'
import { listName, type DoseRecord, type Person } from '../phone-data'
import { roundInFront } from '../phone-round'
import { CANNOT_CORRECT_DOSE, DoseFacts } from '../doses/DoseFacts'
import { DoseSheet, PRN_NOT_BUILT } from '../doses/DoseSheet'
import { sheetDoses } from '../doses/dose-sheet'
import shell from '../shell/shell.module.css'
import { Loaded } from '../ScreenStates'
import { Screen } from '../shell/Screen'
import { SubjectHeader } from '../SubjectHeader'
import styles from '../phone.module.css'

interface ChartData {
  person: Person
  drugs: Drug[]
  records: DoseRecord[]
}

/**
 * Today's chart for one person, grouped by round, pushed from their record.
 * MED-04 on a phone, for today only. **Read-only**: nothing here records, and
 * where recording would be, a line says it is not built.
 *
 * **A dose nobody can record here still appears, saying why.** A controlled
 * drug is on the chart at its round like every other dose, with its own line:
 * the phone does not record one (module 3, decision 3). A chart that left it
 * out would lie about the day.
 *
 * **Each dose's facts are separate** (CLAUDE.md §1): given and a missing second
 * signature are a pill and a hatch; an omission keeps its hatch when somebody
 * has closed it, with the closure as a line of its own. The words are the
 * desktop chart's cell detail (`MarCellDetail`), so a dose reads the same on
 * both.
 *
 * Earlier days are the desktop chart's, and say they are not built here.
 */
export function ChartScreen({ id }: { id: ResidentId }) {
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const answer = viewer.ask('open_resident_record', id)
  const recordAct = useRecordAct()
  const load = useCallback(
    () =>
      Promise.all([getResident(id), getMarRecords(id)]).then(
        ([person, chart]): ChartData => ({
          person,
          drugs: chart.medications,
          records: chart.records,
        }),
      ),
    [id],
  )
  /* Bumped to read the chart again once a recorded round's sheet has closed. */
  const [reads, setReads] = useState(0)
  const [recorded, setRecorded] = useState(false)
  const resource = useResource<ChartData>(load, [id, reads])
  const ready = resource.kind === 'ready' ? resource.data : undefined
  const [recording, setRecording] = useState(false)
  const act =
    ready !== undefined && answer.kind === 'yes' ? recordAct(ready, at) : 'none'

  return (
    <Screen
      title="Today’s chart"
      subject={
        ready !== undefined && answer.kind === 'yes' ? (
          <SubjectHeader person={ready.person} name="here" />
        ) : undefined
      }
      primary={
        act === 'none' ? undefined : (
          <button
            type="button"
            className={`${shell.primary} ${shell.press}`}
            aria-haspopup="dialog"
            data-record-round={act.roundTime}
            onClick={() => setRecording(true)}
          >
            Record the {act.roundTime} round
          </button>
        )
      }
    >
      {ready === undefined || act === 'none' ? null : (
        <DoseSheet
          person={ready.person}
          drugs={ready.drugs}
          records={ready.records}
          roundTime={act.roundTime}
          date={act.date}
          open={recording}
          onOpenChange={(open) => {
            setRecording(open)
            /*
             * Read again on closing, not on recording: the read would take the
             * act away and the sheet with it, before "Recorded" could be read.
             */
            if (!open && recorded) {
              setRecorded(false)
              setReads((count) => count + 1)
            }
          }}
          onRecorded={() => setRecorded(true)}
        />
      )}
      <Loaded
        resource={resource}
        loading="Loading today’s chart…"
        failed="Today’s chart could not be loaded"
      >
        {(data) =>
          answer.kind !== 'yes' ? (
            <div className={styles.card}>
              <p className={styles.cardTitle}>
                {phoneRefusalOf(answer, listName(data.person))}
              </p>
            </div>
          ) : (
            <Chart data={data} at={at} />
          )
        }
      </Loaded>
    </Screen>
  )
}

/**
 * The round the reader can record on the phone for this person now, if any:
 * the round in front of them, where the role table lets them record and at
 * least one ordinary dose has its window open. **No act where nothing can be
 * recorded**: a round of controlled drugs alone says so at each dose instead.
 */
function useRecordAct() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  return (data: ChartData, at: IsoDateTime) => {
    if (viewer.ask('record_medication', data.person.id).kind !== 'yes') return 'none'
    const front = roundInFront({
      drugs: data.drugs,
      records: data.records,
      at,
      timeZone: activeSite.timeZone,
    })
    const doses = sheetDoses({
      ...data,
      roundTime: front.roundTime,
      date: front.date,
      at,
    })
    return doses.some((entry) => entry.kind === 'to_answer') ? front : 'none'
  }
}

function Chart({ data, at }: { data: ChartData; at: IsoDateTime }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const { person } = data
  const chart = todaysChart({
    drugs: data.drugs,
    records: data.records,
    at,
    timeZone: activeSite.timeZone,
  })
  const records = viewer.ask('record_medication', person.id)
  return (
    <>
      <section className={styles.card} data-chart-day={chart.date}>
        <h2 className={styles.cardTitle}>Today, {formatDate(chart.date)}</h2>
        {chart.due === 0 ? (
          <p className={styles.body}>No scheduled dose is on the chart today.</p>
        ) : (
          <p className={styles.body} data-chart-count>
            {chart.recorded} of {pluralise(chart.due, 'dose')} due today recorded
          </p>
        )}
        {records.kind === 'yes' ? null : (
          <ActLine kind="refused">{phoneRefusalOf(records, listName(person))}</ActLine>
        )}
        {/* Once for the screen, not at every dose (`DoseFacts`). */}
        {chart.recorded === 0 ? null : (
          <span data-cannot-correct>
            <ActLine kind="not_built">{CANNOT_CORRECT_DOSE}</ActLine>
          </span>
        )}
      </section>

      {chart.rounds.map((round) => (
        <section
          key={round.roundTime}
          className={styles.card}
          data-chart-round={round.roundTime}
          aria-labelledby={`chart-round-${round.roundTime}`}
        >
          <h2 id={`chart-round-${round.roundTime}`} className={styles.cardTitle}>
            {round.roundTime} round
          </h2>
          <p className={styles.quiet}>
            {round.doses.filter(isRecorded).length} of{' '}
            {pluralise(round.doses.length, 'dose')} recorded
          </p>
          <ul className={styles.items}>
            {round.doses.map((dose) => (
              <li
                key={dose.drug.id}
                className={styles.item}
                data-chart-dose={dose.drug.id}
              >
                <DoseFacts
                  dose={dose}
                  recordsHere={records.kind === 'yes'}
                  cannotCorrect="said_by_the_screen"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <AsRequiredCard chart={chart} />

      {chart.notDueToday.length === 0 ? null : (
        <section className={styles.card} data-chart-not-due>
          <h2 className={styles.cardTitle}>Not due today</h2>
          <ul className={styles.items}>
            {chart.notDueToday.map((drug) => (
              <li key={drug.id} className={styles.item}>
                <p className={styles.value}>{doseName(drug)}</p>
                <p className={styles.quiet}>No dose of it is scheduled today.</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.gutter} data-chart-history>
        <ActLine kind="not_built">{notBuiltOnPhone('Earlier days')}</ActLine>
      </div>
    </>
  )
}

const isRecorded = (dose: ChartDose) =>
  dose.cell.kind === 'recorded' &&
  (dose.cell.state.kind === 'given' || dose.cell.state.kind === 'not_given')

/**
 * The PRN medicines, which are available rather than due, so they have no
 * round. Each is listed whether or not any was given, with what was.
 */
function AsRequiredCard({ chart }: { chart: TodaysChart }) {
  const format = useSiteFormat()
  if (chart.asRequired.length === 0) return null
  return (
    <section className={styles.card} data-chart-prn>
      <h2 className={styles.cardTitle}>As required (PRN)</h2>
      <ul className={styles.items}>
        {chart.asRequired.map(({ drug, given }) => (
          <li key={drug.id} className={styles.item}>
            <p className={styles.value}>{doseName(drug)}</p>
            {given.length === 0 ? (
              <p className={styles.quiet}>No dose of it is recorded as given today.</p>
            ) : (
              given.map((dose) => (
                <p key={dose.givenAt} className={styles.byline}>
                  Given as required {format.time(dose.givenAt)} ·{' '}
                  {staffLabel(dose.givenBy)}
                </p>
              ))
            )}
          </li>
        ))}
      </ul>
      <ActLine kind="not_built">{PRN_NOT_BUILT}</ActLine>
    </section>
  )
}
