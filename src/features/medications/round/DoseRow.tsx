import Link from 'next/link'
import type { Answer } from '@/app/session/capabilities'
import type {
  IsoDateTime,
  NotGivenReason,
  StaffMember,
  StockBalance,
} from '@/data/types'
import { ROUND_WINDOW_MINUTES } from '@/data/fixtures/rounds'
import { useSiteFormat } from '@/app/session/use-session'
import { ActPoint } from '@/components/layout/ActPoint'
import { RadioGroup, Select, SelectedMark, TextField } from '@/components/primitives'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { NOT_GIVEN_REASON_LABEL, NOT_GIVEN_REASONS } from '../medication-words'
import {
  needsOpeningCount,
  type DoseAccess,
  type DoseAnswer,
  type RoundDose,
} from './round'
import styles from './round.module.css'

/** The one sentence a count that does not reconcile carries, in the PRD's words (MED-03). */
export const DISCREPANCY_LINE =
  'Stock count does not match the running balance. This must be resolved before any further administration.'

/**
 * The one line a dose whose window has not opened carries.
 *
 * **It names the state first.** "Not due yet" is what is true of the dose;
 * the hour and the reason follow. A line that only explained why a button was
 * unavailable would leave the reader to infer the state from a disabled
 * control.
 *
 * **Not a gap and not a refusal of this reader.** Nobody may record it yet,
 * whatever their role: the dose is not due. So it is drawn in the neutral
 * information tint rather than hatched or in a status colour, and it names the
 * hour rather than asking somebody to work it out. The hatch begins where this
 * ends: once the window is open and nothing is on the record, nobody has
 * recorded a dose that was due, and that is the unrecorded treatment.
 */
export const notOpenYetLine = (opensAt: string): string =>
  `Not due yet — the window opens at ${opensAt}. Giving a drug early is a clinical decision, and nothing in this product can make one.`

/**
 * One scheduled dose at this round, and the answer chosen for it.
 *
 * **A dose on the record shows the record, never the buttons**: a second
 * answer over somebody else's would put this session's name on a dose they
 * did not give.
 *
 * **Given and Not given are two buttons with no default.** A default here is a
 * dose recorded by nobody looking at it.
 *
 * **A controlled drug the role table does not let this viewer record** is drawn
 * with the table's own answer at the Given button, and the dose stays open: no
 * Not given either, because recording that is recording the dose.
 */
export function DoseRow({
  dose,
  answer,
  onAnswer,
  access,
  controlledDrugAnswer,
  balance,
  witnesses,
  residentName,
}: {
  dose: RoundDose
  answer: DoseAnswer
  onAnswer: (next: DoseAnswer) => void
  access: DoseAccess
  /** The role table's answer for a controlled drug; `not_controlled` otherwise. */
  controlledDrugAnswer: Answer | 'not_controlled'
  balance: StockBalance
  witnesses: StaffMember[]
  residentName: string
}) {
  const format = useSiteFormat()
  const { medication, record } = dose
  const state = record.state

  return (
    <li
      className={styles.dose}
      data-dose={medication.id}
      data-record={state.kind}
      data-answer={answer.kind}
    >
      <div className={styles.doseAbout}>
        <p className={styles.doseName}>{medication.name}</p>
        <p className={styles.doseFacts}>
          <span data-numeric>{medication.dose}</span>
          <span>{medication.route}</span>
          {state.kind === 'due' ? (
            <span data-numeric>
              Window {format.time(state.windowOpensAt)} to{' '}
              {format.time(state.windowClosesAt)}
            </span>
          ) : null}
        </p>
        {medication.isControlledDrug ? (
          <span className={styles.doseTag}>
            <StatusPill tone="brand" label="Controlled drug" />
          </span>
        ) : null}
        {medication.instructions.kind === 'recorded' ? (
          <p className={styles.instructions}>{medication.instructions.value}</p>
        ) : (
          <Unrecorded label="Special instructions not recorded" />
        )}
      </div>

      <div className={styles.doseAnswer}>
        {state.kind === 'due' ? (
          <OpenDose
            dose={dose}
            answer={answer}
            onAnswer={onAnswer}
            access={access}
            controlledDrugAnswer={controlledDrugAnswer}
            balance={balance}
            witnesses={witnesses}
            residentName={residentName}
          />
        ) : (
          <RecordedDose dose={dose} />
        )}
      </div>
    </li>
  )
}

