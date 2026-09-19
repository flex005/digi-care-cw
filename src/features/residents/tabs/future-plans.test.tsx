import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { axe } from 'vitest-axe'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { CARE_ACTS } from '@/app/session/capabilities'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { renderProfileTab } from '@/test/render-signed-in'
import { FuturePlansTab, PlanSections } from './FuturePlansTab'
import { FUTURE_PLANS_SECTIONS, FUTURE_PLAN_ENTRIES } from './future-plans-sections'

/**
 * Future Plans, read-only.
 *
 * The resuscitation decision has three states and the third is rendered
 * loudly: a missing decision must never read as either answer. Every other
 * entry is signed, dated and versioned, and nothing on the tab changes one.
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

function openPlans(staffId: (typeof staffEze)['id'], residentId: string) {
  navigation.pathname = `/residents/${residentId}/future-plans`
  navigation.params = { residentId }
  return renderProfileTab(staffId, <FuturePlansTab />)
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

describe('every entry is declared, and none can go missing', () => {
  it('covers all eight members of FuturePlans', () => {
    // Seven rows plus the resuscitation decision, which is the banner.
    expect(FUTURE_PLAN_ENTRIES).toHaveLength(7)
    expect(FUTURE_PLANS_SECTIONS).toHaveLength(3)
    expect(
      FUTURE_PLANS_SECTIONS.filter((section) => section.banner !== undefined),
    ).toHaveLength(1)
    const ids = FUTURE_PLAN_ENTRIES.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps any section description in words, never as a count of its own rows', () => {
    for (const section of FUTURE_PLANS_SECTIONS) {
      if (section.description === undefined) continue
      expect(
        section.description.trim(),
        `${section.title} has an empty description`,
      ).not.toBe('')
      expect(section.description).not.toMatch(/^\d+ /)
    }
  })

  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s: every entry renders something, and so does the decision',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<PlanSections resident={resident} />),
      )
      for (const entry of FUTURE_PLAN_ENTRIES) {
        const cell = container.querySelector(`[data-field="${entry.id}"]`)
        expect(cell, `${name}: "${entry.id}" is missing`).toBeTruthy()
        const text = cell?.querySelector('dd')?.textContent?.trim()
        expect(text, `${name}: "${entry.label}" rendered an empty row`).not.toBe('')
        expect(text, `${name}: "${entry.label}" rendered a dash`).not.toBe('—')
        if (entry.isUnrecorded(resident.futurePlans))
          expect(
            cell?.querySelector('[data-unrecorded-detail]')?.textContent?.trim(),
          ).toBeTruthy()
      }
      expect(
        container.querySelector(
          `[data-resuscitation="${resident.futurePlans.resuscitation.kind}"]`,
        ),
      ).toBeTruthy()
      unmount()
    },
  )
})

describe('the resuscitation decision', () => {
  it('renders a DNAR as a signed decision, not as good or bad news', async () => {
    const { container } = openPlans(staffEze.id, 'res-okafor')
    await screen.findByText('In an emergency')
    const panel = container.querySelector('[data-resuscitation="dnar_in_place"]')
    expect(panel).toBeTruthy()
    expect(panel?.textContent).toMatch(/DNAR in place/)
    expect(panel?.textContent).toMatch(/Do not attempt cardiopulmonary resuscitation/)
    // A DNAR's signatory is a clinician, not a member of staff in this system.
    expect(panel?.textContent).toMatch(/Signed by Dr.+, \d{2}\/\d{2}\/\d{4}/)
  })

  it('renders "for resuscitation" as a decision somebody recorded', async () => {
    const { container } = openPlans(staffEze.id, 'res-adeyemi')
    await screen.findByText('In an emergency')
    const panel = container.querySelector('[data-resuscitation="for_resuscitation"]')
    expect(panel).toBeTruthy()
    expect(panel?.textContent).toMatch(/For resuscitation/)
    expect(panel?.textContent).toMatch(/CPR is to be attempted/)
    expect(panel?.textContent).toMatch(/Recorded by .+, \d{2}\/\d{2}\/\d{4}/)
  })

  it('hatches an absent decision and says what happens without one', async () => {
    const { container } = openPlans(staffEze.id, 'res-pemberton')
    await screen.findByText('In an emergency')
    const panel = container.querySelector('[data-resuscitation="no_decision_recorded"]')
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(panel?.textContent).toMatch(/In the absence of a decision CPR is attempted/i)
  })
})

describe('every entry is date-stamped, signed and version-controlled', () => {
  it('shows all three on a recorded entry', () => {
    const withPlan = residents.find(
      (resident) => resident.futurePlans.advanceCarePlan.kind === 'recorded',
    )
    expect(
      withPlan,
      'no resident in the fixtures has an advance care plan',
    ).toBeDefined()
    const { container } = render(atSite(<PlanSections resident={withPlan!} />))
    const cell = container.querySelector('[data-field="advance-care-plan"]')
    expect(cell?.textContent).toMatch(/Signed by .+, \d{2}\/\d{2}\/\d{4} · version \d+/)
  })
})

describe('the tab within the profile', () => {
  /*
   * The edit act is gone from this tab, as from the other three. A resuscitation
   * decision is signed by a clinician and a plan is a manager's to change, so
   * the control was never one a reader of this screen could use.
   */
  it.each([
    ['a care worker', staffEze.id],
    ['a senior carer', staffAkinyemi.id],
  ] as const)(
    'offers %s no edit control, and says nothing about who may',
    async (_who, staffId) => {
      const { container } = openPlans(staffId, 'res-okafor')
      await screen.findByText('In an emergency')

      expect(container.querySelector('[data-answer]')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
      for (const reason of editRefusals)
        expect(container.textContent).not.toContain(reason)
    },
  )

  it('draws no control that changes a decision', async () => {
    const { container } = openPlans(staffEze.id, 'res-okafor')
    await screen.findByText('In an emergency')

    const panel = container.querySelector('[class*="tabPanel"]') as HTMLElement
    // Nothing at all. Each section card is the whole of its section, so it
    // carries no expand button either (CLAUDE.md §6).
    expect(within(panel).queryAllByRole('button')).toEqual([])
  })

  it('keeps the subject header mounted alongside it', async () => {
    openPlans(staffEze.id, 'res-hutchinson')
    expect(await screen.findByRole('heading', { name: 'Beryl' })).toBeVisible()
    expect(screen.getByText('In an emergency')).toBeVisible()
  })

  it('has no detectable accessibility violations', async () => {
    const { container } = openPlans(staffEze.id, 'res-pemberton')
    await screen.findByText('In an emergency')
    const panel = container.querySelector('[class*="tabPanel"]')
    expect(panel).toBeTruthy()
    expect(await axe(panel!)).toHaveNoViolations()
  }, 30000)
})
