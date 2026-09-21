import { askToSignOut } from '@/features/auth/SignOutDialog'
import { Icon } from '@/components/icon/Icon'
import { Tooltip } from '@/components/primitives'
import { NAV_ITEMS, shellIcons } from './nav.icons'
import { NavEntry } from './NavEntry'
import styles from './Rail.module.css'

/**
 * The icon rail: every module in the first pill, the account and signing out
 * in the second. Icons only, each with its name as its accessible name and in
 * a tooltip.
 */
export function Rail() {
  const group = (rail: 'modules' | 'account') =>
    NAV_ITEMS.filter((item) => item.rail === rail).map((item) => (
      <li key={item.module}>
        <NavEntry
          item={item}
          className={styles.button}
          activeClassName={styles.active}
          disabledClassName={styles.disabled}
          iconOnly
        >
          <Icon name={item.icon} size={20} />
        </NavEntry>
      </li>
    ))

  return (
    <nav className={styles.rail} aria-label="Main navigation">
      <ul className={styles.group}>{group('modules')}</ul>
      <ul className={styles.group}>
        {group('account')}
        <li>
          <Tooltip content="Sign out" side="right">
            <button
              type="button"
              className={styles.button}
              aria-label="Sign out"
              onClick={askToSignOut}
              data-sign-out
            >
              <Icon name={shellIcons.signOut} size={20} />
            </button>
          </Tooltip>
        </li>
      </ul>
    </nav>
  )
}
