import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import type { CarePlanDomainRecord, IsoDate, IsoDateTime, Resident } from '@/data/types'
import { CARE_PLAN_DOMAINS, subjectResidentId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { incidents } from '@/data/fixtures/incidents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { now } from '@/data/fixtures/clock'
import { resetSessionReviewFlags } from '@/data/access/review-flag-store'
import { dueSoonDays } from '@/data/access/settings-store'
import { wholeDaysBetween } from '@/lib/review-interval'
import { CARE_ACTS, signInRoleOf } from '@/app/session/capabilities'
import { memberById } from '@/data/access/team-store'
import { renderProfileTab } from '@/test/render-signed-in'
import { resetSessionSiteConfig, setActive } from '@/data/access/site-config-store'
import { carePlanGaps } from '@/features/residents/profile/record-gaps'
import { CarePlanTab } from './CarePlanTab'
import { currentVersion } from './plan-fields'

/**
 * A resident's care plan, read-only.
 *
 * **A plan is a document people believe.** Staff follow what it says, so every
 * way of making it look more complete than it is costs somebody something. Most
 * of what is under test is that every domain stays on the list, that a draft
 * never reads as the plan, and that nobody is offered a way to write it here.
 */

/** The person as the team holds them, so the role table is asked by person. */
function memberOf(id: string) {
  const member = memberById(id)
  if (member === undefined) throw new Error(`No team member ${id}`)
  return member
}

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => {
  resetSessionReviewFlags()
  resetSessionSiteConfig()
})

const NOW_ISO = now().toISOString() as IsoDateTime

async function openTab(staffId: typeof staffEze.id, resident: Resident) {
  navigation.params = { residentId: resident.id }
  navigation.pathname = `/residents/${resident.id}/care-plan`
  const { container } = renderProfileTab(staffId, <CarePlanTab />, resident.siteId)
  await waitFor(() => {
    expect(container.querySelector('[data-tab-body="care-plan"]')).toBeTruthy()
    expect(container.textContent).not.toMatch(/Checking post-incident reviews/)
  })
  return container.querySelector('[data-tab-body="care-plan"]') as HTMLElement
}

/* ---------------------------------------------------------------- subjects */

const allDomains = residents.flatMap((resident) =>
  resident.carePlan.map((record) => ({ resident, record })),
)

function find(
  predicate: (entry: { resident: Resident; record: CarePlanDomainRecord }) => boolean,
  what: string,
) {
  const entry = allDomains.find(predicate)
  if (!entry) throw new Error(`No fixture reaches ${what}`)
  return entry
}

const nothingWritten = (() => {
  const resident = residents.find((entry) =>
    entry.carePlan.every((record) => record.status.kind === 'not_started'),
  )
  if (!resident) throw new Error('No fixture resident has nothing written')
  return resident
})()

const partWritten = find(
  ({ record }) => record.status.kind === 'in_progress',
  'a part-written domain with nothing signed',
)

const overdue = find(
  ({ record }) => record.status.kind === 'review_due',
  'a domain past its review date',
)

const dueSoon = find(({ record }) => {
  if (record.status.kind !== 'complete') return false
  const days = wholeDaysBetween(
    NOW_ISO.slice(0, 10) as IsoDate,
    record.status.nextReviewOn,
  )
  return days <= dueSoonDays()
}, 'a domain approaching its review date')

const signed = find(
  ({ record }) =>
    record.versions.kind === 'finalised' && record.status.kind === 'complete',
  'a signed domain in date',
)

const owesReview = (() => {
  for (const incident of incidents) {
    const residentId = subjectResidentId(incident)
    if (residentId === 'none') continue
    for (const flag of incident.reviewFlags) {
      if (flag.state.kind !== 'awaiting' || flag.target.kind !== 'care_plan_domain')
        continue
      const resident = residents.find((entry) => entry.id === residentId)
      if (resident) return { resident, incident }
    }
  }
  throw new Error('No fixture reaches a care plan owing a post-incident review')
})()

const rowOf = (tab: HTMLElement, domainId: string) =>
  tab.querySelector(`[data-domain="${domainId}"]`) as HTMLElement

/* -------------------------------------------------------------- the list */

