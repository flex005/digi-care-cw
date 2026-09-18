import Link from 'next/link'
import { EmptyState, buttonClassName } from '@/components/primitives'
import styles from './not-found.module.css'

/** A URL that names no screen. Said plainly, with the way back. */
export function NotFoundRoute() {
  return (
    <main className={styles.page}>
      <EmptyState
        title="There is no screen at this address"
        body="The address may be mistyped, or name a screen that is not built."
        actions={
          <Link href="/" className={buttonClassName({ variant: 'secondary' })}>
            Go to the start
          </Link>
        }
      />
    </main>
  )
}
