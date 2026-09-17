import Link from 'next/link'
import type { Medication, Resident } from '@/data/types'
import { Avatar } from '@/components/primitives'
import { useSiteFormat } from '@/app/session/use-session'
import { listName } from '@/features/residents/list-name'
import styles from '../medications.module.css'

/**
 * Who a cross-resident medication row is about. **A dose never renders without
 * the person it belongs to**: a drug, a dose and a time with no name beside it
 * is the wrong-subject failure with a dosage on it (CLAUDE.md §2).
 *
 * Shared by the omissions list and the controlled drug register.
 */
export function RowSubject({ resident }: { resident: Resident }) {
  return (
    <div className={styles.rowSubject}>
      <Avatar photo={resident.photo} name={resident.fullLegalName} size="small" />
      <div className={styles.rowWho}>
        <Link className={styles.rowName} href={`/residents/${resident.id}/medications`}>
          {listName(resident)}
        </Link>
        <p className={styles.rowFacts}>{roomWords(resident)}</p>
      </div>
    </div>
  )
}

/**
 * The subject of a write, in the dialog that makes it: photograph, name,
 * preferred name, room and date of birth (CLAUDE.md §2). Still on screen while
 * the rest of the dialog is read.
 */
export function DialogSubject({ resident }: { resident: Resident }) {
  const format = useSiteFormat()
  return (
    <div className={styles.dialogSubject} data-confirm-subject>
      <Avatar photo={resident.photo} name={resident.fullLegalName} size="medium" />
      <div className={styles.dialogWho}>
        <p className={styles.dialogName}>
          {resident.fullLegalName}{' '}
          <span className={styles.dialogPreferred}>
            known as {resident.preferredName}
          </span>
        </p>
        <p className={styles.dialogFacts}>
          {roomWords(resident)}
          {' · Born '}
          <span data-numeric>{format.date(resident.dateOfBirth)}</span>
        </p>
      </div>
    </div>
  )
}

export const roomWords = (resident: Resident): string =>
  resident.room.kind === 'recorded'
    ? `Room ${resident.room.value}`
    : 'Room not recorded'

/**
 * A drug named inside a sentence: "morphine sulfate oral solution". A drug name
 * is a common noun, so it takes a capital only where the sentence starts.
 */
export const drugInSentence = (medication: Medication): string =>
  `${medication.name.charAt(0).toLowerCase()}${medication.name.slice(1)}`
