import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { axe } from 'vitest-axe'
import type { ImportantPeople, ImportantPerson } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOkonkwo } from '@/data/fixtures/organisation'
import { CARE_ACTS } from '@/app/session/capabilities'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { renderProfileTab } from '@/test/render-signed-in'
import { ImportantPeopleTab, PeopleSections } from './ImportantPeopleTab'
import {
  PrimaryContactPanel,
  primaryContactsIn,
} from './important-people-primary-contact'
import {
  IMPORTANT_PEOPLE_CATEGORIES,
  IMPORTANT_PEOPLE_SECTIONS,
} from './important-people-sections'

/**
 * Important People, read-only.
 *
 * The failure this tab is exposed to is a missing category, not a blank field.
 * "No advocate recorded" and "assessed as not needing one" are the same empty
 * space if the row is not there.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

function openPeople(staffId: (typeof staffEze)['id'], residentId: string) {
  navigation.pathname = `/residents/${residentId}/people`
  navigation.params = { residentId }
  return renderProfileTab(staffId, <ImportantPeopleTab />)
}

const atSite = (ui: ReactNode) => (
  <SiteTimeZone timeZone="Europe/London">{ui}</SiteTimeZone>
)

/** The refusal lines the role table holds for editing a profile, read without naming a role. */
const editRefusals = Object.values(CARE_ACTS.edit_resident_profile).flatMap((cell) =>
  typeof cell === 'object' && 'kind' in cell && cell.kind === 'may_not'
    ? [cell.reason]
    : [],
)

