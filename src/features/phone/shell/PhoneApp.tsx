import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { assertNever } from '@/lib/assert-never'
import { pathOf, ROOT_OF, type Place, type TabId } from '../phone-paths'
import { phoneIcons } from '../phone.icons'
import { PeopleScreen } from '../screens/PeopleScreen'
import { RecordScreen } from '../screens/RecordScreen'
import { SearchScreen } from '../screens/SearchScreen'
import { TodayScreen } from '../screens/TodayScreen'
import { InFrontContext, PhoneNavContext, type PhoneNav } from './nav'
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
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add(styles.lockedRoot)
    return () => root.classList.remove(styles.lockedRoot)
  }, [])

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
      <div className={styles.app}>
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
    </PhoneNavContext.Provider>
  )
}

function PlaceScreen({ place }: { place: Place }) {
  switch (place.kind) {
    case 'today':
      return <TodayScreen />
    case 'people':
      return <PeopleScreen />
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
  | { kind: 'not_built'; label: string; icon: IconName; note: string }

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
    label: VOCABULARY.medication.One,
    icon: phoneIcons.dose,
    note: '',
  },
  {
    kind: 'not_built',
    label: 'More',
    icon: phoneIcons.more,
    /* More is where signing out lives on a phone (AUTH-09), and it is not built. */
    note: ' Reloading the page signs you out.',
  },
]

/**
 * The tab bar: fixed, edge to edge, clear of the home indicator. A tab not
 * built yet opens a short sheet saying so, which is what a phone does with
 * anything short (docs/MOBILE_APP_SHELL.md §3). Tapping the tab you are on
 * pops it to its root.
 */
function TabBar({ active, onTap }: { active: TabId; onTap: (tab: TabId) => void }) {
  const [open, setOpen] = useState(false)
  /* Kept after closing, so the sheet keeps its words while it falls. */
  const [shown, setShown] = useState<Extract<TabItem, { kind: 'not_built' }>>()
  return (
    <nav className={styles.tabBar} aria-label="Main navigation">
      {TAB_ITEMS().map((item) =>
        item.kind === 'built' ? (
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
        ) : (
          <button
            key={item.label}
            type="button"
            className={`${styles.tab} ${styles.press} ${styles.tabNotBuilt}`}
            aria-label={`${item.label}, not built`}
            aria-haspopup="dialog"
            data-built="false"
            onClick={() => {
              setShown(item)
              setOpen(true)
            }}
          >
            <Icon name={item.icon} size={24} />
            <span className={styles.tabLabel}>{item.label}</span>
          </button>
        ),
      )}
      {shown === undefined ? null : (
        <Sheet open={open} onOpenChange={setOpen} title={shown.label} cancel="Done">
          <ActLine kind="not_built">{`${shown.label} is not built yet on the phone.${shown.note}`}</ActLine>
        </Sheet>
      )}
    </nav>
  )
}
