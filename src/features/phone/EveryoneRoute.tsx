import { useCallback } from 'react'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { LookupRow, OpensFromHere } from './LookupRows'
import { PeopleNav } from './PeopleNav'
import type { Person } from './phone-data'
import { roomGroups } from './rooms'
import { Loaded } from './ScreenStates'
import styles from './phone.module.css'

/**
 * Everybody at the home, for finding a name. RES-01's search, on a phone.
 *
 * **A lookup list, not a work list**: names and rooms, grouped by room range
 * and ordered by room, because here the reader is finding somebody — the bell
 * in room 214, the visitor asking for Winnie. What is outstanding is on Your
 * list and on each record, where it can be read; here it would be wallpaper.
 */
export function EveryoneRoute() {
  const { activeSite } = useSession()
  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Person[]>(load, [activeSite.id])
  const total = (people: Person[]) =>
    pluralise(people.length, VOCABULARY.subject.one, VOCABULARY.subject.many)

  return (
    <>
      <PeopleNav
        subtitle={
          resource.kind === 'ready'
            ? `${total(resource.data)} at ${activeSite.name}, by room.`
            : activeSite.name
        }
      />
      <Loaded
        resource={resource}
        loading={`Loading everyone at ${activeSite.name}…`}
        failed={`Everyone at ${activeSite.name} could not be loaded`}
      >
        {(people) => (
          <>
            <OpensFromHere people={people} />
            <div className={styles.card}>
              {roomGroups(people).map((group) => (
                <section key={group.key} aria-labelledby={`group-${group.key}`}>
                  <h2 id={`group-${group.key}`} className={styles.groupHeading}>
                    {group.kind === 'room_not_recorded'
                      ? 'Room not recorded'
                      : group.heading}
                  </h2>
                  <ul className={styles.rows}>
                    {group.people.map((person) => (
                      <li key={person.id}>
                        <LookupRow person={person} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Loaded>
    </>
  )
}
