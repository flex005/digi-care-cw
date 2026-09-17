import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Resident } from '@/data/types'
import { StatusPill, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { PROFILE_TABS, tabHref } from './profile-tabs'
import type { TabNote } from './record-gaps'
import { hiddenTabs } from './hidden-tabs'
import { profileIcons } from './profile.icons'
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
 * **It says when it scrolls.** Eleven tabs do not fit at 1440, and a row whose
 * last two tabs are simply cut off is a control reachable only by a reader who
 * guesses. So an edge with hidden tabs carries a button saying how many, with a
 * chevron, beside the row rather than over it, so it never covers the tab
 * somebody is on. It is drawn only while tabs are hidden on that side, and
 * pressing it moves the row along.
 *
 * **Words where the PRD draws an amber dot.** A dot is colour alone, and it
 * says a tab has a problem without saying which. "Consent · 3 of 8 never
 * sought" says it in greyscale, and a gap keeps the hatch.
 */
export function TabStrip({ resident }: { resident: Resident }) {
  const pathname = usePathname()
  const active = useRef<HTMLAnchorElement>(null)
  const scroller = useRef<HTMLElement>(null)
  const [hidden, setHidden] = useState({ before: 0, after: 0 })

  const measure = useCallback(() => {
    const view = scroller.current
    if (view === null) return
    const bounds = view.getBoundingClientRect()
    const tabs = [...view.querySelectorAll('li')].map((tab) =>
      tab.getBoundingClientRect(),
    )
    const next = hiddenTabs(tabs, bounds)
    setHidden((current) =>
      current.before === next.before && current.after === next.after ? current : next,
    )
  }, [])

  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [pathname, measure])

  /*
   * **Again when an edge comes or goes.** An edge takes width from the row, so
   * the tab scrolled into view before it appeared can end up under it: the last
   * tab, opened, sat behind "2 more" until this ran.
   */
  const hasBefore = hidden.before > 0
  const hasAfter = hidden.after > 0
  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [hasBefore, hasAfter])

  useLayoutEffect(() => {
    const view = scroller.current
    if (view === null) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(view)
    view.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      view.removeEventListener('scroll', measure)
    }
  }, [measure])

  const move = (direction: -1 | 1) => {
    const view = scroller.current
    if (view === null) return
    view.scrollBy({ left: direction * view.clientWidth * 0.7, behavior: 'smooth' })
  }

  return (
    <div className={styles.strip}>
      {hidden.before > 0 ? (
        <button
          type="button"
          className={styles.edgeStart}
          onClick={() => move(-1)}
          aria-label={`Show ${hidden.before} earlier ${hidden.before === 1 ? 'tab' : 'tabs'}`}
          data-hidden-tabs="before"
        >
          <Icon name={profileIcons.earlier} size={16} />
          <span>{hidden.before} more</span>
        </button>
      ) : null}
      <nav
        ref={scroller}
        className={styles.stripScroll}
        aria-label={`${resident.preferredName}’s record`}
      >
        <ul className={styles.tabs}>
          {PROFILE_TABS.map((tab) => {
            const href = tabHref(resident.id, tab)
            // A tab stays current on the pages beneath it: a note opened from the
            // Care Notes tab, or the composer, is still the Care Notes tab.
            const current =
              pathname === href ||
              (tab.segment !== '' && pathname.startsWith(`${href}/`))
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
      {hidden.after > 0 ? (
        <button
          type="button"
          className={styles.edgeEnd}
          onClick={() => move(1)}
          aria-label={`Show ${hidden.after} more ${hidden.after === 1 ? 'tab' : 'tabs'}`}
          data-hidden-tabs="after"
        >
          <span>{hidden.after} more</span>
          <Icon name={profileIcons.later} size={16} />
        </button>
      ) : null}
    </div>
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
