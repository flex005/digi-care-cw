import { useState } from 'react'
import type {
  IsoDate,
  IsoDateTime,
  Medication,
  Site,
  StaffMember,
  StockBalance,
  StockCount,
} from '@/data/types'
import { prnGivenThisSession, recordPrn, recordRound } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Button, Card, CardHead, Dialog } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatDate, pluralise } from '@/lib/format'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { MedicationPinStep } from '../MedicationPinStep'
import { registerState } from '../register/register'
import { DoseRow } from './DoseRow'
import { PrnRow } from './PrnRow'
import {
  isRecorded,
  needsOpeningCount,
  outstanding,
  PRN_NOT_CHOSEN,
  signsLine,
  stateFor,
  UNANSWERED,
  windowFor,
  type DoseAccess,
  type DoseAnswer,
  type DoseRecordAccess,
  type PrnAnswer,
  type RoundDose,
  type RoundResident,
} from './round'
import styles from './round.module.css'

/**
 * One resident's doses at this round, answered on the card and recorded together
 * with one act. CW PRD MED-02.
 *
 * **The subject is on the card, from the record.** Photo, name, preferred name,
 * room, date of birth and allergies sit at the head of the card and stay in view
 * while it scrolls (CLAUDE.md §2). Nothing about who a dose is for comes from
 * which card was opened last: every answer is held by the card it belongs to,
 * keyed by that resident's medications.
 *
 * **One act, one signature, every answer listed.** The medication PIN step
 * names each dose and what it is being recorded as, so a PIN confirms something
 * specific.
 */
