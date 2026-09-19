import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { axe } from 'vitest-axe'
import type { StaffId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { CARE_ACTS } from '@/app/session/capabilities'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { renderProfileTab } from '@/test/render-signed-in'
import { GeneralInformationTab, ProfileSections } from './GeneralInformationTab'
import {
  GENERAL_INFORMATION_FIELDS,
  GENERAL_INFORMATION_SECTIONS,
} from './general-information-fields'

/**
 * General Information, read-only.
 *
 * The rule under test is not that the fields render; it is that **none of them
 * can be an empty row**. "—" is the most common way a care record turns "nobody
 * asked" into "nothing to report", and this tab has twenty chances to do it.
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
async function openGeneral(staffId: StaffId, residentId: string) {
  navigation.pathname = `/residents/${residentId}`
  navigation.params = { residentId }
  const view = renderProfileTab(staffId, <GeneralInformationTab />)
  const panel = await screen.findByText('Identity')
  const tab = panel.closest('[data-tab-panel="general"]')
  if (!(tab instanceof HTMLElement)) throw new Error('the tab panel did not render')
  return { ...view, tab }
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

describe('every field is declared, and none can go missing', () => {
  it('covers every profile item, split where one item bundles two facts', () => {
    // Several items bundle two facts ("Full legal name and preferred name"),
    // so the rendered count is higher than sixteen. Fewer would mean something
    // was dropped.
    expect(GENERAL_INFORMATION_FIELDS.length).toBeGreaterThanOrEqual(16)
    expect(GENERAL_INFORMATION_SECTIONS).toHaveLength(5)
  })

  it('gives every field a unique id', () => {
    const ids = GENERAL_INFORMATION_FIELDS.map((field) => field.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps any section description in words, never as a bare count', () => {
    const described = GENERAL_INFORMATION_SECTIONS.filter(
      (section) => section.description !== undefined,
    )
    expect(described.length).toBeGreaterThan(0)
    for (const section of described) {
      expect(section.description?.trim(), `${section.title} is empty`).not.toBe('')
      expect(section.description, `${section.title} is a bare count`).not.toMatch(
        /^\d+ /,
      )
    }
  })

  it('gives the two paragraph-length fields the full row', () => {
    const full = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.width === 'full',
    ).map((field) => field.id)
    expect(full).toEqual(['medical-history', 'communication'])
  })

  it('puts the allergies banner on Clinical, and nowhere else', () => {
    const withBanner = GENERAL_INFORMATION_SECTIONS.filter(
      (section) => section.banner !== undefined,
    ).map((section) => section.id)
    expect(withBanner).toEqual(['clinical'])
  })

  it('hatches every field when missing, with exactly one declared exception', () => {
    // A photograph is an identity aid, not a clinical or compliance record.
    // Any other field opting out would be a hole in the invariant, so the
    // exception list is asserted exactly rather than merely allowed.
    const exceptions = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.whenMissing !== 'hatch',
    ).map((field) => field.id)
    expect(exceptions).toEqual(['photo'])
  })
})

describe('no field is ever an empty row', () => {
  it.each(residents.map((resident) => [resident.fullLegalName, resident] as const))(
    '%s: every field renders something',
    (name, resident) => {
      const { container, unmount } = render(
        atSite(<ProfileSections resident={resident} />),
      )

      for (const field of GENERAL_INFORMATION_FIELDS) {
        const cell = container.querySelector(`[data-field="${field.id}"]`)
        expect(cell, `${name}: field "${field.id}" is not rendered at all`).toBeTruthy()
        const value = cell?.querySelector('dd')?.textContent?.trim()
        expect(value, `${name}: field "${field.label}" rendered an empty row`).not.toBe(
          '',
        )
        expect(
          value,
          `${name}: field "${field.label}" rendered an em dash instead of saying what is missing`,
        ).not.toBe('—') // dash-ok: asserts the dash is absent
      }
      unmount()
    },
  )

  it('hatches an unrecorded field rather than leaving it blank', () => {
    // Ismail Sowande was admitted yesterday: almost nothing is recorded. This is
    // the Partial state, and the tab's real test.
    const newcomer = residents.find((r) => r.id === 'res-sowande')
    if (newcomer === undefined) throw new Error('fixture changed: no res-sowande')
    const { container } = render(atSite(<ProfileSections resident={newcomer} />))

    const unrecorded = GENERAL_INFORMATION_FIELDS.filter(
      (field) => field.isUnrecorded(newcomer) && field.whenMissing === 'hatch',
    )
    expect(unrecorded.length).toBeGreaterThan(8)

    for (const field of unrecorded) {
      const cell = container.querySelector(`[data-field="${field.id}"]`)
      expect(
        cell?.querySelector('[data-state="unrecorded"]'),
        `${field.label} is unrecorded but did not render the hatch`,
      ).toBeTruthy()
      expect(cell?.textContent).toMatch(/not recorded/)
    }
  })
})

describe('allergies', () => {
  it('sit above the Clinical fields, not among them', async () => {
    const withAllergies = residents.find((r) => r.allergies.kind === 'allergies')
    if (withAllergies === undefined) throw new Error('no resident with allergies')
    const { tab } = await openGeneral(staffAkinyemi.id, withAllergies.id)

    const clinical = tab.querySelector('[data-section="clinical"]')
    const panel = clinical?.querySelector('[data-allergies]')
    expect(panel, 'the allergies panel is not inside the Clinical section').toBeTruthy()
    const firstField = clinical?.querySelector('[data-field]')
    if (!panel || !firstField) throw new Error('Clinical did not render')
    expect(
      panel.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(tab.querySelector('[data-field="allergies"]')).toBeNull()
  })

  it('say plainly that unrecorded is not the same as none', async () => {
    const notRecorded = residents.find((r) => r.allergies.kind === 'not_recorded')
    if (notRecorded === undefined)
      throw new Error('no resident with allergies unrecorded')
    const { tab } = await openGeneral(staffAkinyemi.id, notRecorded.id)

    const panel = tab.querySelector('[data-allergies="not_recorded"]')
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    // The field, then the answer, then why the answer is not "none". The
    // pattern is reinforcement; these words are the carrier.
    expect(panel?.textContent).toMatch(/Allergies and adverse reactions/)
    expect(panel?.textContent).toMatch(/Not recorded/)
    expect(panel?.textContent).toMatch(
      /must not be given on the assumption there are none/,
    )
  })

  it('show a recorded negative as settled, not as a gap', async () => {
    const noneKnown = residents.find((r) => r.allergies.kind === 'none_known')
    if (noneKnown === undefined) throw new Error('no resident with no known allergies')
    const { tab } = await openGeneral(staffAkinyemi.id, noneKnown.id)

    const panel = tab.querySelector('[data-allergies="none_known"]')
    expect(panel?.textContent).toMatch(/No known allergies/)
    // Somebody asked and confirmed. Settled, with an author, never hatched.
    expect(panel?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(panel?.textContent).toMatch(/Recorded by/)
  })

  it('name the substance, the reaction and the author when there are some', async () => {
    const withAllergies = residents.find((r) => r.allergies.kind === 'allergies')
    if (withAllergies === undefined || withAllergies.allergies.kind !== 'allergies')
      throw new Error('fixture changed shape')
    const { tab } = await openGeneral(staffAkinyemi.id, withAllergies.id)

    const panel = tab.querySelector('[data-allergies="allergies"]')
    expect(withAllergies.allergies.items.length).toBeGreaterThan(0)
    for (const allergy of withAllergies.allergies.items) {
      expect(panel?.textContent).toContain(allergy.substance)
      expect(panel?.textContent).toContain(allergy.reaction)
    }
    expect(panel?.textContent).toMatch(/Recorded by/)
  })
})

describe('the three answer types stay apart', () => {
  it('renders a value, a recorded negative and a gap differently in one section', async () => {
    // Derived, not named: the property is what this test is about, and which
    // resident happens to hold it is not.
    const subject = residents.find(
      (resident) =>
        resident.gp.kind === 'recorded' &&
        resident.consultants.kind === 'none_involved' &&
        resident.pharmacy.kind === 'unrecorded',
    )
    if (subject === undefined)
      throw new Error(
        'no resident carries a value, a recorded negative and a gap at once',
      )
    const { tab } = await openGeneral(staffAkinyemi.id, subject.id)

    const gp = tab.querySelector('[data-field="gp"]')
    const consultants = tab.querySelector('[data-field="consultants"]')
    const pharmacy = tab.querySelector('[data-field="pharmacy"]')

    // A recorded value: plain, with its author.
    expect(gp?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(gp?.textContent).toMatch(/Recorded by/)

    // A recorded NEGATIVE: settled, info-toned, with its author.
    expect(consultants?.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(consultants?.querySelector('[data-tone="info"]')).toBeTruthy()
    expect(consultants?.textContent).toMatch(/No consultants or specialists involved/)
    expect(consultants?.textContent).toMatch(/Recorded by/)

    // A gap: hatched, saying what is missing.
    expect(pharmacy?.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(pharmacy?.textContent).toMatch(/Pharmacy not recorded/)
  })
})

describe('attribution', () => {
  it('shows the author and date on clinical and compliance fields', async () => {
    const resident = residents.find((r) => r.primaryDiagnosis.kind === 'recorded')
    if (resident === undefined) throw new Error('no recorded primary diagnosis')
    const { tab } = await openGeneral(staffAkinyemi.id, resident.id)
    const field = tab.querySelector('[data-field="primary-diagnosis"]')
    expect(field?.textContent).toMatch(/Recorded by .+, \d{2}\/\d{2}\/\d{4}/)
  })

  it('does not show it on person-centred fields', async () => {
    const resident = residents.find((r) => r.religion.kind === 'recorded')
    if (resident === undefined) throw new Error('no recorded religion')
    const { tab } = await openGeneral(staffAkinyemi.id, resident.id)
    const field = tab.querySelector('[data-field="religion"]')
    expect(field?.textContent?.trim()).not.toBe('')
    expect(field?.textContent).not.toMatch(/Recorded by/)
  })

  it('attributes dietary requirements, which reach a plate', async () => {
    const resident = residents.find((r) => r.dietaryRequirements.kind === 'recorded')
    if (resident === undefined) throw new Error('no recorded dietary requirements')
    const { tab } = await openGeneral(staffAkinyemi.id, resident.id)
    expect(tab.querySelector('[data-field="diet"]')?.textContent).toMatch(/Recorded by/)
  })
})

/**
 * **Read-only, and it no longer says who may edit.**
 *
 * The tab used to draw a disabled "Edit profile" with the role table's refusal
 * beside it. Neither role can ever perform it — `edit_resident_profile` is
 * `may_not` for both, whatever the resident — so the control was an act nobody
 * reading this screen can do, repeated on four tabs, telling a care worker
 * about somebody else's job. It is gone; the role table still holds the rule,
 * and `capabilities.test.ts` still holds the role table.
 *
 * The line a control that does nothing must carry (CLAUDE.md §6) is not owed
 * here, because there is no longer a control. That rule exists so nothing on
 * screen implies an act happened; drawing nothing implies nothing.
 */
describe('read-only, with nothing on it that writes', () => {
  it.each([
    ['a care worker, Eze', staffEze.id],
    ['a senior carer, Akinyemi', staffAkinyemi.id],
  ] as const)(
    'offers %s no edit control and no refusal about it',
    async (_who, staffId) => {
      const { tab } = await openGeneral(staffId, 'res-okafor')

      expect(within(tab).queryByRole('button', { name: 'Edit profile' })).toBeNull()
      expect(tab.querySelector('[data-act-line]')).toBeNull()
      for (const reason of editRefusals) expect(tab.textContent).not.toContain(reason)
    },
  )

  it('draws no change control on any field', async () => {
    const withAllergies = residents.find(
      (r) => r.allergies.kind === 'allergies' && r.gp.kind === 'recorded',
    )
    if (withAllergies === undefined)
      throw new Error('no resident with allergies and a GP')
    const { tab } = await openGeneral(staffAkinyemi.id, withAllergies.id)

    // The card expand buttons are navigation. Nothing else here is a button.
    const writes = within(tab)
      .queryAllByRole('button')
      .filter((button) => button.getAttribute('data-expand') === null)
    expect(writes).toEqual([])
    expect(tab.querySelectorAll('[data-act-line]')).toHaveLength(0)
  })

  it('has no detectable accessibility violations', async () => {
    const { tab } = await openGeneral(staffAkinyemi.id, 'res-sowande')
    const results = await axe(tab)
    expect(results).toHaveNoViolations()
  }, 30000)
})
