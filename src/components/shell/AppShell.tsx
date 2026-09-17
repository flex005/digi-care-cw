import type { ReactNode } from 'react'
import { MovedClockLine } from './MovedClockLine'
import { RequireSignIn } from './RequireSignIn'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { TopBar } from './TopBar'
import styles from './AppShell.module.css'

/**
 * The signed-in frame: sidebar, top bar and content on a wide screen; top bar,
 * content and a bottom tab bar on a compact one.
 *
 * **Which layout shows is decided by CSS alone**, at the one breakpoint in
 * tokens.css, never by reading the window in script. A Figma capture taken at
 * a width gets that width's layout, with nothing in the DOM that differs
 * between a capture and a person using it.
 *
 * **Flex throughout, never grid.** Figma has no grid, and its importer builds
 * auto-layout from flex and gap; `scripts/check-figma-export.mjs` holds that.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <RequireSignIn>
      <a className="skipToContent" href="#main">
        Skip to content
      </a>
      <div className={styles.shell}>
        <div className={styles.sidebar}>
          <Sidebar />
        </div>
        <div className={styles.column}>
          <div className={styles.topbar}>
            <TopBar />
          </div>
          <main id="main" className={styles.main}>
            <MovedClockLine />
            {children}
          </main>
        </div>
        <div className={styles.tabbar}>
          <TabBar />
        </div>
      </div>
    </RequireSignIn>
  )
}
