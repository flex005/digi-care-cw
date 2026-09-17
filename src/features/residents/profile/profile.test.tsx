import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResidentId } from '@/data/types'
import { residentById } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { renderProfileTab } from '@/test/render-signed-in'
import { CareNotesTab } from './LaterPhaseTab'
import { PROFILE_TABS } from './profile-tabs'
import { consentGaps, riskAssessmentGaps } from './record-gaps'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/notes',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const open = (id: string, segment = 'notes') => {
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
    renderProfileTab(staffEze.id, <CareNotesTab />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Emmanuel' }),
    ).toBeTruthy()
    expect(screen.getByText('Emmanuel Okafor')).toBeTruthy()
  })

  it('names a resident who is not on the list, and shows nothing of their record', async () => {
    open('res-kavanagh')
    renderProfileTab(staffEze.id, <CareNotesTab />)
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
    renderProfileTab(staffOsei.id, <CareNotesTab />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(screen.queryByLabelText('Risk flags')).toBeNull()
  })

  it('opens any resident at the home for a senior carer', async () => {
    open('res-kavanagh')
    renderProfileTab(staffAkinyemi.id, <CareNotesTab />, 'site-rosewood-court')
    expect(await screen.findByRole('heading', { level: 1, name: 'Doris' })).toBeTruthy()
  })
})

describe('the head of the record', () => {
  it('draws all five risk flags, whatever they say', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <CareNotesTab />)
    const flags = await screen.findByRole('list', { name: 'Risk flags' })
    expect(
      within(flags)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-badge')),
    ).toEqual(['falls', 'allergies', 'resuscitation', 'eolc', 'isolation'])
  })

  it('draws the call button with the line that says it does nothing', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <CareNotesTab />)
    const kin = await screen.findByText(/^Next of kin/)
    const block = kin.closest('[data-next-of-kin]') as HTMLElement
    expect(within(block).getByRole('button', { name: /^Call / })).toBeTruthy()
    expect(
      within(block).getByText('Calling is not built: this is a design specification.'),
    ).toBeTruthy()
  })

  it('puts the medication due on the one dark card, with what it is out of', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <CareNotesTab />)
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
    renderProfileTab(staffEze.id, <CareNotesTab />)
    const strip = await screen.findByRole('navigation', { name: 'Emmanuel’s record' })
    const links = within(strip).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('data-tab'))).toEqual(
      PROFILE_TABS.map((tab) => (tab.segment === '' ? 'general' : tab.segment)),
    )
    expect(links).toHaveLength(11)
    expect(
      within(strip).getByRole('link', { current: 'page' }).getAttribute('data-tab'),
    ).toBe('notes')
  })

  it('names a tab’s gaps in words, from the same counts the tab states', async () => {
    // Ismail Sowande was admitted yesterday: consents unsought, risks unassessed.
    const id = 'res-sowande'
    open(id)
    renderProfileTab(staffAkinyemi.id, <CareNotesTab />, 'site-ashgrove-lodge')
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
    renderProfileTab(staffAkinyemi.id, <CareNotesTab />, 'site-ashgrove-lodge')
    const strip = await screen.findByRole('navigation', { name: /’s record$/ })
    const marks = strip.querySelectorAll('[data-state]')
    expect(marks.length).toBeGreaterThan(0)
    for (const mark of marks) expect(mark.textContent?.trim()).not.toBe('')
  })

  it('opens a later tab to say which phase builds it', async () => {
    open('res-okafor')
    renderProfileTab(staffEze.id, <CareNotesTab />)
    expect(
      await screen.findByText('This tab is built in Phase 3, care notes.'),
    ).toBeTruthy()
  })
})
