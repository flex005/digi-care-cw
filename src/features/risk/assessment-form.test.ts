import { describe, expect, it } from 'vitest'
import {
  levelFor,
  outstanding,
  runningScore,
  unanswered,
  writtenInterventions,
  type Answers,
} from './assessment-form'
import { INSTRUMENT_ITEMS, bandFor } from './instrument'

/**
 * Scoring, as arithmetic. CW PRD RA-02.
 *
 * The running total is the figure a clinical band is read off, so it is tested
 * where it is computed rather than through a screen.
 */

const everyItem = (choice: number): Answers =>
  Object.fromEntries(INSTRUMENT_ITEMS.map((item) => [item.id, choice]))

describe('the running score', () => {
  it('starts at nothing answered, and says how many are left', () => {
    const running = runningScore({})
    expect(running.total).toBe(0)
    expect(running.answered).toBe(0)
    expect(running.items).toBe(INSTRUMENT_ITEMS.length)
    expect(running.complete).toBe(false)
  })

  it('totals only the items somebody answered', () => {
    const first = INSTRUMENT_ITEMS[0]!
    const second = INSTRUMENT_ITEMS[1]!
    const running = runningScore({ [first.id]: 2, [second.id]: 1 })
    expect(running.total).toBe(
      (first.choices[2]?.points ?? 0) + (second.choices[1]?.points ?? 0),
    )
    expect(running.answered).toBe(2)
    expect(running.complete).toBe(false)
  })

  it('is complete only when every item has an answer', () => {
    const running = runningScore(everyItem(0))
    expect(running.answered).toBe(INSTRUMENT_ITEMS.length)
    expect(running.complete).toBe(true)
    expect(running.total).toBe(0)
    expect(running.band).toBe(bandFor(0))
  })

  it('moves the band as the total crosses a threshold', () => {
    const lowest = runningScore(everyItem(0))
    const highest = runningScore(everyItem(1))
    expect(lowest.band).toBe(bandFor(lowest.total))
    expect(highest.band).toBe(bandFor(highest.total))
    expect(highest.total).toBeGreaterThan(lowest.total)
  })
})

describe('what stands between the form and a signature', () => {
  it('names the unanswered factors on a scored template', () => {
    expect(
      outstanding({ templateId: 'falls', answers: {}, level: 'not_chosen' }),
    ).toEqual([`an answer to ${INSTRUMENT_ITEMS.length} factors`])
    expect(unanswered({})).toHaveLength(INSTRUMENT_ITEMS.length)
    expect(
      outstanding({ templateId: 'falls', answers: everyItem(0), level: 'not_chosen' }),
    ).toEqual([])
  })

  /*
   * An unscored template has no items to answer: what it needs is the level
   * somebody judged, because there is no arithmetic to derive one from.
   */
  it('asks an unscored template for its level instead', () => {
    expect(
      outstanding({ templateId: 'behaviour', answers: {}, level: 'not_chosen' }),
    ).toEqual(['the level this assessment reaches'])
    expect(
      outstanding({ templateId: 'behaviour', answers: {}, level: 'high' }),
    ).toEqual([])
  })
})

describe('the level a form records', () => {
  it('is the instrument’s band on a scored template, never a separate opinion', () => {
    const answers = everyItem(1)
    expect(levelFor('falls', answers, 'low')).toBe(runningScore(answers).band)
  })

  it('is the judgement on an unscored one', () => {
    expect(levelFor('behaviour', {}, 'moderate')).toBe('moderate')
    expect(levelFor('behaviour', {}, 'not_chosen')).toBe('not_chosen')
  })
})

describe('interventions', () => {
  it('counts only the ones somebody wrote something in', () => {
    expect(
      writtenInterventions([
        { what: '  ', who: 'K. Osei', reviewOn: '2026-10-01' },
        { what: 'Two staff for transfers', who: '', reviewOn: '' },
      ]),
    ).toHaveLength(1)
  })
})
