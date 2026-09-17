import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { sessionLosses } from '@/data/access/session-losses'
import { pinHoldings } from '@/app/session/medication-pins'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { Button, buttonClassName } from '@/components/primitives'
import { PageHead } from '@/components/layout/PageHead'
import { formatCount, pluralise } from '@/lib/format'
import styles from './auth.module.css'

/**
 * Signing out (AUTH-09), from the rail or the account menu.
 *
 * **The one act in this build that destroys work rather than failing to save
 * it.** Everything recorded is held in this tab and nowhere else, so the
 * confirmation names what would go, item by item, with counts. Where nothing
 * has been written it says so plainly, rather than drawing an empty list.
 *
 * Read once, on the way in: the list somebody agreed to is the list destroyed.
 */
export function SignOutRoute() {
  const { signOut } = useSession()
  const { member } = useSignedIn()
  const router = useRouter()
  const [losses] = useState(() => [...sessionLosses(), ...pinHoldings()])
  const total = losses.reduce((running, entry) => running + entry.count, 0)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <div data-sign-out>
      <PageHead
        title={`Sign out, ${firstName}?`}
        lines={['Signing out discards everything recorded this session']}
      />
      {/* A confirmation, not a card of content: it has nowhere to expand to,
          so it takes the card's surface without its head. */}
      <section className={styles.confirm}>
        <h2 className={styles.confirmTitle}>
          {losses.length > 0 ? 'What you would lose' : 'Nothing to lose'}
        </h2>
        {losses.length > 0 ? (
          <ul className={styles.losses} data-loss-list>
            {losses.map((entry) => (
              <li key={entry.what} className={styles.loss} data-loss={entry.what}>
                <span>{entry.what.charAt(0).toUpperCase() + entry.what.slice(1)}</span>
                <span className={styles.lossCount} data-numeric>
                  {formatCount(entry.count)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.nothingToLose} data-nothing-to-lose>
            Nothing has been recorded this session, so signing out loses nothing.
          </p>
        )}
        <div className={styles.signOutActions}>
          <Link
            href="/"
            className={buttonClassName({ variant: 'secondary', size: 'large' })}
          >
            Stay signed in
          </Link>
          <Button
            variant="destructive"
            size="large"
            onClick={() => {
              signOut()
              router.replace('/sign-in')
            }}
            data-confirm-sign-out
          >
            {total === 0
              ? 'Sign out'
              : `Sign out and discard ${pluralise(total, 'record')}`}
          </Button>
        </div>
      </section>
    </div>
  )
}