describe('the domain list', () => {
  it('renders every domain, from the constant and not from the record', async () => {
    const tab = await openTab(staffAkinyemi.id, nothingWritten)
    expect(tab.querySelectorAll('[data-domain]')).toHaveLength(CARE_PLAN_DOMAINS.length)
    for (const domain of CARE_PLAN_DOMAINS) {
      expect(rowOf(tab, domain.id)?.textContent, domain.id).toContain(domain.name)
    }
  })

  it('leads with the count of what was never written, carrying its denominator', async () => {
    const tab = await openTab(staffAkinyemi.id, nothingWritten)
    const lead = tab.querySelector('[data-never-written]')
    // Counted here rather than read from the screen's own derivation.
    const expected = nothingWritten.carePlan.filter(
      (record) => record.status.kind === 'not_started',
    ).length
    expect(expected).toBeGreaterThan(0)
    expect(lead?.getAttribute('data-never-written')).toBe(String(expected))
    expect(lead?.textContent).toMatch(
      new RegExp(`of\\s*${CARE_PLAN_DOMAINS.length} parts`),
    )
    expect(lead?.textContent).toMatch(/never been written down/)
  })

  it('gives never written the hatch and the PRD’s note, and no quote', async () => {
    const tab = await openTab(staffAkinyemi.id, nothingWritten)
    const row = rowOf(tab, CARE_PLAN_DOMAINS[0].id)
    expect(
      row.querySelector('[data-state-cell] [data-state="unrecorded"]')?.textContent,
    ).toMatch(/Never written/)
    expect(row.querySelector('[data-state-chip]')).toBeNull()
    expect(row.querySelector('[data-quote]')).toBeNull()
    expect(row.querySelector('[data-not-written-note]')?.textContent).toBe(
      'This section of the care plan has not been written yet. Contact your manager.',
    )
  })

  it('puts the resident’s own words from the signed version under the domain name', async () => {
    const { resident, record } = signed
    const version = currentVersion(record)
    if (version === 'none') throw new Error('expected a signed version')

    const tab = await openTab(staffAkinyemi.id, resident)
    const row = rowOf(tab, record.domainId)
    expect(row.querySelector('[data-quote]')?.textContent).toContain(
      version.currentNeeds,
    )
    expect(row.querySelector('[data-settled], [data-due-soon]')?.textContent).toContain(
      version.finalisedBy.displayName,
    )
  })

  it('always states the support level, hatched where nobody has assessed it', async () => {
    const tab = await openTab(staffAkinyemi.id, nothingWritten)
    for (const domain of CARE_PLAN_DOMAINS) {
      expect(rowOf(tab, domain.id).textContent, domain.id).toMatch(
        /Support level not assessed/,
      )
    }
  })

  it('gives due soon no chip at all, only its date', async () => {
    const { resident, record } = dueSoon
    const tab = await openTab(staffAkinyemi.id, resident)
    const row = rowOf(tab, record.domainId)
    expect(row.querySelector('[data-due-soon]')).toBeTruthy()
    expect(row.querySelector('[data-state-chip]')).toBeNull()
    expect(row.textContent).toMatch(/review due/)
  })

  it('gives overdue a chip naming when it was last signed and by whom', async () => {
    const { resident, record } = overdue
    if (record.status.kind !== 'review_due')
      throw new Error('expected an overdue domain')
    const tab = await openTab(staffAkinyemi.id, resident)
    const chip = rowOf(tab, record.domainId).querySelector('[data-state-chip]')
    expect(chip?.textContent).toMatch(/Review overdue/)
    expect(chip?.textContent).toMatch(/last signed/)
    expect(chip?.textContent).toContain(record.status.finalisedBy.displayName)
  })

  it('says a part-written domain is not signed, without calling it written or a gap', async () => {
    const { resident, record } = partWritten
    const tab = await openTab(staffAkinyemi.id, resident)
    const row = rowOf(tab, record.domainId)
    expect(row.textContent).toMatch(/Draft in progress/)
    expect(row.textContent).toMatch(/not signed/)
    expect(row.textContent).not.toMatch(/Version/)
    expect(row.textContent).not.toMatch(/Never written/)
  })
})

/* ------------------------------------------------------------ read-only */

