import { Icon } from '@/components/icon/Icon'
import { Logo } from '@/components/brand/Logo'
import { NAV_ITEMS, NAV_SECTIONS } from './nav.icons'
import { NavEntry } from './NavEntry'
import styles from './Sidebar.module.css'

/** The wide layout's navigation. Every module, built or not, in declared order. */
export function Sidebar() {
  return (
    <nav className={styles.sidebar} aria-label="Main navigation">
      <div className={styles.brand}>
        <Logo variant="lockup" height={32} title="Radiant digicare" />
      </div>

      <div className={styles.scroll}>
        {NAV_SECTIONS.map((section) => {
          const items = NAV_ITEMS.filter((item) => item.section === section.id)
          return (
            <div key={section.id} className={styles.section}>
              {section.label === '' ? null : (
                <p className={styles.sectionLabel}>{section.label}</p>
              )}
              <ul className={styles.items}>
                {items.map((item) => (
                  <li key={item.module}>
                    <NavEntry
                      item={item}
                      className={styles.item}
                      activeClassName={styles.active}
                      disabledClassName={styles.disabled}
                    >
                      <Icon name={item.icon} size={20} />
                      <span className={styles.label}>{item.label}</span>
                    </NavEntry>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