function OpenDose({
  dose,
  answer,
  onAnswer,
  access,
  controlledDrugAnswer,
  balance,
  witnesses,
  residentName,
}: {
  dose: RoundDose
  answer: DoseAnswer
  onAnswer: (next: DoseAnswer) => void
  access: DoseAccess
  controlledDrugAnswer: Answer | 'not_controlled'
  balance: StockBalance
  witnesses: StaffMember[]
  residentName: string
}) {
  const format = useSiteFormat()
  const { medication } = dose
  const name = `${medication.name} ${medication.dose}`
  const { window, record } = access
  const notOpenYet = window.kind === 'not_open_yet'

  return (
    <>
      {window.kind === 'not_open_yet' ? (
        <p className={styles.notOpenYet} data-not-open-yet>
          {notOpenYetLine(format.time(window.opensAt))}
        </p>
      ) : null}

      {record.kind === 'discrepancy' ? (
        <p className={styles.discrepancy} data-discrepancy>
          {DISCREPANCY_LINE}
        </p>
      ) : null}

      {record.kind === 'cannot_record' && controlledDrugAnswer !== 'not_controlled' ? (
        <div className={styles.answerRefused}>
          <ActPoint
            answer={controlledDrugAnswer}
            label="Given"
            notBuilt="Recording a controlled drug dose is not built."
            residentName={residentName}
          />
        </div>
      ) : (
        <div className={styles.answers} role="group" aria-label={`Answer for ${name}`}>
          <AnswerButton
            label="Given"
            chosen={answer.kind === 'given'}
            disabled={notOpenYet || record.kind === 'discrepancy'}
            onClick={() =>
              onAnswer({ kind: 'given', openingCount: '', witness: 'not_chosen' })
            }
          />
          <AnswerButton
            label="Not given"
            chosen={answer.kind === 'not_given'}
            disabled={notOpenYet}
            onClick={() =>
              onAnswer({ kind: 'not_given', reason: 'not_chosen', note: '' })
            }
          />
        </div>
      )}

      {/* A dose that is not due yet is not a dose nobody has recorded: there is
          nothing to record. The hatch would claim a gap the chart does not
          hold, and the line above says what is true instead. */}
      {answer.kind === 'unanswered' && !notOpenYet ? (
        <Unrecorded label="Not recorded yet" />
      ) : null}

      {answer.kind === 'not_given' ? (
        <div className={styles.answerDetail}>
          <RadioGroup
            legend={`Why was ${name} not given?`}
            options={NOT_GIVEN_REASONS.map((reason) => ({
              value: reason,
              label: NOT_GIVEN_REASON_LABEL[reason],
            }))}
            value={answer.reason === 'not_chosen' ? undefined : answer.reason}
            onValueChange={(value) =>
              onAnswer({ ...answer, reason: value as NotGivenReason })
            }
          />
          {answer.reason === 'other' ? (
            <TextField
              label="Say why it was not given"
              value={answer.note}
              onChange={(note) => onAnswer({ ...answer, note })}
              hint={answer.note.trim() === '' ? 'Other needs words.' : undefined}
            />
          ) : null}
        </div>
      ) : null}

      {answer.kind === 'given' && medication.isControlledDrug ? (
        <div className={styles.answerDetail} data-controlled-drug>
          <p className={styles.quiet}>{secondSignatureLine(controlledDrugAnswer)}</p>
          {needsOpeningCount(medication, balance, answer) ? (
            <>
              <Unrecorded
                label="No balance recorded for this drug"
                detail="nobody has counted it: your count becomes the opening balance, signed by you and the witness you choose"
              />
              <TextField
                label={`Opening balance: count the cabinet, in ${medication.stockUnit}`}
                value={answer.openingCount}
                onChange={(openingCount) => onAnswer({ ...answer, openingCount })}
              />
              {witnesses.length === 0 ? (
                <Unrecorded
                  label="Nobody here can witness the opening count"
                  detail="the role table lets nobody else at this home countersign a controlled drug"
                />
              ) : (
                <Select
                  label="Witness to the opening count"
                  labelVisible
                  placeholder="Choose a witness"
                  value={answer.witness === 'not_chosen' ? undefined : answer.witness}
                  onValueChange={(witness) => onAnswer({ ...answer, witness })}
                  options={witnesses.map((member) => ({
                    value: member.id,
                    label: member.ref.fullName,
                  }))}
                />
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

/**
 * What finishing a controlled drug dose still needs, said from the role table's
 * completion rather than written here.
 */
function secondSignatureLine(answer: Answer | 'not_controlled'): string {
  if (answer === 'not_controlled' || answer.kind !== 'yes') return ''
  switch (answer.completion.kind) {
    case 'needs_a_second_signature':
      return answer.completion.by === 'a_second_senior_witness'
        ? 'Recording this is the first signature. A second senior carer countersigns on the register afterwards.'
        : 'Recording this is the first signature. The other shift signs afterwards.'
    case 'done_when_done':
    case 'handed_on':
      return ''
    default:
      return assertNever(answer.completion)
  }
}

function AnswerButton({
  label,
  chosen,
  disabled,
  onClick,
}: {
  label: string
  chosen: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={chosen ? styles.answerChosen : styles.answer}
      aria-pressed={chosen}
      disabled={disabled}
      onClick={onClick}
    >
      <SelectedMark selected={chosen} />
      {label}
    </button>
  )
}

/**
 * The chart's answer for a dose somebody has already dealt with, or the fact
 * that nobody did.
 *
 * **A compound state renders as separate facts.** A controlled drug given with
 * its second signature still to come is "Given" and, beside it, the hatched
 * missing signature: half a record, and it says so.
 */
function RecordedDose({ dose }: { dose: RoundDose }) {
  const format = useSiteFormat()
  const state = dose.record.state

  switch (state.kind) {
    case 'given':
      switch (state.witness.kind) {
        case 'not_required':
          return (
            <Settled
              label="Given"
              detail={format.attribution(state.givenBy.displayName, state.givenAt)}
            />
          )
        case 'witnessed':
          return (
            <Settled
              label="Given"
              detail={`${format.attribution(state.givenBy.displayName, state.givenAt)} · second signature ${state.witness.by.displayName}`}
            />
          )
        case 'required_not_recorded':
          return (
            <div className={styles.facts} data-half-record>
              <StatusPill
                tone="positive"
                label="Given"
                detail={format.attribution(state.givenBy.displayName, state.givenAt)}
              />
              <Unrecorded
                label="Second signature not recorded"
                detail="a second senior carer countersigns on the register"
              />
              <Link href="/medications/register" className={styles.link}>
                Open the controlled drug register
              </Link>
            </div>
          )
        default:
          return assertNever(state.witness)
      }
    case 'not_given':
      return (
        <Settled
          label={`Not given: ${NOT_GIVEN_REASON_LABEL[state.reason]}`}
          detail={[
            state.note === '' ? '' : state.note,
            format.attribution(state.recordedBy.displayName, state.recordedAt),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )
    case 'omitted':
      return (
        <Unrecorded
          label="Nothing recorded"
          detail={`the window closed at ${format.time(
            new Date(
              new Date(state.dueAt).getTime() + ROUND_WINDOW_MINUTES * 60_000,
            ).toISOString() as IsoDateTime,
          )}`}
        />
      )
    case 'due':
    case 'not_due':
      throw new Error(
        `${dose.medication.name} was drawn as recorded while ${state.kind}.`,
      )
    default:
      return assertNever(state)
  }
}
