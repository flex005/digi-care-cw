import type { ImportantPeople, ImportantPerson } from '@/data/types'
import { Unrecorded } from '@/components/status'
import styles from './people-and-plans.module.css'

/**
 * Who this home rings first: a panel at the top of the tab, not a marker hidden
 * on one of seven person blocks.
 *
 * Any recorded person can carry `isPrimaryContact`, so reading it off the
 * blocks means scanning all of them and hoping the marker was not missed.
 * Three states, because a blank could mean any of them:
 *
 *   Helen Whitcombe, wife         recorded
 *   Not recorded                  a gap: nobody has said who to ring first
 *   More than one recorded        a contradiction, never quietly resolved
 *
 * The third does not occur in the fixtures and renders anyway. Picking one of
 * two silently is how the wrong family member finds out.
 *
 * Read-only: who holds it is changed by a manager or an admin, through the
 * profile edit the tab's act refuses.
 */

interface Held {
  person: ImportantPerson
  /** Where the flag was found. */
  category: string
}

/** Exported so a test can find a resident with none, rather than naming one. */
export function primaryContactsIn(people: ImportantPeople): Held[] {
  const held: Held[] = []
  const consider = (person: ImportantPerson, category: string) => {
    if (person.isPrimaryContact) held.push({ person, category })
  }

  if (people.nextOfKin.kind === 'recorded')
    consider(people.nextOfKin.value, 'Next of kin')
  if (people.emergencyContact.kind === 'recorded')
    consider(people.emergencyContact.value, 'Emergency contact')
  if (people.lpaHolder.kind === 'recorded')
    consider(people.lpaHolder.value, 'Lasting power of attorney')
  if (people.advocate.kind === 'recorded') consider(people.advocate.value, 'Advocate')
  if (people.familyWithVisitingRights.kind === 'recorded')
    for (const person of people.familyWithVisitingRights.items)
      consider(person, 'Family with visiting rights')

  return held
}

export function PrimaryContactPanel({
  people,
  residentName,
}: {
  people: ImportantPeople
  residentName: string
}) {
  const held = primaryContactsIn(people)

  if (held.length === 0)
    return (
      <div className={styles.bannerSlot} data-primary-contact="none">
        <Unrecorded
          variant="panel"
          caption="Primary contact"
          label="Not recorded"
          detail={`Nobody has been named as the person this home rings first about ${residentName}.`}
        />
      </div>
    )

  if (held.length > 1)
    return (
      <div className={styles.bannerSlot} data-primary-contact="conflict">
        <div className={styles.bannerCritical}>
          <p className={styles.bannerCaption}>Primary contact</p>
          <p className={styles.bannerHeadline}>More than one recorded</p>
          <p className={styles.bannerDetail}>
            {held
              .map((entry) => `${entry.person.name} (${entry.category})`)
              .join(' and ')}{' '}
            are both marked as the primary contact for {residentName}. Only one person
            can be.
          </p>
        </div>
      </div>
    )

  const [only] = held as [Held]

  return (
    <div className={styles.bannerSlot} data-primary-contact="recorded">
      <div className={styles.bannerInfo}>
        <p className={styles.bannerCaption}>Primary contact</p>
        <p className={styles.bannerHeadline}>{only.person.name}</p>
        <p className={styles.bannerDetail}>
          {only.person.relationship} · {only.category}. This is the person the home
          rings first about {residentName}.
        </p>
      </div>
    </div>
  )
}
