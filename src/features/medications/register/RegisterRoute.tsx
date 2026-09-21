import { useCallback, useState } from 'react'
import type {
  IsoDateTime,
  MarWitness,
  Medication,
  RegisterMovement,
  Resident,
  StockBalance,
  StockCount,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import {
  countersignControlledDrug,
  getRegister,
  stockBalanceFor,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import {
  Button,
  Card,
  CardHead,
  Dialog,
  EmptyState,
  Pager,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NotYourHome, StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { ActPoint } from '@/components/layout/ActPoint'
import { ActionCard } from '@/components/layout/ActionCard'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { formatCount, pluralise } from '@/lib/format'
import { assertNever } from '@/lib/assert-never'
import { listName } from '@/features/residents/list-name'
import { waitingSince } from '@/features/notes/note-parts'
import {
  DialogSubject,
  RowSubject,
  drugInSentence,
  roomWords,
} from '../omissions/subject'
import { medicationsIcons } from '../medications.icons'
import { MedicationPinStep } from '../MedicationPinStep'
import {
  buildRegister,
  isAwaitingWitness,
  registerState,
  type AwaitingDose,
  type RegisterEntry,
  type RegisterState,
} from './register'
import { quantityWithUnit, unitFor } from './units'
import styles from '../medications.module.css'

/**
 * The controlled drug register. CW PRD MED-03.
 *
 * **Asked of the role table, and drawn either way.** A care worker gets the tab
 * page with the act refused in the table's words and a line saying the register
 * exists: hiding it would say there is no register rather than that it is not
 * theirs to open.
 *
 * For a senior carer: what is waiting for a second signature, then every
 * controlled drug grouped by the resident it is prescribed for, each with its
 * running balance, any count that does not reconcile, and every entry since
 * the register opened.
 */
export function RegisterRoute() {
  const viewer = useViewer()
  const answer = viewer.ask('view_controlled_drug_register')
  return answer.kind === 'yes' ? <Register /> : <RegisterRefused />
}

function RegisterRefused() {
  const { activeSite } = useSession()
  return (
    <Card>
      <CardHead
        title="Controlled drug register"
        subtitle={`The register of every controlled drug at ${activeSite.name}.`}
        expand={{ kind: 'whole' }}
      />
      <div className={styles.refusedBody} data-register-refused>
        <p className={styles.plain}>
          {activeSite.name} keeps a controlled drug register: every dose, delivery,
          disposal and stock count, with two signatures. Senior carers keep it.
        </p>
      </div>
    </Card>
  )
}

/**
 * What MED-03 says about the second signature, and what it does not say.
 *
 * **A quoted silence, not a refusal.** The act stays available at every age:
 * nothing here decides how long after a dose a second signature can still be a
 * witness statement, because the PRD does not, and a control that refused would
 * read as a rule somebody set. The quotation is MED-03's own words so that the
 * reader can see the silence rather than take it on trust.
 *
 * The register's own logic and what the fixtures hold are in PROGRESS.md; the
 * question is in docs/DEPARTURES.md, for whoever wrote MED-03 to settle.
 */
export const COUNTERSIGN_QUOTED =
  'MED-03 says: “Senior 1 records administration + stock count. System prompts Witness 2. Senior 2 taps Countersign + enters own PIN.”'

export const COUNTERSIGN_SILENCE = `${COUNTERSIGN_QUOTED} It does not say how long after a dose a second signature may still be added, and it does not say what makes a dose recent. Nothing here decides it: every dose below can be countersigned, whatever its age, and each says how long it has waited.`

/** The same silence at one dose, with that dose's age. */
export const countersignSilenceAt = (waited: string): string =>
  `Waiting ${waited}. How long after a dose a second signature may still be added is not stated in MED-03.`

interface RegisterData {
  medications: Medication[]
  residents: Resident[]
  counts: StockCount[]
  movements: RegisterMovement[]
  records: MarRecord[]
}

/** One controlled drug, everything the register holds for it. */
interface DrugRegister {
  medication: Medication
  resident: Resident
  entries: RegisterEntry[]
  state: RegisterState
  balance: StockBalance
}

/** A dose waiting for Witness 2, with who and what it is. */
interface Waiting {
  entry: AwaitingDose
  medication: Medication
  resident: Resident
}

type Countersigned = { kind: 'none' } | { kind: 'done'; words: string }

function Register() {
  const { activeSite } = useSession()
  const [reloads, setReloads] = useState(0)
  const [countersigned, setCountersigned] = useState<Countersigned>({ kind: 'none' })

  const load = useCallback(() => getRegister(activeSite.id), [activeSite.id])
  const resource = useResource<RegisterData>(load, [activeSite.id, reloads])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />
  if (resource.kind === 'loading')
    return (
      <Card>
        <p className={styles.status} role="status">
          Loading the controlled drug register…
        </p>
      </Card>
    )
  if (resource.kind === 'error')
    return (
      <Card>
        <EmptyState
          title="The register could not be loaded"
          body="Nothing has been lost: this is a read."
          actions={
            <Button variant="secondary" onClick={resource.retry}>
              Try again
            </Button>
          }
        />
      </Card>
    )

  const onCountersigned = (words: string) => {
    setCountersigned({ kind: 'done', words })
    setReloads((count) => count + 1)
  }

  return (
    <Found
      data={resource.data}
      home={activeSite.name}
      countersigned={countersigned}
      onCountersigned={onCountersigned}
    />
  )
}

function Found({
  data,
  home,
  countersigned,
  onCountersigned,
}: {
  data: RegisterData
  home: string
  countersigned: Countersigned
  onCountersigned: (words: string) => void
}) {
  const drugs: DrugRegister[] = data.medications
    .flatMap((medication) => {
      const resident = data.residents.find(
        (entry) => entry.id === medication.residentId,
      )
      // A controlled drug whose resident cannot be resolved is not drawn: a
      // balance with nobody attached to it is the wrong-subject failure.
      if (resident === undefined) return []
      const counts = data.counts.filter((count) => count.medicationId === medication.id)
      return [
        {
          medication,
          resident,
          entries: buildRegister(medication, counts, data.movements, data.records),
          state: registerState(counts),
          balance: stockBalanceFor(medication.id),
        },
      ]
    })
    .sort(
      (a, b) =>
        listName(a.resident).localeCompare(listName(b.resident)) ||
        a.medication.name.localeCompare(b.medication.name),
    )

  const waiting: Waiting[] = drugs
    .flatMap(({ entries, medication, resident }) =>
      entries
        .filter(isAwaitingWitness)
        .map((entry) => ({ entry, medication, resident })),
    )
    .sort((a, b) => a.entry.at.localeCompare(b.entry.at))

  const given = drugs.reduce(
    (sum, drug) => sum + drug.entries.filter((entry) => entry.kind === 'given').length,
    0,
  )
  const discrepancies = drugs.filter((drug) => drug.state.kind === 'discrepancy').length
  const noBalance = drugs.filter(
    (drug) => drug.balance.kind === 'no_balance_recorded',
  ).length
  const residentsWithDrugs = new Set(drugs.map((drug) => drug.resident.id)).size
  const oldest = waiting[0]

  const groups = groupByResident(drugs)

  return (
    <div className={styles.page}>
      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker="Awaiting Witness 2"
            figure={formatCount(waiting.length)}
            of={`of ${pluralise(given, 'controlled drug dose')} given on the register`}
            footLabel="Oldest waiting"
            footValue={
              oldest === undefined ? 'Nothing waiting' : waitingSince(oldest.entry.at)
            }
            action={
              <a
                href="#awaiting-witness-2"
                className={buttonClassName({ variant: 'secondary' })}
                data-awaiting-link
              >
                Show doses awaiting Witness 2
              </a>
            }
          />
        </div>
        <div className={styles.tileColumn}>
          <MetricTiles label={`Controlled drug register figures at ${home}`}>
            <MetricTile
              label="Counts that do not reconcile"
              icon={metricIcons.urgent}
              figure={<MetricValue>{formatCount(discrepancies)}</MetricValue>}
              of={`of ${pluralise(drugs.length, 'controlled drug')} at ${home}`}
            />
            <MetricTile
              label="No balance recorded"
              icon={metricIcons.attention}
              figure={
                noBalance === 0 ? (
                  <MetricValue>0</MetricValue>
                ) : (
                  <Unrecorded
                    variant="chip"
                    label={`${formatCount(noBalance)} with no balance`}
                    detail="nobody has counted them"
                  />
                )
              }
              of={`of ${pluralise(drugs.length, 'controlled drug')} at ${home}`}
            />
            <MetricTile
              label="Controlled drugs"
              icon={metricIcons.doses}
              figure={<MetricValue>{formatCount(drugs.length)}</MetricValue>}
              of={`across ${pluralise(residentsWithDrugs, 'resident')} at ${home}`}
            />
          </MetricTiles>
        </div>
      </div>
      {/* Below the row rather than inside the tile column: in the column it
          made that side taller than the dark card beside it, and the four
          cards are one comparison. */}
      <p className={styles.scopeNote}>
        Counted over every controlled drug prescribed at {home}.
      </p>

      <AwaitingCard
        waiting={waiting}
        given={given}
        countersigned={countersigned}
        onCountersigned={onCountersigned}
      />

      {drugs.length === 0 ? (
        <Card>
          <CardHead title="Controlled drugs" expand={{ kind: 'whole' }} />
          <p className={styles.plain}>No controlled drug is prescribed at {home}.</p>
        </Card>
      ) : (
        groups.map(({ resident, drugs: theirs }) => (
          <section
            key={resident.id}
            className={styles.residentGroup}
            aria-label={`Controlled drugs for ${resident.fullLegalName}`}
            data-register-resident={resident.id}
          >
            <h2 className={styles.groupHeading}>
              {listName(resident)}{' '}
              <span className={styles.groupFacts}>{roomWords(resident)}</span>
            </h2>
            {theirs.map((drug) => (
              <DrugCard key={drug.medication.id} drug={drug} />
            ))}
          </section>
        ))
      )}
    </div>
  )
}

function groupByResident(
  drugs: DrugRegister[],
): { resident: Resident; drugs: DrugRegister[] }[] {
  const groups: { resident: Resident; drugs: DrugRegister[] }[] = []
  for (const drug of drugs) {
    const group = groups.find((entry) => entry.resident.id === drug.resident.id)
    if (group === undefined) groups.push({ resident: drug.resident, drugs: [drug] })
    else group.drugs.push(drug)
  }
  return groups
}

/* ------------------------------------------------------------ awaiting */

function AwaitingCard({
  waiting,
  given,
  countersigned,
  onCountersigned,
}: {
  waiting: Waiting[]
  given: number
  countersigned: Countersigned
  onCountersigned: (words: string) => void
}) {
  const paged = usePaged(waiting, 10)
  return (
    <Card>
      <div id="awaiting-witness-2" className={styles.anchor}>
        <CardHead
          title="Awaiting Witness 2"
          subtitle="Controlled drug doses on the register with one signature, the longest waiting first."
          expand={{ kind: 'whole' }}
        />
      </div>
      <p className={styles.silenceCard} data-countersign-silence>
        <Icon name={medicationsIcons.silence} size={16} />
        <span>{COUNTERSIGN_SILENCE}</span>
      </p>

      <div className={styles.viewHead}>
        <p className={styles.claim} data-awaiting-claim>
          <span data-numeric>{formatCount(waiting.length)}</span> of{' '}
          <span data-numeric>{formatCount(given)}</span> controlled drug{' '}
          {given === 1 ? 'dose' : 'doses'} given on the register{' '}
          {waiting.length === 1 ? 'is' : 'are'} waiting for a second signature · oldest
          first
        </p>
      </div>

      {countersigned.kind === 'done' ? (
        <p className={styles.justDone} role="status" data-countersigned>
          {countersigned.words}
        </p>
      ) : null}

      {waiting.length === 0 ? (
        <p className={styles.plain}>
          No dose on the register is waiting for Witness 2.
        </p>
      ) : (
        <>
          <ul className={styles.rows}>
            {paged.shown.map((item) => (
              <AwaitingRow
                key={`${item.entry.dose.medicationId}|${item.entry.dose.date}|${item.entry.dose.roundTime}`}
                item={item}
                onCountersigned={onCountersigned}
              />
            ))}
          </ul>
          <Pager paged={paged} total={waiting.length} noun="doses awaiting Witness 2" />
        </>
      )}
    </Card>
  )
}

function AwaitingRow({
  item,
  onCountersigned,
}: {
  item: Waiting
  onCountersigned: (words: string) => void
}) {
  const format = useSiteFormat()
  const { entry, medication, resident } = item
  return (
    <li
      className={styles.row}
      data-awaiting={`${entry.dose.medicationId}|${entry.dose.date}|${entry.dose.roundTime}`}
    >
      <RowSubject resident={resident} />
      <div className={styles.rowMain}>
        <p className={styles.rowDrug}>
          {medication.name} {medication.dose}
          <span className={styles.rowDrugMeta}>
            {' · '}
            {medication.route.toLowerCase()} · {entry.dose.roundTime} round
          </span>
        </p>
        {/* Two facts, never one pill: the dose was given, and its second
            signature is missing. */}
        <div className={styles.facts}>
          <StatusPill
            tone="positive"
            label="Given"
            detail={format.attributionOn(staffLabel(entry.by), entry.at)}
          />
          <Unrecorded label="Second signature not recorded" />
        </div>
        <p className={styles.line}>
          Witness 1 has recorded. Awaiting Witness 2 signature.
        </p>
      </div>

      {/* At the end of the row: the countersignature is what to do about the
          half-record beside it, not one more line of it. */}
      <div className={styles.rowActs}>
        <CountersignControl
          entry={entry}
          medication={medication}
          resident={resident}
          onCountersigned={onCountersigned}
        />
      </div>
    </li>
  )
}

/**
 * The second signature. CW PRD MED-03: "Senior 2 taps Countersign and enters
 * own PIN".
 *
 * **Never the person who gave the dose.** A countersignature from the giver is
 * one person's word twice, so the control is not drawn for them and the line
 * says why; the write refuses it too. The dose stays half a record.
 *
 * **Confirmed with the medication PIN**, which names what it signs.
 */
function CountersignControl({
  entry,
  medication,
  resident,
  onCountersigned,
}: {
  entry: AwaitingDose
  medication: Medication
  resident: Resident
  onCountersigned: (words: string) => void
}) {
  const viewer = useViewer()
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  if (entry.by.id === member.id)
    return (
      <p className={styles.ownDose} data-own-dose>
        The second signature has to be another senior carer: you gave this dose.
      </p>
    )

  const answer = viewer.ask('countersign_controlled_drug', resident.id)
  if (answer.kind !== 'yes')
    return (
      <ActPoint
        answer={answer}
        label="Countersign"
        notBuilt="Countersigning is on this page."
        residentName={resident.preferredName}
      />
    )

  const drug = `${drugInSentence(medication)} ${medication.dose}`
  const givenAt = `${format.time(entry.at)} on ${format.instantDate(entry.at)}`
  const signs = `Countersign: ${drug} given to ${resident.fullLegalName} at ${givenAt} by ${staffLabel(entry.by)}`

  const confirm = () => {
    countersignControlledDrug({
      ...entry.dose,
      by: member.ref,
      at: now().toISOString() as IsoDateTime,
    })
      .then(() => {
        setOpen(false)
        onCountersigned(
          `You countersigned ${resident.fullLegalName}’s ${drug}, given at ${givenAt} by ${staffLabel(entry.by)}. Both signatures are on the register.`,
        )
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'The countersignature was not recorded.',
        ),
      )
  }

  return (
    <>
      {/* The silence at the act, with this dose's age. The act is not refused:
          what the PRD leaves open, the screen leaves open. */}
      <p className={styles.silence} data-dose-silence>
        <Icon name={medicationsIcons.silence} size={16} />
        <span>{countersignSilenceAt(waitingSince(entry.at))}</span>
      </p>
      <Button
        variant="primary"
        size="large"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
        data-countersign
      >
        Countersign
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Countersign ${resident.fullLegalName}’s ${drug}?`}
        description={`You are Witness 2 for the dose ${staffLabel(entry.by)} gave at ${givenAt}.`}
      >
        <DialogSubject resident={resident} />
        <MedicationPinStep
          signs={signs}
          confirmLabel="Countersign"
          onConfirmed={confirm}
          onCancel={() => setOpen(false)}
        />
        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------ one drug */

function DrugCard({ drug }: { drug: DrugRegister }) {
  const format = useSiteFormat()
  const { medication, resident, entries, state, balance } = drug
  const paged = usePaged(entries, 10)
  const newest = entries[0]

  return (
    <Card>
      <div className={styles.drugHead} data-register-drug={medication.id}>
        <div className={styles.drugWho}>
          <h3 className={styles.drugTitle}>{medication.name}</h3>
          <p className={styles.drugMeta}>
            {medication.dose} · {medication.form} · {resident.fullLegalName} ·{' '}
            {roomWords(resident)}
          </p>
        </div>
        <div className={styles.balance} data-balance={balance.kind}>
          {balance.kind === 'no_balance_recorded' ? (
            // Never a zero and never a dash: both read as a balance somebody
            // had established.
            <Unrecorded
              variant="chip"
              label="No balance recorded"
              detail="nobody has counted this drug"
            />
          ) : (
            <>
              <span className={styles.balanceLabel}>Running balance</span>
              <span className={styles.balanceFigure} data-numeric>
                {newest === undefined ? balance.value : newest.balanceAfter}
              </span>
              <span className={styles.balanceUnit}>
                {unitFor(
                  newest === undefined ? balance.value : newest.balanceAfter,
                  medication.stockUnit,
                )}{' '}
                remaining
              </span>
              <span className={styles.balanceNote}>
                Last counted{' '}
                <span data-numeric>
                  {quantityWithUnit(balance.value, medication.stockUnit)}
                </span>
                ,{' '}
                {format.attributionOn(staffLabel(balance.countedBy), balance.countedAt)}
              </span>
            </>
          )}
        </div>
      </div>

      {state.kind === 'discrepancy' ? (
        <div className={styles.banner} role="alert" data-discrepancy>
          <p className={styles.bannerTitle}>
            <Icon name={medicationsIcons.discrepancy} size={16} />
            Stock count does not match the running balance. This must be resolved before
            any further administration.
          </p>
          <p className={styles.bannerDetail}>
            Counted{' '}
            <span data-numeric>
              {quantityWithUnit(state.counted, medication.stockUnit)}
            </span>{' '}
            on <span data-numeric>{format.dateTime(state.at)}</span>, where the register
            expected{' '}
            <span data-numeric>
              {quantityWithUnit(state.expected, medication.stockUnit)}
            </span>
            .
          </p>
        </div>
      ) : null}

      {entries.length === 0 ? (
        /* No table: headers over an empty body would say the register exists
           and happens to be empty, when it was never opened. */
        <div className={styles.emptyRegister} data-empty-register>
          <Unrecorded
            variant="panel"
            label="Nothing on the register for this drug"
            detail="No opening count has been taken, so no dose, delivery or disposal has a balance to be recorded against."
          />
        </div>
      ) : (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={styles.caption}>
                Register entries for {resident.fullLegalName}’s{' '}
                {drugInSentence(medication)}, newest first, with the running balance
                after each in {medication.stockUnit}.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">What happened</th>
                  <th scope="col" className={styles.num}>
                    Quantity
                  </th>
                  <th scope="col" className={styles.num}>
                    Running balance
                  </th>
                  <th scope="col">Witness 1</th>
                  <th scope="col">Witness 2</th>
                </tr>
              </thead>
              <tbody>
                {paged.shown.map((entry) => (
                  <tr
                    key={`${entry.kind}-${entry.at}`}
                    className={
                      entry.kind === 'routine_count' && !entry.reconciles
                        ? styles.flaggedRow
                        : undefined
                    }
                    data-entry={entry.kind}
                  >
                    <td>
                      <span data-numeric>{format.instantDate(entry.at)}</span>
                    </td>
                    <td>
                      <span data-numeric>{format.time(entry.at)}</span>
                    </td>
                    <td>
                      <WhatHappened entry={entry} unit={medication.stockUnit} />
                    </td>
                    <td className={styles.num}>
                      <Quantity entry={entry} unit={medication.stockUnit} />
                    </td>
                    <td className={styles.num}>
                      <span data-numeric>
                        {quantityWithUnit(entry.balanceAfter, medication.stockUnit)}
                      </span>
                    </td>
                    <td>{staffLabel(entry.by)}</td>
                    <td>
                      <SecondWitness entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
           * **The same entries as a list, for a screen no table fits.**
           *
           * Seven columns is 750px; at 390 the table was a 314px window onto
           * something twice its width, inside a page that already scrolls
           * down. Restyling the table itself would have taken its semantics
           * away — `display: block` drops the implicit roles, and stating them
           * back is what `jsx-a11y/no-redundant-roles` refuses — so the phone
           * gets a list that is honestly a list, and the desk keeps a table
           * that is honestly a table. **Which one shows is CSS alone**
           * (CLAUDE.md §4), so a capture at a width gets that width's layout.
           *
           * Nothing is left out: every column the table has is a line here, in
           * the order the table has them.
           */}
          <ul className={styles.entryList} data-register-entries>
            {paged.shown.map((entry) => (
              <li
                key={`${entry.kind}-${entry.at}`}
                className={
                  entry.kind === 'routine_count' && !entry.reconciles
                    ? styles.entryFlagged
                    : styles.entry
                }
                data-entry={entry.kind}
              >
                <p className={styles.entryWhen}>
                  <span data-numeric>{format.instantDate(entry.at)}</span>
                  <span data-numeric>{format.time(entry.at)}</span>
                </p>
                <p className={styles.entryWhat}>
                  <WhatHappened entry={entry} unit={medication.stockUnit} />
                </p>
                <dl className={styles.entryFacts}>
                  <div className={styles.entryFact}>
                    <dt>Quantity</dt>
                    <dd>
                      <Quantity entry={entry} unit={medication.stockUnit} />
                    </dd>
                  </div>
                  <div className={styles.entryFact}>
                    <dt>Running balance</dt>
                    <dd data-numeric>
                      {quantityWithUnit(entry.balanceAfter, medication.stockUnit)}
                    </dd>
                  </div>
                  <div className={styles.entryFact}>
                    <dt>Witness 1</dt>
                    <dd>{staffLabel(entry.by)}</dd>
                  </div>
                  <div className={styles.entryFact}>
                    <dt>Witness 2</dt>
                    <dd>
                      <SecondWitness entry={entry} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <Pager paged={paged} total={entries.length} noun="register entries" />
        </>
      )}
    </Card>
  )
}

function WhatHappened({ entry, unit }: { entry: RegisterEntry; unit: string }) {
  switch (entry.kind) {
    case 'given':
      return <>Given</>
    case 'opening_count':
      return <>Counted: opening balance</>
    case 'routine_count':
      return entry.reconciles ? (
        <>Counted</>
      ) : (
        <span className={styles.countMismatch}>
          Counted: does not match. Expected{' '}
          <span data-numeric>{quantityWithUnit(entry.expected, unit)}</span>
        </span>
      )
    case 'received':
      return <>Received from {entry.from}</>
    case 'disposed':
      return <>Disposed: {entry.reason}</>
    default:
      return assertNever(entry)
  }
}

/** A count does not change the stock; it says what the stock is. */
function Quantity({ entry, unit }: { entry: RegisterEntry; unit: string }) {
  switch (entry.kind) {
    case 'opening_count':
    case 'routine_count':
      return <span data-numeric>{quantityWithUnit(entry.counted, unit)} counted</span>
    case 'received':
      return <span data-numeric>+{quantityWithUnit(entry.quantity, unit)}</span>
    case 'given':
    case 'disposed':
      return <span data-numeric>−{quantityWithUnit(entry.quantity, unit)}</span>
    default:
      return assertNever(entry)
  }
}

function SecondWitness({ entry }: { entry: RegisterEntry }) {
  if (entry.kind !== 'given') return <>{staffLabel(entry.witnessedBy)}</>
  return <DoseWitness witness={entry.witness} />
}

function DoseWitness({ witness }: { witness: MarWitness }) {
  switch (witness.kind) {
    case 'witnessed':
      return <>{staffLabel(witness.by)}</>
    case 'required_not_recorded':
      return <Unrecorded label="Second signature not recorded" />
    case 'not_required':
      // A controlled drug always needs one; said rather than left blank if a
      // record ever arrives that claims otherwise.
      return <>Recorded as not required</>
    default:
      return assertNever(witness)
  }
}
