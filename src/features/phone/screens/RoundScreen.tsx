import { useCallback, useState } from 'react'
import { getRound } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { IsoDateTime } from '@/data/types'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { ActLine, Avatar } from '@/components/primitives'
import { MovedClockLine } from '@/components/shell/MovedClockLine'
import { Unrecorded } from '@/components/status'
import { formatDate, pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { listName, noListYetLine, scopeNote } from '../phone-data'
import { offListLine, yourRound, type RoundData, type RoundRow } from '../phone-round'
import { notBuiltOnPhone } from '../not-built'
import { phoneIcons } from '../phone.icons'
import { Loaded } from '../ScreenStates'
import { Screen } from '../shell/Screen'
import { StackLink } from '../shell/StackLink'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

/**
 * Your round: the people you record for at the round in front of you, each a
 * way into their record. MED-02 on a phone, as a list. **It writes nothing**:
 * recording a dose is the record's sheet (module 3, step 4), never a row here.
 *
 * **Nobody at the round is left off it.** A person whose only open doses are
 * controlled drugs is a row that says why nothing can be recorded for them
 * here, because a list that silently dropped them would tell a care worker her
 * round was empty when it is not. For N. Eze at 20:00 that is every row.
 *
 * **Ordered by room, as the trolley goes**, never by urgency, so a row does not
 * move while somebody walks towards it.
 */
export function RoundScreen() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const load = useCallback(() => getRound(activeSite.id), [activeSite.id])
  const resource = useResource<RoundData>(load, [activeSite.id])

  return (
    <Screen root title="Your round">
      <div className={styles.gutter}>
        <MovedClockLine form="phone" />
      </div>
      <Loaded
        resource={resource}
        loading="Loading your round…"
        failed="Your round could not be loaded"
      >
        {(data) =>
          viewer.scope.kind === 'not_decided' ? (
            <div className={styles.card} data-scope="not_decided">
              <Unrecorded
                variant="phonePanel"
                caption="Your list"
                label={noListYetLine}
                detail="Your round is the people on your list, so it is empty because nobody has decided who you cover, not because nobody has a dose due."
              />
            </div>
          ) : (
            <RoundList data={data} at={at} />
          )
        }
      </Loaded>
    </Screen>
  )
}

function RoundList({ data, at }: { data: RoundData; at: IsoDateTime }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const answers = data.residents.map((person) => ({
    person,
    answer: viewer.ask('record_medication', person.id),
  }))
  const people = answers
    .filter((entry) => entry.answer.kind === 'yes')
    .map((entry) => entry.person)
  const offList = answers.some((entry) => entry.answer.kind === 'not_stated')
  const round = yourRound({
    data,
    people,
    at,
    timeZone: activeSite.timeZone,
  })
  const doses = round.rows.reduce((sum, row) => sum + row.doses, 0)
  const recorded = round.rows.reduce((sum, row) => sum + row.recorded, 0)

  return (
    <>
      <div className={styles.card} data-round={round.roundTime}>
        <p className={styles.cardTitle}>
          {round.roundTime} round, {formatDate(round.date)}
        </p>
        {doses === 0 ? (
          <p className={styles.body}>
            Nobody you record for has a dose on the chart at {round.roundTime} today.
          </p>
        ) : (
          <p className={styles.body} data-round-count>
            {recorded} of {pluralise(doses, 'dose')} recorded
          </p>
        )}
        <p className={styles.quiet}>{scopeNote(viewer.scope, activeSite.name)}</p>
      </div>

      {round.rows.length === 0 ? null : (
        <ul className={styles.list}>
          {round.rows.map((row) => (
            <li key={row.person.id}>
              <RoundRowLink row={row} />
            </li>
          ))}
        </ul>
      )}

      {round.withoutDose === 0 ? null : (
        <p className={`${styles.quiet} ${styles.gutter}`} data-without-dose>
          {pluralise(
            round.withoutDose,
            VOCABULARY.subject.one,
            VOCABULARY.subject.many,
          )}{' '}
          you record for {round.withoutDose === 1 ? 'has' : 'have'} no dose at the{' '}
          {round.roundTime} round.
        </p>
      )}
      {offList ? (
        <p className={`${styles.quiet} ${styles.gutter}`}>{offListLine}</p>
      ) : null}
    </>
  )
}

/**
 * One person at the round: who, where, and what the phone can and cannot do
 * about their doses, each fact on its own line (CLAUDE.md §1, a compound state
 * as separate facts). The row opens their record and records nothing.
 *
 * **The sentence names the person as the row's heading does, by the list name.**
 * The legal name directly under the list name ("Ronald" under "Ron") reads as
 * two people. This is the phone's form of §2, not a break from the desktop's
 * legal name in sentences: there the list name is never directly above the
 * sentence. docs/DEPARTURES.md, phone.
 */
function RoundRowLink({ row }: { row: RoundRow }) {
  const format = useSiteFormat()
  const { person } = row
  const nothingHere =
    row.controlled > 0 && row.toRecord === 0 && row.notOpenYet.kind === 'none'

  return (
    <StackLink
      to={{ kind: 'record', id: person.id }}
      className={`${styles.row} ${shell.pressRow}`}
    >
      <Avatar photo={person.photo} name={person.fullLegalName} size="medium" />
      <span className={styles.rowText} data-round-row={person.id}>
        <span className={styles.rowName}>{listName(person)}</span>
        <span className={styles.rowMeta}>
          {person.room.kind === 'recorded' ? (
            `Room ${person.room.value}`
          ) : (
            <Unrecorded label="Room not recorded" />
          )}
        </span>
        <span className={styles.quiet} data-row-count>
          {row.recorded} of {pluralise(row.doses, 'dose')} recorded
        </span>
        {row.toRecord === 0 ? null : (
          <span className={styles.rowLine} data-to-record>
            {row.toRecord} to record now
          </span>
        )}
        {row.notOpenYet.kind === 'none' ? null : (
          <span className={styles.quiet} data-not-open-yet>
            {row.notOpenYet.count} not due yet — the window opens at{' '}
            {format.time(row.notOpenYet.opensAt)}
          </span>
        )}
        {row.windowClosed === 0 ? null : (
          <Unrecorded
            label={`${row.windowClosed} with nothing recorded`}
            detail="the window closed"
          />
        )}
        {row.controlled === 0 ? null : (
          <span data-controlled={nothingHere ? 'only' : 'also'}>
            <ActLine kind="not_built">
              {`${
                nothingHere
                  ? `Nothing can be recorded for ${listName(person)} here: ${pluralise(row.controlled, 'controlled drug')} open.`
                  : `${pluralise(row.controlled, 'controlled drug')} open as well.`
              } ${notBuiltOnPhone('Recording a controlled drug')}`}
            </ActLine>
          </span>
        )}
        {row.recorded === row.doses ? (
          <span className={styles.quiet} data-all-recorded>
            All recorded
          </span>
        ) : null}
      </span>
      <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
    </StackLink>
  )
}
