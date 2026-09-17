import { useState } from 'react'
import type { IsoDateTime, Medication } from '@/data/types'
import type { PrnAdministration } from '@/data/access/mar-store'
import { recordPrnOutcomeFor } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { staffLabel } from '@/data/access/team-store'
import { ActLine, Button, SelectedMark, TextField } from '@/components/primitives'
import { Settled, Unrecorded } from '@/components/status'
import type { PrnAnswer } from './round'
import styles from './round.module.css'

/**
 * An as-required medication on a resident's card, and the doses given from it
 * this session.
 *
 * **PRN is more than a third button.** A reason and a symptom before the dose,
 * recorded with the medication PIN alongside the card's other answers, and an
 * outcome afterwards, which is a second write the other answers do not have.
 * Until somebody writes it the outcome is hatched: a dose given and never
 * checked is not a complete record.
 *
 * **The dose is the prescribed dose, shown and not chosen.** The loader records
 * no dose of its own, so a field offering a different one would accept a
 * figure and keep none of it.
 */
export function PrnRow({
  medication,
  answer,
  onAnswer,
  given,
  onOutcomeRecorded,
}: {
  medication: Medication
  answer: PrnAnswer
  onAnswer: (next: PrnAnswer) => void
  given: PrnAdministration[]
  onOutcomeRecorded: () => void
}) {
  const chosen = answer.kind === 'prn'
  const name = `${medication.name} ${medication.dose}`

  return (
    <li className={styles.dose} data-prn={medication.id} data-answer={answer.kind}>
      <div className={styles.doseAbout}>
        <p className={styles.doseName}>{medication.name}</p>
        <p className={styles.doseFacts}>
          <span data-numeric>{medication.dose}</span>
          <span>{medication.route}</span>
          <span>As required</span>
        </p>
        {medication.instructions.kind === 'recorded' ? (
          <p className={styles.instructions}>{medication.instructions.value}</p>
        ) : (
          <Unrecorded label="Special instructions not recorded" />
        )}
        {given.map((entry) => (
          <PrnGiven
            key={entry.id}
            entry={entry}
            onOutcomeRecorded={onOutcomeRecorded}
          />
        ))}
      </div>

      <div className={styles.doseAnswer}>
        <div className={styles.answers} role="group" aria-label={`Answer for ${name}`}>
          <button
            type="button"
            className={chosen ? styles.answerChosen : styles.answer}
            aria-pressed={chosen}
            onClick={() =>
              onAnswer(
                chosen
                  ? { kind: 'not_chosen' }
                  : { kind: 'prn', reason: '', symptom: '' },
              )
            }
          >
            <SelectedMark selected={chosen} />
            PRN
          </button>
        </div>

        {answer.kind === 'prn' ? (
          <div className={styles.answerDetail}>
            <TextField
              label="Reason for giving it"
              value={answer.reason}
              onChange={(reason) => onAnswer({ ...answer, reason })}
            />
            <TextField
              label="Symptom observed"
              value={answer.symptom}
              onChange={(symptom) => onAnswer({ ...answer, symptom })}
            />
            <p className={styles.quiet}>
              Dose given: <span data-numeric>{medication.dose}</span>, as prescribed.
            </p>
            <ActLine kind="not_built">
              A dose other than the prescribed one cannot be recorded here.
            </ActLine>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function PrnGiven({
  entry,
  onOutcomeRecorded,
}: {
  entry: PrnAdministration
  onOutcomeRecorded: () => void
}) {
  const format = useSiteFormat()
  const { member } = useSignedIn()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const record = () => {
    recordPrnOutcomeFor({
      id: entry.id,
      text,
      at: now().toISOString() as IsoDateTime,
      by: member.ref,
    })
      .then(() => {
        setText('')
        setError('')
        onOutcomeRecorded()
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'The outcome was not recorded.',
        ),
      )
  }

  return (
    <div className={styles.prnGiven} data-prn-given={entry.id}>
      <Settled
        label={`PRN given: ${entry.symptom}, ${entry.reason}`}
        detail={format.attribution(staffLabel(entry.givenBy), entry.givenAt)}
      />
      {entry.outcome.kind === 'recorded' ? (
        <Settled
          label={`Outcome: ${entry.outcome.text}`}
          detail={format.attribution(staffLabel(entry.outcome.by), entry.outcome.at)}
        />
      ) : (
        <div className={styles.answerDetail} data-outcome="not_recorded">
          <Unrecorded
            label="Outcome not recorded yet"
            detail="a dose given and never checked is not a complete record"
          />
          <TextField label="What happened afterwards" value={text} onChange={setText} />
          {error === '' ? null : (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actRow}>
            <Button
              variant="secondary"
              size="large"
              disabled={text.trim() === ''}
              onClick={record}
            >
              Record outcome
            </Button>
          </div>
          <ActLine kind="not_performed">No reminder is sent after 30 minutes.</ActLine>
        </div>
      )}
    </div>
  )
}
