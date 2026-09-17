import { useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { PageHead } from '@/components/layout/PageHead'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { scopeLine } from '@/app/session/resident-scope'
import styles from './medications.module.css'

/**
 * The Medications module: its head and the strip of its four tabs. CW PRD
 * MED-01 to MED-03.
 *
 * **All four tabs for both roles.** The controlled drug register and Add
 * interim refuse on their own pages with the role table's reason; a tab that
 * vanished for one role would say the act does not exist rather than that it
 * is not theirs. **No Pharmacy cycle tab**: neither role touches it and the PRD
 * specifies no screen for it (docs/DEPARTURES.md).
 *
 * **An underline strip, because it navigates within a page** (CLAUDE.md §6).
 * The tab you are on is heavier, darker and underlined, and says so to a
 * screen reader with `aria-current`.
 */
export const MEDICATION_TABS = [
  { label: 'Omissions', href: '/medications' },
  { label: 'Round', href: '/medications/round' },
  { label: 'Controlled drug register', href: '/medications/register' },
  { label: 'Add interim', href: '/medications/interim' },
] as const

export function MedicationsLayout({ children }: { children?: ReactNode }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const pathname = usePathname()

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const residents = useResource(load, [activeSite.id])

  const lines =
    residents.kind === 'ready'
      ? [
          activeSite.name,
          scopeLine(
            viewer.scope,
            residents.data.map((resident) => resident.id),
            activeSite.name,
          ),
        ]
      : [activeSite.name]

  return (
    <div className={styles.module}>
      <PageHead title="Medications" lines={lines} />
      <nav className={styles.strip} aria-label="Medications">
        <ul className={styles.tabs}>
          {MEDICATION_TABS.map((tab) => {
            // Omissions is the module's own address, so only an exact match
            // marks it; the others stay current on anything beneath them.
            const current =
              tab.href === '/medications'
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`)
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={current ? styles.tabCurrent : styles.tab}
                  aria-current={current ? 'page' : undefined}
                  data-medications-tab={tab.label}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {children}
    </div>
  )
}
