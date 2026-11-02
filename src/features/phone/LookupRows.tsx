import Link from 'next/link'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { pluralise } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { listName, noListYetLine, type Person } from './phone-data'
import { PHONE_PATHS } from './phone-paths'
import { phoneIcons } from './phone.icons'
import styles from './phone.module.css'

/**
 * A lookup row: a name and a room, and nothing else.
 *
 * **No status, no avatar.** This is where somebody finds a person, not where
 * they find work, and a status on every row of the home would turn the hatch
 * into wallpaper: the one mark this product exists to make visible would be on
 * every line and so on none.
 *
 * **It opens only if the record would**, asked of the role table: a row that
 * looked tappable and refused on arrival would be a control that does not do
 * what it shows. A row that does not open has no chevron and stays 48px tall,
 * so the list keeps one rhythm.
 */
export function LookupRow({ person }: { person: Person }) {
  const viewer = useViewer()
  const opens = viewer.ask('open_resident_record', person.id).kind === 'yes'
  const content = (
    <>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{listName(person)}</span>
      </span>
      {person.room.kind === 'recorded' ? (
        <span className={styles.room}>{person.room.value}</span>
      ) : (
        <Unrecorded label="Room not recorded" />
      )}
      {opens ? (
        <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
      ) : null}
    </>
  )
  return opens ? (
    <Link
      href={PHONE_PATHS.record(person.id)}
      className={styles.row}
      aria-label={`${listName(person)}${person.room.kind === 'recorded' ? `, room ${person.room.value}` : ', room not recorded'}`}
    >
      {content}
    </Link>
  ) : (
    <div className={styles.row}>{content}</div>
  )
}

/**
 * How many of the people in view open from here, when not all of them do.
 * Nothing when every row opens, because then there is nothing to explain.
 */
export function OpensFromHere({ people }: { people: Person[] }) {
  const viewer = useViewer()
  const opening = people.filter(
    (person) => viewer.ask('open_resident_record', person.id).kind === 'yes',
  ).length
  if (opening === people.length) return null
  const total = pluralise(
    people.length,
    VOCABULARY.subject.one,
    VOCABULARY.subject.many,
  )
  return (
    <p className={styles.quiet}>
      {viewer.scope.kind === 'not_decided'
        ? `None of these ${total} opens from here. ${noListYetLine}`
        : `${opening} of these ${total} open from here: the ones on your list.`}
    </p>
  )
}
