import { NAV_ITEMS, PILL_MODULES } from './nav.icons'
import { NavEntry } from './NavEntry'
import styles from './NavPill.module.css'

/**
 * The five modules a shift moves between, as a pill of tabs in the top bar.
 *
 * **A grey track with no thumb.** The raised white thumb belongs to the
 * segmented control, which switches between presentations of the same data;
 * navigation goes to different data, and the MAR will put both on one screen.
 * The tab you are on reads by weight and ink.
 */
export function NavPill() {
  return (
    <nav className={styles.pill} aria-label="Shift navigation">
      <ul className={styles.tabs}>
        {PILL_MODULES.map((module) => {
          const item = NAV_ITEMS.find((entry) => entry.module === module)
          if (item === undefined)
            throw new Error(`The pill names ${module}, which is not a nav item.`)
          return (
            <li key={item.module}>
              <NavEntry
                item={item}
                className={styles.tab}
                activeClassName={styles.active}
                disabledClassName={styles.disabled}
                tooltipSide="bottom"
              >
                {item.label}
              </NavEntry>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
