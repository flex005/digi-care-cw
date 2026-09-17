import type { ReactNode } from 'react'
import type { SignedEntry } from '@/data/types'
import { staffLabel } from '@/data/access/team-store'
import { formatDate } from '@/lib/format'
import styles from './FieldList.module.css'

/**
 * A signed, dated, version-controlled entry.
 *
 * All three on one line beneath the value, always visible and never
 * hover-only. The version is shown even at 1: a number that only appears once
 * it is interesting teaches the reader nothing the first time they see it, and
 * the interesting case here is the entry rewritten since the family last read it.
 *
 * There is no history link. The fixtures carry a version number and not the
 * versions behind it, and a link to a list that does not exist would be worse
 * than the number alone.
 *
 * `signedBy` is a member of staff here, unlike a DNAR's, which is a plain
 * string: a DNAR is signed by a clinician who is usually not staff at the home.
 */
export function SignedValue<T>({
  entry,
  render,
}: {
  entry: SignedEntry<T>
  render: (value: T) => ReactNode
}) {
  return (
    <>
      <div className={styles.value}>{render(entry.value)}</div>
      <p className={styles.attribution}>
        Signed by {staffLabel(entry.signedBy)},{' '}
        <span data-numeric>{formatDate(entry.signedOn)}</span> ·{' '}
        <span data-numeric>version {entry.version}</span>
      </p>
    </>
  )
}
