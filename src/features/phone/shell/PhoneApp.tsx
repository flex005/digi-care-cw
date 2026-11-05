import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { RequireSignIn } from '@/components/shell/RequireSignIn'
import { SessionExpiry } from '@/components/shell/SessionExpiry'
import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import { ActLine } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { getRound } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { IsoDateTime } from '@/data/types'
import { dueSoon } from '@/features/dashboard/dashboard-figures'
import { formatCount, pluralise, zonedDate } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { assertNever } from '@/lib/assert-never'
import { scopeReaches, type DoseRecord } from '../phone-data'
import { pathOf, ROOT_OF, type Place, type TabId } from '../phone-paths'
import { phoneIcons } from '../phone.icons'
import { PeopleScreen } from '../screens/PeopleScreen'
import { RecordScreen } from '../screens/RecordScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { FrameContext, InFrontContext, PhoneNavContext, type PhoneNav } from './nav'
import { Sheet } from './Sheet'
import {
  initialStacks,
  pop,
  push,
  tapTab,
  topOf,
  type Entry,
  type Stacks,
} from './stack'
import styles from './shell.module.css'

/** Push and pop, in milliseconds. The CSS says the same; removal waits on this. */
const TRANSITION_MS = 260

const TABS: TabId[] = ['today', 'people']

/**
 * The phone app: one stack per tab, a fixed tab bar, and nothing else that
 * scrolls but the pane of the screen in front (docs/MOBILE_APP_SHELL.md).
 *
 * **What a responsive page does not do**: the document never scrolls; a
 * screen pushed in from the right is popped back to the right; each tab keeps
 * its stack and its scroll while you are on another; a task rises as a sheet
 * over the place you are on instead of replacing it.
 *
 * **The stack is the source of truth and the address is a copy.** A push adds
 * a history entry so the system back gesture pops; a tab switch replaces the
 * address without adding one, as a phone's tabs do.
 */
export function PhoneApp({ children }: { children?: ReactNode }) {
  return (
    <RequireSignIn>
      <Phone>{children}</Phone>
    </RequireSignIn>
  )
}

