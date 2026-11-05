import { fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { submitCareNote } from '@/data/access/client'
import { resetSessionNotes } from '@/data/access/note-store'
import { now } from '@/data/fixtures/clock'
import { staffEze } from '@/data/fixtures/organisation'
import type { IsoDateTime, ResidentId } from '@/data/types'
import { renderSignedIn } from '@/test/render-signed-in'
import { PhoneApp } from '../shell/PhoneApp'

vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}))

afterEach(() => {
  resetSessionNotes()
  window.history.replaceState(null, '', '/')
})

const tab = (id: 'today' | 'people') =>
  document.querySelector(`[data-tab="${id}"]`) as HTMLElement
const tabLink = (label: string) =>
  [
    ...document.querySelectorAll<HTMLElement>('nav[aria-label="Main navigation"] a'),
  ].find((link) => link.textContent === label) as HTMLElement
const notWrittenUp = () => {
  const card = within(tab('today'))
    .getByText('Not written up today')
    .closest('[data-stat]')
  return Number(card?.querySelector('[data-numeric]')?.textContent)
}

describe('the phone: Today, read again on coming back to the front', () => {
  it('stops counting a resident as not written up once their note is written elsewhere', async () => {
    window.history.replaceState(null, '', '/m')
    renderSignedIn(staffEze.id, <PhoneApp />)
    await within(tab('today')).findByText('Not written up today')
    // The fixtures leave some of this list unwritten on purpose; the test needs one.
    const before = notWrittenUp()
    expect(before).toBeGreaterThan(0)

    // Away from Today: the reader's list, and a note for each of them.
    fireEvent.click(tabLink('Residents'))
    await waitFor(() => expect(tab('people').querySelectorAll('li a').length).toBe(4))
    const ids = [...tab('people').querySelectorAll<HTMLAnchorElement>('li a')].map(
      (link) => link.getAttribute('href')?.split('/').pop() as ResidentId,
    )
    for (const residentId of ids)
      await submitCareNote({
        residentId,
        category: 'general',
        body: 'Settled through the afternoon.',
        mood: { kind: 'not_recorded' },
        shift: { kind: 'auto', value: 'late' },
        author: staffEze,
        at: now().toISOString() as IsoDateTime,
        flag: { kind: 'not_flagged' },
      })

    // Back to Today, which reads again and finds everybody written up.
    fireEvent.click(tabLink('Today'))
    await waitFor(() => expect(notWrittenUp()).toBe(0))
    const card = within(tab('today'))
      .getByText('Not written up today')
      .closest('[data-stat]')
    expect(card?.getAttribute('data-state')).toBeNull()
  })
})
