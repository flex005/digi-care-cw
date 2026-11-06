import { useCallback, useState } from 'react'
import { getMarRecords, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { staffLabel } from '@/data/access/team-store'
import type { IsoDateTime, MarWitness, ResidentId } from '@/data/types'
import { refusalOf } from '@/app/session/refusal'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActLine } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { StatusPill, Unrecorded } from '@/components/status'
import { NOT_GIVEN_REASON_LABEL } from '@/features/medications/medication-words'
import { doseName } from '@/features/medications/round/round'
import { assertNever } from '@/lib/assert-never'
import { formatDate, pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { notBuiltOnPhone } from '../not-built'
import {
  todaysChart,
  type ChartDose,
  type Drug,
  type TodaysChart,
} from '../phone-chart'
import { listName, type DoseRecord, type Person } from '../phone-data'
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
  const resource = useResource<ChartData>(load, [id])
  const ready = resource.kind === 'ready' ? resource.data : undefined

  return (
    <Screen
      title="Today’s chart"
      subject={
        ready !== undefined && answer.kind === 'yes' ? (
          <SubjectHeader person={ready.person} name="here" />
        ) : undefined
      }
    >
      <Loaded
        resource={resource}
        loading="Loading today’s chart…"
        failed="Today’s chart could not be loaded"
      >
        {(data) =>
          answer.kind !== 'yes' ? (
            <div className={styles.card}>
              <p className={styles.cardTitle}>
                {refusalOf(answer, listName(data.person))}
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
  const doses = chart.rounds.flatMap((round) => round.doses)
  /*
   * Said once, above the rounds, because they are about the role and not about
   * a dose: who may record for this person, and the role table's question on
   * controlled drugs where it has one.
   */
  const controlledQuestion = doses.some(
    (dose) => dose.drug.isControlledDrug && isOpen(dose),
  )
    ? viewer.ask('record_controlled_drug_dose', person.id)
    : undefined

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
          <ActPoint
            answer={records}
            label="Record a dose"
            notBuilt={notBuiltOnPhone('Recording a dose')}
          />
        )}
        {controlledQuestion === undefined ? null : (
          <ActPoint
            answer={controlledQuestion}
            label="Given"
            notBuilt="Recording a controlled drug dose is not built."
          />
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
                <DoseFacts dose={dose} recordsHere={records.kind === 'yes'} />
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

const isOpen = (dose: ChartDose) =>
  dose.cell.kind === 'recorded' && dose.cell.state.kind === 'due'

/**
 * One dose, as separate facts: what it is, what the record holds, and, where it
 * is still open, why it cannot be recorded here.
 */
function DoseFacts({ dose, recordsHere }: { dose: ChartDose; recordsHere: boolean }) {
  const format = useSiteFormat()
  const { drug, cell } = dose
  const name = (
    <p className={styles.value}>
      {doseName(drug)}
      {drug.isControlledDrug ? (
        <span className={styles.quiet}> · Controlled drug</span>
      ) : null}
    </p>
  )

  if (cell.kind === 'not_held')
    return (
      <>
        {name}
        <p className={styles.quiet} data-dose="not_held">
          No record of this round is held here. This is not a record that the dose was
          missed.
        </p>
      </>
    )

  const state = cell.state
  switch (state.kind) {
    case 'due':
      return (
        <>
          {name}
          <span data-dose="due">
            <StatusPill tone="info" label="Due" />
          </span>
          <p className={styles.quiet}>
            Window {format.time(state.windowOpensAt)} to{' '}
            {format.time(state.windowClosesAt)}. Nothing is recorded yet.
          </p>
          {recordsHere ? (
            <span data-cannot-record={drug.isControlledDrug ? 'controlled' : 'any'}>
              <ActLine kind="not_built">
                {notBuiltOnPhone(
                  drug.isControlledDrug
                    ? 'Recording a controlled drug'
                    : 'Recording a dose',
                )}
              </ActLine>
            </span>
          ) : null}
        </>
      )
    case 'given':
      return (
        <>
          {name}
          <span data-dose="given">
            <StatusPill tone="positive" label="Given" />
          </span>
          <p className={styles.byline}>
            {format.time(state.givenAt)} · {staffLabel(state.givenBy)}
          </p>
          <Witness witness={state.witness} />
        </>
      )
    case 'not_given':
      return (
        <>
          {name}
          <span data-dose="not_given">
            <StatusPill
              tone="critical"
              label="Not given"
              detail={NOT_GIVEN_REASON_LABEL[state.reason]}
            />
          </span>
          {state.note === '' ? null : <p className={styles.body}>{state.note}</p>}
          <p className={styles.byline}>
            {format.time(state.recordedAt)} · {staffLabel(state.recordedBy)}
          </p>
        </>
      )
    case 'omitted':
      return (
        <>
          {name}
          <span data-dose="omitted">
            <Unrecorded
              label="No record"
              detail={`the window for ${format.time(state.dueAt)} closed with nothing recorded`}
            />
          </span>
          <p className={styles.quiet}>
            {state.escalation.kind === 'escalated'
              ? `Escalated at ${format.time(state.escalation.at)}.`
              : 'Not escalated.'}
          </p>
          {state.closure.kind === 'closed' ? (
            <p className={styles.quiet} data-closure="closed">
              Closed by {staffLabel(state.closure.by)},{' '}
              {format.dateTime(state.closure.at)}: {state.closure.reason} The dose still
              has no record.
            </p>
          ) : (
            <p className={styles.quiet} data-closure="open">
              Not closed: nobody has closed this omission.
            </p>
          )}
        </>
      )
    default:
      return assertNever(state)
  }
}

function Witness({ witness }: { witness: MarWitness }) {
  switch (witness.kind) {
    case 'not_required':
      return null
    case 'witnessed':
      return (
        <p className={styles.byline}>Second signature · {staffLabel(witness.by)}</p>
      )
    case 'required_not_recorded':
      return (
        <span data-second-signature="missing">
          <Unrecorded
            label="Second signature not recorded"
            detail="a controlled drug needs two"
          />
        </span>
      )
    default:
      return assertNever(witness)
  }
}

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
      <ActLine kind="not_built">
        {notBuiltOnPhone(`Recording a ${VOCABULARY.medication.one} as required`)}
      </ActLine>
    </section>
  )
}
