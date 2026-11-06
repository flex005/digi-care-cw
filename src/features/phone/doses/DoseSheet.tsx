import { useId, useState } from 'react'
import { now } from '@/data/fixtures/clock'
import type { IsoDate, IsoDateTime } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import { ActLine } from '@/components/primitives'
import { AllergyBadge, Unrecorded } from '@/components/status'
import { allergyNotCheckedLine } from '@/features/medications/SigningSubject'
import {
  NOT_GIVEN_REASON_LABEL,
  NOT_GIVEN_REASONS,
} from '@/features/medications/medication-words'
import { notOpenYetLine } from '@/features/medications/round/DoseRow'
import {
  doseName,
  UNANSWERED,
  type DoseAnswer,
} from '@/features/medications/round/round'
import { listInWords } from '@/features/notes/composer/note-fields'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { notBuiltOnPhone } from '../not-built'
import type { Drug } from '../phone-chart'
import type { DoseRecord, Person } from '../phone-data'
import { DoseFacts } from './DoseFacts'
import { Sheet } from '../shell/Sheet'
import shell from '../shell/shell.module.css'
import { SubjectHeader } from '../SubjectHeader'
import { sheetDoses, stillNeeded, type SheetDose } from './dose-sheet'
import styles from '../phone.module.css'

/** Said wherever the phone would record a PRN, which it does not yet. */
export const PRN_NOT_BUILT = notBuiltOnPhone(
  `Recording a ${VOCABULARY.medication.one} as required`,
)

/** Said where the sheet would sign, until the drug PIN step is built. */
export const SIGNING_NOT_BUILT = notBuiltOnPhone('Signing with your drug PIN')

/**
 * Recording one person's round on the phone: a full-height sheet over today's
 * chart. CW PRD MED-02, for one person, as module 3 step 4 scoped it.
 *
 * **Pinned under the title, for as long as the sheet is open**: who it is
 * (CLAUDE.md §2), their allergies in all three states, and the line saying that
 * nothing here checks the drugs against them. A sheet covers the record, so the
 * allergies on it are out of sight at exactly the moment they matter.
 *
 * **Every scheduled dose at the round is listed.** An ordinary dose whose window
 * is open takes Given or Not given, **with no default**: a default is a dose
 * recorded by nobody looking at it. Not given needs a reason, and Other needs
 * words. A controlled drug, a dose not due yet, an omission and a dose already
 * recorded each say what they are, and none takes an answer.
 *
 * **Nothing is recorded here.** Signing is the drug PIN, which is the next
 * step and says it is not built yet. The answers live in this sheet and go when
 * it closes; no draft survives it, or a sign-out.
 */
export function DoseSheet({
  person,
  drugs,
  records,
  roundTime,
  date,
  open,
  onOpenChange,
}: {
  person: Person
  drugs: Drug[]
  records: DoseRecord[]
  roundTime: string
  date: IsoDate
  open: boolean
  onOpenChange: (open: boolean) => void
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
            <AllergyBadge status={person.allergies} />
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
}: {
  person: Person
  drugs: Drug[]
  records: DoseRecord[]
  roundTime: string
  date: IsoDate
}) {
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const [answers, setAnswers] = useState<Record<string, DoseAnswer>>({})
  const doses = sheetDoses({ drugs, records, roundTime, date, at })
  const needed = stillNeeded(doses, answers)
  const hasPrn = drugs.some((drug) => drug.isPrn)

  return (
    <div className={styles.composer} data-dose-sheet={roundTime}>
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
        ) : (
          <p className={styles.hint} data-sheet-answered>
            {needed.answered} of {pluralise(needed.asked, 'dose')} answered
          </p>
        )}
        {needed.waiting.length > 0 ? (
          <p className={styles.hint} data-still-needed>
            Still needed: {listInWords(needed.waiting)}.
          </p>
        ) : null}
        {needed.ready ? (
          <span data-sheet-sign>
            <ActLine kind="not_built">{SIGNING_NOT_BUILT}</ActLine>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function SheetDoseRow({
  entry,
  answer,
  onAnswer,
}: {
  entry: SheetDose
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
