import { useId, useState } from 'react'
import { now } from '@/data/fixtures/clock'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { ActLine } from '@/components/primitives'
import { AllergyBadge, AllergyNames, Unrecorded } from '@/components/status'
import { allergyNotCheckedLine } from '@/features/medications/SigningSubject'
import {
  NOT_GIVEN_REASON_LABEL,
  NOT_GIVEN_REASONS,
} from '@/features/medications/medication-words'
import { notOpenYetLine } from '@/features/medications/round/DoseRow'
import {
  doseName,
  neededAtLine,
  needsAt,
  signsLine,
  stillNeedLine,
  stateFor,
  UNANSWERED,
  type DoseAnswer,
} from '@/features/medications/round/round'
import { MedicationPinStep } from '@/features/medications/MedicationPinStep'
import { MEDICATION_PIN } from '@/features/medications/pin-wording'
import { openDosesAt, recordRound } from '@/data/access/client'
import { listInWords } from '@/features/notes/composer/note-fields'
import { assertNever } from '@/lib/assert-never'
import { formatDate, pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { notBuiltOnPhone } from '../not-built'
import type { Drug } from '../phone-chart'
import type { DoseRecord, Person } from '../phone-data'
import { DoseFacts } from './DoseFacts'
import { Sheet } from '../shell/Sheet'
import shell from '../shell/shell.module.css'
import { SubjectHeader } from '../SubjectHeader'
import { heldBack, sheetDoses, stillNeeded, type SheetDose } from './dose-sheet'
import styles from '../phone.module.css'

/** Said wherever the phone would record a PRN, which it does not yet. */
export const PRN_NOT_BUILT = notBuiltOnPhone(
  `Recording a ${VOCABULARY.medication.one} as required`,
)

/**
 * Recording one person's round on the phone: a full-height sheet over today's
 * chart. CW PRD MED-02, for one person, as module 3 step 4 scoped it.
 *
 * **Pinned under the title, for as long as the sheet is open**: who it is
 * (CLAUDE.md §2), their allergies in all three states, and the line saying that
 * nothing here checks the drugs against them. A sheet covers the record, so the
 * allergies on it are out of sight at exactly the moment they matter.
 *
 * **The pinned allergies are the substances alone, every one** (`AllergyNames`),
 * and the reaction and severity of each open the scrolling body, read before the
 * first dose. The head cannot scroll, so whatever it holds is taken from the
 * doses: with one row per allergy, seven allergies and the keyboard up left 8px
 * of doses on a 390-wide phone (PROGRESS.md, 06/11/2026). Names wrap to two or
 * three lines instead, and none is ever hidden to make room.
 *
 * **Every scheduled dose at the round is listed.** An ordinary dose whose window
 * is open takes Given or Not given, **with no default**: a default is a dose
 * recorded by nobody looking at it. Not given needs a reason, and Other needs
 * words. A controlled drug, a dose not due yet, an omission and a dose already
 * recorded each say what they are, and none takes an answer.
 *
 * **Signing is the medication PIN, inside the sheet**, under the same pinned
 * head: what it signs dose by dose, and the time it will put on the record,
 * said before the PIN is typed (`recordsAtLine`). **A round is signed whole**,
 * as the record takes it, so where an open dose the phone cannot answer is at
 * the round, the sheet says the round cannot be signed here rather than failing
 * at the PIN. The answers live in this sheet and go when it closes; no draft
 * survives it, or a sign-out.
 */
export function DoseSheet({
  person,
  drugs,
  records,
  roundTime,
  date,
  open,
  onOpenChange,
  onRecorded,
}: {
  person: Person
  drugs: Drug[]
  records: DoseRecord[]
  roundTime: string
  date: IsoDate
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called once the round is on the record, so the chart beneath reads it again. */
  onRecorded: () => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${roundTime} round for ${person.preferredName}`}
      height="full"
      head={
        <>
          <SubjectHeader person={person} name="here" />
          <div className={styles.gutter} data-sheet-allergies={person.allergies.kind}>
            <AllergyNames status={person.allergies} />
            <p className={styles.hint}>{allergyNotCheckedLine(person.fullLegalName)}</p>
          </div>
        </>
      }
    >
      <SheetBody
        person={person}
        drugs={drugs}
        records={records}
        roundTime={roundTime}
        date={date}
        onRecorded={onRecorded}
      />
    </Sheet>
  )
}

/** Mounted when the sheet opens, so each window is read at that moment. */
function SheetBody({
  person,
  drugs,
  records,
  roundTime,
  date,
  onRecorded,
}: {
  person: Person
  drugs: Drug[]
  records: DoseRecord[]
  roundTime: string
  date: IsoDate
  onRecorded: () => void
}) {
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const [answers, setAnswers] = useState<Record<string, DoseAnswer>>({})
  const [step, setStep] = useState<Step>({ kind: 'answering' })
  const doses = sheetDoses({ drugs, records, roundTime, date, at })
  const needed = stillNeeded(doses, answers)
  const held = heldBack(doses, openDosesAt(person.id, date, roundTime))
  const hasPrn = drugs.some((drug) => drug.isPrn)
  const answered = doses.flatMap((entry) =>
    entry.kind === 'to_answer'
      ? [
          {
            medication: entry.dose.medication,
            answer: answers[entry.dose.medication.id] ?? UNANSWERED,
          },
        ]
      : [],
  )

  const sign = async () => {
    /* The instant this build can stamp: the one its record was drawn at. */
    const stamp = now().toISOString() as IsoDateTime
    try {
      await recordRound({
        residentId: person.id,
        date,
        roundTime,
        doses: answered.map(({ medication: drug, answer }) => ({
          medicationId: drug.id,
          state: stateFor(answer, drug, member.ref, stamp),
        })),
        openingCounts: [],
        by: member.ref,
        at: stamp,
      })
      setStep({ kind: 'recorded', at: stamp })
      onRecorded()
    } catch (failure) {
      setStep({
        kind: 'refused',
        reason: failure instanceof Error ? failure.message : String(failure),
      })
    }
  }

  if (step.kind === 'recorded')
    return (
      <div className={styles.composer} data-dose-sheet={roundTime}>
        <p className={styles.savedLine} role="status" data-sheet-recorded>
          Recorded for {person.fullLegalName} at {format.time(step.at)}, held in this
          session only.
        </p>
      </div>
    )

  if (step.kind === 'signing')
    return (
      <div
        className={styles.composer}
        data-dose-sheet={roundTime}
        data-sheet-step="pin"
      >
        <p className={styles.body} data-records-at>
          {recordsAtLine(format.time(at))}
        </p>
        <MedicationPinStep
          signs={`For ${person.fullLegalName}, ${roundTime} round on ${formatDate(date)}. ${signsLine(answered, [], () => '')}.`}
          confirmLabel="Record doses"
          cancelLabel="Back to the answers"
          onConfirmed={() => void sign()}
          onCancel={() => setStep({ kind: 'answering' })}
        />
      </div>
    )

  return (
    <div className={styles.composer} data-dose-sheet={roundTime}>
      {person.allergies.kind === 'allergies' ? (
        <div className={styles.items} data-sheet-allergy-detail>
          <AllergyBadge status={person.allergies} />
        </div>
      ) : null}
      <ul className={styles.items}>
        {doses.map((entry) => (
          <li
            key={entry.dose.medication.id}
            className={styles.item}
            data-sheet-dose={entry.dose.medication.id}
            data-sheet-kind={entry.kind}
          >
            <SheetDoseRow
              entry={entry}
              needs={needsAt(needed.needs, entry.dose.medication.id)}
              answer={answers[entry.dose.medication.id] ?? UNANSWERED}
              onAnswer={(next) =>
                setAnswers((all) => ({ ...all, [entry.dose.medication.id]: next }))
              }
            />
          </li>
        ))}
      </ul>

      {hasPrn ? <ActLine kind="not_built">{PRN_NOT_BUILT}</ActLine> : null}

      <div className={styles.field} data-sheet-end>
        {needed.asked === 0 ? (
          <p className={styles.hint}>
            Nothing at the {roundTime} round can be recorded on the phone for{' '}
            {person.preferredName}.
          </p>
        ) : needed.needs.length > 0 ? (
          <p className={styles.hint} data-still-needed>
            {stillNeedLine(needed.needs, needed.asked)}
          </p>
        ) : (
          <p className={styles.hint} data-sheet-answered>
            {needed.answered} of {pluralise(needed.asked, 'dose')} answered
          </p>
        )}
        {step.kind === 'refused' ? (
          <p className={styles.refusal} role="alert" data-sheet-refused>
            Nothing was recorded. {step.reason}
          </p>
        ) : null}
        {needed.asked > 0 && held.length > 0 ? (
          <span data-sheet-held>
            <ActLine kind="refused">{heldBackLine(held)}</ActLine>
          </span>
        ) : needed.ready ? (
          <button
            type="button"
            className={`${shell.primary} ${shell.press}`}
            data-sheet-sign
            onClick={() => setStep({ kind: 'signing' })}
          >
            Sign with your {MEDICATION_PIN}
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Where the sheet is: answering, at the medication PIN, recorded, or refused by the record. */
type Step =
  | { kind: 'answering' }
  | { kind: 'signing' }
  | { kind: 'recorded'; at: IsoDateTime }
  | { kind: 'refused'; reason: string }

/**
 * The time the PIN will put on the record, said before it is typed, and what
 * that time is. **This build stamps the instant its record was drawn at** (the
 * page opening, or the time asked for), never the moment somebody signs; a real
 * build stamps the act itself (docs/DEPARTURES.md, phone).
 */
export const recordsAtLine = (time: string): string =>
  `This will be recorded as ${time}: the time this page was opened at, not the moment you sign.`

/**
 * Why a round cannot be signed here, though its ordinary doses are answered.
 * **A round is signed whole**: the record refuses one short of any open dose
 * (`recordRound`, `openDosesAt`), and these are open doses the phone cannot
 * answer.
 */
export const heldBackLine = (held: string[]): string =>
  `A round is signed all at once, and ${listInWords(held)} cannot be recorded on the phone, so this round cannot be signed here.`

function SheetDoseRow({
  entry,
  needs,
  answer,
  onAnswer,
}: {
  entry: SheetDose
  /** What this dose still needs before the round can be signed, said at it. */
  needs: string[]
  answer: DoseAnswer
  onAnswer: (next: DoseAnswer) => void
}) {
  const format = useSiteFormat()
  const { medication: drug, record } = entry.dose
  switch (entry.kind) {
    case 'recorded':
    case 'window_closed':
      if (record.state.kind === 'due' || record.state.kind === 'not_due')
        throw new Error(`${doseName(drug)} has no record to show.`)
      return (
        <DoseFacts
          dose={{ drug: drug, cell: { kind: 'recorded', state: record.state } }}
          recordsHere={false}
          cannotCorrect="at_dose"
        />
      )
    case 'controlled':
      return (
        <>
          <DoseName entry={entry} />
          <span data-cannot-record="controlled">
            <ActLine kind="not_built">
              {notBuiltOnPhone('Recording a controlled drug')}
            </ActLine>
          </span>
        </>
      )
    case 'not_open_yet':
      return (
        <>
          <DoseName entry={entry} />
          <p className={styles.hint} data-not-open-yet>
            {notOpenYetLine(format.time(entry.opensAt))}
          </p>
        </>
      )
    case 'to_answer':
      return (
        <>
          <DoseName entry={entry} />
          <Answers name={doseName(drug)} answer={answer} onAnswer={onAnswer} />
          {needs.length === 0 ? null : (
            <p className={styles.hint} data-needed>
              {neededAtLine(needs)}
            </p>
          )}
        </>
      )
    default:
      return assertNever(entry)
  }
}

/** What the dose is: the drug and dose, route, window, and its instructions. */
function DoseName({ entry }: { entry: SheetDose }) {
  const format = useSiteFormat()
  const { medication: drug, record } = entry.dose
  return (
    <>
      <p className={styles.value}>
        {doseName(drug)}
        {drug.isControlledDrug ? (
          <span className={styles.quiet}> · Controlled drug</span>
        ) : null}
      </p>
      <p className={styles.quiet}>
        {drug.route}
        {record.state.kind === 'due'
          ? ` · Window ${format.time(record.state.windowOpensAt)} to ${format.time(record.state.windowClosesAt)}`
          : ''}
      </p>
      {drug.instructions.kind === 'recorded' ? (
        <p className={styles.body}>{drug.instructions.value}</p>
      ) : (
        <Unrecorded label="Special instructions not recorded" />
      )}
    </>
  )
}

/**
 * Given or Not given, neither chosen until somebody chooses; then, for Not
 * given, the reason, and words where the reason is Other.
 */
function Answers({
  name,
  answer,
  onAnswer,
}: {
  name: string
  answer: DoseAnswer
  onAnswer: (next: DoseAnswer) => void
}) {
  const id = useId()
  const choice = (label: string, chosen: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={chosen}
      className={[styles.choiceRow, shell.press, chosen ? styles.choiceChosen : '']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
    >
      <span>{label}</span>
    </button>
  )

  return (
    <div className={styles.doseAnswer}>
      <div role="radiogroup" aria-label={`Answer for ${name}`} className={styles.items}>
        {choice('Given', answer.kind === 'given', () =>
          onAnswer({ kind: 'given', openingCount: '', witness: 'not_chosen' }),
        )}
        {choice('Not given', answer.kind === 'not_given', () =>
          onAnswer({ kind: 'not_given', reason: 'not_chosen', note: '' }),
        )}
      </div>
      {answer.kind === 'not_given' ? (
        <>
          <div
            role="radiogroup"
            aria-label={`Why ${name} was not given`}
            className={styles.items}
          >
            {NOT_GIVEN_REASONS.map((reason) =>
              choice(NOT_GIVEN_REASON_LABEL[reason], answer.reason === reason, () =>
                onAnswer({ ...answer, reason }),
              ),
            )}
          </div>
          {answer.reason === 'not_chosen' ? null : (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${id}-note`}>
                {answer.reason === 'other'
                  ? 'Why was it not given? (required)'
                  : 'Note (optional)'}
              </label>
              <textarea
                id={`${id}-note`}
                className={styles.textField}
                rows={3}
                value={answer.note}
                onChange={(event) => onAnswer({ ...answer, note: event.target.value })}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
