import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import type { StaffId } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { CARE_ACTS } from '@/app/session/capabilities'
import { renderProfileTab } from '@/test/render-signed-in'
import { NeedsTab } from './NeedsTab'
import { NEEDS_SECTIONS, RENDERED_DOMAIN_IDS } from './needs-sections'

/**
 * The Needs tab, read-only.
 *
 * The failure this screen is most exposed to is not a blank cell, it is a
 * missing row. A Needs tab showing only the domains somebody got round to
 * writing reads as a complete picture of a person's needs, and nothing on the
 * screen says otherwise.
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

/** Open the tab for a resident, signed in as a named person. */
async function openNeeds(staffId: StaffId, residentId: string) {
  navigation.pathname = `/residents/${residentId}/needs`
  navigation.params = { residentId }
  const view = renderProfileTab(staffId, <NeedsTab />)
  const intro = await screen.findByText(/Generated from the care plan/)
  const tab = intro.closest('[data-tab-panel="needs"]')
  if (!(tab instanceof HTMLElement)) throw new Error('the tab panel did not render')
  return { ...view, tab }
}

function rowOf(tab: HTMLElement, domainId: string): HTMLElement {
  const row = tab.querySelector(`[data-domain="${domainId}"]`)
  if (!(row instanceof HTMLElement)) throw new Error(`${domainId} is not on the tab`)
  return row
}

/** The refusal lines the role table holds for writing a care plan, read without naming a role. */
const carePlanRefusals = Object.values(CARE_ACTS.write_care_plan).flatMap((cell) =>
  typeof cell === 'object' && 'kind' in cell && cell.kind === 'may_not'
    ? [cell.reason]
    : [],
)

describe('every care plan domain is on the screen', () => {
  /**
   * The five need groups claim only nine of the ten domains: `end_of_life`
   * belongs to none of them. Rendering the five alone would drop a domain
   * silently, so the leftovers are computed and rendered rather than hardcoded.
   */
  it('renders every domain exactly once across all sections', () => {
    const all = CARE_PLAN_DOMAINS.map((domain) => domain.id).sort()
    expect([...RENDERED_DOMAIN_IDS].sort()).toEqual(all)
    expect(new Set(RENDERED_DOMAIN_IDS).size).toBe(RENDERED_DOMAIN_IDS.length)
  })

  it('keeps the five groups, and adds a section only for leftovers', () => {
    expect(NEEDS_SECTIONS.length).toBeGreaterThanOrEqual(5)
    expect(NEEDS_SECTIONS.length).toBeLessThanOrEqual(6)
    const other = NEEDS_SECTIONS.find((section) => section.id === 'other')
    expect(other?.domainIds).toContain('end_of_life')
    // The catch-all explains itself rather than appearing unlabelled.
    expect(other?.description).toMatch(/Future Plans/)
  })

  it('keeps any section description in words, never as a count of its own rows', () => {
    for (const section of NEEDS_SECTIONS) {
      if (section.description === undefined) continue
      expect(section.description.trim(), `${section.name} is empty`).not.toBe('')
      expect(section.description, `${section.name} is a bare count`).not.toMatch(
        /^\d+ /,
      )
    }
  })

  it.each(residents.map((resident) => [resident.fullLegalName, resident.id] as const))(
    '%s: all ten domains rendered',
    async (name, id) => {
      const { tab, unmount } = await openNeeds(staffAkinyemi.id, id)
      for (const domain of CARE_PLAN_DOMAINS) {
        const row = tab.querySelector(`[data-domain="${domain.id}"]`)
        expect(
          row,
          `${name}: ${domain.name} is missing from the Needs tab`,
        ).toBeTruthy()
        expect(row?.textContent).toContain(domain.name)
      }
      unmount()
    },
    20000,
  )
})

describe('a domain with no content says so', () => {
  it('hatches an unwritten domain rather than showing an empty summary', async () => {
    // Ismail Sowande, admitted yesterday: every domain not_started.
    const { tab } = await openNeeds(staffAkinyemi.id, 'res-sowande')
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = rowOf(tab, domain.id)
      expect(
        row.querySelector('[data-state="unrecorded"]'),
        `${domain.name} has no content but did not render the hatch`,
      ).toBeTruthy()
      expect(row.textContent).toMatch(/No care plan content/)
    }
  })

  it('gives support level its own labelled answer on every domain', async () => {
    const { tab } = await openNeeds(staffEze.id, 'res-okafor')
    for (const domain of CARE_PLAN_DOMAINS) {
      const row = rowOf(tab, domain.id)
      const labels = [...row.querySelectorAll('dt')].map((term) => term.textContent)
      expect(labels, `${domain.name} has no support level`).toContain('Support level')
    }
  })

  it('never lets "not assessed" and "Independent" look alike', async () => {
    const { tab } = await openNeeds(staffAkinyemi.id, 'res-sowande')
    const row = rowOf(tab, 'mobility')
    expect(row.textContent).toMatch(/Support level not assessed/)
    expect(row.textContent).not.toMatch(/Independent/)
  })
})

