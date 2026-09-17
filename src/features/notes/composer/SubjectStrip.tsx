import type { Resident, Site } from '@/data/types'
import { now } from '@/data/fixtures/clock'
import { Avatar } from '@/components/primitives'
import { AllergyBadge, Unrecorded } from '@/components/status'
import { ageFrom, formatDate } from '@/lib/format'
import styles from './composer.module.css'

/**
 * The subject header on a write surface. CLAUDE.md §2.
 *
 * > Every write surface carries a persistent, non-collapsing subject header:
 * > resident photo, name, preferred name, room, DOB.
 *
 * Ported from the Admin build. **Sticky**, so whoever is typing can see who
 * they are typing about at any point in a long form, and never collapsible.
 * The profile head above the composer is not sticky and scrolls away; this
 * does not.
 *
 * It carries allergies as well as identity: a note about medication written
 * against somebody whose allergies are out of sight is the failure next door
 * to writing against the wrong person.
 */
export function SubjectStrip({ resident, site }: { resident: Resident; site: Site }) {
  return (
    <div className={styles.subject} data-subject-strip={resident.id}>
      <div className={styles.subjectRow}>
        <Avatar photo={resident.photo} name={resident.fullLegalName} size="small" />
        <div className={styles.subjectWho}>
          <p className={styles.subjectName}>{resident.preferredName}</p>
          <p className={styles.subjectLegal}>{resident.fullLegalName}</p>
        </div>
        <p className={styles.subjectFacts}>
          <span>
            {resident.room.kind === 'recorded' ? (
              `Room ${resident.room.value}`
            ) : (
              <Unrecorded label="Room not recorded" />
            )}
          </span>
          <span data-numeric>
            Born {formatDate(resident.dateOfBirth)} (
            {ageFrom(resident.dateOfBirth, now())})
          </span>
          <span>{site.name}</span>
        </p>
      </div>
      <div className={styles.subjectAllergies}>
        <AllergyBadge status={resident.allergies} />
      </div>
    </div>
  )
}