describe('every category is declared, and none can go missing', () => {
  it('covers all seven members of ImportantPeople in three sections', () => {
    expect(IMPORTANT_PEOPLE_CATEGORIES).toHaveLength(7)
    expect(IMPORTANT_PEOPLE_SECTIONS).toHaveLength(3)
    const ids = IMPORTANT_PEOPLE_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps any section description in words, never as a count of its own rows', () => {
    for (const section of IMPORTANT_PEOPLE_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.title} has an empty description`,
      ).not.toBe('')
      expect(section.description).not.toMatch(/^\d+ /)
    }
  })
})

describe('no category is ever an empty row', () => {
  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s: every category renders something',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<PeopleSections resident={resident} />),
      )
      for (const category of IMPORTANT_PEOPLE_CATEGORIES) {
        const cell = container.querySelector(`[data-field="${category.id}"]`)
        expect(cell, `${name}: "${category.id}" is not rendered at all`).toBeTruthy()
        const text = cell?.querySelector('dd')?.textContent?.trim()
        expect(text, `${name}: "${category.label}" rendered an empty row`).not.toBe('')
        expect(text, `${name}: "${category.label}" rendered a dash`).not.toBe('—')
      }
      unmount()
    },
  )

  it('hatches an unrecorded category and says what the gap costs', () => {
    // Admitted most recently: almost nothing is recorded.
    const newcomer = residents.find((resident) => resident.id === 'res-sowande')!
    const { container } = render(atSite(<PeopleSections resident={newcomer} />))

    const missing = IMPORTANT_PEOPLE_CATEGORIES.filter((category) =>
      category.isUnrecorded(newcomer.importantPeople),
    )
    expect(missing.length).toBeGreaterThan(3)

    for (const category of missing) {
      const cell = container.querySelector(`[data-field="${category.id}"]`)
      expect(
        cell?.querySelector('[data-state="unrecorded"]'),
        `${category.label} is unrecorded but did not render the hatch`,
      ).toBeTruthy()
      expect(
        cell?.querySelector('[data-unrecorded-detail]')?.textContent?.trim(),
        `${category.label} does not say what the gap costs`,
      ).toBeTruthy()
    }
  })

  it('draws a recorded negative as settled and attributed, never hatched', () => {
    const negatives = residents.flatMap((resident) =>
      (['familyWithVisitingRights', 'otherProfessionals'] as const)
        .filter((key) => resident.importantPeople[key].kind === 'none_involved')
        .map((key) => ({
          resident,
          id: key === 'otherProfessionals' ? 'other-professionals' : 'visiting-family',
        })),
    )
    expect(
      negatives.length,
      'no resident in the fixtures has a recorded negative',
    ).toBeGreaterThan(0)

    const { resident, id } = negatives[0]!
    const { container } = render(atSite(<PeopleSections resident={resident} />))
    const cell = container.querySelector(`[data-field="${id}"]`)!
    expect(cell.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(cell.querySelector('[data-state="recorded"][data-tone="info"]')).toBeTruthy()
    expect(cell.textContent).toMatch(/Recorded by .+, \d{2}\/\d{2}\/\d{4}/)
  })
})

describe('who this home rings first', () => {
  const person = (name: string, isPrimaryContact: boolean): ImportantPerson => ({
    name,
    relationship: 'Daughter',
    contact: { phone: '07700 900000', email: 'family@example.invalid' },
    address: '1 Test Road, Thornfield',
    isPrimaryContact,
    communicationPreference: { kind: 'unrecorded' },
  })

  const people = (overrides: Partial<ImportantPeople>): ImportantPeople => ({
    nextOfKin: { kind: 'unrecorded' },
    emergencyContact: { kind: 'unrecorded' },
    lpaHolder: { kind: 'unrecorded' },
    socialWorker: { kind: 'unrecorded' },
    advocate: { kind: 'unrecorded' },
    familyWithVisitingRights: { kind: 'not_recorded' },
    otherProfessionals: { kind: 'not_recorded' },
    ...overrides,
  })

  const recordedAt = '2026-03-12T09:00:00Z' as const

  it('names the one person who holds it', () => {
    const { container } = render(
      atSite(
        <PrimaryContactPanel
          people={people({
            nextOfKin: {
              kind: 'recorded',
              value: person('Helen Adeleke', true),
              recordedBy: staffOkonkwo,
              recordedAt,
            },
          })}
          residentName="Emmanuel"
        />,
      ),
    )
    expect(container.querySelector('[data-primary-contact="recorded"]')).toBeTruthy()
    expect(screen.getByText('Helen Adeleke')).toBeVisible()
  })

  it('hatches it when nobody holds it, rather than showing nothing', () => {
    const { container } = render(
      atSite(<PrimaryContactPanel people={people({})} residentName="Ismail" />),
    )
    expect(container.querySelector('[data-primary-contact="none"]')).toBeTruthy()
    expect(container.querySelector('[data-state="unrecorded"]')).toBeTruthy()
  })

  it('refuses to choose when two people are marked as primary', () => {
    const { container } = render(
      atSite(
        <PrimaryContactPanel
          people={people({
            nextOfKin: {
              kind: 'recorded',
              value: person('Helen Adeleke', true),
              recordedBy: staffOkonkwo,
              recordedAt,
            },
            advocate: {
              kind: 'recorded',
              value: person('Daniel Okonjo', true),
              recordedBy: staffOkonkwo,
              recordedAt,
            },
          })}
          residentName="Emmanuel"
        />,
      ),
    )
    expect(container.querySelector('[data-primary-contact="conflict"]')).toBeTruthy()
    expect(screen.getByText(/Helen Adeleke.*Daniel Okonjo/s)).toBeVisible()
  })

  it('reaches the none state with a resident in the fixtures, in the tab', async () => {
    // The property is asserted; the resident is derived, so a regenerated
    // fixture set cannot quietly move it.
    const withNobody = residents.filter(
      (resident) => primaryContactsIn(resident.importantPeople).length === 0,
    )
    expect(
      withNobody.length,
      'no resident has nobody holding the primary contact',
    ).toBeGreaterThan(0)

    const { container } = openPeople(staffAkinyemi.id, withNobody[0]!.id)
    await screen.findByText('Family and next of kin')
    expect(container.querySelector('[data-primary-contact="none"]')).toBeTruthy()
  })
})

describe('the tab within the profile', () => {
  /*
   * The edit act is gone from this tab. Neither role can ever perform it, so
   * the control was telling a care worker about an admin's job on four tabs
   * at once. The rule still lives in the role table and is still tested there.
   */
  it.each([
    ['a care worker', staffEze.id],
    ['a senior carer', staffAkinyemi.id],
  ] as const)(
    'offers %s no edit control, and says nothing about who may',
    async (_who, staffId) => {
      const { container } = openPeople(staffId, 'res-okafor')
      await screen.findByText('Family and next of kin')

      expect(container.querySelector('[data-answer]')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
      for (const reason of editRefusals)
        expect(container.textContent).not.toContain(reason)
    },
  )

  it('draws no control that writes, and no number that dials', async () => {
    const { container } = openPeople(staffEze.id, 'res-okafor')
    await screen.findByText('Family and next of kin')

    expect(screen.queryByRole('button', { name: /primary contact/i })).toBeNull()
    const panel = container.querySelector('[class*="tabPanel"]')!
    expect(panel.querySelector('a[href^="tel:"]')).toBeNull()
    // Nothing at all. Each section card is the whole of its section, so it
    // carries no expand button either (CLAUDE.md §6).
    expect(within(panel as HTMLElement).queryAllByRole('button')).toEqual([])
  })

  it('keeps the subject header mounted alongside it', async () => {
    openPeople(staffEze.id, 'res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByText('Family and next of kin')).toBeVisible()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = openPeople(staffAkinyemi.id, 'res-sowande')
    await screen.findByText('Family and next of kin')
    const panel = container.querySelector('[class*="tabPanel"]')
    expect(panel).toBeTruthy()
    expect(await axe(panel!)).toHaveNoViolations()
  }, 30000)
})
