import { vi } from 'vitest'

/* A full instant before any fixture loads: 20:20 BST, 16/09/2026 (CLAUDE.md §8). */
vi.hoisted(() => {
  window.history.replaceState(null, '', '/m?at=2026-09-16T19:20:00Z')
})

import { within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SiteId } from '@/data/types'
import { staffEze } from '@/data/fixtures/organisation'
import { patchedRecords } from '@/data/access/mar-store'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from './shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

/**
 * Today's chart drawing a dose prescribed at a round with no record held. **No
 * fixture reaches that state**, so the loader is wrapped here to leave out one
 * record of Pemberton's 08:00 round; the fixtures, which both builds read, are
 * not changed.
 */
const PERSON = 'res-pemberton'
const DAY = '2026-09-16'
const dropped = patchedRecords().find(
  (record) =>
    record.residentId === PERSON &&
    record.date === DAY &&
    record.roundTime === '08:00' &&
    record.state.kind === 'given',
)

/* `vi.mock` is hoisted above the constants, so the record it leaves out is named again inside it. */
vi.mock('@/data/access/client', async (original) => {
  const real = await original<typeof import('@/data/access/client')>()
  return {
    ...real,
    getMarRecords: async (id: Parameters<typeof real.getMarRecords>[0]) => {
      const chart = await real.getMarRecords(id)
      const { patchedRecords: records } = await import('@/data/access/mar-store')
      const gone = records().find(
        (record) =>
          record.residentId === 'res-pemberton' &&
          record.date === '2026-09-16' &&
          record.roundTime === '08:00' &&
          record.state.kind === 'given',
      )
      return {
        ...chart,
        records: chart.records.filter(
          (record) =>
            !(
              gone !== undefined &&
              record.medicationId === gone.medicationId &&
              record.date === gone.date &&
              record.roundTime === gone.roundTime
            ),
        ),
      }
    },
  }
})

describe('today’s chart with a dose nobody holds a record of', () => {
  it('draws it at its round, in the desktop’s words, as not held and not as missed', async () => {
    if (dropped === undefined) throw new Error('No dose given at 08:00 to leave out')
    window.history.replaceState(null, '', `/m/people/${PERSON}/chart`)
    renderSignedIn(staffEze.id, <PhoneApp />, 'site-rosewood-court' as SiteId)
    const people = () => document.querySelector('[data-tab="people"]') as HTMLElement
    await within(people()).findByText(/^Today, /)

    const dose = people().querySelector(
      `[data-chart-round="08:00"] [data-chart-dose="${dropped.medicationId}"]`,
    )
    expect(dose?.querySelector('[data-dose="not_held"]')?.textContent).toBe(
      'No record of this round is held here. This is not a record that the dose was missed.',
    )
    // Not an omission: no hatch, and nothing says it was missed.
    expect(dose?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(dose?.querySelector('[data-dose="omitted"]')).toBeNull()
  })
})
