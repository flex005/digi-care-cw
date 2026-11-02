import Link from 'next/link'
import { useCallback, useState } from 'react'
import { getCareNotesForSite, getResidentsBySite, getRound } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { CareNote, IsoDateTime } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { useViewer, type Viewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { ActLine, Avatar, buttonClassName } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { NOTHING_OUTSTANDING, OutstandingLine } from './OutstandingLine'
import { outstandingFor } from './outstanding'
import { PeopleNav } from './PeopleNav'
import {
  listName,
  noListYetLine,
  scopeLine,
  type DoseRecord,
  type Person,
} from './phone-data'
import { PHONE_PATHS } from './phone-paths'
import { phoneIcons } from './phone.icons'
import { byRoom } from './rooms'
import { Loaded } from './ScreenStates'
import styles from './phone.module.css'

interface ListData {
  people: Person[]
  records: DoseRecord[]
  notes: CareNote[]
}

/**
 * Your list: the people this reader was given, as work. RES-01 on a phone.
 *
 * **Each row is a name, a room and one line**: the single most pressing thing
 * outstanding today, or plain words saying none of the four things looked at
 * is. Never a row of badges, which would make every row equally loud and so
 * none of them louder than another.
 *
 * **Ordered by room, not by urgency**, so a row does not move while somebody
 * is walking the corridor towards it. The one line is what says which is
 * pressing.
 *
 * **Who is on it is asked of the role table**, never decided here: a senior
 * carer's list is the home and a care worker's is who they were given.
 */
export function YourListRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)

  const load = useCallback(
    () =>
      Promise.all([
        getResidentsBySite(activeSite.id),
        getRound(activeSite.id).then(({ records }) => records),
        getCareNotesForSite(activeSite.id),
      ]).then(([people, records, notes]): ListData => ({ people, records, notes })),
    [activeSite.id],
  )
  const resource = useResource<ListData>(load, [activeSite.id])

  return (
    <>
      <PeopleNav
        subtitle={
          resource.kind === 'ready'
            ? `${activeSite.name}: ${scopeLine(
                viewer.scope,
                resource.data.people.map((person) => person.id),
                activeSite.name,
              )}.`
            : activeSite.name
        }
      />
      <Loaded
        resource={resource}
        loading="Loading your list…"
        failed="Your list could not be loaded"
      >
        {(data) =>
          viewer.scope.kind === 'not_decided' ? (
            <NobodyAssigned atHome={data.people.length} viewer={viewer} />
          ) : (
            <WorkList data={data} at={at} viewer={viewer} />
          )
        }
      </Loaded>
    </>
  )
}

function WorkList({
  data,
  at,
  viewer,
}: {
  data: ListData
  at: IsoDateTime
  viewer: Viewer
}) {
  const { activeSite } = useSession()
  const yours = data.people
    .filter((person) => viewer.ask('open_resident_record', person.id).kind === 'yes')
    .sort(byRoom)

  if (yours.length === 0)
    return (
      <div className={[styles.card, styles.cardPadded].join(' ')}>
        <p className={styles.cardTitle}>Nobody at {activeSite.name} is on your list</p>
        <p className={styles.body}>
          Your list names {VOCABULARY.subject.many} at another home. Everyone and search
          still find a name and a room here.
        </p>
      </div>
    )

  return (
    <div className={styles.card}>
      <ul className={styles.rows}>
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
              <Link href={PHONE_PATHS.record(person.id)} className={styles.row}>
                <Avatar
                  photo={person.photo}
                  name={person.fullLegalName}
                  size="medium"
                />
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
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Nobody has given this reader a list.
 *
 * **Not "no residents"**, which would be false of a home with people in it:
 * the hatch, because nobody has decided, and the home's own count beside it so
 * the empty list cannot be read as an empty home. **It names where a list is
 * set and that this reader cannot set it**, asked of the role table, because a
 * care worker cannot change their own list and a control offering to would be
 * a control that does not exist.
 */
function NobodyAssigned({ atHome, viewer }: { atHome: number; viewer: Viewer }) {
  const { activeSite } = useSession()
  const setting = viewer.ask('open_settings_and_team')
  return (
    <div
      className={[styles.card, styles.cardPadded].join(' ')}
      data-scope="not_decided"
    >
      <Unrecorded
        variant="panel"
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
      <div className={styles.actions}>
        <Link
          href={PHONE_PATHS.everyone}
          className={buttonClassName({ variant: 'secondary', size: 'large' })}
        >
          Find somebody in Everyone
        </Link>
      </div>
    </div>
  )
}
