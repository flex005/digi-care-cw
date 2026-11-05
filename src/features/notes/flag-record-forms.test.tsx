import { describe, expect, it } from 'vitest'
import { staffNwosu } from '@/data/fixtures/organisation'
import type { CareNoteReview, IsoDateTime } from '@/data/types'
import { renderSignedIn } from '@/test/render-signed-in'
import { FlagRecord } from './note-parts'

/** A flag nobody has answered: the hatched chip and the "Why flagged" label. */
const waiting: CareNoteReview = {
  kind: 'flagged_not_reviewed',
  flaggedBy: staffNwosu,
  flaggedAt: '2026-11-05T09:00:00.000Z' as IsoDateTime,
  reason: { kind: 'given', text: 'Bruise on the left arm.' },
}

const drawn = (form: 'desktop' | 'phone') => {
  const { container, unmount } = renderSignedIn(
    staffNwosu.id,
    <FlagRecord review={waiting} form={form} />,
  )
  const chip = container.querySelector('[data-state="unrecorded"]') as HTMLElement
  const root = container.querySelector('[data-flag-record]') as HTMLElement
  const result = { chip: chip.className, root: root.className, text: root.textContent }
  unmount()
  return result
}

describe('the flag record, in its two forms', () => {
  it('draws the phone form with the phone’s hatched chip and sentence-case labels', () => {
    const phone = drawn('phone')
    expect(phone.chip).toMatch(/phoneChip/)
    expect(phone.root).toMatch(/phoneForm/)
  })

  it('leaves the desktop form exactly as it was', () => {
    const desktop = drawn('desktop')
    expect(desktop.chip).not.toMatch(/phoneChip/)
    expect(desktop.root).not.toMatch(/phoneForm/)
  })

  it('says the same words in both', () => {
    expect(drawn('phone').text).toBe(drawn('desktop').text)
  })
})
