import { useState, type ReactNode } from 'react'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { Avatar } from '@/components/primitives'
import { phoneIcons } from '../phone.icons'
import { usePhoneNav } from './nav'
import styles from './shell.module.css'

/**
 * One phone screen: its bar, anything that must never scroll away, the one
 * pane that scrolls, and its one primary action.
 *
 * **A root screen opens on a person or a large title.** With `person`, the bar
 * is the reader: their initials, the title beside them, and a small line under
 * it that names the home; nothing scrolls away. Without it, a large title sits
 * in the content and collapses into the bar once it has scrolled away
 * (docs/MOBILE_APP_SHELL.md §7). A pushed screen has a small back chevron
 * immediately before its title, left aligned, from the start.
 *
 * **The home is in the bar on every screen** (CLAUDE.md §2): under the title,
 * or in the person's line.
 *
 * `subject` sits between the bar and the pane, so a record's subject header is
 * fixed while the record scrolls under it (CLAUDE.md §2). `primary` sits under
 * the pane, above the tab bar, where a thumb is (§8).
 */
export function Screen({
  title,
  subtitle,
  root = false,
  person,
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
  /**
   * A root screen headed by the reader rather than a title: the line under the
   * title, which must name the home, and at most two round icon buttons.
   */
  person?: { line: string; actions?: ReactNode }
  /** Whether the title is the screen's heading, or something in it is. */
  heading?: 'title' | 'elsewhere'
  action?: ReactNode
  subject?: ReactNode
  primary?: ReactNode
  children: ReactNode
}) {
  const nav = usePhoneNav()
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const [scrolledPast, setScrolledPast] = useState(false)
  const showTitle = !root || scrolledPast
  const BarTitle = !root && heading === 'title' ? 'h1' : 'p'

  return (
    <section className={styles.screen} aria-label={title}>
      {root && person !== undefined ? (
        <header className={`${styles.bar} ${styles.personBar}`}>
          <Avatar
            photo={{ kind: 'not_on_file' }}
            name={member.ref.fullName}
            size="medium"
            tone="brand"
          />
          <div className={styles.personText}>
            <h1 className={styles.personName}>{title}</h1>
            <p className={styles.personLine}>{person.line}</p>
          </div>
          {person.actions === undefined ? null : (
            <div className={styles.personActions}>{person.actions}</div>
          )}
        </header>
      ) : (
        <header className={styles.bar}>
          {root ? null : (
            <button
              type="button"
              className={`${styles.barBack} ${styles.press}`}
              onClick={nav.back}
              aria-label="Back"
            >
              <Icon name={phoneIcons.back} size={20} />
            </button>
          )}
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
          {action === undefined ? null : <div className={styles.barSide}>{action}</div>}
        </header>
      )}
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
        <div
          className={
            primary === undefined
              ? styles.paneBody
              : `${styles.paneBody} ${styles.paneBodyDocked}`
          }
        >
          {root && person === undefined ? (
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
