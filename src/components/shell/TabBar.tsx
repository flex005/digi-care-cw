import { useState } from 'react'
import { Icon } from '@/components/icon/Icon'
import { Dialog } from '@/components/primitives'
import { NAV_ITEMS, NAV_SECTIONS, shellIcons } from './nav.icons'
import { NavEntry } from './NavEntry'
import styles from './TabBar.module.css'

/**
 * The compact layout's navigation: the rail, moved to the bottom. Four modules
 * as tabs, and More holding the rest in the same sections, the account
 * included.
 */
export function TabBar() {
  const [moreOpen, setMoreOpen] = useState(false)
  const tabs = NAV_ITEMS.filter((item) => item.compact === 'tab')

  return (
    <nav className={styles.tabbar} aria-label="Main navigation">
      <ul className={styles.tabs}>
        {tabs.map((item) => (
          <li key={item.module} className={styles.slot}>
            <NavEntry
              item={item}
              className={styles.tab}
              activeClassName={styles.active}
              disabledClassName={styles.disabled}
            >
              <Icon name={item.icon} size={20} />
              <span className={styles.label}>{item.label}</span>
            </NavEntry>
          </li>
        ))}
        <li className={styles.slot}>
          <button
            type="button"
            className={styles.tab}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
          >
            <Icon name={shellIcons.more} size={20} />
            <span className={styles.label}>More</span>
          </button>
        </li>
      </ul>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <div className={styles.more}>
          {NAV_SECTIONS.map((section) => {
            const items = NAV_ITEMS.filter(
              (item) => item.section === section.id && item.compact === 'more',
            )
            if (items.length === 0) return null
            return (
              <div key={section.id} className={styles.moreSection}>
                {section.label === '' ? null : (
                  <p className={styles.moreHeading}>{section.label}</p>
                )}
                <ul className={styles.moreItems}>
                  {items.map((item) => (
                    <li key={item.module}>
                      <NavEntry
                        item={item}
                        className={styles.moreItem}
                        activeClassName={styles.moreActive}
                        disabledClassName={styles.disabled}
                        onNavigate={() => setMoreOpen(false)}
                      >
                        <Icon name={item.icon} size={20} />
                        <span>{item.label}</span>
                      </NavEntry>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </Dialog>
    </nav>
  )
}
