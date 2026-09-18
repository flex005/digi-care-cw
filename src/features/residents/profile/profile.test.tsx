import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResidentId } from '@/data/types'
import { residentById } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { renderProfileTab } from '@/test/render-signed-in'
import { GoalsTab } from '@/features/goals/GoalsTab'
import { PROFILE_TABS } from './profile-tabs'
import { consentGaps, riskAssessmentGaps } from './record-gaps'
import { hiddenTabs } from './hidden-tabs'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/goals',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const open = (id: string, segment = 'goals') => {
  navigation.params = { residentId: id }
  navigation.pathname = `/residents/${id}/${segment}`
}

const resident = (id: string) => {
  const found = residentById(id as ResidentId)
  if (found === undefined) throw new Error(`no fixture ${id}`)
  return found
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('a resident’s record', () => {
  it('opens for a care worker whose list names the resident', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Emmanuel' }),
    ).toBeTruthy()
    expect(screen.getByText('Emmanuel Okafor')).toBeTruthy()
  })

  it('names a resident who is not on the list, and shows nothing of their record', async () => {
    open('res-kavanagh')
    renderProfileTab(staffEze.id, <GoalsTab />)
    expect(await screen.findByText('Doris Kavanagh is not on your list.')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByLabelText('Risk flags')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(
      screen.queryByText(/could not be loaded|does not exist|not found/i),
    ).toBeNull()
  })

  it('tells a care worker with no list that nobody has given one', async () => {
    open('res-okafor')
    renderProfileTab(staffOsei.id, <GoalsTab />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(screen.queryByLabelText('Risk flags')).toBeNull()
  })

  it('opens any resident at the home for a senior carer', async () => {
    open('res-kavanagh')
    renderProfileTab(staffAkinyemi.id, <GoalsTab />, 'site-rosewood-court')
    expect(await screen.findByRole('heading', { level: 1, name: 'Doris' })).toBeTruthy()
  })
})

describe('the head of the record', () => {
  it('draws all five risk flags, whatever they say', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    const flags = await screen.findByRole('list', { name: 'Risk flags' })
    expect(
      within(flags)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-badge')),
    ).toEqual(['falls', 'allergies', 'resuscitation', 'eolc', 'isolation'])
  })

  it('draws the call button with the line that says it does nothing', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    const kin = await screen.findByText(/^Next of kin/)
    const block = kin.closest('[data-next-of-kin]') as HTMLElement
    expect(within(block).getByRole('button', { name: /^Call / })).toBeTruthy()
    expect(
      within(block).getByText('Calling is not built: this is a design specification.'),
    ).toBeTruthy()
  })

  it('puts the medication due on the one dark card, with what it is out of', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    await screen.findByRole('heading', { level: 1 })
    const cards = document.querySelectorAll('[data-action-card]')
    expect(cards).toHaveLength(1)
    expect(
      within(cards[0] as HTMLElement).getByText(/prescribed for Emmanuel$/),
    ).toBeTruthy()
  })
})

describe('the tab strip', () => {
  it('draws all eleven tabs for a care worker, the PRD’s order, none hidden', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    const strip = await screen.findByRole('navigation', { name: 'Emmanuel’s record' })
    const links = within(strip).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('data-tab'))).toEqual(
      PROFILE_TABS.map((tab) => (tab.segment === '' ? 'general' : tab.segment)),
    )
    expect(links).toHaveLength(11)
    expect(
      within(strip).getByRole('link', { current: 'page' }).getAttribute('data-tab'),
    ).toBe('goals')
  })

  it('names a tab’s gaps in words, from the same counts the tab states', async () => {
    // Ismail Sowande was admitted yesterday: consents unsought, risks unassessed.
    const id = 'res-sowande'
    open(id)
    renderProfileTab(staffAkinyemi.id, <GoalsTab />, 'site-ashgrove-lodge')
    const strip = await screen.findByRole('navigation', { name: /’s record$/ })
    const consent = consentGaps(resident(id))
    const risk = riskAssessmentGaps(resident(id))
    expect(consent.neverSought).toBeGreaterThan(0)
    expect(risk.neverAssessed).toBeGreaterThan(0)

    const consentTab = strip.querySelector('[data-tab="consent"]') as HTMLElement
    const riskTab = strip.querySelector('[data-tab="risk-assessments"]') as HTMLElement
    expect(
      within(consentTab).getByText(
        `${consent.neverSought} of ${consent.asked} never sought`,
      ),
    ).toBeTruthy()
    expect(
      within(riskTab).getByText(`${risk.neverAssessed} of ${risk.asked} never done`),
    ).toBeTruthy()
    // A tab the PRD does not mark carries nothing.
    expect(strip.querySelector('[data-tab="needs"] [data-state]')).toBeNull()
  })

  it('carries no colour-alone mark: every tab note is words', async () => {
    open('res-sowande')
    renderProfileTab(staffAkinyemi.id, <GoalsTab />, 'site-ashgrove-lodge')
    const strip = await screen.findByRole('navigation', { name: /’s record$/ })
    const marks = strip.querySelectorAll('[data-state]')
    expect(marks.length).toBeGreaterThan(0)
    for (const mark of marks) expect(mark.textContent?.trim()).not.toBe('')
  })

  /*
   * Every tab is built as of Phase 7. Goals was the last one that was not, and
   * it said which phase would build it rather than sitting disabled; this now
   * holds the record it opens to instead.
   */
  it('opens the goals tab onto that resident’s own goals', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <GoalsTab />)
    expect(await screen.findByText(/’s goals$/)).toBeTruthy()
  })
})

describe('whether the tab strip says it scrolls', () => {
  const view = { left: 100, right: 1000 }

  it('counts nothing hidden when every tab is inside the row', () => {
    expect(
      hiddenTabs(
        [
          { left: 110, right: 300 },
          { left: 300, right: 990 },
        ],
        view,
      ),
    ).toEqual({ before: 0, after: 0 })
  })

  it('counts a tab cut by either edge as hidden on that side', () => {
    expect(
      hiddenTabs(
        [
          { left: 40, right: 160 },
          { left: 160, right: 900 },
          { left: 900, right: 1060 },
          { left: 1060, right: 1200 },
        ],
        view,
      ),
    ).toEqual({ before: 1, after: 2 })
  })

  it('draws the edge with the count only while tabs are hidden past it', async () => {
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.tagName === 'NAV') return { left: 0, right: 900 } as DOMRect
      const tab = this.querySelector('[data-tab]')?.getAttribute('data-tab')
      if (this.tagName === 'LI' && tab) {
        const index = PROFILE_TABS.findIndex(
          (entry) => (entry.segment === '' ? 'general' : entry.segment) === tab,
        )
        return { left: index * 100, right: index * 100 + 100 } as DOMRect
      }
      return original.call(this)
    }
    try {
      open('res-okafor')
      renderProfileTab(staffEze.id, <GoalsTab />)
      const more = await screen.findByRole('button', { name: 'Show 2 more tabs' })
      expect(more.textContent).toBe('2 more')
      expect(document.querySelector('[data-hidden-tabs="before"]')).toBeNull()
    } finally {
      Element.prototype.getBoundingClientRect = original
    }
  })
})
