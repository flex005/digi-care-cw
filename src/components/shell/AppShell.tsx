import type { ReactNode } from 'react'
import { MovedClockLine } from './MovedClockLine'
import { Rail } from './Rail'
import { RequireSignIn } from './RequireSignIn'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import styles from './AppShell.module.css'

/**
 * The signed-in frame, in the shape the visual direction sets
 * (docs/cw-dashboard.html): a pill top bar across the page, an icon rail
 * beside the content on a wide screen, and bottom tabs on a compact one.
 *
 * **The page scrolls, not a panel inside it**, so a full-page capture takes the
 * whole screen, and the rail stays in view by sticking rather than by the
 * content scrolling under it.
 *
 * **Which layout shows is decided by CSS alone**, at the one breakpoint in
 * tokens.css. A Figma capture taken at a width gets that width's layout.
 *
 * **Flex throughout, never grid.** Figma has no grid.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <RequireSignIn>
      <a className="skipToContent" href="#main">
        Skip to content
      </a>
      <div className={styles.page}>
        <div className={styles.frame}>
          <TopBar />
          <div className={styles.body}>
            <div className={styles.rail}>
              <Rail />
            </div>
            <main id="main" className={styles.main}>
              <MovedClockLine />
              {children}
            </main>
          </div>
        </div>
        <div className={styles.tabbar}>
          <TabBar />
        </div>
      </div>
    </RequireSignIn>
  )
}
