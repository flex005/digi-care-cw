import { useCallback, useMemo, useState } from 'react'
import type {
  IsoDateTime,
  Medication,
  Resident,
  StockBalance,
  StockCount,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { getRegister, getRound, stockBalanceFor } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { noListYetLine, scopeNote } from '@/app/session/resident-scope'
import { ActionCard } from '@/components/layout/ActionCard'
import {
  ActLine,
  Button,
  Card,
  CardHead,
  EmptyState,
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import {
  formatCount,
  formatDate,
  pluralise,
  zonedDate,
  zonedWallClock,
} from '@/lib/format'
import { ResidentRoundCard } from './ResidentRoundCard'
import {
  arrivalRound,
  residentsAt,
  roundCount,
  roundTimesOf,
  windowFor,
  type RoundResident,
} from './round'
import { witnessesFor } from './witnesses'
import styles from './round.module.css'

/** The words at the head of a care worker's round, decided and not to be reworded. */
export const OFF_LIST_LINE =
  'Residents not on your list are not shown: the PRD does not say whether you record their doses.'

interface RoundData {
  residents: Resident[]
  medications: Medication[]
  records: MarRecord[]
  counts: StockCount[]
}

/**
 * The medication round. CW PRD MED-02.
 *
 * **These doses are due at this round, for these people, and you are about to
 * sign for them.** One card per resident, in room order, each carrying its
 * subject from the record, its doses and their three answers, and one act that
 * records them together under the medication PIN.
 *
 * **Scope is asked of the role table, resident by resident.** A care worker sees
 * the residents on their list and is told, once, that the others are not shown
 * because the PRD does not say; a senior carer sees the home. A care worker
 * nobody has given a list is told that, hatched, rather than shown an empty
 * round that reads as a home with nothing due.
 *
 * **Round pills filter.** Each round is different data, not a presentation of
 * the same data, so the times are pills and never a segmented control, and each
 * says how many doses it holds and how many are recorded.
 *
 * **Nothing is sent.** The PRD's 30-minute push and 60-minute alert do not
 * exist in this build, and the head of the round says so.
 */
export function RoundRoute() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [written, setWritten] = useState(0)
  const [picked, setPicked] = useState<string | 'on_arrival'>('on_arrival')
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(
    () =>
      Promise.all([getRound(activeSite.id), getRegister(activeSite.id)]).then(
        ([round, register]): RoundData => ({ ...round, counts: register.counts }),
      ),
    [activeSite.id],
  )
  const resource = useResource<RoundData>(load, [activeSite.id, written])
  const witnesses = useMemo(
    () => witnessesFor(activeSite.id, member.id),
    [activeSite.id, member.id],
  )

  const head = <div className={styles.head}></div>

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (viewer.scope.kind === 'not_decided')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <CardHead
            title="Your round"
            subtitle={scopeNote(viewer.scope, activeSite.name)}
            expand={{ kind: 'whole' }}
          />
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has residents with doses due. Until somebody gives you a list, no dose is shown to you here and nothing is counted for you.`}
          />
        </Card>
      </div>
    )

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.quiet} role="status">
            Loading the round…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The round could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  const { residents, medications, records, counts } = resource.data
  const timeZone = activeSite.timeZone
  const date = zonedDate(at, timeZone)
  const wall = new Date(zonedWallClock(at, timeZone))
  const wallMinutes = wall.getUTCHours() * 60 + wall.getUTCMinutes()

  const answers = residents.map((resident) => ({
    resident,
    answer: viewer.ask('record_medication', resident.id),
  }))
  const inScope = answers
    .filter((entry) => entry.answer.kind === 'yes')
    .map((entry) => entry.resident)
  const offList = answers.some((entry) => entry.answer.kind === 'not_stated')

  const roundTimes = roundTimesOf(medications)
  const roundTime =
    picked === 'on_arrival'
      ? arrivalRound(roundTimes, records, date, at, wallMinutes)
      : picked
  const atRound = (time: string): RoundResident[] =>
    residentsAt(inScope, medications, records, time, date)
  const entries = atRound(roundTime)
  const { due, recorded } = roundCount(entries)
  const notYet = due - recorded
  const firstOpen = entries.find((entry) =>
    entry.doses.some((dose) => dose.record.state.kind === 'due'),
  )
  /*
   * A round picked before it opens. Every dose at one round shares one window,
   * so this is the whole round or none of it, and the banner says so rather
   * than sending somebody to a card where every answer refuses.
   */
  const dueDoses = entries
    .flatMap((entry) => entry.doses)
    .filter((dose) => dose.record.state.kind === 'due')
  const stillShut = dueDoses.filter(
    (dose) => windowFor(dose, at).kind === 'not_open_yet',
  )
  const firstShut = stillShut[0]
  const shutWindow = firstShut === undefined ? undefined : windowFor(firstShut, at)
  /** When this round opens, or `open` because it already has. */
  const roundOpensAt: IsoDateTime | 'open' =
    shutWindow?.kind === 'not_open_yet' && stillShut.length === dueDoses.length
      ? shutWindow.opensAt
      : 'open'
  const balance = (medication: Medication): StockBalance =>
    stockBalanceFor(medication.id)

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        {offList ? <ActLine kind="not_stated">{OFF_LIST_LINE}</ActLine> : null}
      </div>

      <div className={styles.pills} role="group" aria-label="Round">
        {roundTimes.map((time) => {
          const chosen = time === roundTime
          const count = roundCount(atRound(time))
          return (
            <button
              key={time}
              type="button"
              className={chosen ? styles.pillChosen : styles.pill}
              aria-pressed={chosen}
              onClick={() => setPicked(time)}
              data-round-pill={time}
            >
              <SelectedMark selected={chosen} />
              <span data-numeric>
                {count.due === 0
                  ? `${time} · no doses on the chart`
                  : `${time} · ${count.recorded} of ${count.due} recorded`}
              </span>
            </button>
          )
        })}
      </div>

      <ActionCard
        kicker={`${roundTime} round, ${formatDate(date)}`}
        figure={formatCount(recorded)}
        of={`of ${pluralise(due, 'medication')} recorded for ${roundTime} round.`}
        detail={
          <div className={styles.bannerDetail} data-round-banner>
            {roundOpensAt === 'open' ? null : (
              <p data-round-not-open>
                The {roundTime} window opens at {format.time(roundOpensAt)}. Nothing on
                this round can be recorded before then.
              </p>
            )}
            {notYet === 0 ? null : <p data-not-yet>{notYet} not yet recorded.</p>}
            <p>{scopeNote(viewer.scope, activeSite.name)}</p>
            <p>
              A dose whose window closes with nothing recorded is an omission, and is
              listed on the Omissions tab.
            </p>
          </div>
        }
        footLabel="Next to record"
        footValue={
          roundOpensAt !== 'open'
            ? `Nothing until ${format.time(roundOpensAt)}`
            : firstOpen === undefined
              ? 'Nothing left to record at this round'
              : firstOpen.resident.fullLegalName
        }
        action={
          roundOpensAt !== 'open' ? (
            <span className={styles.bannerQuiet}>
              The {roundTime} round has not opened
            </span>
          ) : firstOpen === undefined ? (
            <span className={styles.bannerQuiet}>
              {due === 0
                ? 'No doses on the chart'
                : notYet === 0
                  ? 'Every dose has a record'
                  : `${notYet} with no record, and the window has closed`}
            </span>
          ) : (
            <a
              href={`#round-${firstOpen.resident.id}`}
              className={buttonClassName({ variant: 'secondary' })}
            >
              Go to {firstOpen.resident.preferredName}
            </a>
          )
        }
      />

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            title={`No doses on the chart at ${roundTime}`}
            body={
              offList
                ? `None of the residents on your list has a dose on the chart at ${roundTime} today.`
                : `No resident at ${activeSite.name} has a dose on the chart at ${roundTime} today.`
            }
          />
        </Card>
      ) : (
        <div className={styles.cards}>
          {entries.map((entry) => (
            <ResidentRoundCard
              key={`${roundTime}|${entry.resident.id}`}
              entry={entry}
              site={activeSite}
              roundTime={roundTime}
              date={date}
              counts={counts}
              balance={balance}
              witnesses={witnesses}
              onRecorded={() => setWritten((count) => count + 1)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
