import type { AllergyStatus } from '@/data/types'
import { AllergyBadge } from './AllergyBadge'
import styles from './AllergyNames.module.css'

/**
 * Allergies by substance alone, **every one of them, however many**: the fact
 * somebody needs at the moment of giving a drug is whether this drug is on the
 * list. For a space that cannot grow with the list, such as a head pinned over
 * doses; the reaction and severity of each go where they can be read before the
 * first dose without holding the screen (`AllergyBadge`).
 *
 * **Nothing is cut short.** Seven allergies wrap to two or three lines; none is
 * ever behind a "+3 more", which is an allergy out of sight at the moment it
 * matters. No known allergies and allergies not recorded are short already, and
 * render as they do everywhere else.
 */
export function AllergyNames({ status }: { status: AllergyStatus }) {
  if (status.kind !== 'allergies') return <AllergyBadge status={status} />
  return (
    <p className={styles.names} data-state="recorded" data-tone="critical">
      <span className={styles.dot} aria-hidden="true" />
      <span>
        Allergies: {status.items.map((allergy) => allergy.substance).join(', ')}
      </span>
    </p>
  )
}
