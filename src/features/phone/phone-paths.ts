import type { ResidentId } from '@/data/types'

/**
 * Every place the phone can show, and its address.
 *
 * **A place, never a task** (docs/MOBILE_APP_SHELL.md §3): writing, picking
 * and confirming happen in a sheet over the place you are on. Each entry says
 * so in `kind`, and `check-app-shell.mjs` fails on any other kind.
 *
 * **Under `/m`, beside the desktop's addresses rather than inside them.** A
 * record is `/m/people/<id>`: the path does not say the subject term, because
 * the term is configurable and an address cannot follow a vocabulary chosen
 * after it was shared.
 */
export const PHONE_PLACES = {
  today: { kind: 'place', tab: 'today' },
  people: { kind: 'place', tab: 'people' },
  search: { kind: 'place', tab: 'people' },
  record: { kind: 'place', tab: 'people' },
  notes: { kind: 'place', tab: 'people' },
} as const

export type TabId = 'today' | 'people'

export type Place =
  | { kind: 'today' }
  /** Your list or Everyone: two views of the people tab's root, not two places. */
  | { kind: 'people'; view: 'yours' | 'everyone' }
  | { kind: 'search' }
  | { kind: 'record'; id: ResidentId }
  /** One person's care notes, read-only, newest first. */
  | { kind: 'notes'; id: ResidentId }

export const ROOT_OF: Record<TabId, Place> = {
  today: { kind: 'today' },
  people: { kind: 'people', view: 'yours' },
}

export function pathOf(place: Place): string {
  switch (place.kind) {
    case 'today':
      return '/m'
    case 'people':
      return place.view === 'everyone' ? '/m/everyone' : '/m/people'
    case 'search':
      return '/m/search'
    case 'record':
      return `/m/people/${place.id}`
    case 'notes':
      return `/m/people/${place.id}/notes`
  }
}

/**
 * The stack an address stands for, when somebody arrives by it: the tab, and
 * the places on it from the root up. A record opened from a link sits over its
 * tab's root, so back has somewhere to go.
 *
 * Anything unrecognised opens Today rather than a not-found: an address under
 * `/m` that names nothing is still the phone app.
 */
export function stackOf(pathname: string): { tab: TabId; places: Place[] } {
  const parts = pathname.split('/').filter(Boolean).slice(1)
  const [first, second, third] = parts
  if (first === 'search')
    return { tab: 'people', places: [ROOT_OF.people, { kind: 'search' }] }
  if (first === 'people' || first === 'list' || first === 'everyone') {
    if (first === 'people' && second !== undefined && third === 'notes')
      return {
        tab: 'people',
        places: [
          ROOT_OF.people,
          { kind: 'record', id: second as ResidentId },
          { kind: 'notes', id: second as ResidentId },
        ],
      }
    if (first === 'people' && second !== undefined)
      return {
        tab: 'people',
        places: [ROOT_OF.people, { kind: 'record', id: second as ResidentId }],
      }
    return {
      tab: 'people',
      places: [{ kind: 'people', view: first === 'everyone' ? 'everyone' : 'yours' }],
    }
  }
  return { tab: 'today', places: [ROOT_OF.today] }
}
