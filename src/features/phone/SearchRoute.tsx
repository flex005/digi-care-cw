import { useCallback, useState } from 'react'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { LookupRow, OpensFromHere } from './LookupRows'
import { PeopleNav } from './PeopleNav'
import type { Person } from './phone-data'
import { phoneIcons } from './phone.icons'
import { byRoom } from './rooms'
import { Loaded } from './ScreenStates'
import styles from './phone.module.css'

/**
 * Search, across everybody at the home and never only the reader's list.
 *
 * **It says which set it searched**, above the field, because a care worker
 * whose list holds four people would otherwise read "no match" as "not here".
 * **And it says what a result cannot tell you**: a result is a name and a room,
 * and finding somebody here says nothing about what is missing on their record.
 *
 * By full name, preferred name or room, as RES-01 asks ("Name or room").
 */
export function SearchRoute() {
  const { activeSite } = useSession()
  const [query, setQuery] = useState('')
  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Person[]>(load, [activeSite.id])
  const total = (people: Person[]) =>
    pluralise(people.length, VOCABULARY.subject.one, VOCABULARY.subject.many)

  return (
    <>
      <PeopleNav
        subtitle={
          resource.kind === 'ready'
            ? `Searches all ${total(resource.data)} at ${activeSite.name}, not only your list.`
            : `Searches everyone at ${activeSite.name}, not only your list.`
        }
      />
      <div className={styles.searchField}>
        <Icon name={phoneIcons.search} size={20} />
        <input
          type="search"
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search everyone by name or room"
          placeholder="Name or room"
          autoComplete="off"
        />
        {query === '' ? null : (
          <button
            type="button"
            className={styles.clear}
            onClick={() => setQuery('')}
            aria-label="Clear the search"
          >
            <Icon name={phoneIcons.clear} size={20} />
          </button>
        )}
      </div>
      <p className={styles.quiet}>
        A result shows a name and a room. It cannot show what is missing on that record.
      </p>
      <Loaded
        resource={resource}
        loading={`Loading everyone at ${activeSite.name}…`}
        failed={`Everyone at ${activeSite.name} could not be loaded`}
      >
        {(people) => {
          const asked = query.trim()
          if (asked === '') return null
          const found = people.filter((person) => matches(person, asked)).sort(byRoom)
          if (found.length === 0)
            return (
              <div className={[styles.card, styles.cardPadded].join(' ')} role="status">
                <p className={styles.body}>
                  Nobody at {activeSite.name} matches “{asked}”, out of {total(people)}.
                </p>
              </div>
            )
          return (
            <>
              <p className={styles.quiet} role="status">
                {found.length} of {total(people)} match “{asked}”.
              </p>
              <OpensFromHere people={found} />
              <div className={styles.card}>
                <ul className={styles.rows}>
                  {found.map((person) => (
                    <li key={person.id}>
                      <LookupRow person={person} />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )
        }}
      </Loaded>
    </>
  )
}

function matches(person: Person, asked: string): boolean {
  const needle = asked.toLocaleLowerCase('en-GB')
  return [
    person.fullLegalName,
    person.preferredName,
    person.room.kind === 'recorded' ? person.room.value : '',
  ].some((value) => value.toLocaleLowerCase('en-GB').includes(needle))
}
