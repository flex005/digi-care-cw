import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives'
import { MovedClockLine } from '@/components/shell/MovedClockLine'
import { RequireSignIn } from '@/components/shell/RequireSignIn'
import { SessionExpiry } from '@/components/shell/SessionExpiry'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { PHONE_PATHS } from './phone-paths'
import { phoneIcons } from './phone.icons'
import styles from './phone.module.css'

/**
 * The phone app's frame: the home across the top, the screen, and four tabs.
 *
 * **A second frame beside the desktop shell, not a mode of it.** The desktop
 * build is responsive and stays; this is a phone product built for one width,
 * reached at its own addresses under `/m`, so neither can change the other.
 *
 * **The home is always in the bar**, for somebody who works at one home as much
 * as for somebody who works at two (CLAUDE.md §2), and the bar sticks so it
 * stays in view on a long record.
 *
 * **A tab bar, not a rail**: Today, the people, medication and More. Only the
 * people are built. The other two say so when tapped, in the same words and the
 * same popover the desktop uses for a module with no screen, rather than being
 * left out: absence from a list is the same bug as a blank cell.
 *
 * One column at every width. At a desktop width it sits centred at phone width
 * rather than stretching, because what it specifies is the phone.
 */
export function PhoneShell({ children }: { children?: ReactNode }) {
  return (
    <RequireSignIn>
      <a className="skipToContent" href="#main">
        Skip to content
      </a>
      <div className={styles.frame}>
        <PhoneBar />
        <main id="main" className={styles.main}>
          <SessionExpiry />
          <MovedClockLine />
          {children}
        </main>
        <PhoneTabs />
      </div>
    </RequireSignIn>
  )
}

function PhoneBar() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  return (
    <header className={styles.bar}>
      <p className={styles.barHome}>{activeSite.name}</p>
      <p className={styles.barWho}>
        {member.ref.fullName} · {viewer.roleName}
      </p>
    </header>
  )
}

interface Tab {
  label: string
  icon: IconName
  /** Where it goes, or that it goes nowhere yet. */
  to:
    | { kind: 'built'; path: string; owns: (pathname: string) => boolean }
    | { kind: 'not_built'; note: string }
}

const TABS = (): Tab[] => [
  {
    label: 'Today',
    icon: phoneIcons.today,
    to: {
      kind: 'built',
      path: PHONE_PATHS.today,
      owns: (pathname) => pathname === PHONE_PATHS.today,
    },
  },
  {
    label: VOCABULARY.subject.Many,
    icon: phoneIcons.people,
    to: {
      kind: 'built',
      path: PHONE_PATHS.yourList,
      owns: (pathname) => pathname !== PHONE_PATHS.today,
    },
  },
  {
    label: VOCABULARY.medication.One,
    icon: phoneIcons.dose,
    to: { kind: 'not_built', note: '' },
  },
  {
    label: 'More',
    icon: phoneIcons.more,
    /* More is where signing out lives on a phone (AUTH-09), and it is not built. */
    to: { kind: 'not_built', note: ' Reloading the page signs you out.' },
  },
]

function PhoneTabs() {
  const pathname = usePathname()
  return (
    <nav className={styles.tabs} aria-label="Main navigation">
      <ul className={styles.tabList}>
        {TABS().map((tab) => (
          <li key={tab.label} className={styles.tabSlot}>
            {tab.to.kind === 'built' ? (
              <Link
                href={tab.to.path}
                className={[styles.tab, tab.to.owns(pathname) ? styles.tabActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={tab.to.owns(pathname) ? 'page' : undefined}
              >
                <Icon name={tab.icon} size={20} />
                <span className={styles.tabLabel}>{tab.label}</span>
              </Link>
            ) : (
              <Popover>
                <PopoverTrigger
                  className={[styles.tab, styles.tabNotBuilt].join(' ')}
                  aria-label={`${tab.label}, not built`}
                  data-built="false"
                >
                  <Icon name={tab.icon} size={20} />
                  <span className={styles.tabLabel}>{tab.label}</span>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className={styles.popoverNote}>
                  {tab.label} is not built yet on the phone.{tab.to.note}
                </PopoverContent>
              </Popover>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