function Phone({ children }: { children?: ReactNode }) {
  const [frame, setFrame] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<Stacks>(() =>
    initialStacks(window.location.pathname),
  )
  const [leaving, setLeaving] = useState<{ tab: TabId; entry: Entry }[]>([])
  const [entering, setEntering] = useState<string | null>(null)
  /*
   * A tab mounts its stack the first time it is shown, as a phone's tabs do,
   * and then keeps it: arriving at a record does not read Today's figures.
   */
  const [visited, setVisited] = useState<TabId[]>(() => [state.active])
  const current = useRef(state)
  /** History entries this app pushed and nothing has popped yet. */
  const pushed = useRef(0)

  const commit = useCallback((next: Stacks) => {
    current.current = next
    setState(next)
  }, [])

  const retire = useCallback((tab: TabId, entries: Entry[]) => {
    if (entries.length === 0) return
    setLeaving((was) => [...was, ...entries.map((entry) => ({ tab, entry }))])
    window.setTimeout(
      () => setLeaving((was) => was.filter((item) => !entries.includes(item.entry))),
      TRANSITION_MS,
    )
  }, [])

  const popHere = useCallback((): Stacks | undefined => {
    const { state: next, popped } = pop(current.current)
    if (popped === undefined) return undefined
    commit(next)
    setEntering(null)
    retire(next.active, [popped])
    return next
  }, [commit, retire])

  useEffect(() => {
    const onPop = () => {
      pushed.current = Math.max(0, pushed.current - 1)
      const next = popHere()
      if (next === undefined)
        window.history.replaceState(null, '', pathOf(topOf(current.current).place))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [popHere])

  const nav = useMemo<PhoneNav>(
    () => ({
      push: (place: Place) => {
        const next = push(current.current, place)
        commit(next)
        setEntering(topOf(next).key)
        pushed.current += 1
        window.history.pushState(null, '', pathOf(place))
      },
      back: () => {
        if (pushed.current > 0) {
          window.history.back()
          return
        }
        const next = popHere()
        if (next !== undefined)
          window.history.replaceState(null, '', pathOf(topOf(next).place))
      },
      switchTab: (tab: TabId) => {
        const { state: next, popped } = tapTab(current.current, tab)
        commit(next)
        setVisited((was) => (was.includes(tab) ? was : [...was, tab]))
        setEntering(null)
        retire(tab, popped)
        pushed.current = 0
        window.history.replaceState(null, '', pathOf(topOf(next).place))
      },
    }),
    [commit, popHere, retire],
  )

  return (
    <PhoneNavContext.Provider value={nav}>
      <FrameContext.Provider value={frame}>
        <div className={styles.app} ref={setFrame}>
          <div className={styles.notices}>
            <SessionExpiry />
          </div>
          <div className={styles.stackArea}>
            {TABS.map((tab) => {
              const showing = tab === state.active
              const stack = state.stacks[tab]
              const going = leaving
                .filter((item) => item.tab === tab)
                .map((item) => item.entry)
              return (
                <div
                  key={tab}
                  className={
                    showing ? styles.tabLayer : `${styles.tabLayer} ${styles.tabHidden}`
                  }
                  inert={!showing}
                  data-tab={tab}
                >
                  {!visited.includes(tab)
                    ? null
                    : [
                        ...stack.map((entry, index) => ({
                          entry,
                          at:
                            index === stack.length - 1
                              ? ('top' as const)
                              : ('under' as const),
                        })),
                        ...going.map((entry) => ({ entry, at: 'leaving' as const })),
                      ].map(({ entry, at }) => {
                        /*
                         * One list, keyed by entry, so a popped screen stays the same
                         * instance while it slides out rather than remounting and
                         * reading its record again.
                         */
                        const className = [
                          styles.entry,
                          at === 'under' ? styles.under : styles.top,
                          at === 'top' && entry.key === entering ? styles.entering : '',
                          at === 'leaving' ? styles.leaving : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                        return (
                          <div
                            key={entry.key}
                            className={className}
                            inert={at !== 'top'}
                            aria-hidden={at === 'leaving' ? true : undefined}
                            data-entry={entry.place.kind}
                          >
                            <InFrontContext.Provider value={showing && at === 'top'}>
                              <PlaceScreen place={entry.place} />
                            </InFrontContext.Provider>
                          </div>
                        )
                      })}
                </div>
              )
            })}
          </div>
          <TabBar active={state.active} onTap={nav.switchTab} />
          {children}
        </div>
      </FrameContext.Provider>
    </PhoneNavContext.Provider>
  )
}

function PlaceScreen({ place }: { place: Place }) {
  switch (place.kind) {
    case 'today':
      return <TodayScreen />
    case 'people':
      return <PeopleScreen view={place.view} />
    case 'search':
      return <SearchScreen />
    case 'record':
      return <RecordScreen id={place.id} />
    default:
      return assertNever(place)
  }
}

type TabItem =
  | { kind: 'built'; tab: TabId; label: string; icon: IconName }
  | {
      kind: 'not_built'
      label: string
      icon: IconName
      note: string
      /** Whether it carries the count of doses on a clock. One tab does. */
      clock: boolean
      /**
       * A tab with its label under its icon, or the raised centre action: an
       * icon alone in a purple circle, its label only in its accessible name.
       */
      face: 'labelled' | 'raised'
    }

const TAB_ITEMS = (): TabItem[] => [
  { kind: 'built', tab: 'today', label: 'Today', icon: phoneIcons.today },
  {
    kind: 'built',
    tab: 'people',
    label: VOCABULARY.subject.Many,
    icon: phoneIcons.people,
  },
  {
    kind: 'not_built',
    label: 'Care notes',
    icon: phoneIcons.writeNote,
    /* Writing a care note is the phone's next module, and the desktop has it. */
    note: ' A care note can be written in the desktop build.',
    clock: false,
    face: 'raised',
  },
  {
    kind: 'not_built',
    label: VOCABULARY.medication.One,
    icon: phoneIcons.dose,
    note: '',
    clock: true,
    face: 'labelled',
  },
  {
    kind: 'not_built',
    label: 'More',
    icon: phoneIcons.more,
    /* More is where signing out lives on a phone (AUTH-09), and it is not built. */
    note: ' Reloading the page signs you out.',
    clock: false,
    face: 'labelled',
  },
]

type DueCount =
  { kind: 'counted'; due: number; onChart: number } | { kind: 'not_counted' }

/**
 * The one count the tab bar carries: doses due now or in the next two hours,
 * on the reader's list, today — the same figure Today's tile shows, from the
 * same owner. **Not counted** while the round loads or for a reader with no
 * list, and then no badge is drawn and the tab's name says nothing about doses.
 */
function useDueCount(): DueCount {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const load = useCallback(
    () => getRound(activeSite.id).then(({ records }) => records),
    [activeSite.id],
  )
  const resource = useResource<DoseRecord[]>(load, [activeSite.id])
  if (resource.kind !== 'ready' || viewer.scope.kind === 'not_decided')
    return { kind: 'not_counted' }
  const today = zonedDate(at, activeSite.timeZone)
  const todays = resource.data.filter(
    (record) => record.date === today && scopeReaches(viewer.scope, record.residentId),
  )
  return { kind: 'counted', due: dueSoon(todays, at).doses, onChart: todays.length }
}

/** The count in words, with what it is out of and what it is over. */
const dueSentence = (count: Extract<DueCount, { kind: 'counted' }>): string =>
  `${count.due} of ${pluralise(count.onChart, 'dose')} on today’s chart due now or in the next 2 hours, on your list.`

/**
 * The tab bar: a white pill floating in the gutter, clear of the home
 * indicator, the tab you are on a filled purple pill inside it. A tab not
 * built yet opens a short sheet saying so (docs/MOBILE_APP_SHELL.md §3).
 * Tapping the tab you are on pops it to its root.
 *
 * **The raised centre action is not a tab.** It writes a care note, which is
 * not built, so it opens the same sheet the other unbuilt slots do: the active
 * tab and the address stay where they were.
 *
 * **One badge, on Medication**, because doses are the only thing here on a
 * clock. A badge is a bare number by nature, so its denominator and scope are
 * in the tab's accessible name and in the sheet it opens.
 */
function TabBar({ active, onTap }: { active: TabId; onTap: (tab: TabId) => void }) {
  const [open, setOpen] = useState(false)
  /* Kept after closing, so the sheet keeps its words while it falls. */
  const [shown, setShown] = useState<Extract<TabItem, { kind: 'not_built' }>>()
  const count = useDueCount()
  const badged = (item: Extract<TabItem, { kind: 'not_built' }>) =>
    item.clock && count.kind === 'counted' && count.due > 0 ? count : undefined

  return (
    <nav className={styles.tabBar} aria-label="Main navigation">
      <div className={styles.tabPill}>
        {TAB_ITEMS().map((item) => {
          if (item.kind === 'built')
            return (
              <a
                key={item.label}
                href={pathOf(ROOT_OF[item.tab])}
                className={[
                  styles.tab,
                  styles.press,
                  item.tab === active ? styles.tabActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={item.tab === active ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onTap(item.tab)
                }}
              >
                <Icon name={item.icon} size={24} />
                <span className={styles.tabLabel}>{item.label}</span>
              </a>
            )
          const badge = badged(item)
          if (item.face === 'raised')
            return (
              <button
                key={item.label}
                type="button"
                className={`${styles.centre} ${styles.press}`}
                aria-label={`${item.label}, not built`}
                aria-haspopup="dialog"
                data-built="false"
                onClick={() => {
                  setShown(item)
                  setOpen(true)
                }}
              >
                <Icon name={item.icon} size={24} />
              </button>
            )
          return (
            <button
              key={item.label}
              type="button"
              className={`${styles.tab} ${styles.press}`}
              aria-label={`${item.label}, not built${badge === undefined ? '' : `. ${dueSentence(badge)}`}`}
              aria-haspopup="dialog"
              data-built="false"
              onClick={() => {
                setShown(item)
                setOpen(true)
              }}
            >
              <Icon name={item.icon} size={24} />
              <span className={styles.tabLabel}>{item.label}</span>
              {badge === undefined ? null : (
                <span className={styles.tabBadge} aria-hidden="true" data-badge>
                  {formatCount(badge.due)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {shown === undefined ? null : (
        <Sheet open={open} onOpenChange={setOpen} title={shown.label} cancel="Done">
          {shown.clock && count.kind === 'counted' ? <p>{dueSentence(count)}</p> : null}
          <ActLine kind="not_built">{`${shown.label} is not built yet on the phone.${shown.note}`}</ActLine>
        </Sheet>
      )}
    </nav>
  )
}
