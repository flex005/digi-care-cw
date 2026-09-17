import type { ReactNode } from 'react'
import styles from './PageHead.module.css'

/**
 * The head of a screen: who it is for, and the one thing to do next.
 *
 * `title` and `emphasis` are one heading, "Good evening, Kwame", with the name
 * a step quieter. `lines` is what the screen is scoped to: the shift, the home,
 * the list. `aside` is a quiet chip (the date and time), `action` the primary
 * act as a pill.
 */
export function PageHead({
  title,
  emphasis,
  lines,
  aside,
  action,
}: {
  title: string
  emphasis?: string
  lines: string[]
  aside?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className={styles.head}>
      <div className={styles.text}>
        <h1 className={styles.title}>
          {title}
          {emphasis === undefined ? null : (
            <>
              , <span className={styles.emphasis}>{emphasis}</span>
            </>
          )}
        </h1>
        <p className={styles.lines}>{lines.join(' · ')}</p>
      </div>
      {aside === undefined && action === undefined ? null : (
        <div className={styles.side}>
          {aside === undefined ? null : <span className={styles.chip}>{aside}</span>}
          {action}
        </div>
      )}
    </header>
  )
}
