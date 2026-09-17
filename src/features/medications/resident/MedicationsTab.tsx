import Link from 'next/link'
import type { DueMedication } from '@/data/access/client'
import type { Medication } from '@/data/types'
import { prnGivenThisSession, stockBalanceFor } from '@/data/access/client'
import { staffLabel } from '@/data/access/team-store'
import { Card, CardHead, buttonClassName } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import {
  Field,
  FieldList,
  RecordedValueField,
} from '@/features/residents/tabs/FieldList'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import { quantityWithUnit } from '../register/units'
import { residentMedicationsIcons } from './resident-medications.icons'
import styles from './medications-tab.module.css'

/**
 * A resident's Medications tab. RES-03, MED-04's way in.
 *
 * **Every medication prescribed, each field answered.** A prescription card
 * lists what giving the drug requires: the dose, the route, when, how often,
 * how, who prescribed it, where it is kept, the most allowed in 24 hours and,
 * for a controlled drug, the balance the register stands at. A field nobody
 * recorded is hatched and says what is missing, never an empty row.
 *
 * **Three answers for the 24-hour maximum.** Not applicable is a claim (the
 * schedule is the limit) and reads plainly. Recorded is a quantity in the unit
 * the drug is counted in. Not recorded is hatched, and says what it costs: a
 * safety check nothing can run.
 *
 * **A balance nobody counted is not zero.** It is hatched "No balance recorded".
 *
 * What is due now, and the as-required doses given this session with their
 * outcome, sit above the prescriptions. The MAR opens from here. Adding an
 * interim medication is drawn and refused with the role table's reason
 * (docs/DEPARTURES.md: "Add interim stays visible on Medications and refuses").
 */
export function MedicationsTab() {
  const { resident, medications } = useOpenRecord()
  const viewer = useViewer()
  const controlled = medications.filter((medication) => medication.isControlledDrug)
  const asRequired = medications.filter((medication) => medication.isPrn)
  const registerAnswer = viewer.ask('view_controlled_drug_register')

  return (
    <div className={styles.tabPanel} data-tab-body="medications">
      <Card>
        <CardHead
          title={`${resident.preferredName}’s medications`}
          subtitle={`${pluralise(medications.length, 'medicine')} prescribed: ${pluralise(controlled.length, 'controlled drug')} and ${asRequired.length} as required.`}
          expand={{ kind: 'whole' }}
        />
        <div className={styles.acts}>
          <Link
            href={`/residents/${resident.id}/medications/mar`}
            className={buttonClassName({ variant: 'primary' })}
            data-open-mar
          >
            Open MAR
            <Icon name={residentMedicationsIcons.open} size={16} />
          </Link>
          <ActPoint
            answer={viewer.ask('add_interim_medication', resident.id)}
            label="Add interim medication"
            notBuilt=""
            residentName={resident.preferredName}
          />
        </div>
      </Card>

      <DueNow />
      <PrnThisSession />

      {medications.length === 0 ? (
        <Card>
          <p className={styles.plain}>
            Nothing is prescribed for {resident.preferredName}.
          </p>
        </Card>
      ) : (
        medications.map((medication) => (
          <PrescriptionCard
            key={medication.id}
            medication={medication}
            showsRegister={registerAnswer.kind === 'yes'}
          />
        ))
      )}
    </div>
  )
}

