import type { Person } from './phone-data'

/**
 * Everybody at the home in the order you would walk it: by room.
 *
 * **Grouped by room range, because the fixtures hold no wings.** The brief for
 * this screen grouped by wing, with wing names that do not exist in the record,
 * and a heading the record cannot support is a fact invented for the layout. The
 * hundreds digit is the only structure the room numbers carry, so a group is the
 * rooms sharing one, and its heading is the range actually present ("Rooms 104
 * to 119"), never a name for it: nothing says 1xx is a floor.
 *
 * **A room nobody recorded sorts last, in its own group, under the hatch.** It
 * is a gap in where somebody is, which is the one thing this list is for, so it
 * is not dropped and it is not filed under a guessed number.
 */
export type RoomGroup =
  | { kind: 'range'; key: string; heading: string; people: Person[] }
  | { kind: 'unnumbered'; key: string; heading: string; people: Person[] }
  | { kind: 'room_not_recorded'; key: string; people: Person[] }

const NUMBERED = /^\d+$/

const roomOf = (person: Person): string | undefined =>
  person.room.kind === 'recorded' ? person.room.value : undefined

/** Room first, numerically where the rooms are numbers; then name. */
export function byRoom(a: Person, b: Person): number {
  const roomA = roomOf(a)
  const roomB = roomOf(b)
  if (roomA === undefined && roomB !== undefined) return 1
  if (roomB === undefined && roomA !== undefined) return -1
  const rooms =
    roomA === undefined || roomB === undefined
      ? 0
      : roomA.localeCompare(roomB, 'en-GB', { numeric: true })
  return rooms !== 0 ? rooms : a.fullLegalName.localeCompare(b.fullLegalName, 'en-GB')
}

export function roomGroups(people: Person[]): RoomGroup[] {
  const sorted = [...people].sort(byRoom)
  const ranges = new Map<number, Person[]>()
  const unnumbered: Person[] = []
  const notRecorded: Person[] = []

  for (const person of sorted) {
    const room = roomOf(person)
    if (room === undefined) notRecorded.push(person)
    else if (!NUMBERED.test(room)) unnumbered.push(person)
    else {
      const hundred = Math.floor(Number(room) / 100)
      ranges.set(hundred, [...(ranges.get(hundred) ?? []), person])
    }
  }

  const groups: RoomGroup[] = [...ranges.entries()].map(([hundred, members]) => {
    const first = roomOf(members[0] as Person)
    const last = roomOf(members[members.length - 1] as Person)
    return {
      kind: 'range',
      key: `range-${hundred}`,
      heading: first === last ? `Room ${first}` : `Rooms ${first} to ${last}`,
      people: members,
    }
  })
  if (unnumbered.length > 0)
    groups.push({
      kind: 'unnumbered',
      key: 'unnumbered',
      heading: 'Rooms without a number',
      people: unnumbered,
    })
  if (notRecorded.length > 0)
    groups.push({ kind: 'room_not_recorded', key: 'not-recorded', people: notRecorded })
  return groups
}

/**
 * Whether a person matches what was typed: their legal name, their preferred
 * name or their room. One rule for search and for the care note picker, so a
 * name found in one is found in the other.
 */
export function matchesNameOrRoom(person: Person, asked: string): boolean {
  const needle = asked.toLocaleLowerCase('en-GB')
  return [
    person.fullLegalName,
    person.preferredName,
    person.room.kind === 'recorded' ? person.room.value : '',
  ].some((value) => value.toLocaleLowerCase('en-GB').includes(needle))
}
