import { ROOT_OF, stackOf, type Place, type TabId } from '../phone-paths'

/**
 * The phone's navigation state: one stack per tab, and which tab is showing.
 *
 * **A stack per tab, kept whole**, so leaving a tab and coming back finds it as
 * it was. Every entry stays mounted while it is on a stack, which is what keeps
 * its scroll position: nothing here remembers a number, the pane does.
 *
 * Pure, so the rules — what push, pop and a tab tap do — are tested without a
 * browser, and the shell only draws the result.
 */
export interface Entry {
  key: string
  place: Place
}

export interface Stacks {
  active: TabId
  stacks: Record<TabId, Entry[]>
}

let made = 0
const entry = (place: Place): Entry => {
  made += 1
  return { key: `${place.kind}-${made}`, place }
}

export function initialStacks(pathname: string): Stacks {
  const { tab, places } = stackOf(pathname)
  const stacks: Record<TabId, Entry[]> = {
    today: [entry(ROOT_OF.today)],
    people: [entry(ROOT_OF.people)],
  }
  stacks[tab] = places.map(entry)
  return { active: tab, stacks }
}

export const topOf = (state: Stacks, tab: TabId = state.active): Entry => {
  const stack = state.stacks[tab]
  const top = stack[stack.length - 1]
  if (top === undefined)
    throw new Error(`The ${tab} stack is empty, which no move allows.`)
  return top
}

/** Onto the stack of the tab you are on, whatever tab the place belongs to. */
export function push(state: Stacks, place: Place): Stacks {
  return {
    ...state,
    stacks: {
      ...state.stacks,
      [state.active]: [...state.stacks[state.active], entry(place)],
    },
  }
}

/** Off the top. A root is never popped: there is nowhere under it. */
export function pop(state: Stacks): { state: Stacks; popped: Entry | undefined } {
  const stack = state.stacks[state.active]
  if (stack.length <= 1) return { state, popped: undefined }
  return {
    state: {
      ...state,
      stacks: { ...state.stacks, [state.active]: stack.slice(0, -1) },
    },
    popped: stack[stack.length - 1],
  }
}

/**
 * A tab tap: another tab shows its stack as it was left; the tab you are on
 * pops to its root.
 */
export function tapTab(state: Stacks, tab: TabId): { state: Stacks; popped: Entry[] } {
  if (tab !== state.active) return { state: { ...state, active: tab }, popped: [] }
  const [root, ...rest] = state.stacks[tab]
  if (root === undefined || rest.length === 0) return { state, popped: [] }
  return {
    state: { ...state, stacks: { ...state.stacks, [tab]: [root] } },
    popped: rest,
  }
}