describe('counted over what the home keeps', () => {
  it('leaves a domain the home stopped keeping out of the count, and draws it plain', async () => {
    const resident = residents.find((entry) =>
      entry.carePlan.some((domain) => domain.status.kind === 'not_started'),
    )!
    const unwritten = resident.carePlan.find(
      (domain) => domain.status.kind === 'not_started',
    )!
    const before = carePlanGaps(resident)
    setActive(resident.siteId, unwritten.domainId, false)
    const after = carePlanGaps(resident)
    expect(after).toMatchObject({
      asked: before.asked - 1,
      neverWritten: before.neverWritten - 1,
    })

    const tab = await openTab(staffAkinyemi.id, resident)
    const lead = tab.querySelector('[data-never-written]') as HTMLElement
    expect(lead.getAttribute('data-never-written')).toBe(String(after.neverWritten))
    expect(lead.textContent).toContain(`of ${after.asked} parts`)
    const row = tab.querySelector(
      `[data-domain="${unwritten.domainId}"]`,
    ) as HTMLElement
    expect(row.querySelector('[data-not-kept]')).not.toBeNull()
    expect(row.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(row.textContent).not.toMatch(/Contact your manager/)
    expect(tab.querySelector('[data-retired-note]')).not.toBeNull()
  })
})

describe('read, not written', () => {
  it('opens a draft to be read, and says it is not what staff follow', async () => {
    const { resident, record } = partWritten
    if (record.draft.kind !== 'draft') throw new Error('expected a draft')
    const user = userEvent.setup()
    const tab = await openTab(staffAkinyemi.id, resident)
    const row = rowOf(tab, record.domainId)

    const name = CARE_PLAN_DOMAINS.find((domain) => domain.id === record.domainId)!.name
    await user.click(within(row).getByRole('button', { name: `Read ${name}` }))

    const reading = row.querySelector('[data-draft-reading]')
    expect(reading?.textContent).toMatch(/Draft, not signed/)
    expect(reading?.textContent).toMatch(/Not what staff follow/)
    expect(reading?.textContent).toContain(record.draft.currentNeeds)
    expect(row.querySelector('[data-signed-version]')).toBeNull()
    // Nothing in it can be typed into.
    expect(
      row.querySelectorAll('input, textarea, [contenteditable="true"]'),
    ).toHaveLength(0)
  })

  it('offers no link or control on any row beyond opening it to read', async () => {
    const tab = await openTab(staffAkinyemi.id, overdue.resident)
    for (const row of tab.querySelectorAll('[data-domain]')) {
      expect(row.querySelectorAll('a, input, textarea')).toHaveLength(0)
      for (const button of row.querySelectorAll('button')) {
        expect(button.textContent).toMatch(/^Read /)
      }
    }
  })

  it('refuses editing to both roles, with the role table’s reason', async () => {
    for (const staff of [staffEze, staffAkinyemi]) {
      const grant = CARE_ACTS.write_care_plan[signInRoleOf(memberOf(staff.id))]
      if (grant.kind !== 'may_not')
        throw new Error('expected the table to refuse this person')

      // On the care worker's list, so the refusal is the role's and not scope's.
      const resident = residents.find((entry) => entry.id === 'res-adeyemi')!
      const tab = await openTab(staff.id, resident)
      expect(within(tab).getByRole('button', { name: 'Edit care plan' })).toBeDisabled()
      expect(tab.querySelector('[data-act-line="refused"]')?.textContent).toBe(
        grant.reason,
      )
      cleanup()
    }
  })
})

/* ------------------------------------------------------------ owed reviews */

describe('what the plan owes', () => {
  it('says the plan owes a post-incident review, naming the incident', async () => {
    const { resident, incident } = owesReview
    const tab = await openTab(staffAkinyemi.id, resident)
    const owed = tab.querySelector('[data-owed]')
    expect(owed?.textContent).toMatch(/owes (a )?post-incident review/)
    expect(tab.querySelector(`[data-owed-incident="${incident.id}"]`)).toBeTruthy()
  })
})

describe('accessibility', () => {
  it('has no violations on the domain list', async () => {
    const tab = await openTab(staffAkinyemi.id, overdue.resident)
    expect((await axe(tab)).violations).toEqual([])
  }, 60000)
})
