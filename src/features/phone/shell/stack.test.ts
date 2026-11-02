import { describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import { pathOf, stackOf } from '../phone-paths'
import { initialStacks, pop, push, tapTab, topOf } from './stack'

const okafor = 'res-okafor' as ResidentId
const kinds = (entries: { place: { kind: string } }[]) =>
  entries.map((e) => e.place.kind)

describe('the phone’s stacks', () => {
  it('turns an address into a stack with somewhere to go back to', () => {
    expect(stackOf('/m')).toEqual({ tab: 'today', places: [{ kind: 'today' }] })
    expect(stackOf('/m/people/res-okafor')).toEqual({
      tab: 'people',
      places: [{ kind: 'people' }, { kind: 'record', id: okafor }],
    })
    expect(stackOf('/m/search').places.map((place) => place.kind)).toEqual([
      'people',
      'search',
    ])
    expect(stackOf('/m/nowhere').tab).toBe('today')
  })

  it('round-trips every place through its address', () => {
    for (const place of [
      { kind: 'today' },
      { kind: 'people' },
      { kind: 'search' },
      { kind: 'record', id: okafor },
    ] as const) {
      const { places } = stackOf(pathOf(place))
      expect(places[places.length - 1]).toEqual(place)
    }
  })

  it('pushes onto the tab you are on, and never pops a root', () => {
    const start = initialStacks('/m')
    const pushed = push(start, { kind: 'record', id: okafor })
    expect(kinds(pushed.stacks.today)).toEqual(['today', 'record'])
    expect(kinds(pushed.stacks.people)).toEqual(['people'])
    const { state: back, popped } = pop(pushed)
    expect(popped?.place.kind).toBe('record')
    expect(pop(back).popped).toBeUndefined()
  })

  it('switches tab without touching either stack, and pops to root on a second tap', () => {
    const deep = push(initialStacks('/m/people'), { kind: 'record', id: okafor })
    const away = tapTab(deep, 'today').state
    expect(away.active).toBe('today')
    expect(topOf(away, 'people').place.kind).toBe('record')
    const backAgain = tapTab(away, 'people').state
    expect(topOf(backAgain).place.kind).toBe('record')
    const { state: rooted, popped } = tapTab(backAgain, 'people')
    expect(kinds(rooted.stacks.people)).toEqual(['people'])
    expect(popped).toHaveLength(1)
  })
})
