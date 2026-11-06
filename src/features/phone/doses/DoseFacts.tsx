import type { MarWitness } from '@/data/types'
import { staffLabel } from '@/data/access/team-store'
import { useSiteFormat } from '@/app/session/use-session'
import { ActLine } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { NOT_GIVEN_REASON_LABEL } from '@/features/medications/medication-words'
import { doseName } from '@/features/medications/round/round'
import { assertNever } from '@/lib/assert-never'
import { notBuiltOnPhone, notBuiltYet } from '../not-built'
import type { ChartDose } from '../phone-chart'
import styles from '../phone.module.css'

/**
 * One dose, as separate facts: what it is, what the record holds, and, where it
 * is still open, why it cannot be recorded here.
 *
 * **That a recorded dose cannot be corrected is said where it would be
 * read.** On the round's sheet, at the dose (`cannotCorrect="at_dose"`): that
 * is where somebody has just tapped and may see they tapped wrong, and a sheet
 * holds one round, so the line cannot pile up. On today's chart, once for the
 * screen (`CANNOT_CORRECT_DOSE`, `"said_by_the_screen"`): at every dose of a
 * full day it was wallpaper. No surface in this build corrects a dose, so the
 * line does not say "on the phone" (`notBuiltYet`). An omission and a dose with
 * no record held are not recorded doses, and say nothing.
 */
export function DoseFacts({
  dose,
  recordsHere,
  cannotCorrect,
}: {
  dose: ChartDose
  recordsHere: boolean
  /** Whether this dose says it cannot be corrected, or the screen says it once. */
  cannotCorrect: 'at_dose' | 'said_by_the_screen'
}) {
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
          {/* An ordinary dose is recorded through the round's sheet; this one cannot be. */}
          {recordsHere && drug.isControlledDrug ? (
            <span data-cannot-record="controlled">
              <ActLine kind="not_built">
                {notBuiltOnPhone('Recording a controlled drug')}
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
          {cannotCorrect === 'at_dose' ? <CannotCorrect /> : null}
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
          {cannotCorrect === 'at_dose' ? <CannotCorrect /> : null}
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

/** Said on a recorded dose wherever the phone shows one. */
export const CANNOT_CORRECT_DOSE = notBuiltYet('Correcting a recorded dose')

function CannotCorrect() {
  return (
    <span data-cannot-correct>
      <ActLine kind="not_built">{CANNOT_CORRECT_DOSE}</ActLine>
    </span>
  )
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
