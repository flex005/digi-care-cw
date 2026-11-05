import { describe, expect, it } from 'vitest'
import { residentsBySite } from '@/data/fixtures/residents'
import type { Person } from './phone-data'
import { byRoom, roomGroups } from './rooms'

const rosewood = residentsBySite('site-rosewood-court')
const template = rosewood.find((person) => person.room.kind === 'recorded')?.room
if (template?.kind !== 'recorded') throw new Error('No fixture has a recorded room.')
const withRoom = (person: Person, room: string | 'unrecorded'): Person => ({
  ...person,
  room: room === 'unrecorded' ? { kind: 'unrecorded' } : { ...template, value: room },
})

describe('rooms', () => {
  it('orders numerically, not as text, and puts an unrecorded room last', () => {
    const [a, b, c, d] = rosewood as [Person, Person, Person, Person]
    const sorted = [
      withRoom(a, '201'),
      withRoom(b, 'unrecorded'),
      withRoom(c, '14'),
      withRoom(d, '103'),
    ]
      .sort(byRoom)
      .map((person) => (person.room.kind === 'recorded' ? person.room.value : 'none'))
    expect(sorted).toEqual(['14', '103', '201', 'none'])
  })

  it('groups the fixtures by the hundreds of the room number, headed by the range present', () => {
    const groups = roomGroups(rosewood)
    expect(groups.flatMap((group) => group.people)).toHaveLength(rosewood.length)
    for (const group of groups) {
      if (group.kind !== 'range') continue
      const rooms = group.people.map((person) =>
        person.room.kind === 'recorded' ? Number(person.room.value) : NaN,
      )
      expect(new Set(rooms.map((room) => Math.floor(room / 100))).size).toBe(1)
      const first = Math.min(...rooms)
      const last = Math.max(...rooms)
      expect(group.heading).toBe(
        first === last ? `Room ${first}` : `Rooms ${first} to ${last}`,
      )
    }
  })

  it('files an unrecorded room under its own group, never under a guessed number', () => {
    const [a, b] = rosewood as [Person, Person]
    const groups = roomGroups([withRoom(a, '104'), withRoom(b, 'unrecorded')])
    expect(groups.map((group) => group.kind)).toEqual(['range', 'room_not_recorded'])
  })
})
