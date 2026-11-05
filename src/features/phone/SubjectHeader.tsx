import { Avatar } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import type { Person } from './phone-data'
import styles from './phone.module.css'

/**
 * Who a record or a write is about: photo, preferred name, room and date of
 * birth, and the full legal name where nothing above it already says it
 * (CLAUDE.md §2). On a record the name is the bar's title, so the block leads
 * with what the bar does not say; at the head of a composer, which covers the
 * bar, the name is here.
 */
export function SubjectHeader({
  person,
  name,
}: {
  person: Person
  /** Whether the full legal name is drawn here or already in the bar above. */
  name: 'here' | 'in_the_bar'
}) {
  return (
    <div className={styles.subject} data-subject-header>
      <Avatar photo={person.photo} name={person.fullLegalName} size="medium" />
      <div className={styles.subjectText}>
        {name === 'here' ? (
          <p className={styles.subjectName}>{person.fullLegalName}</p>
        ) : null}
        <p className={styles.subjectFacts}>
          <span>Known as {person.preferredName}</span>
          {person.room.kind === 'recorded' ? (
            <span>Room {person.room.value}</span>
          ) : (
            <Unrecorded label="Room not recorded" />
          )}
          <span>Born {formatDate(person.dateOfBirth)}</span>
        </p>
      </div>
    </div>
  )
}
