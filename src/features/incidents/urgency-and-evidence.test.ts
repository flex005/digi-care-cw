import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { incidents } from '@/data/fixtures/incidents'
import { staffAkinyemi, staffNwosu } from '@/data/fixtures/organisation'
import {
  attachEvidence,
  incidentHoldings,
  raiseUrgency,
  resetSessionIncidents,
  withIncidentEdits,
} from '@/data/access/incident-store'
import type { Incident } from '@/data/types'

/**
 * Urgency and evidence on an incident. Phase 21.
 *
 * **Every subject here is chosen by the property under test, never by
 * position.** `incidents` is sorted by `occurredAt`, so the array's order moves
 * with the clock — and in the Admin build three test files took their subject
 * as `incidents[0]` and broke the day a fixture gained a stood-down urgency,
 * which is the change this file is about. Nothing below indexes it.
 */

const withUrgency = (kind: Incident['urgency']['kind']) =>
  incidents.filter((incident) => incident.urgency.kind === kind)

/** The fixture that pins a kind, where exactly one is meant to. */
function onlyWith(kind: Incident['urgency']['kind']): Incident {
  const found = withUrgency(kind)
  expect(found, kind).toHaveLength(1)
  return found[0]!
}

beforeEach(() => {
  resetSessionIncidents()
})

describe('the fixtures reach every member', () => {
  /*
   * A state no fixture reaches is a state every screen that renders it is dead
   * in, and the feature reads as unbuilt. The Admin build lost three render
   * sites that way before anybody noticed.
   */
  it('pins one raised and one stood down, and leaves the rest ordinary', () => {
    expect(withUrgency('needs_attention_now')).toHaveLength(1)
    expect(withUrgency('stood_down')).toHaveLength(1)
    expect(withUrgency('ordinary').length).toBe(incidents.length - 2)
  })

  it('gives the raised one a reason and keeps the reword apart from the raise', () => {
    const raised = onlyWith('needs_attention_now')
    if (raised.urgency.kind !== 'needs_attention_now') throw new Error('unreachable')
    expect(raised.urgency.because.trim().length).toBeGreaterThan(20)
    /*
     * Reworded an hour after the raise, so the screen has a case where the two
     * acts differ. With one act a reword reset the only timestamp there was,
     * and an urgency raised six hours ago read as a minute old.
     */
    expect(raised.urgency.worded.at).not.toBe(raised.urgency.raised.at)
    expect(new Date(raised.urgency.worded.at).getTime()).toBeGreaterThan(
      new Date(raised.urgency.raised.at).getTime(),
    )
  })

  /*
   * Standing down answers a raise rather than deleting it: the record says who
   * raised this and why *and* who overruled that and why. Going back to
   * `ordinary` would have left it unable to tell "nobody thought this urgent"
   * from "somebody did and was overruled".
   */
  it('keeps the raise in full on the one that was stood down', () => {
    const stood = onlyWith('stood_down')
    if (stood.urgency.kind !== 'stood_down') throw new Error('unreachable')
    expect(stood.urgency.because.trim().length).toBeGreaterThan(20)
    expect(stood.urgency.why.trim().length).toBeGreaterThan(20)
    // Two people, two judgements. One name against both would not be a record.
    expect(stood.urgency.stoodDown.by.id).not.toBe(stood.urgency.raised.by.id)
    expect(new Date(stood.urgency.stoodDown.at).getTime()).toBeGreaterThan(
      new Date(stood.urgency.raised.at).getTime(),
    )
  })

  /*
   * No invented evidence, and an empty list is not a gap: most incidents have
   * nothing to attach, and hatching that would make the hatch texture.
   */
  it('attaches no evidence to anything generated', () => {
    expect(incidents.every((incident) => incident.evidence.length === 0)).toBe(true)
  })
})