export function ResidentRoundCard({
  entry,
  site,
  roundTime,
  date,
  counts,
  balance,
  witnesses,
  onRecorded,
}: {
  entry: RoundResident
  site: Site
  roundTime: string
  date: IsoDate
  counts: StockCount[]
  balance: (medication: Medication) => StockBalance
  witnesses: StaffMember[]
  onRecorded: () => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()
  const { resident, doses, asRequired } = entry

  const [answers, setAnswers] = useState<Record<string, DoseAnswer>>({})
  const [prn, setPrn] = useState<Record<string, PrnAnswer>>({})
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')
  const [recordedAt, setRecordedAt] = useState<IsoDateTime | 'not_this_session'>(
    'not_this_session',
  )

  const controlledDrugAnswer = viewer.ask('record_controlled_drug_dose', resident.id)
  /** The instant this card is drawn against, which decides every window on it. */
  const asOf = now().toISOString() as IsoDateTime
  const recordAccess = (dose: RoundDose): DoseRecordAccess => {
    if (!dose.medication.isControlledDrug) return { kind: 'open' }
    if (controlledDrugAnswer.kind !== 'yes') return { kind: 'cannot_record' }
    const counted = counts.filter((count) => count.medicationId === dose.medication.id)
    return registerState(counted).kind === 'discrepancy'
      ? { kind: 'discrepancy' }
      : { kind: 'open' }
  }
  const access = (dose: RoundDose): DoseAccess => ({
    window: windowFor(dose, asOf),
    record: recordAccess(dose),
  })

  const answerOf = (dose: RoundDose) => answers[dose.medication.id] ?? UNANSWERED
  const prnEntries = asRequired.map((medication) => ({
    medication,
    answer: prn[medication.id] ?? PRN_NOT_CHOSEN,
  }))
  const { waiting, blocked, notOpenYet, ready } = outstanding({
    doses,
    answers,
    access,
    balance,
    prn: prnEntries,
  })

  const open = doses.filter((dose) => dose.record.state.kind === 'due')
  const recorded = doses.filter((dose) => isRecorded(dose.record.state)).length
  const chosen = open.filter((dose) => answerOf(dose).kind !== 'unanswered')
  const witnessName = (id: string) =>
    witnesses.find((entry) => entry.id === id)?.ref.fullName ?? id
  const signs = signsLine(
    chosen.map((dose) => ({ medication: dose.medication, answer: answerOf(dose) })),
    prnEntries,
    witnessName,
  )
  const actLabel = `Record ${resident.fullLegalName}’s ${roundTime} doses`
  const firstNotOpen = notOpenYet[0]
  const opensAt = (dose: RoundDose): IsoDateTime => {
    const window = windowFor(dose, asOf)
    if (window.kind !== 'not_open_yet')
      throw new Error(`${dose.medication.name}'s window is open; it has no opening.`)
    return window.opensAt
  }

  const submit = async () => {
    const at = now().toISOString() as IsoDateTime
    try {
      if (chosen.length > 0) {
        await recordRound({
          residentId: resident.id,
          date,
          roundTime,
          doses: chosen.map((dose) => ({
            medicationId: dose.medication.id,
            state: stateFor(answerOf(dose), dose.medication, member.ref, at),
          })),
          openingCounts: chosen.flatMap((dose) => {
            const answer = answerOf(dose)
            if (answer.kind !== 'given') return []
            if (!needsOpeningCount(dose.medication, balance(dose.medication), answer))
              return []
            const witness = witnesses.find((entry) => entry.id === answer.witness)
            if (witness === undefined)
              throw new Error(
                `${dose.medication.name} has no witness to its opening count.`,
              )
            return [
              {
                medicationId: dose.medication.id,
                counted: Number(answer.openingCount.trim()),
                witnessedBy: witness.ref,
              },
            ]
          }),
          by: member.ref,
          at,
        })
      }
      for (const { medication, answer } of prnEntries) {
        if (answer.kind !== 'prn') continue
        await recordPrn({
          residentId: resident.id,
          medicationId: medication.id,
          reason: answer.reason,
          symptom: answer.symptom,
          by: member.ref,
          at,
        })
      }
      setAnswers({})
      setPrn({})
      setError('')
      setRecordedAt(at)
      onRecorded()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
    }
  }

  return (
    <Card>
      <div
        className={styles.cardBody}
        id={`round-${resident.id}`}
        data-round-card={resident.id}
      >
        <CardHead
          title={`${resident.preferredName}’s ${roundTime} doses`}
          subtitle={`${recorded} of ${pluralise(doses.length, 'dose')} recorded`}
          expand={{
            kind: 'link',
            href: `/residents/${resident.id}/medications/mar`,
          }}
        />
        <SubjectStrip resident={resident} site={site} />

        <ul
          className={styles.doses}
          aria-label={`Doses due at ${roundTime} for ${resident.fullLegalName}`}
        >
          {doses.map((dose) => (
            <DoseRow
              key={dose.medication.id}
              dose={dose}
              answer={answerOf(dose)}
              onAnswer={(next) =>
                setAnswers((current) => ({ ...current, [dose.medication.id]: next }))
              }
              access={access(dose)}
              controlledDrugAnswer={
                dose.medication.isControlledDrug
                  ? controlledDrugAnswer
                  : 'not_controlled'
              }
              balance={balance(dose.medication)}
              witnesses={witnesses}
              residentName={resident.fullLegalName}
            />
          ))}
        </ul>

        {asRequired.length === 0 ? null : (
          <section className={styles.asRequired} aria-label="As required">
            <h3 className={styles.sectionTitle}>As required</h3>
            <p className={styles.quiet}>
              Not due at a round. Nothing here has to be answered before the round is
              recorded.
            </p>
            <ul className={styles.doses}>
              {prnEntries.map(({ medication, answer }) => (
                <PrnRow
                  key={medication.id}
                  medication={medication}
                  answer={answer}
                  onAnswer={(next) =>
                    setPrn((current) => ({ ...current, [medication.id]: next }))
                  }
                  given={prnGivenThisSession(resident.id).filter(
                    (given) => given.medicationId === medication.id,
                  )}
                  onOutcomeRecorded={onRecorded}
                />
              ))}
            </ul>
          </section>
        )}

        <div className={styles.cardFoot}>
          {/* Every dose at one round shares one window, so the card says it
              once. Where that is ever not true, each dose carries its own line
              and this one is not drawn. */}
          {firstNotOpen === undefined || notOpenYet.length !== open.length ? null : (
            <p className={styles.notOpenYetAct} data-card-not-open-yet>
              The {roundTime} window has not opened. Nothing can be recorded for{' '}
              {resident.fullLegalName} until {format.time(opensAt(firstNotOpen))}.
            </p>
          )}
          {blocked.length === 0 ? null : (
            <p className={styles.blocked} data-round-blocked>
              This round cannot be recorded for {resident.fullLegalName} while the
              controlled drug is unanswered.
            </p>
          )}
          {open.length === 0 && asRequired.length === 0 ? (
            <p className={styles.quiet}>
              Nothing is left to record for {resident.fullLegalName} at {roundTime}.
            </p>
          ) : (
            /* What is outstanding and what to do about it, on one line: the
               act answers the sentence beside it, and stacked under it the
               button read as the next thing rather than as the answer. */
            <div className={styles.actRow}>
              {waiting.length === 0 ? null : (
                <p className={styles.waiting} data-waiting>
                  Waiting on: {waiting.join(' · ')}
                </p>
              )}
              <div className={styles.actRowAct}>
                <Button
                  size="large"
                  disabled={!ready}
                  onClick={() => {
                    setError('')
                    setSigning(true)
                  }}
                >
                  {actLabel}
                </Button>
              </div>
            </div>
          )}
          {recordedAt === 'not_this_session' ? null : (
            <p className={styles.quiet} role="status">
              Recorded for {resident.fullLegalName} at {format.time(recordedAt)}, held
              in this session only.
            </p>
          )}
          {error === '' ? null : (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <Dialog open={signing} onOpenChange={setSigning} title={`${actLabel}?`}>
        {signing ? (
          <div className={styles.signing}>
            <p className={styles.signingSubject} data-signing-subject={resident.id}>
              <span>{resident.fullLegalName}</span>
              <span>
                {resident.room.kind === 'recorded' ? (
                  `Room ${resident.room.value}`
                ) : (
                  <Unrecorded label="Room not recorded" />
                )}
              </span>
              <span data-numeric>Born {formatDate(resident.dateOfBirth)}</span>
            </p>
            <MedicationPinStep
              signs={`For ${resident.fullLegalName}, ${roundTime} round on ${formatDate(date)}. ${signs}.`}
              confirmLabel="Record doses"
              onConfirmed={() => {
                setSigning(false)
                void submit()
              }}
              onCancel={() => setSigning(false)}
            />
          </div>
        ) : null}
      </Dialog>
    </Card>
  )
}
