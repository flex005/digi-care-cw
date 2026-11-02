import { useCallback, useEffect, useRef, useState } from 'react'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { LookupRow, OpensFromHere } from '../LookupRows'
import type { Person } from '../phone-data'
import { phoneIcons } from '../phone.icons'
import { byRoom } from '../rooms'
import { Loaded } from '../ScreenStates'
import { useInFront } from '../shell/nav'
import { Screen } from '../shell/Screen'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

/** Long enough for the push to finish and the keyboard to rise. */
const AFTER_KEYBOARD_MS = 300

/**
 * Search, across everybody at the home and never only the reader's list.
 *
 * **It says which set it searched**, because a care worker whose list holds
 * four people would otherwise read "no match" as "not here", **and what a
 * result cannot tell you**: a name and a room say nothing about what is
 * missing on that record.
 *
 * A place, pushed over the list, with the field focused once it is in front
 * and the keyboard up (docs/MOBILE_APP_SHELL.md §11).
 */
export function SearchScreen() {
  const { activeSite } = useSession()
  const inFront = useInFront()
  const field = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Person[]>(load, [activeSite.id])
  const total = (people: Person[]) =>
    pluralise(people.length, VOCABULARY.subject.one, VOCABULARY.subject.many)

  useEffect(() => {
    if (!inFront) return
    const timer = window.setTimeout(() => field.current?.focus(), AFTER_KEYBOARD_MS)
    return () => window.clearTimeout(timer)
  }, [inFront])

  return (
    <Screen title="Search">
      <div className={styles.searchField}>
        <Icon name={phoneIcons.search} size={20} />
        <input
          ref={field}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={(event) => {
            const target = event.currentTarget
            window.setTimeout(
              () => target.scrollIntoView({ block: 'center', behavior: 'smooth' }),
              AFTER_KEYBOARD_MS,
            )
          }}
          aria-label="Search everyone by name or room"
          placeholder="Name or room"
        />
        {query === '' ? null : (
          <button
            type="button"
            className={`${styles.clear} ${shell.press}`}
            onClick={() => setQuery('')}
            aria-label="Clear the search"
          >
            <Icon name={phoneIcons.clear} size={20} />
          </button>
        )}
      </div>
      <div className={styles.gutter}>
        <p className={styles.quiet}>
          {resource.kind === 'ready'
            ? `Searches all ${total(resource.data)} at ${activeSite.name}, not only your list.`
            : `Searches everyone at ${activeSite.name}, not only your list.`}{' '}
          A result shows a name and a room. It cannot show what is missing on that
          record.
        </p>
      </div>
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
              <p className={`${styles.body} ${styles.gutter}`} role="status">
                Nobody at {activeSite.name} matches “{asked}”, out of {total(people)}.
              </p>
            )
          return (
            <>
              <p className={`${styles.quiet} ${styles.gutter}`} role="status">
                {found.length} of {total(people)} match “{asked}”.
              </p>
              <OpensFromHere people={found} />
              <ul className={styles.list}>
                {found.map((person) => (
                  <li key={person.id}>
                    <LookupRow person={person} />
                  </li>
                ))}
              </ul>
            </>
          )
        }}
      </Loaded>
    </Screen>
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
