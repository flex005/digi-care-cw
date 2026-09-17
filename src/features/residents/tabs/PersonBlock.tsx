import type { ReactNode } from 'react'
import type {
  CommunicationPreference,
  ContactDetails,
  ContactMethodId,
  ImportantPerson,
  Recorded,
} from '@/data/types'
import { CONTACT_METHODS } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import styles from './people-and-plans.module.css'

/**
 * A person, drawn the same way wherever one appears on Important People.
 *
 * Name and relationship, then how to reach them, then how they asked to be
 * reached, then whether they are the one the home rings first. The
 * relationship qualifies the name; the preference qualifies the number above it.
 *
 * **The number is text, not a link.** Calling is not built in this build, and a
 * number that dials would claim otherwise.
 */

function methodName(method: ContactMethodId): string {
  const found = CONTACT_METHODS.find((entry) => entry.id === method)
  if (found === undefined) throw new Error(`No contact method is named ${method}.`)
  return found.name
}

export function ContactLines({ contact }: { contact: ContactDetails }) {
  return (
    <p className={styles.personLine}>
      <span className={styles.contactNumber} data-numeric>
        {contact.phone}
      </span>
      <span className={styles.contactMeta}> · {contact.email}</span>
    </p>
  )
}

/**
 * How this person asked to be contacted, and in what language.
 *
 * Ringing somebody who asked to be written to, or ringing in English somebody
 * who asked for Yoruba, is how a family hears something has happened from the
 * wrong person in the wrong words. So the unrecorded case is hatched.
 */
export function CommunicationPreferenceLine({
  preference,
}: {
  preference: Recorded<CommunicationPreference>
}) {
  return (
    <div className={styles.personPreference}>
      <span className={styles.personPreferenceLabel}>Preferred contact</span>
      {preference.kind === 'unrecorded' ? (
        <Unrecorded
          variant="chip"
          label="Not recorded"
          detail="nobody has asked how this person wants to be contacted, or in what language"
        />
      ) : (
        <span className={styles.personPreferenceValue}>
          {methodName(preference.value.method)} · {preference.value.language}
        </span>
      )}
    </div>
  )
}

export function PersonBlock({
  person,
  extra,
}: {
  person: ImportantPerson
  /** Facts a plain contact does not carry, such as an LPA's authority. */
  extra?: ReactNode
}) {
  return (
    <div className={styles.person}>
      <p className={styles.personName}>
        {person.name}
        <span className={styles.personRelationship}> · {person.relationship}</span>
      </p>
      <ContactLines contact={person.contact} />
      <p className={styles.personLine}>{person.address}</p>
      {extra}
      <CommunicationPreferenceLine preference={person.communicationPreference} />
      {person.isPrimaryContact ? (
        // Marks which person holds it. The panel at the top says what holding it means.
        <StatusPill tone="info" label="Primary contact" />
      ) : null}
    </div>
  )
}
