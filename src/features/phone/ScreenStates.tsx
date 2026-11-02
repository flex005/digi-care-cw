import type { ReactNode } from 'react'
import type { AsyncResource } from '@/data/access/resource'
import { Button } from '@/components/primitives'
import { NotYourHome } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import styles from './phone.module.css'

/**
 * A phone screen's read in each of the states that are not the screen itself:
 * still loading, refused because the record is at another home, or failed.
 *
 * **A failed read says nothing was lost**, because nothing on these screens
 * writes, and offers the read again.
 */
export function Loaded<T>({
  resource,
  loading,
  failed,
  children,
}: {
  resource: AsyncResource<T>
  /** "Loading your list…" */
  loading: string
  /** "Your list could not be loaded" */
  failed: string
  children: (data: T) => ReactNode
}) {
  switch (resource.kind) {
    case 'ready':
      return <>{children(resource.data)}</>
    case 'loading':
      return (
        <div className={styles.card}>
          <p className={styles.status} role="status">
            {loading}
          </p>
        </div>
      )
    case 'refused':
      return <NotYourHome refusal={resource} />
    case 'error':
      return (
        <div className={[styles.card, styles.cardPadded].join(' ')} role="alert">
          <p className={styles.cardTitle}>{failed}</p>
          <p className={styles.body}>Nothing has been lost: this is a read.</p>
          <div className={styles.actions}>
            <Button variant="secondary" size="large" onClick={resource.retry}>
              Try again
            </Button>
          </div>
        </div>
      )
    default:
      return assertNever(resource)
  }
}
