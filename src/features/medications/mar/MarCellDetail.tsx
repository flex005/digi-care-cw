import type { ReactNode } from 'react'
import type { MarWitness, Resident } from '@/data/types'
import { Button, Dialog } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { staffLabel } from '@/data/access/team-store'
import { assertNever } from '@/lib/assert-never'
import { NOT_GIVEN_REASON_LABEL } from '../medication-words'
import type { MarCellAt } from './mar-grid'
import styles from './mar.module.css'

/**
 * What one cell holds, as separate facts. CW PRD MED-04: "Tap any cell: detail
 * panel — who, when, dose, notes".
 *
 * **Separate facts, never one line.** Who gave it, when, the dose and route,
 * the reason and note, the second signature, the escalation and the closure
 * each get their own row, so a gap in one is drawn as a gap in that row and
 * cannot hide inside a sentence about the others. A missing second signature is
 * a hatched row beneath a "Given" pill. A closed omission keeps its hatched
 * "No record" row, and the closure is a plain row of its own.
 *
 * **Read-only.** The dialog holds no control but Close, and says so beneath its
 * title: the MAR is a record, and no historical dose is edited from it.
 */
export function MarCellDetail({
  at,
  resident,
  onClose,
}: {
  at: MarCellAt | 'none'
  resident: Resident
  onClose: () => void
}) {
  const format = useSiteFormat()
  if (at === 'none') return null
  const { medication, date, roundTime } = at

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`${medication.name}, ${roundTime} round on ${format.date(date)}`}
      description={`For ${resident.fullLegalName}. Read-only: nothing on the MAR can be changed.`}
      actions={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <dl className={styles.facts} data-cell-detail>
        <Fact name="Medicine">{medication.name}</Fact>
        <Fact name="Dose">{medication.dose}</Fact>
        <Fact name="Route">{medication.route}</Fact>
        <Fact name="Round">
          {roundTime} on {format.date(date)}
        </Fact>
        <CellFacts at={at} />
      </dl>
    </Dialog>
  )
}

function Fact({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className={styles.fact} data-fact={name}>
      <dt className={styles.factName}>{name}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  )
}

function CellFacts({ at }: { at: MarCellAt }) {
  const format = useSiteFormat()
  const { cell, medication } = at

  switch (cell.kind) {
    case 'not_on_this_round':
      return (
        <Fact name="Record">
          Not due: no dose of {medication.name} is prescribed at this round.
        </Fact>
      )
    case 'not_prescribed_yet':
      return (
        <Fact name="Record">
          Not due: {medication.name} was not prescribed until{' '}
          {format.date(cell.startedOn)}.
        </Fact>
      )
    case 'not_held':
      return (
        <Fact name="Record">
          No record of this round is held here. This is not a record that the dose was
          missed.
        </Fact>
      )
    case 'recorded':
      break
    default:
      return assertNever(cell)
  }

  const state = cell.state
  switch (state.kind) {
    case 'not_due':
      return <Fact name="Record">Not due: no dose was expected at this round.</Fact>

    case 'due':
      return (
        <>
          <Fact name="Record">
            <StatusPill tone="info" label="Due" />
          </Fact>
          <Fact name="Window">
            Open from {format.time(state.windowOpensAt)} until{' '}
            {format.time(state.windowClosesAt)}. Nothing is recorded yet.
          </Fact>
        </>
      )

    case 'given':
      return (
        <>
          <Fact name="Record">
            {medication.isPrn ? (
              'Given as required (PRN)'
            ) : (
              <StatusPill tone="positive" label="Given" />
            )}
          </Fact>
          <Fact name="Given by">{staffLabel(state.givenBy)}</Fact>
          <Fact name="Given at">{format.dateTime(state.givenAt)}</Fact>
          <Fact name="Second signature">
            <Witness witness={state.witness} />
          </Fact>
        </>
      )

    case 'not_given':
      return (
        <>
          <Fact name="Record">
            <StatusPill tone="critical" label="Not given" />
          </Fact>
          <Fact name="Reason">{NOT_GIVEN_REASON_LABEL[state.reason]}</Fact>
          <Fact name="Note">
            {state.note === '' ? 'No note was written with the reason.' : state.note}
          </Fact>
          <Fact name="Recorded by">{staffLabel(state.recordedBy)}</Fact>
          <Fact name="Recorded at">{format.dateTime(state.recordedAt)}</Fact>
        </>
      )

    case 'omitted':
      return (
        <>
          <Fact name="Record">
            <Unrecorded
              variant="chip"
              label="No record"
              detail="The window closed and nothing was recorded: not given, not refused, nothing."
            />
          </Fact>
          <Fact name="Due at">{format.dateTime(state.dueAt)}</Fact>
          <Fact name="Escalation">
            {state.escalation.kind === 'escalated'
              ? `Escalated at ${format.dateTime(state.escalation.at)}`
              : 'Not escalated'}
          </Fact>
          <Fact name="Closure">
            {state.closure.kind === 'closed' ? (
              <span className={styles.closure} data-closure-record>
                <span>
                  Closed by {staffLabel(state.closure.by)},{' '}
                  {format.dateTime(state.closure.at)}
                </span>
                <span>Why: {state.closure.reason}</span>
                <span className={styles.factNote}>
                  Closing records a decision about the gap. The dose still has no
                  record.
                </span>
              </span>
            ) : (
              'Not closed: nobody has closed this omission.'
            )}
          </Fact>
        </>
      )

    default:
      return assertNever(state)
  }
}

function Witness({ witness }: { witness: MarWitness }) {
  switch (witness.kind) {
    case 'not_required':
      return <>Not required for this medicine</>
    case 'witnessed':
      return <>Signed by {staffLabel(witness.by)}</>
    case 'required_not_recorded':
      return (
        <Unrecorded
          variant="chip"
          label="Second signature not recorded"
          detail="A controlled drug needs two signatures. This is half a record."
        />
      )
    default:
      return assertNever(witness)
  }
}
