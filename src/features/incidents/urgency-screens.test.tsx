import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/incidents?at=20:20')
})

import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Incident, IsoDateTime } from '@/data/types'
import { incidents } from '@/data/fixtures/incidents'
import { now } from '@/data/fixtures/clock'
import { residentById } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffNwosu } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import {
  holdEvidence,
  releaseEvidence,
  resetSessionIncidents,
} from '@/data/access/incident-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { IncidentRow } from './IncidentRow'
import { ReportIncidentRoute } from './ReportIncidentRoute'

const navigation = vi.hoisted(() => ({ pathname: '/incidents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
  resetSessionIncidents()
})

/** Chosen by the member under test, never by position in a sorted array. */
const withUrgency = (kind: Incident['urgency']['kind']) =>
  incidents.find((incident) => incident.urgency.kind === kind)!

function renderRow(incident: Incident, who = staffAkinyemi.id) {
  const resident =
    incident.subject.kind === 'resident'
      ? residentById(incident.subject.residentId)
      : undefined
  return renderSignedIn(
    who,
    <ul>
      <IncidentRow
        incident={incident}
        resident={resident}
        at={now().toISOString() as IsoDateTime}
      />
    </ul>,
    ROSEWOOD,
  )
}

const row = () => document.querySelector<HTMLElement>('[data-incident]')!

describe('urgency on the record', () => {
  /*
   * Nothing is drawn for an ordinary incident, because nothing is what it is.
   * A line reading "not urgent" on thirty-eight rows makes the two that are
   * harder to find rather than easier.
   */
  it('draws nothing at all where nobody raised it', () => {
    renderRow(withUrgency('ordinary'))
    expect(row().querySelector('[data-urgency]')).toBeNull()
    expect(row().textContent).not.toMatch(/needs attention/i)
    expect(row().textContent).not.toMatch(/can wait/i)
  })

  /*
   * Findable in a list of forty, and never by colour alone: the caution ink
   * and tint with the words inside them, which is the one treatment
   * `check-caution-carriers` allows outside `Toast`.
   */
  it('names a raise, its reason and who raised it', () => {
    const raised = withUrgency('needs_attention_now')
    if (raised.urgency.kind !== 'needs_attention_now') throw new Error('unreachable')
    renderRow(raised)
    const mark = row().querySelector<HTMLElement>(
      '[data-urgency="needs_attention_now"]',
    )!
    expect(mark).not.toBeNull()
    expect(mark.textContent).toContain('Needs attention now')
    expect(mark.textContent).toContain(raised.urgency.because)
    expect(mark.textContent).toContain(raised.urgency.raised.by.displayName)
    // A judgement somebody recorded, so it never wears the hatch.
    expect(mark.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  /** The fixture was reworded an hour later, so both acts have to be printed. */
  it('says who reworded it, where that is somebody other than the raiser', () => {
    const raised = withUrgency('needs_attention_now')
    if (raised.urgency.kind !== 'needs_attention_now') throw new Error('unreachable')
    renderRow(raised)
    expect(row().textContent).toContain('reworded by')
  })

  /*
   * A first raise is one act, and the record says it once rather than printing
   * the same name twice. Reached through the form, which is where it comes
   * from.
   */
  it('says it once where the raise and the wording are the same act', () => {
    const subject = withUrgency('ordinary')
    const stamp = { by: staffNwosu, at: now().toISOString() as IsoDateTime }
    renderRow({
      ...subject,
      urgency: {
        kind: 'needs_attention_now',
        raised: stamp,
        because: 'She is on anticoagulants and nobody has examined her.',
        worded: stamp,
      },
    })
    expect(row().textContent).toContain('Needs attention now')
    expect(row().textContent).not.toContain('reworded by')
  })

  /*
   * A complete record, not a gap: one person raised it with a reason, another
   * answered it with theirs, and both halves are on the screen. Returning to
   * `ordinary` would have lost the first.
   */
  it('renders a stood-down urgency in full, and never hatches it', () => {
    const stood = withUrgency('stood_down')
    if (stood.urgency.kind !== 'stood_down') throw new Error('unreachable')
    renderRow(stood)
    const mark = row().querySelector<HTMLElement>('[data-urgency="stood_down"]')!
    expect(mark.textContent).toContain('Raised, and stood down')
    expect(mark.textContent).toContain(stood.urgency.because)
    expect(mark.textContent).toContain(stood.urgency.why)
    expect(mark.textContent).toContain(stood.urgency.raised.by.displayName)
    expect(mark.textContent).toContain(stood.urgency.stoodDown.by.displayName)
    expect(mark.querySelector('[data-state="unrecorded"]')).toBeNull()
  })

  /*
   * Neither role that signs in stands one down, so no control is drawn — the
   * way this build renders every act it does not offer. Asked of the role
   * table rather than decided here.
   */
  it('offers no stand-down control to either role', () => {
    for (const who of [staffAkinyemi.id, staffEze.id]) {
      const { unmount } = renderRow(withUrgency('needs_attention_now'), who)
      expect(document.querySelector('[data-act-line]'), who).toBeNull()
      expect(document.body.textContent, who).not.toMatch(/stand (it )?down/i)
      unmount()
    }
  })
})

describe('evidence on the record', () => {
  const file = (name: string, type: string, bytes = 4096) =>
    new File([new Uint8Array(bytes)], name, { type })

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:stub-evidence'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws nothing where nothing is attached, and never the hatch', () => {
    renderRow(withUrgency('ordinary'))
    expect(row().querySelector('[data-evidence-on]')).toBeNull()
  })

  it('shows the thumbnail, the file name and who attached it', () => {
    const subject = withUrgency('ordinary')
    const entry = holdEvidence(file('IMG_8812.jpg', 'image/jpeg'), staffNwosu)
    renderRow({ ...subject, evidence: [entry] })
    const strip = row().querySelector<HTMLElement>('[data-evidence-on]')!
    expect(strip.textContent).toContain('IMG_8812.jpg')
    expect(strip.textContent).toContain(staffNwosu.displayName)
    const image = strip.querySelector<HTMLImageElement>('img')!
    expect(image.getAttribute('src')).toBe(entry.url)
    expect(image.getAttribute('alt')).toBe('Attached photograph: IMG_8812.jpg')
    // Where it lives, beside the list.
    expect(strip.textContent).toContain('The originals on the device')
    releaseEvidence(entry)
  })

  it('renders a video as a video rather than as an image', () => {
    const subject = withUrgency('ordinary')
    const entry = holdEvidence(file('clip.mov', 'video/quicktime'), staffNwosu)
    renderRow({ ...subject, evidence: [entry] })
    expect(row().querySelector('video')).not.toBeNull()
    expect(row().querySelector('img[data-evidence-image]')).toBeNull()
    releaseEvidence(entry)
  })

  /*
   * **The Stale state.** A `blob:` URL belongs to the tab that made it, so a
   * record read after a reload holds a handle that resolves to nothing. An
   * empty box where a photograph was is the `url(#…)` failure again: a gap
   * that looks like a value. The words are what the reader gets instead.
   */
  it('says a file from a finished session is gone, rather than drawing a blank', () => {
    const subject = withUrgency('ordinary')
    const entry = holdEvidence(file('IMG_8812.jpg', 'image/jpeg'), staffNwosu)
    renderRow({ ...subject, evidence: [entry] })
    const image = row().querySelector<HTMLImageElement>('img')!
    // What the browser does with a handle whose session has ended. Through
    // `fireEvent` so React flushes the state it sets.
    fireEvent.error(image)
    expect(row().querySelector('img')).toBeNull()
    expect(row().textContent).toContain('attached in a session that has ended')
    expect(row().textContent).toContain('IMG_8812.jpg')
    releaseEvidence(entry)
  })
})

describe('the form asks about urgency', () => {
  async function openForm(who = staffAkinyemi.id) {
    const user = userEvent.setup()
    renderSignedIn(who, <ReportIncidentRoute />, ROSEWOOD)
    await screen.findByRole('radiogroup', { name: 'Can this one wait its turn?' })
    return user
  }

  const waiting = () =>
    document.querySelector('[data-report-waiting]')?.textContent ?? ''

  it('asks as a question with two answers, and holds the form until one is given', async () => {
    await openForm()
    expect(waiting()).toContain('whether this one can wait its turn')
    const group = screen.getByRole('radiogroup', {
      name: 'Can this one wait its turn?',
    })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    for (const radio of within(group).getAllByRole('radio'))
      expect(radio).not.toBeChecked()
  })

  /*
   * It is not severity, and the form says so where it asks: harm is clinical
   * and has its own scale above.
   */
  it('says it is not the harm question', async () => {
    await openForm()
    expect(screen.getByText(/Not how much harm was caused/)).toBeTruthy()
  })

  it('will not take "needs attention now" without a reason', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('radio', { name: /^It needs attention now/ }))
    expect(waiting()).toContain('why it cannot wait')
    await user.type(
      screen.getByLabelText('Why it cannot wait'),
      'She is on anticoagulants and nobody has examined her.',
    )
    expect(waiting()).not.toContain('why it cannot wait')
  })

  it('asks for no reason where it can wait its turn', async () => {
    const user = await openForm()
    await user.click(screen.getByRole('radio', { name: /^It can wait its turn/ }))
    expect(screen.queryByLabelText('Why it cannot wait')).toBeNull()
    expect(waiting()).not.toContain('can wait its turn')
  })
})

describe('the form takes photographs and video', () => {
  const file = (name: string, type: string, bytes = 4096) =>
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

  async function openForm() {
    const user = userEvent.setup()
    renderSignedIn(staffAkinyemi.id, <ReportIncidentRoute />, ROSEWOOD)
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })
    return user
  }

  const input = () => document.querySelector<HTMLInputElement>('[data-evidence-input]')!

  /*
   * A real control. The last file chooser in this build was a disabled button
   * and a line saying nothing was stored, and the 19/09 sweep removed both for
   * doing nothing.
   */
  it('offers a file control that is not disabled, and takes photographs and video', async () => {
    await openForm()
    expect(input()).toBeEnabled()
    expect(input().getAttribute('accept')).toBe('image/*,video/*')
    expect(screen.getByText('Choose photographs or video')).toBeTruthy()
  })

  it('says nothing is attached without hatching it', async () => {
    await openForm()
    const none = document.querySelector('[data-evidence-none]')
    expect(none?.textContent).toBe('Nothing attached.')
    expect(none?.closest('[data-state="unrecorded"]')).toBeNull()
  })

  it('lists what was chosen, with a preview and where it lives', async () => {
    const user = await openForm()
    await user.upload(input(), file('IMG_8812.jpg', 'image/jpeg'))
    const list = document.querySelector<HTMLElement>('[data-evidence-list]')!
    expect(list.textContent).toContain('IMG_8812.jpg')
    expect(list.textContent).toContain('4 KB')
    expect(list.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/)
    expect(document.querySelector('[data-evidence-where]')?.textContent).toContain(
      'The originals on the device are the only lasting copy',
    )
    expect(document.querySelector('[data-evidence-none]')).toBeNull()
  })

  /*
   * **`accept` is advice, and the refusal is the gate.** `userEvent.upload`
   * honours the attribute and drops the file before the handler sees it, which
   * is what a file picker does — and a drag and drop, a share sheet or a
   * browser that ignores the hint does not. So the change is fired directly:
   * the question is what the build does when something that is neither arrives,
   * not whether the picker filtered it.
   */
  it('refuses a file that is neither, and says which one', async () => {
    await openForm()
    fireEvent.change(input(), {
      target: { files: [file('notes.pdf', 'application/pdf')] },
    })
    expect(document.querySelector('[data-evidence-refused]')?.textContent).toContain(
      'notes.pdf',
    )
    expect(document.querySelector('[data-evidence-list]')).toBeNull()
  })

  /*
   * A photograph chosen by mistake was never on the record, so taking it out
   * removes it and hands the file back rather than keeping a second fact
   * beside the first.
   */
  it('takes a file out again, and gives it back to the browser', async () => {
    const user = await openForm()
    await user.upload(input(), file('IMG_8812.jpg', 'image/jpeg'))
    const url = document
      .querySelector<HTMLImageElement>('[data-evidence-list] img')!
      .getAttribute('src')
    await user.click(screen.getByRole('button', { name: 'Take it out' }))
    expect(document.querySelector('[data-evidence-list]')).toBeNull()
    expect(document.querySelector('[data-evidence-none]')).not.toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
  })

  /** Empty is not a gap, so the form submits with nothing attached. */
  it('does not hold the form for evidence', async () => {
    await openForm()
    expect(document.querySelector('[data-report-waiting]')?.textContent).not.toMatch(
      /photograph|video|evidence/i,
    )
  })
})