describe('raising it after the report', () => {
  const ordinary = () => withUrgency('ordinary')[0]!

  it('stamps the raise and the wording as one act the first time', () => {
    const subject = ordinary()
    raiseUrgency(
      subject,
      'She is on anticoagulants and nobody has examined her.',
      staffNwosu,
    )
    const after = withIncidentEdits(subject)
    if (after.urgency.kind !== 'needs_attention_now') throw new Error('not raised')
    expect(after.urgency.raised).toEqual(after.urgency.worded)
    expect(after.urgency.because).toBe(
      'She is on anticoagulants and nobody has examined her.',
    )
  })

  /*
   * A reword keeps `raised` exactly as it was and moves `worded` only. This is
   * the whole reason the member carries two acts.
   *
   * **The two acts differ by author here and not by time, and that is the
   * clock rather than the write.** `now()` returns the instant the record was
   * generated against and does not tick (CLAUDE.md §6), so every write in one
   * session shares a timestamp — `vi.setSystemTime` moves the real clock and
   * this reads neither. The differing-timestamp case is what the pinned fixture
   * above exists for, raised an hour after the fall and reworded an hour after
   * that. An assertion that the two stamps differ would be asserting something
   * this build cannot do in a session, and it would pass only by accident.
   */
  it('keeps the original raise when somebody rewords it', () => {
    const subject = ordinary()
    raiseUrgency(subject, 'First wording, written in a hurry.', staffNwosu)
    const first = withIncidentEdits(subject)
    if (first.urgency.kind !== 'needs_attention_now') throw new Error('not raised')

    raiseUrgency(first, 'Reworded by somebody else, who knew more.', staffAkinyemi)
    const second = withIncidentEdits(subject)
    if (second.urgency.kind !== 'needs_attention_now') throw new Error('not raised')

    expect(second.urgency.raised).toEqual(first.urgency.raised)
    expect(second.urgency.raised.by.id).toBe(staffNwosu.id)
    expect(second.urgency.worded.by.id).toBe(staffAkinyemi.id)
    expect(second.urgency.because).toBe('Reworded by somebody else, who knew more.')
  })

  /*
   * **The caller's copy is not the record**, and this is the case that has no
   * symptom. A screen holding the fixture incident and raising twice would,
   * without the store reading its own overlay, find `ordinary` on the second
   * call and re-stamp `raised` — destroying the first raise, which is exactly
   * what `worded` exists to protect. Attaching twice had a visible symptom and
   * is what led here; this one never would have.
   */
  it('keeps the raise even when the caller hands back the unpatched record', () => {
    const subject = ordinary()
    raiseUrgency(subject, 'Raised by the person who found her.', staffNwosu)
    raiseUrgency(subject, 'Reworded from the same stale copy.', staffAkinyemi)
    const after = withIncidentEdits(subject)
    if (after.urgency.kind !== 'needs_attention_now') throw new Error('not raised')
    expect(after.urgency.raised.by.id).toBe(staffNwosu.id)
    expect(after.urgency.worded.by.id).toBe(staffAkinyemi.id)
  })

  it('refuses to say something is urgent without saying why', () => {
    expect(() => raiseUrgency(ordinary(), '   ', staffNwosu)).toThrow(/saying why/)
  })

  /*
   * The union holds one raise and one stand-down, not a chain, so re-raising
   * would overwrite a judgement somebody recorded — the thing the member exists
   * to prevent. Refused in the store, not in a form.
   */
  it('refuses to re-raise something a manager stood down', () => {
    expect(() =>
      raiseUrgency(
        onlyWith('stood_down'),
        'I still think this cannot wait.',
        staffNwosu,
      ),
    ).toThrow(/stood down/)
  })
})

describe('attaching a photograph', () => {
  const file = (name: string, type: string, bytes = 2048) =>
    new File([new Uint8Array(bytes)], name, { type })

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:stub-${Math.random().toString(36).slice(2)}`),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records what it is, what it was called and who attached it', () => {
    const subject = withUrgency('ordinary')[0]!
    const entry = attachEvidence(
      subject,
      file('IMG_8812.jpg', 'image/jpeg'),
      staffNwosu,
    )
    expect(entry.kind).toBe('photo')
    expect(entry.fileName).toBe('IMG_8812.jpg')
    expect(entry.size).toBe(2048)
    expect(entry.attached.by.id).toBe(staffNwosu.id)
    expect(withIncidentEdits(subject).evidence).toEqual([entry])
  })

  it('reads a video as a video, and keeps both on the same report', () => {
    const subject = withUrgency('ordinary')[0]!
    attachEvidence(subject, file('IMG_8812.jpg', 'image/jpeg'), staffNwosu)
    const clip = attachEvidence(
      subject,
      file('clip.mov', 'video/quicktime'),
      staffNwosu,
    )
    expect(clip.kind).toBe('video')
    expect(withIncidentEdits(subject).evidence.map((item) => item.kind)).toEqual([
      'photo',
      'video',
    ])
  })

  /*
   * Two kinds, because a reader wants to know which they are about to open. A
   * spreadsheet filed under the nearer of the two is a record that lies about
   * itself.
   */
  it('refuses anything that is not a photograph or a video', () => {
    const subject = withUrgency('ordinary')[0]!
    expect(() =>
      attachEvidence(subject, file('notes.pdf', 'application/pdf'), staffNwosu),
    ).toThrow(/photograph or a video/)
    expect(withIncidentEdits(subject).evidence).toEqual([])
  })

  /*
   * The sign-out list has to name it, or somebody signs out believing a
   * photograph of a bruise is filed somewhere.
   */
  it('tells the sign-out list what it is holding, counted', () => {
    const subject = withUrgency('ordinary')[0]!
    attachEvidence(subject, file('IMG_1.jpg', 'image/jpeg'), staffNwosu)
    attachEvidence(subject, file('IMG_2.jpg', 'image/jpeg'), staffNwosu)
    const said = incidentHoldings().map((holding) => holding.what)
    expect(said).toContain('photographs and video you attached')
    const line = incidentHoldings().find(
      (holding) => holding.what === 'photographs and video you attached',
    )
    expect(line?.count).toBe(2)
  })

  /*
   * Clearing the overlay drops the records that pointed at the files; the
   * browser holds each one until something revokes it, so forgetting here is a
   * leak that lasts as long as the tab. No guard can see this.
   */
  it('hands the files back to the browser on sign-out', () => {
    const subject = withUrgency('ordinary')[0]!
    const one = attachEvidence(subject, file('IMG_1.jpg', 'image/jpeg'), staffNwosu)
    const two = attachEvidence(subject, file('clip.mov', 'video/mp4'), staffNwosu)
    resetSessionIncidents()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(one.url)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(two.url)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(withIncidentEdits(subject).evidence).toEqual([])
  })
})
