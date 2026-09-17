import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Resident } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { PROFILE_TABS, tabHref } from './profile-tabs'
import type { TabNote } from './record-gaps'
import styles from './profile.module.css'

/**
 * The eleven tabs of a resident's record. RES-03.
 *
 * **One row that scrolls, at both widths**, with the tab you are on scrolled
 * into view, so a tab opened from a link at the far end is not off screen.
 *
 * **An underline strip, because it navigates within a page** (CLAUDE.md §6).
 * The tab you are on is in heavier, darker type with the underline; the
 * underline alone would be a shape carrying the state.
 *
 * **Words where the PRD draws an amber dot.** A dot is colour alone, and it
 * says a tab has a problem without saying which. "Consent · 3 of 8 never
 * sought" says it in greyscale, and a gap keeps the hatch.
 */
export function TabStrip({ resident }: { resident: Resident }) {
  const pathname = usePathname()
  const active = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <nav className={styles.strip} aria-label={`${resident.preferredName}’s record`}>
      <ul className={styles.tabs}>
        {PROFILE_TABS.map((tab) => {
          const href = tabHref(resident.id, tab)
          const current = pathname === href
          const notes = tab.notes(resident)
          return (
            <li key={tab.label}>
              <Link
                ref={current ? active : undefined}
                href={href}
                className={current ? styles.tabCurrent : styles.tabLink}
                aria-current={current ? 'page' : undefined}
                data-tab={tab.segment === '' ? 'general' : tab.segment}
              >
                <span>{tab.label}</span>
                {notes.map((note) => (
                  <Note key={note.words} note={note} />
                ))}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Note({ note }: { note: TabNote }) {
  switch (note.kind) {
    case 'gap':
      return <Unrecorded label={note.words} />
    case 'finding':
      return <StatusPill tone="caution" label={note.words} />
    default:
      return assertNever(note)
  }
}
