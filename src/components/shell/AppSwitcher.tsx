import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { DIGI_APPS, NOT_IN_THIS_BUILD } from '@/app/digi-apps'
import { shellIcons } from './nav.icons'
import styles from './TopBar.module.css'

/**
 * The diGi app switcher — the grid beside the bell, as the Admin build's bar
 * carries it.
 *
 * The apps come from `digi-apps.ts`, which holds the rule that matters here:
 * only apps the documents name. A launcher full of plausible siblings would
 * put fictional products in real chrome.
 *
 * **They are listed, not offered.** The Admin draws each as a disabled menu
 * item; this build does not draw controls that refuse, so each is a line of
 * text saying what it is and whether it is this one. Nothing here is a
 * silent no-op and nothing here is greyed out: a reader gets the family this
 * product belongs to, and the plain fact that the prototype is one window on
 * it.
 */
export function AppSwitcher() {
  return (
    <DropdownMenu>
      {/* Icon-only, so a name and a tooltip, never one or the other (§7). */}
      <Tooltip content="diGi apps">
        <DropdownMenuTrigger
          className={styles.iconButton}
          aria-label="diGi apps"
          data-app-switcher
        >
          <Icon name={shellIcons.appSwitcher} size={20} />
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end">
        {/* "Apps", not "diGi apps": the label style uppercases, and
            "DIGI APPS" mangles a brand whose casing is the point. The
            trigger's name keeps the full "diGi apps". */}
        <DropdownMenuLabel>Apps</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <AppList />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The family, split out so it can be read without opening a menu — for the
 * reason `NotificationsSummary` is.
 */
export function AppList() {
  return (
    <ul className={styles.appList}>
      {DIGI_APPS.map((app) => (
        <li className={styles.app} key={app.name} data-app={app.name}>
          <span className={styles.appText}>
            <span className={styles.appName}>{app.name}</span>
            <span className={styles.appDescription}>{app.description}</span>
          </span>
          <span className={styles.appState}>
            {app.isCurrent ? 'This app' : NOT_IN_THIS_BUILD}
          </span>
        </li>
      ))}
    </ul>
  )
}
