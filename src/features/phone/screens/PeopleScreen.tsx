import { useCallback, useState } from 'react'
import { getCareNotesForSite, getResidentsBySite, getRound } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { CareNote, IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { useViewer, type Viewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { ActLine, Avatar } from '@/components/primitives'
import { MovedClockLine } from '@/components/shell/MovedClockLine'
import { Unrecorded } from '@/components/status'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { LookupRow, OpensFromHere } from '../LookupRows'
import { NOTHING_OUTSTANDING, OutstandingLine } from '../OutstandingLine'
import { outstandingFor } from '../outstanding'
import {
  listName,
  noListYetLine,
  scopeLine,
  type DoseRecord,
  type Person,
} from '../phone-data'
import { phoneIcons } from '../phone.icons'
import type { Place } from '../phone-paths'
import { byRoom, roomGroups } from '../rooms'
import { Loaded } from '../ScreenStates'
import { Screen } from '../shell/Screen'
import { StackLink } from '../shell/StackLink'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

interface PeopleData {
  people: Person[]
  records: DoseRecord[]
  notes: CareNote[]
}

type View = Extract<Place, { kind: 'people' }>['view']

/**
 * The people tab's root: Your list as work, Everyone as lookup, and the way
 * into search. RES-01 on a phone.
 *
 * **Your list and Everyone are two views in one screen**, switched by an
 * underline strip, because they are different data about the same home and
 * neither is a place you go into. Search is a place: it is pushed.
 */
export function PeopleScreen({ view: opensOn }: { view: View }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [view, setView] = useState<View>(opensOn)
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(
    () =>
      Promise.all([
        getResidentsBySite(activeSite.id),
        getRound(activeSite.id).then(({ records }) => records),
        getCareNotesForSite(activeSite.id),
      ]).then(([people, records, notes]): PeopleData => ({ people, records, notes })),
    [activeSite.id],
  )
  const resource = useResource<PeopleData>(load, [activeSite.id])

  return (
    <Screen
      root
      title={VOCABULARY.subject.Many}
      subtitle={
        resource.kind === 'ready'
          ? view === 'yours'
            ? `${activeSite.name}: ${scopeLine(
                viewer.scope,
                resource.data.people.map((person) => person.id),
                activeSite.name,
              )}.`
            : `${pluralise(resource.data.people.length, VOCABULARY.subject.one, VOCABULARY.subject.many)} at ${activeSite.name}, by room.`
          : activeSite.name
      }
    >
      <div className={styles.gutter}>
        <MovedClockLine form="phone" />
      </div>
      <StackLink
        to={{ kind: 'search' }}
        className={`${styles.searchButton} ${shell.press}`}
      >
        <Icon name={phoneIcons.search} size={20} />
        <span>Search everyone by name or room</span>
      </StackLink>
      <div
        className={styles.strip}
        role="group"
        aria-label={`${VOCABULARY.subject.Many} lists`}
      >
        {(
          [
            ['yours', 'Your list'],
            ['everyone', 'Everyone'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={[
              styles.stripTab,
              shell.press,
              view === id ? styles.stripActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <Loaded
        resource={resource}
        loading={
          view === 'yours'
            ? 'Loading your list…'
            : `Loading everyone at ${activeSite.name}…`
        }
        failed={
          view === 'yours'
            ? 'Your list could not be loaded'
            : `Everyone at ${activeSite.name} could not be loaded`
        }
      >
        {(data) =>
          view === 'everyone' ? (
            <Everyone people={data.people} />
          ) : viewer.scope.kind === 'not_decided' ? (
            <NobodyAssigned
              atHome={data.people.length}
              viewer={viewer}
              showEveryone={() => setView('everyone')}
            />
          ) : (
            <WorkList data={data} at={at} viewer={viewer} />
          )
        }
      </Loaded>
    </Screen>
  )
}

/**
 * Your list: each row a name, a room and one line — the single most pressing
 * thing outstanding today, or plain words naming the four things looked at.
 * Never a row of badges. **Ordered by room, not urgency**, so a row does not
 * move while somebody is walking towards it.
 */
function WorkList({
  data,
  at,
  viewer,
}: {
  data: PeopleData
  at: IsoDateTime
  viewer: Viewer
}) {
  const { activeSite } = useSession()
  const yours = data.people
    .filter((person) => viewer.ask('open_resident_record', person.id).kind === 'yes')
    .sort(byRoom)

  if (yours.length === 0)
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>Nobody at {activeSite.name} is on your list</p>
        <p className={styles.body}>
          Your list names {VOCABULARY.subject.many} at another home. Everyone and search
          still find a name and a room here.
        </p>
      </div>
    )

  return (
    <ul className={styles.list}>
      {yours.map((person) => {
        const [first, ...rest] = outstandingFor({
          person,
          records: data.records,
          notes: data.notes,
          timeZone: activeSite.timeZone,
          at,
        })
        return (
          <li key={person.id}>
            <StackLink
              to={{ kind: 'record', id: person.id }}
              className={`${styles.row} ${shell.pressRow}`}
            >
              <Avatar photo={person.photo} name={person.fullLegalName} size="medium" />
              <span className={styles.rowText}>
                <span className={styles.rowName}>{listName(person)}</span>
                <span className={styles.rowMeta}>
                  {person.room.kind === 'recorded' ? (
                    `Room ${person.room.value}`
                  ) : (
                    <Unrecorded label="Room not recorded" />
                  )}
                </span>
                <span className={styles.rowLine}>
                  {first === undefined ? (
                    <span className={styles.quiet}>{NOTHING_OUTSTANDING}</span>
                  ) : (
                    <OutstandingLine item={first} size="row" />
                  )}
                  {rest.length === 0 ? null : (
                    <span className={styles.quiet}>and {rest.length} more</span>
                  )}
                </span>
              </span>
              <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
            </StackLink>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Everybody at the home, for finding a name: names and rooms, grouped by room
 * range because the fixtures hold no wings, and nothing else.
 */
function Everyone({ people }: { people: Person[] }) {
  return (
    <>
      <OpensFromHere people={people} />
      {roomGroups(people).map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`}>
          <div className={styles.sectionHead}>
            <h2 id={`group-${group.key}`} className={styles.sectionTitle}>
              {group.kind === 'room_not_recorded' ? 'Room not recorded' : group.heading}
            </h2>
          </div>
          <ul className={styles.list}>
            {group.people.map((person) => (
              <li key={person.id}>
                <LookupRow person={person} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/**
 * Nobody has given this reader a list. **Not "no residents"**: the hatch,
 * because nobody has decided, the home's own count so the empty list cannot
 * read as an empty home, and where a list is set — asked of the role table,
 * because a care worker cannot set their own.
 */
function NobodyAssigned({
  atHome,
  viewer,
  showEveryone,
}: {
  atHome: number
  viewer: Viewer
  showEveryone: () => void
}) {
  const { activeSite } = useSession()
  const setting = viewer.ask('open_settings_and_team')
  return (
    <div className={styles.card} data-scope="not_decided">
      <Unrecorded
        variant="phonePanel"
        caption="Your list"
        label={noListYetLine}
        detail={`${activeSite.name} has ${pluralise(atHome, VOCABULARY.subject.one, VOCABULARY.subject.many)}. Your list is empty because nobody has decided who you cover, not because the home is.`}
      />
      <p className={styles.body}>Your list is set in Team Management.</p>
      {setting.kind === 'not_your_role' ? (
        <ActLine kind="refused">{setting.reason}</ActLine>
      ) : (
        <ActLine kind="not_built">Team Management is not part of this product.</ActLine>
      )}
      <button
        type="button"
        className={`${styles.pill} ${shell.press}`}
        onClick={showEveryone}
      >
        Find somebody in Everyone
      </button>
    </div>
  )
}
