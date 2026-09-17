import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import type { AnyConsent, Resident, StaffRef } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { memberById } from '@/data/access/team-store'
import { resetSessionSiteConfig, setActive } from '@/data/access/site-config-store'
import { answerFor } from '@/app/session/capabilities'
import { residentScopeFor } from '@/app/session/resident-scope'
import { signInRoleOf } from '@/app/session/roles'
import { consentGaps } from '@/features/residents/profile/record-gaps'
import { renderProfileTab } from '@/test/render-signed-in'
import { ConsentTab } from './ConsentTab'
import { CONSENT_MEANS } from './consent-meaning'

/**
 * The Consent tab, read-only.
 *
 * **The module's hazard is that a signature looks like consent.** So each type
 * says in plain English what it permits, the outcome and who decided it are two
 * columns, and a consent nobody sought is hatched in both.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/consent',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

afterEach(() => resetSessionSiteConfig())

function openAs(staff: StaffRef, resident: Resident) {
  navigation.pathname = `/residents/${resident.id}/consent`
  navigation.params = { residentId: resident.id }
  return renderProfileTab(staff.id, <ConsentTab />)
}

const panelOf = (container: HTMLElement) =>
  waitFor(() => {
    const panel = container.querySelector<HTMLElement>('[data-consent-panel]')
    expect(panel).toBeTruthy()
    return panel!
  })

const byId = (id: string) => residents.find((entry) => entry.id === id)!
const okafor = byId('res-okafor')
const brennan = byId('res-brennan')
const withNeverSought = residents.find((entry) =>
  CONSENT_TYPES.some((type) => entry.consents[type.id].kind === 'not_sought'),
)!

describe('every consent type is listed', () => {
  it('renders one row per type, from the constant', async () => {
    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    const rendered = [...panel.querySelectorAll('[data-consent]')].map((row) =>
      row.getAttribute('data-consent'),
    )
    expect(rendered).toEqual(CONSENT_TYPES.map((type) => type.id))
  })

  it('says in plain English what consenting to each one permits', async () => {
    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    for (const type of CONSENT_TYPES) {
      const row = panel.querySelector(`[data-consent="${type.id}"]`)
      expect(row?.querySelector('[data-means]')?.textContent, type.id).toBe(
        CONSENT_MEANS[type.id],
      )
    }
  })

  it('offers no per-row control: nothing on this tab records', async () => {
    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    for (const row of panel.querySelectorAll<HTMLElement>('[data-consent]')) {
      expect(within(row).queryByRole('link')).toBeNull()
      expect(within(row).queryByRole('button')).toBeNull()
    }
  })
})

describe('the lead figure is the tab name’s figure', () => {
  it('states consentGaps, numerator and denominator', async () => {
    const gaps = consentGaps(withNeverSought)
    expect(gaps.neverSought).toBeGreaterThan(0)

    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    const lead = panel.querySelector('[data-never-sought]')!
    expect(lead.getAttribute('data-never-sought')).toBe(String(gaps.neverSought))
    expect(lead.getAttribute('data-asked')).toBe(String(gaps.asked))
    expect(lead.textContent).toContain(`of ${gaps.asked} consents`)
    expect(lead.textContent).toMatch(/never been sought/)
    // A gap counted, so the hatch.
    expect(lead.querySelector('[data-state="unrecorded"]')).toBeTruthy()

    // And the tab's name says the same thing, because it reads the same function.
    const tab = container.querySelector('[data-tab="consent"]')!
    expect(tab.textContent).toContain(
      `${gaps.neverSought} of ${gaps.asked} never sought`,
    )
  })

  it('counts over what the home asks, and says what it left out', async () => {
    const type = CONSENT_TYPES.find(
      (entry) => withNeverSought.consents[entry.id].kind === 'not_sought',
    )!
    setActive(withNeverSought.siteId, type.id, false)
    const gaps = consentGaps(withNeverSought)
    expect(gaps.asked).toBe(CONSENT_TYPES.length - 1)

    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    expect(panel.querySelector('[data-never-sought]')?.getAttribute('data-asked')).toBe(
      String(gaps.asked),
    )
    expect(panel.querySelector('[data-not-asked-note]')).toBeTruthy()

    // Still listed, and plain: the home decided there is nothing to ask.
    const row = panel.querySelector(`[data-consent="${type.id}"]`)!
    expect(row.getAttribute('data-configured')).toBe('retired_unanswered')
    expect(row.querySelector('[data-not-asked]')).toBeTruthy()
    expect(row.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('what was decided, and who decided it', () => {
  it('gives a never-sought consent the hatch in both columns', async () => {
    const type = CONSENT_TYPES.find(
      (entry) => withNeverSought.consents[entry.id].kind === 'not_sought',
    )!
    const { container } = openAs(staffAkinyemi, withNeverSought)
    const panel = await panelOf(container)

    const row = panel.querySelector(`[data-consent="${type.id}"]`)!
    expect(
      row.querySelector('[data-outcome="not_sought"] [data-state="unrecorded"]'),
    ).toBeTruthy()
    expect(
      row.querySelector('[data-authority="none"] [data-state="unrecorded"]'),
    ).toBeTruthy()
    expect(row.textContent).toMatch(/Nobody has decided/)
  })

  it('renders a withdrawal as a decision, with the authority and who recorded it', async () => {
    const status = brennan.consents.photography as AnyConsent
    expect(status.kind).toBe('withdrawn')
    if (status.kind !== 'withdrawn') return

    const { container } = openAs(staffAkinyemi, brennan)
    const panel = await panelOf(container)

    const row = panel.querySelector('[data-consent="photography"]')!
    expect(row.querySelector('[data-outcome="withdrawn"]')).toBeTruthy()
    expect(
      row.querySelector('[data-outcome="withdrawn"] [data-state="unrecorded"]'),
    ).toBeNull()
    const authority = row.querySelector('[data-authority="the_resident"]')!
    expect(authority.textContent).toMatch(/Capacity assessed/)
    expect(authority.querySelector('[data-recorded-by]')?.textContent).toContain(
      status.recordedBy.displayName,
    )
  })

  it('does not give a refusal a failure treatment', async () => {
    const subject = residents.find((entry) =>
      CONSENT_TYPES.some((type) => entry.consents[type.id].kind === 'refused'),
    )!
    const type = CONSENT_TYPES.find(
      (entry) => subject.consents[entry.id].kind === 'refused',
    )!

    const { container } = openAs(staffAkinyemi, subject)
    const panel = await panelOf(container)

    const outcome = panel.querySelector(
      `[data-consent="${type.id}"] [data-outcome="refused"]`,
    )!
    expect(outcome.textContent).toMatch(/Refused/)
    expect(outcome.querySelector('[data-tone="critical"]')).toBeNull()
    expect(outcome.querySelector('[data-tone="caution"]')).toBeNull()
    expect(outcome.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('the withdrawal that did not undo what it could not', () => {
  it('renders every effect from the record, and an uncounted one as a gap', async () => {
    const status = brennan.consents.photography as AnyConsent
    if (status.kind !== 'withdrawn') throw new Error('needs the pinned withdrawal')

    const { container } = openAs(staffAkinyemi, brennan)
    const panel = await panelOf(container)

    const remains = panel.querySelector('[data-consent="photography"] [data-remains]')!
    for (const effect of status.remains) {
      expect(
        remains.querySelector(`[data-effect="${effect.name}"]`),
        effect.name,
      ).toBeTruthy()
    }
    const uncounted = remains.querySelector('[data-count="not_counted"]')!
    expect(uncounted.textContent).toMatch(/Not counted/)
    expect(uncounted.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // The list itself is counted facts, not a gap.
    expect(remains.getAttribute('data-state')).toBeNull()
  })
})

describe('recording a decision is the senior carer’s act', () => {
  const answerOf = (staff: StaffRef, resident: Resident) => {
    const member = memberById(staff.id)!
    return answerFor(signInRoleOf(member), residentScopeFor(member), 'record_consent', {
      kind: 'resident',
      id: resident.id,
    })
  }

  it('is live for Akinyemi, and says it is not built', async () => {
    expect(answerOf(staffAkinyemi, okafor).kind).toBe('yes')

    const { container } = openAs(staffAkinyemi, okafor)
    const panel = await panelOf(container)

    const button = within(panel).getByRole('button', {
      name: 'Record a consent decision',
    })
    expect(button).toBeEnabled()
    expect(panel.querySelector('[data-act-line="not_built"]')?.textContent).toBe(
      'Recording consent is built in Phase 8, senior carer records.',
    )
  })

  it('is unavailable to Eze, with the role table’s reason', async () => {
    const answer = answerOf(staffEze, okafor)
    if (answer.kind !== 'not_your_role') throw new Error('expected a refusal by role')

    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const button = within(panel).getByRole('button', {
      name: 'Record a consent decision',
    })
    expect(button).toBeDisabled()
    expect(panel.querySelector('[data-act-line="refused"]')?.textContent).toBe(
      answer.reason,
    )
  })
})

describe('accessibility', () => {
  it('has no violations on the consent tab', async () => {
    const { container } = openAs(staffAkinyemi, brennan)
    await panelOf(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 20000)
})
