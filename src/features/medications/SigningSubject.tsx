import type { Resident } from '@/data/types'
import { AllergyBadge, Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import styles from './SigningSubject.module.css'

/**
 * What the act does not do, said where allergies are shown at a signature.
 *
 * Nothing in either build compares a drug with an allergy: a medication carries
 * no ingredient or class, so the only comparison available would be matching
 * names, which is not a check. Without this line, allergies shown at the PIN
 * read as allergies checked (CLAUDE.md §6). Held here because this is the one
 * place it is drawn, on the desktop round and on the phone.
 */
export const allergyNotCheckedLine = (name: string): string =>
  `Nothing here checks these drugs against ${name}’s allergies.`

/**
 * Who a medication PIN is about to sign for, at the moment it signs.
 *
 * **The subject again, inside the dialog**: name, room and date of birth
 * (CLAUDE.md §2), because a dialog covers the head of the surface that opened
 * it. **And the allergies**, in all three of their states, because the PIN is
 * the last moment before a drug is on the record as given, and allergies shown
 * only on the screen underneath are out of sight at exactly that moment.
 */
export function SigningSubject({ person }: { person: Resident }) {
  return (
    <div className={styles.subject}>
      <p className={styles.who} data-signing-subject={person.id}>
        <span>{person.fullLegalName}</span>
        <span>
          {person.room.kind === 'recorded' ? (
            `Room ${person.room.value}`
          ) : (
            <Unrecorded label="Room not recorded" />
          )}
        </span>
        <span data-numeric>Born {formatDate(person.dateOfBirth)}</span>
      </p>
      <div className={styles.allergies} data-signing-allergies>
        <AllergyBadge status={person.allergies} />
        <p className={styles.notChecked}>
          {allergyNotCheckedLine(person.fullLegalName)}
        </p>
      </div>
    </div>
  )
}
