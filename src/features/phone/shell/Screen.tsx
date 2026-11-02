import { useState, type ReactNode } from 'react'
import { useSession } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { phoneIcons } from '../phone.icons'
import { usePhoneNav } from './nav'
import styles from './shell.module.css'

/**
 * One phone screen: its bar, anything that must never scroll away, the one
 * pane that scrolls, and its one primary action.
 *
 * **A root screen has a large title in its content** that collapses into the
 * bar once it has scrolled away (docs/MOBILE_APP_SHELL.md §7). A pushed screen
 * has a back chevron and its title in the bar from the start.
 *
 * **The home is in the bar on every screen**, under the title (CLAUDE.md §2).
 *
 * `subject` sits between the bar and the pane, so a record's subject header is
 * fixed while the record scrolls under it (CLAUDE.md §2). `primary` sits under
 * the pane, above the tab bar, where a thumb is (§8).
 */
export function Screen({
  title,
  subtitle,
  root = false,
  heading = 'title',
  action,
  subject,
  primary,
  children,
}: {
  title: string
  subtitle?: ReactNode
  /** A tab's first screen: large title, no back. */
  root?: boolean
  /** Whether the title is the screen's heading, or something in it is. */
  heading?: 'title' | 'elsewhere'
  action?: ReactNode
  subject?: ReactNode
  primary?: ReactNode
  children: ReactNode
}) {
  const nav = usePhoneNav()
  const { activeSite } = useSession()
  const [scrolledPast, setScrolledPast] = useState(false)
  const showTitle = !root || scrolledPast
  const BarTitle = !root && heading === 'title' ? 'h1' : 'p'

  return (
    <section className={styles.screen} aria-label={title}>
      <header className={styles.bar}>
        <div className={styles.barSide}>
          {root ? null : (
            <button
              type="button"
              className={`${styles.barButton} ${styles.press}`}
              onClick={nav.back}
              aria-label="Back"
            >
              <Icon name={phoneIcons.back} size={24} />
            </button>
          )}
        </div>
        <div className={styles.barMiddle}>
          <BarTitle
            className={
              showTitle
                ? styles.barTitle
                : `${styles.barTitle} ${styles.barTitleHidden}`
            }
            aria-hidden={root && !scrolledPast ? true : undefined}
          >
            {title}
          </BarTitle>
          <p className={styles.barHome}>{activeSite.name}</p>
        </div>
        <div className={styles.barSide}>{action}</div>
      </header>
      {subject}
      <div
        className={styles.pane}
        data-scroll-pane
        onScroll={
          root
            ? (event) => setScrolledPast(event.currentTarget.scrollTop > 40)
            : undefined
        }
      >
        <div className={styles.paneBody}>
          {root ? (
            <div className={styles.largeTitle}>
              <h1 className={styles.largeTitleText}>{title}</h1>
              {subtitle === undefined ? null : (
                <p className={styles.largeTitleSub}>{subtitle}</p>
              )}
            </div>
          ) : null}
          {children}
        </div>
      </div>
      {primary === undefined ? null : (
        <div className={styles.primaryDock}>{primary}</div>
      )}
    </section>
  )
}
