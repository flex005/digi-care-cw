import Link from 'next/link'
import { useSignedIn } from '@/app/session/use-session'
import { ActLine, buttonClassName } from '@/components/primitives'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { PHONE_PATHS } from './phone-paths'
import styles from './phone.module.css'

/**
 * Today, on the phone: not built, and saying so.
 *
 * **Settled last, on purpose.** It summarises the other modules, so drawing it
 * before they exist on the phone would put figures on it that no screen behind
 * them could be checked against — the dashboard's own rule, that it holds no
 * record of its own.
 */
export function TodayRoute() {
  const { member } = useSignedIn()
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName
  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Hello, {firstName}</h1>
        <p className={styles.subtitle}>Today</p>
      </div>
      <div className={[styles.card, styles.cardPadded].join(' ')}>
        <p className={styles.cardTitle}>Today is settled last</p>
        <p className={styles.body}>
          It sums up the other modules, so it waits until they are on the phone.
        </p>
        <p className={styles.body}>Built so far: {VOCABULARY.subject.Many}.</p>
        <ActLine kind="not_built">Today is not built yet on the phone.</ActLine>
        <div className={styles.actions}>
          <Link
            href={PHONE_PATHS.yourList}
            className={buttonClassName({ variant: 'primary', size: 'large' })}
          >
            Open your list
          </Link>
        </div>
      </div>
    </>
  )
}