describe('the Stale state', () => {
  it('shows a domain past its review date as overdue, with how long', async () => {
    // Grace Adeyemi's mobility domain was finalised long ago and never
    // reviewed. Unlike General Information, this tab has a real Stale state,
    // because domains carry review dates.
    const { tab } = await openNeeds(staffEze.id, 'res-adeyemi')
    const row = rowOf(tab, 'mobility')
    expect(row.textContent).toMatch(/Review due/)
    // How long, in whatever unit reads best: a bare "Review due" fails this.
    expect(row.textContent).toMatch(/\b\d+ (day|week|month|year)s? overdue/)
  })
})

describe('a revision in progress', () => {
  const revised = residents.flatMap((resident) =>
    resident.carePlan
      .filter(
        (domain) =>
          domain.versions.kind === 'finalised' && domain.draft.kind === 'draft',
      )
      .map((domain) => ({ resident, domain })),
  )[0]

  it('says a revision is being written, quietly and without a treatment', async () => {
    if (revised === undefined)
      throw new Error('no resident has a signed domain with a draft')
    if (revised.domain.draft.kind !== 'draft') throw new Error('expected a draft')
    const { tab } = await openNeeds(staffAkinyemi.id, revised.resident.id)

    const line = rowOf(tab, revised.domain.domainId).querySelector('[data-revision]')
    expect(line?.textContent).toMatch(/revision is in progress, not yet signed/)
    expect(line?.textContent).toContain(revised.domain.draft.updatedBy.displayName)
    // Quiet: plain text, no pill, no hatch.
    expect(line?.tagName).toBe('P')
    expect(line?.querySelector('[data-state]')).toBeNull()
  })

  it('does not move the status: only a signature does that', async () => {
    if (revised === undefined)
      throw new Error('no resident has a signed domain with a draft')
    const { tab } = await openNeeds(staffAkinyemi.id, revised.resident.id)

    const row = rowOf(tab, revised.domain.domainId)
    expect(revised.domain.status.kind).toBe('complete')
    expect(row.textContent).toMatch(/Complete/)
    expect(row.textContent).not.toMatch(/In progress/)
    expect(row.textContent).not.toMatch(/Not started/)
  })

  it('says nothing extra where the draft is the only thing there', async () => {
    const partWritten = residents.flatMap((resident) =>
      resident.carePlan
        .filter((domain) => domain.status.kind === 'in_progress')
        .map((domain) => ({ resident, domain })),
    )[0]
    if (partWritten === undefined) throw new Error('no domain is in progress')
    const { tab } = await openNeeds(staffAkinyemi.id, partWritten.resident.id)

    const row = rowOf(tab, partWritten.domain.domainId)
    expect(row.textContent).toMatch(/In progress/)
    expect(row.querySelector('[data-revision]')).toBeNull()
  })
})

/*
 * **Read-only, and it no longer names whose job the writing is.** A manager
 * writes and finalises the care plan, which is true of both roles that sign in
 * here, so the disabled "Edit care plan" was an act neither reader could ever
 * perform. The rule is still in the role table and still tested there.
 */
describe('read-only, with nothing on it that writes', () => {
  it.each([
    ['a care worker, Eze', staffEze.id],
    ['a senior carer, Akinyemi', staffAkinyemi.id],
  ] as const)(
    'offers %s no care plan act and no refusal about it',
    async (_who, staffId) => {
      const { tab } = await openNeeds(staffId, 'res-hutchinson')

      expect(within(tab).queryByRole('button', { name: 'Edit care plan' })).toBeNull()
      expect(tab.querySelectorAll('[data-act-line]')).toHaveLength(0)
      expect(carePlanRefusals.length).toBeGreaterThan(0)
      for (const reason of carePlanRefusals)
        expect(tab.textContent).not.toContain(reason)
    },
  )

  it('offers no per-domain writing, and opens the Care Plan tab from each section', async () => {
    const { tab } = await openNeeds(staffAkinyemi.id, 'res-sowande')
    expect(within(tab).queryByRole('link', { name: /write/i })).toBeNull()

    const opens = tab.querySelectorAll('a[aria-label^="Open "]')
    expect(opens).toHaveLength(NEEDS_SECTIONS.length)
    for (const link of opens)
      expect(link).toHaveAttribute('href', '/residents/res-sowande/care-plan')
  })

  it('has no detectable accessibility violations', async () => {
    const { tab } = await openNeeds(staffEze.id, 'res-adeyemi')
    const results = await axe(tab)
    expect(results).toHaveNoViolations()
  }, 30000)
})
