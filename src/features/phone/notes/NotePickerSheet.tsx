import { useCallback, useState } from 'react'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import type { ResidentId } from '@/data/types'
import { phoneRefusalOf } from '../phone-refusal'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import {
  listName,
  noListYetLine,
  scopeLine,
  scopeReaches,
  type Person,
} from '../phone-data'
import { phoneIcons } from '../phone.icons'
import { byRoom, matchesNameOrRoom } from '../rooms'
import { Loaded } from '../ScreenStates'
import { Sheet } from '../shell/Sheet'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

/**
 * "Who is this note about?" CW PRD CN-02's resident picker, from the raised
 * centre action.
 *
 * **It chooses a subject and writes nothing.** Choosing pushes that person's
 * record, and the composer opens over it, so the subject of the note is the
 * record in the address (CLAUDE.md §2), never a selection held here.
 *
 * **It never leaves somebody out without saying why.** It opens on the reader's
 * own list; a search reaches everybody at the home, and a person the role table
 * does not let this reader write about is listed with the refusal in the words
 * the record uses, and cannot be chosen. An empty result for somebody off the
 * list would be read as "not here" when it means "not yours", which is a blank
 * meaning two opposite things (CLAUDE.md §1).
 */
export function NotePickerSheet({
  open,
  onOpenChange,
  onChosen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChosen: (id: ResidentId) => void
}) {
  const [query, setQuery] = useState('')
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('')
        onOpenChange(next)
      }}
      title="Who is this note about?"
      height="full"
      head={
        <div className={styles.searchField}>
          <Icon name={phoneIcons.search} size={20} />
          <input
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
      }
    >
      <PickerBody query={query.trim()} onChosen={onChosen} />
    </Sheet>
  )
}

/** Loads when the sheet opens, so a picker never shows yesterday's home. */
function PickerBody({
  query,
  onChosen,
}: {
  query: string
  onChosen: (id: ResidentId) => void
}) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Person[]>(load, [activeSite.id])
  const total = (people: Person[]) =>
    pluralise(people.length, VOCABULARY.subject.one, VOCABULARY.subject.many)

  return (
    <Loaded
      resource={resource}
      loading={`Loading everyone at ${activeSite.name}…`}
      failed={`Everyone at ${activeSite.name} could not be loaded`}
    >
      {(people) => {
        if (query !== '') {
          const found = people
            .filter((person) => matchesNameOrRoom(person, query))
            .sort(byRoom)
          return (
            <>
              <p className={styles.quiet} role="status">
                {found.length === 0
                  ? `Nobody at ${activeSite.name} matches “${query}”, out of ${total(people)}.`
                  : `${found.length} of ${total(people)} match “${query}”. Searches everyone at ${activeSite.name}, not only your list.`}
              </p>
              <Rows people={found} onChosen={onChosen} />
            </>
          )
        }
        if (viewer.scope.kind === 'not_decided')
          return (
            <>
              <Unrecorded
                variant="phonePanel"
                label={noListYetLine}
                detail={`Search above reaches everyone at ${activeSite.name}, and says for each whether you can write about them.`}
              />
            </>
          )
        const yours = people
          .filter((person) => scopeReaches(viewer.scope, person.id))
          .sort(byRoom)
        return (
          <>
            <p className={styles.quiet}>
              {viewer.scope.kind === 'every_resident'
                ? `Everyone at ${activeSite.name}, ${total(people)}.`
                : `${scopeLine(
                    viewer.scope,
                    people.map((person) => person.id),
                    activeSite.name,
                  )}. Search reaches everyone else at ${activeSite.name}.`}
            </p>
            <Rows people={yours} onChosen={onChosen} />
          </>
        )
      }}
    </Loaded>
  )
}

/**
 * One row per person: a target where this reader may write about them, and
 * the refusal in words where they may not.
 */
function Rows({
  people,
  onChosen,
}: {
  people: Person[]
  onChosen: (id: ResidentId) => void
}) {
  const viewer = useViewer()
  if (people.length === 0) return null
  return (
    <ul className={styles.listInSheet} data-picker>
      {people.map((person) => {
        const answer = viewer.ask('write_care_note', person.id)
        const room =
          person.room.kind === 'recorded' ? person.room.value : 'Room not recorded'
        if (answer.kind === 'yes')
          return (
            <li key={person.id}>
              <button
                type="button"
                className={`${styles.row} ${shell.pressRow} ${styles.pickRow}`}
                onClick={() => onChosen(person.id)}
              >
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{listName(person)}</span>
                </span>
                <span className={styles.room}>{room}</span>
                <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
              </button>
            </li>
          )
        return (
          <li key={person.id} data-refused={answer.kind}>
            <div className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{listName(person)}</span>
                <span className={styles.rowMeta}>
                  {phoneRefusalOf(answer, listName(person))}
                </span>
              </span>
              <span className={styles.room}>{room}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