function DueNow() {
  const { resident, medications, dueSoon } = useOpenRecord()
  const format = useSiteFormat()

  return (
    <Card>
      <CardHead
        title={`Due now or in the next ${pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}`}
        subtitle={`${dueSoon.length} of ${pluralise(medications.length, 'medicine')} prescribed for ${resident.preferredName}.`}
        expand={{ kind: 'link', href: `/residents/${resident.id}/medications/mar` }}
      />
      {dueSoon.length === 0 ? (
        <p className={styles.plain} data-due-none>
          Nothing is due for {resident.preferredName} in the next{' '}
          {pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}.
        </p>
      ) : (
        <ul className={styles.rows}>
          {dueSoon.map((due) => (
            <li
              key={`${due.medication.id}-${due.record.roundTime}`}
              className={styles.row}
              data-due={due.medication.id}
            >
              <span className={styles.rowTitle}>
                {due.medication.name} {due.medication.dose}
              </span>
              <span className={styles.rowDetail}>
                {due.medication.route} · {due.record.roundTime} round ·{' '}
                <DueWindow due={due} time={format.time} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DueWindow({
  due,
  time,
}: {
  due: DueMedication
  time: ReturnType<typeof useSiteFormat>['time']
}) {
  const state = due.record.state
  switch (state.kind) {
    case 'due':
      return (
        <>
          window {time(state.windowOpensAt)} to {time(state.windowClosesAt)}, nothing
          recorded yet
        </>
      )
    case 'given':
    case 'not_given':
    case 'omitted':
    case 'not_due':
      return <>recorded on the MAR</>
    default:
      return assertNever(state)
  }
}

function PrnThisSession() {
  const { resident, medications } = useOpenRecord()
  const format = useSiteFormat()
  const given = prnGivenThisSession(resident.id)
  const byId = new Map(medications.map((medication) => [medication.id, medication]))

  return (
    <Card>
      <CardHead
        title="As-required doses given this session"
        subtitle="Each with what happened after it was given."
        expand={{ kind: 'whole' }}
      />
      {given.length === 0 ? (
        <p className={styles.plain} data-prn-none>
          No as-required dose has been recorded for {resident.preferredName} in this
          session.
        </p>
      ) : (
        <ul className={styles.rows}>
          {given.map((entry) => {
            const medication = byId.get(entry.medicationId)
            return (
              <li key={entry.id} className={styles.row} data-prn={entry.id}>
                <span className={styles.rowTitle}>
                  {medication === undefined
                    ? 'A medicine no longer prescribed'
                    : `${medication.name} ${medication.dose}`}
                </span>
                <span className={styles.rowDetail}>
                  Given by {staffLabel(entry.givenBy)}, {format.dateTime(entry.givenAt)}
                </span>
                <span className={styles.rowDetail}>
                  Symptom: {entry.symptom} · Reason: {entry.reason}
                </span>
                {entry.outcome.kind === 'recorded' ? (
                  <span className={styles.rowDetail} data-prn-outcome="recorded">
                    Outcome, {format.dateTime(entry.outcome.at)}: {entry.outcome.text}
                  </span>
                ) : (
                  <span data-prn-outcome="not_recorded">
                    <Unrecorded
                      label="Outcome not recorded"
                      detail="Nobody has said what the dose did."
                      variant="chip"
                    />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function PrescriptionCard({
  medication,
  showsRegister,
}: {
  medication: Medication
  showsRegister: boolean
}) {
  const format = useSiteFormat()

  return (
    <Card>
      <div data-medication={medication.id}>
        <CardHead
          title={medication.name}
          subtitle={`${medication.dose} · ${medication.route}`}
          expand={{ kind: 'whole' }}
        />
        <FieldList>
          <Field id="dose" label="Dose">
            {medication.dose}
          </Field>
          <Field id="route" label="Route">
            {medication.route}
          </Field>
          <Field id="form" label="Form">
            {medication.form}
          </Field>
          <Field id="rounds" label="Rounds">
            {medication.isPrn ? 'As required' : medication.roundTimes.join(', ')}
          </Field>
          <Field id="interval" label="How often">
            {medication.isPrn
              ? 'As required: not on a fixed interval'
              : medication.intervalDays === 1
                ? 'Every day'
                : `Every ${pluralise(medication.intervalDays, 'day')}`}
          </Field>
          <Field id="instructions" label="Instructions" width="full">
            <RecordedValueField
              record={medication.instructions}
              label="Instructions"
              missingDetail="Nobody has recorded how this is to be given."
              attributed
              render={(value) => value}
            />
          </Field>
          <Field id="prescriber" label="Prescriber">
            <RecordedValueField
              record={medication.prescriber}
              label="Prescriber"
              missingDetail="Nobody has recorded who prescribed this."
              attributed
              render={(value) => `${value.name}, ${value.organisation}`}
            />
          </Field>
          <Field id="storage" label="Storage">
            <RecordedValueField
              record={medication.storage}
              label="Storage"
              missingDetail="Nobody has recorded where this is kept."
              attributed
              render={(value) => value}
            />
          </Field>
          <Field id="maximum" label="Maximum in 24 hours">
            <Maximum medication={medication} />
          </Field>
          <Field id="started" label="Started">
            <span data-numeric>{format.date(medication.startedOn)}</span>
          </Field>
          <Field id="controlled" label="Controlled drug">
            {medication.isControlledDrug
              ? 'Yes: two signatures for every dose, and a counted balance'
              : 'No'}
          </Field>
          {medication.isControlledDrug ? (
            <Field id="balance" label="Balance">
              <Balance medication={medication} showsRegister={showsRegister} />
            </Field>
          ) : null}
        </FieldList>
      </div>
    </Card>
  )
}

function Maximum({ medication }: { medication: Medication }) {
  const maximum = medication.maximumIn24Hours
  switch (maximum.kind) {
    case 'not_applicable':
      return (
        <span data-maximum="not_applicable">
          Not applicable: given at set rounds, so the schedule is the limit
        </span>
      )
    case 'recorded':
      return (
        <span data-maximum="recorded">
          {quantityWithUnit(maximum.quantity, medication.stockUnit)} in any 24 hours
        </span>
      )
    case 'not_recorded':
      return (
        <span data-maximum="not_recorded">
          <Unrecorded
            variant="chip"
            label="Maximum in 24 hours not recorded"
            detail="A safety check that cannot run: nothing can say when a further dose would be too much."
          />
        </span>
      )
    default:
      return assertNever(maximum)
  }
}

function Balance({
  medication,
  showsRegister,
}: {
  medication: Medication
  showsRegister: boolean
}) {
  const format = useSiteFormat()
  const balance = stockBalanceFor(medication.id)

  const register = showsRegister ? (
    <Link href="/medications/register" className={styles.link} data-register-link>
      Open the controlled drug register
      <Icon name={residentMedicationsIcons.open} size={16} />
    </Link>
  ) : null

  switch (balance.kind) {
    case 'counted':
      return (
        <span className={styles.balance} data-balance="counted">
          <span data-numeric>
            {quantityWithUnit(balance.value, medication.stockUnit)}
          </span>
          <span className={styles.attribution}>
            Counted by {staffLabel(balance.countedBy)},{' '}
            {format.dateTime(balance.countedAt)}
          </span>
          {register}
        </span>
      )
    case 'no_balance_recorded':
      return (
        <span className={styles.balance} data-balance="no_balance_recorded">
          <Unrecorded
            variant="chip"
            label="No balance recorded"
            detail="Nobody has counted this drug into the register, so no dose can be checked against a balance."
          />
          {register}
        </span>
      )
    default:
      return assertNever(balance)
  }
}
