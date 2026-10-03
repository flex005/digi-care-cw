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

/**
 * How many times a phrase is in the line, because once is the claim.
 *
 * **`toContain` is blind to repetition**, and that is what let the refusal line
 * say "the real time" three times and print the same 14:30 at both ends: every
 * assertion over it was true at one occurrence and true at three. A line of one
 * sentence saying one fact under three owners is the defect this component was
 * changed to fix, and the test agreed with it.
 */
const timesIn = (text: string, phrase: string) => text.split(phrase).length - 1

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
    const said = line?.textContent ?? ''
    expect(line?.dataset.movedClock).toBe('nearest_round')
    expect(timesIn(said, '14:20')).toBe(1)
    expect(
      timesIn(said, 'Showing the 14:00 round, which is the nearest one running'),
    ).toBe(1)
    expect(timesIn(said, 'the 14:00 round')).toBe(1)
    // Two instants, both needed: where the record is, and where the wall is.
    expect(timesIn(said, 'Real time 16:30')).toBe(1)
    expect(line?.querySelector('[data-clock-unreadable]')).toBeNull()
  })
})

describe('an instant was asked for and read', () => {
  it('says it is showing what was asked for, with the real time beside it', async () => {
    const line = await bannerAt(NO_ROUND, '?at=08:20')
    const said = line?.textContent ?? ''
    expect(line?.dataset.movedClock).toBe('requested')
    expect(timesIn(said, '08:20')).toBe(1)
    expect(timesIn(said, 'Showing the time you asked for')).toBe(1)
    expect(timesIn(said, 'Real time 16:30')).toBe(1)
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
    expect(timesIn(line?.textContent ?? '', hhmm)).toBe(1)
    expect(line?.querySelector('[data-clock-unreadable]')).toBeNull()
  })
})

/**
 * The vocabulary half of the same line.
 *
 * Read through the rendered line for the reason the clock's tests are: the
 * defect that cost two commits was a constant that was right and a notice that
 * never reached the screen, and no assertion over an export could have seen it.
 */
describe('the words this organisation uses', () => {
  it('says nothing at all under this build’s own vocabulary', async () => {
    expect(await bannerAt(MID_ROUND)).toBeNull()
    expect(await bannerAt(MID_ROUND, '?terms=')).toBeNull()
    // Asking for the default explicitly is still the default, so still silent.
    expect(await bannerAt(MID_ROUND, '?terms=org:care_home')).toBeNull()
    expect(await bannerAt(MID_ROUND, '?terms=subject:resident')).toBeNull()
  })

  it('quotes what was asked for, and offers the way back', async () => {
    const line = await bannerAt(MID_ROUND, '?terms=subject:service_user')
    const said = line?.textContent ?? ''
    expect(line?.querySelector('[data-vocabulary="chosen"]')).not.toBeNull()
    expect(timesIn(said, 'subject:service_user')).toBe(1)
    expect(timesIn(said, 'Showing the words you asked for')).toBe(1)
    const back = line?.querySelector('[data-vocabulary-reset]')
    expect(back?.textContent).toBe('Use this build’s words')
    expect(back?.getAttribute('href')).not.toContain('terms=')
  })

  /*
   * The clock is at the real time here, so the line exists only because the
   * words did — which is what proves the two halves are independent rather
   * than one riding on the other.
   */
  it('draws the line for the words alone, with no clock in it', async () => {
    const line = await bannerAt(MID_ROUND, '?terms=org:hospital')
    const said = line?.textContent ?? ''
    expect(line).not.toBeNull()
    expect(timesIn(said, 'Real time')).toBe(0)
    expect(timesIn(said, 'Use the real time')).toBe(0)
    expect(line?.querySelector('[data-clock-reset]')).toBeNull()
  })

  it('carries both facts in one line, and never draws a second', async () => {
    const line = await bannerAt(NO_ROUND, '?terms=subject:service_user')
    expect(document.querySelectorAll('p[data-moved-clock]')).toHaveLength(1)
    const said = line?.textContent ?? ''
    expect(timesIn(said, 'the 14:00 round, which is the nearest one running')).toBe(1)
    expect(timesIn(said, 'subject:service_user')).toBe(1)
  })

  /*
   * A value that could not be read is not the same fact as no value — the
   * defect `?at=` was carrying, which this parameter was written after rather
   * than before.
   */
  it('says a term it cannot read was ignored, and which word was wrong', async () => {
    const line = await bannerAt(MID_ROUND, '?terms=subject:service-user')
    const said = line?.textContent ?? ''
    expect(line?.querySelector('[data-vocabulary="unreadable"]')).not.toBeNull()
    expect(timesIn(said, 'is not a vocabulary this can read, so it was ignored')).toBe(
      1,
    )
    // The word that was wrong, named, so nobody retypes the ones that were right.
    expect(timesIn(said, 'service-user')).toBe(2) // once quoted whole, once named
    expect(timesIn(said, 'Showing this build’s own words')).toBe(1)
  })

  it('refuses a term name it does not know, and names the ones it does', async () => {
    const said =
      (await bannerAt(MID_ROUND, '?terms=inhabitant:resident'))?.textContent ?? ''
    expect(timesIn(said, 'is not a term this build names')).toBe(1)
    expect(timesIn(said, 'subject')).toBeGreaterThan(0)
  })

  it('refuses an element that is not a term and a choice at all', async () => {
    const said = (await bannerAt(MID_ROUND, '?terms=service_user'))?.textContent ?? ''
    expect(timesIn(said, 'is not a term and a choice')).toBe(1)
    expect(timesIn(said, 'subject:service_user')).toBe(1)
  })

  /*
   * **One bad element refuses the whole request.** Half a vocabulary applied is
   * a setting that looks applied, with no way for the reader to tell which of
   * their choices landed.
   */
  it('takes none of a request when one element of it is wrong', async () => {
    const line = await bannerAt(
      MID_ROUND,
      '?terms=subject:service_user,carePlan:nonsense',
    )
    expect(line?.querySelector('[data-vocabulary="unreadable"]')).not.toBeNull()
    expect(line?.querySelector('[data-vocabulary="chosen"]')).toBeNull()
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
    const said = line?.textContent ?? ''
    expect(timesIn(said, '“tuesday”')).toBe(1)
    expect(timesIn(said, 'is not a time this can read, so it was ignored')).toBe(1)
    // The refusal does not replace saying where the record actually is.
    expect(timesIn(said, '14:20')).toBe(1)
    expect(timesIn(said, 'the 14:00 round')).toBe(1)
    expect(timesIn(said, 'Real time 16:30')).toBe(1)
  })

  /*
   * The case that reads worst and is reachable only here: a refusal while the
   * real clock is already inside a round. Nothing moved, so the instant at the
   * front of the line is the real time — and the line must not then say the
   * real time twice more and print 14:30 again at the end. Counted, not
   * contained, because the version that said it three times satisfied every
   * `toContain` written over it.
   */
  it('says the clock did not move, once, when a refusal left it where it was', async () => {
    const line = await bannerAt(MID_ROUND, '?at=25:99')
    const said = line?.textContent ?? ''
    expect(line?.dataset.movedClock).toBe('unreadable')
    expect(timesIn(said, '“25:99”')).toBe(1)
    expect(timesIn(said, 'and the clock has not moved')).toBe(1)
    expect(timesIn(said, '14:30')).toBe(1)
    // Nothing moved, so there is no second instant to name and no "Showing".
    expect(timesIn(said, 'Real time')).toBe(0)
    expect(timesIn(said, 'Showing')).toBe(0)
    expect(timesIn(said, 'the real time')).toBe(1) // the way back, and only that
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
