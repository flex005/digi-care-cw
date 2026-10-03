import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

/**
 * What the banner says, for each of the four things that can bring a reader to
 * an instant other than the one they expected.
 *
 * **Asserted through the rendered line, never through the exported
 * constants.** The defect this file was written for was a constant that was
 * right and a banner that drew nothing: `requested()` returned `undefined` for
 * both "nobody asked" and "asked, and it could not be read", so a reviewer who
 * typed an instant got the real clock in silence with their own instant still
 * in the address bar. A test over `CLOCK_REASON` would have agreed with
 * whatever the code decided; only reading the line catches a notice that never
 * reaches the screen.
 *
 * Each case pins the real clock with fake timers and re-imports the module,
 * because the clock reads the address once at load — so the address has to be
 * set before the import, and the real time has to be fixed or the expectations
 * move with the calendar (CLAUDE.md §8).
 */

const ROSEWOOD_ROUNDS = '08:00, 14:00, 18:00 and 20:00'

async function bannerAt(realTime: string, search = '') {
  vi.setSystemTime(new Date(realTime))
  vi.resetModules()
  window.history.replaceState(null, '', `/dashboard${search}`)
  const { MovedClockLine } = await import('./MovedClockLine')
  const { container } = render(<MovedClockLine />)
  return container.querySelector('p')
}

/** Mid-round and outside one, on the same day. */
const MID_ROUND = '2026-09-16T14:30:00'
const NO_ROUND = '2026-09-16T16:30:00'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})

afterEach(() => {
  vi.useRealTimers()
  window.history.replaceState(null, '', '/dashboard')
})

describe('nothing was asked for', () => {
  it(`says nothing when the real time is already inside one of ${ROSEWOOD_ROUNDS}`, async () => {
    const line = await bannerAt(MID_ROUND)
    expect(line).toBeNull()
  })

  /*
   * The record moves itself to the nearest round so the screens that exist to
   * show one are not blank for sixteen hours of the day. Moving it is defensible
   * and doing it quietly is not: every timestamp on every screen then agrees
   * with each other and with nothing outside.
   */
  it('names the round it moved to, and the real time, when no round is running', async () => {
    const line = await bannerAt(NO_ROUND)
    expect(line?.dataset.movedClock).toBe('nearest_round')
    expect(line?.textContent).toContain('14:20')
    expect(line?.textContent).toContain(
      'Showing the 14:00 round, which is the nearest one running',
    )
    expect(line?.textContent).toContain('Real time 16:30')
    expect(line?.querySelector('[data-clock-unreadable]')).toBeNull()
  })
})

describe('an instant was asked for and read', () => {
  it('says it is showing what was asked for, with the real time beside it', async () => {
    const line = await bannerAt(NO_ROUND, '?at=08:20')
    expect(line?.dataset.movedClock).toBe('requested')
    expect(line?.textContent).toContain('08:20')
    expect(line?.textContent).toContain('Showing the time you asked for')
    expect(line?.textContent).toContain('Real time 16:30')
  })

  /*
   * `?at=real` is the reader asking for the clock on the wall, so there is
   * nothing to announce: the record is drawn where they already believe it is.
   */
  it('says nothing when the real clock itself was asked for', async () => {
    const line = await bannerAt(NO_ROUND, '?at=real')
    expect(line).toBeNull()
  })

  /*
   * A `+` in an ISO offset arrives as a space, because that is what form
   * encoding means by it. The product's own links percent-encode it, so this is
   * the hand-typed URL and nobody else's — and it is repaired rather than
   * refused, in addition to the refusal path and never instead of it.
   */
  it('reads an offset that arrived with its + eaten into a space', async () => {
    const line = await bannerAt(NO_ROUND, '?at=2026-09-16T20:20:00+01:00')
    const wanted = new Date('2026-09-16T20:20:00+01:00')
    const hhmm = `${String(wanted.getHours()).padStart(2, '0')}:${String(
      wanted.getMinutes(),
    ).padStart(2, '0')}`
    expect(line?.dataset.movedClock).toBe('requested')
    expect(line?.textContent).toContain(hhmm)
    expect(line?.querySelector('[data-clock-unreadable]')).toBeNull()
  })
})

describe('an instant was asked for and could not be read', () => {
  /*
   * The case the whole change exists for. It must not be silent, and it must
   * quote the value back: a reader who typed an offset has to see what arrived
   * to understand why it was refused, and a paraphrase leaves them retyping the
   * same thing.
   */
  it('says what was asked for, that it was ignored, and which instant is shown', async () => {
    const line = await bannerAt(NO_ROUND, '?at=tuesday')
    expect(line).not.toBeNull()
    expect(line?.dataset.movedClock).toBe('unreadable')
    expect(
      line
        ?.querySelector('[data-clock-unreadable]')
        ?.getAttribute('data-clock-unreadable'),
    ).toBe('tuesday')
    expect(line?.textContent).toContain('“tuesday”')
    expect(line?.textContent).toContain(
      'is not a time this can read, so it was ignored',
    )
    // The refusal does not replace saying where the record actually is.
    expect(line?.textContent).toContain('14:20')
    expect(line?.textContent).toContain('the 14:00 round')
    expect(line?.textContent).toContain('Real time 16:30')
  })

  it('refuses a clock time outside a clock, and quotes that too', async () => {
    const line = await bannerAt(MID_ROUND, '?at=25:99')
    expect(line?.dataset.movedClock).toBe('unreadable')
    expect(line?.textContent).toContain('“25:99”')
    // Mid-round, so the instant shown is the real one, and the line says so.
    expect(line?.textContent).toContain('Showing the real time')
    expect(line?.textContent).toContain('14:30')
  })

  it('offers the way back to the real clock on every one of them', async () => {
    for (const search of ['?at=tuesday', '?at=08:20', '']) {
      const line = await bannerAt(NO_ROUND, search)
      const reset = line?.querySelector('[data-clock-reset]')
      expect(reset?.textContent, search).toBe('Use the real time')
      expect(reset?.getAttribute('href'), search).toContain('at=real')
    }
  })
})
