import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import type { Resident } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { resetSessionSiteConfig, setActive } from '@/data/access/site-config-store'
import { CARE_ACTS, signInRoleOf } from '@/app/session/capabilities'
import { memberById } from '@/data/access/team-store'
import { renderProfileTab } from '@/test/render-signed-in'
import { riskAssessmentGaps } from '@/features/residents/profile/record-gaps'
import { INSTRUMENT_ITEMS } from '@/features/risk/instrument'
import { RiskAssessmentsTab } from './RiskAssessmentsTab'

/**
 * A resident's risk assessments, read-only.
 *
 * The tab's own hazard is that a list of assessments makes a gap easy to hide:
 * a list of the completed ones looks like a finished job. So most of what is
 * under test is that every template stays on the list, that a never-assessed
 * risk never reads as low, and that the figure at the head is the same fact the
 * tab's name states.
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
  resetSessionSiteConfig()
})

const NEVER_ASSESSED_FALLS = residentOf('res-hutchinson')

function residentOf(id: string): Resident {
  const resident = residents.find((entry) => entry.id === id)
  if (resident === undefined) throw new Error(`No fixture resident ${id}`)
  return resident
}

async function openTab(staffId: typeof staffEze.id, resident: Resident) {
  navigation.params = { residentId: resident.id }
  navigation.pathname = `/residents/${resident.id}/risk-assessments`
  const { container } = renderProfileTab(
    staffId,
    <RiskAssessmentsTab />,
    resident.siteId,
  )
  await waitFor(() => expect(container.querySelector('[data-tab-body]')).toBeTruthy())
  return container.querySelector('[data-tab-body="risk-assessments"]') as HTMLElement
}

describe('every template is listed, always', () => {
  it('renders every template row from the constant, not from the record', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)

    expect(tab.querySelectorAll('[data-template]')).toHaveLength(
      RISK_ASSESSMENT_TEMPLATES.length,
    )
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      const row = tab.querySelector(`[data-template="${template.id}"]`)
      expect(row, template.id).toBeTruthy()
      expect(row?.textContent).toContain(template.name)
    }
  })

  it('renders the same rows for the resident with the most assessments on record', async () => {
    // Completing an assessment cannot remove a row: the row is the template.
    const assessedCount = (resident: Resident) =>
      RISK_ASSESSMENT_TEMPLATES.filter(
        (template) => resident.risks[template.id].kind === 'assessed',
      ).length
    const mostAssessed = [...residents].sort(
      (a, b) => assessedCount(b) - assessedCount(a),
    )[0]!
    expect(assessedCount(mostAssessed)).toBeGreaterThan(0)

    const tab = await openTab(staffAkinyemi.id, mostAssessed)
    expect(tab.querySelectorAll('[data-template]')).toHaveLength(
      RISK_ASSESSMENT_TEMPLATES.length,
    )
    expect(tab.querySelectorAll('[data-assessed="assessed"]')).toHaveLength(
      assessedCount(mostAssessed),
    )
  })

  it('keeps a template the home has stopped asking on the list, plain and uncounted', async () => {
    const resident = NEVER_ASSESSED_FALLS
    const unanswered = RISK_ASSESSMENT_TEMPLATES.find(
      (template) => resident.risks[template.id].kind === 'not_assessed',
    )!
    setActive(resident.siteId, unanswered.id, false)

    const tab = await openTab(staffAkinyemi.id, resident)
    const row = tab.querySelector(`[data-template="${unanswered.id}"]`)!
    expect(row.getAttribute('data-configured')).toBe('retired_unanswered')
    expect(row.textContent).toMatch(/Not carried out at this home/)
    // A question nobody here asks is not a gap, so it carries no hatch.
    expect(row.querySelectorAll('[data-state="unrecorded"]')).toHaveLength(0)
    expect(tab.querySelectorAll('[data-template]')).toHaveLength(
      RISK_ASSESSMENT_TEMPLATES.length,
    )

    const gaps = riskAssessmentGaps(resident)
    expect(gaps.asked).toBe(RISK_ASSESSMENT_TEMPLATES.length - 1)
    // The retired template leaves the numerator as well as the denominator.
    expect(tab.querySelector('[data-never-assessed]')?.textContent).toMatch(
      new RegExp(`^${gaps.neverAssessed}\\s*of\\s*${gaps.asked} risks`),
    )
    expect(tab.querySelector('[data-retired-note]')?.textContent).toMatch(
      new RegExp(`1 of the ${RISK_ASSESSMENT_TEMPLATES.length} templates`),
    )
  })
})

describe('the figure at the head is the fact the tab name states', () => {
  it('equals riskAssessmentGaps, with its denominator', async () => {
    const resident = NEVER_ASSESSED_FALLS
    const gaps = riskAssessmentGaps(resident)
    expect(gaps.neverAssessed).toBeGreaterThan(0)

    const tab = await openTab(staffEze.id, resident)
    const lead = tab.querySelector('[data-never-assessed]')!
    expect(lead.getAttribute('data-never-assessed')).toBe(String(gaps.neverAssessed))
    expect(lead.textContent).toMatch(
      new RegExp(
        `^${gaps.neverAssessed}\\s*of\\s*${gaps.asked} risks have never been assessed`,
      ),
    )
    expect(lead.textContent).toMatch(/Never assessed is not low risk/)
    // A gap, so the hatch is its surface.
    expect(lead.className).toMatch(/unrecorded/)

    const overdue = tab.querySelector('[data-overdue]')!
    expect(overdue.getAttribute('data-overdue')).toBe(String(gaps.overdue))
    expect(overdue.textContent).toMatch(
      new RegExp(`of\\s*${gaps.asked} past their review date`),
    )
  })

  it('agrees with the tab strip, which reads the same function', async () => {
    const resident = NEVER_ASSESSED_FALLS
    const gaps = riskAssessmentGaps(resident)
    navigation.params = { residentId: resident.id }
    navigation.pathname = `/residents/${resident.id}/risk-assessments`
    const { container } = renderProfileTab(
      staffEze.id,
      <RiskAssessmentsTab />,
      resident.siteId,
    )
    await waitFor(() => expect(container.querySelector('[data-tab-body]')).toBeTruthy())

    const strip = container.querySelector('a[data-tab="risk-assessments"]')!
    expect(strip.textContent).toContain(
      `${gaps.neverAssessed} of ${gaps.asked} never done`,
    )
  })
})

describe('never assessed is never made to look fine', () => {
  it('carries “No level”, not a blank and not low', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)
    const row = tab.querySelector('[data-template="falls"]')!
    expect(row.getAttribute('data-assessed')).toBe('not_assessed')
    expect(row.textContent).toContain('No level')
    expect(row.textContent).not.toContain('Low')
    expect(row.querySelectorAll('[data-state="unrecorded"]').length).toBeGreaterThan(0)
  })

  it('says exactly once that nobody has looked', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)
    const row = tab.querySelector('[data-template="falls"]')!
    expect(row.textContent!.match(/nobody has looked/g) ?? []).toHaveLength(1)
  })

  it('names who assessed and when on every assessed row', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)
    const assessed = RISK_ASSESSMENT_TEMPLATES.filter(
      (template) => NEVER_ASSESSED_FALLS.risks[template.id].kind === 'assessed',
    )
    expect(assessed.length).toBeGreaterThan(0)
    for (const template of assessed) {
      const status = NEVER_ASSESSED_FALLS.risks[template.id]
      if (status.kind !== 'assessed') throw new Error('expected an assessment')
      const row = tab.querySelector(`[data-template="${template.id}"]`)!
      expect(row.textContent, template.id).toContain(status.assessedBy.displayName)
      expect(row.textContent, template.id).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    }
  })
})

describe('the placeholder says so where it appears', () => {
  it('banners the list', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)
    const banner = tab.querySelector('[data-placeholder-instrument]')
    expect(banner?.textContent).toMatch(/not a validated clinical scale/)
    expect(banner?.textContent).toMatch(/make no clinical decision/)
    // The assessments under it were recorded: the hatch would say they were not.
    expect(banner?.closest('[data-state="unrecorded"]')).toBeNull()
    expect(banner?.querySelector('[data-state="unrecorded"]')).toBeNull()
  })
})

describe('scoring is asked of the role table', () => {
  /*
   * Phase 8 makes the act live. Where the reader may score, the control is on
   * each template, because scoring acts on one; where they may not, the
   * refusal is drawn once at the head rather than nine times down the list.
   */
  it('gives a senior carer the act on every template the home carries out', async () => {
    const tab = await openTab(staffAkinyemi.id, NEVER_ASSESSED_FALLS)
    expect(tab.querySelector('[data-scoring-live]')?.textContent).toBe(
      'Scoring is on each template below.',
    )
    expect(tab.querySelector('[data-act-line]')).toBeNull()

    const rows = [...tab.querySelectorAll('[data-template]')]
    const carriedOut = rows.filter(
      (row) => row.getAttribute('data-configured') !== 'retired_unanswered',
    )
    expect(carriedOut.length).toBeGreaterThan(0)
    for (const row of carriedOut) {
      // It opens over the record rather than at a second address, so the act
      // is a button on the row and not a link away from it.
      const act = row.querySelector('[data-score]')
      expect(act?.tagName).toBe('BUTTON')
      expect(act?.getAttribute('data-score')).toBe(row.getAttribute('data-template'))
      expect(act?.textContent).toBe(
        row.getAttribute('data-assessed') === 'assessed' ? 'Re-score' : 'Score',
      )
    }
    // A template this home does not carry out has no act: it is a question
    // nobody here asks, not a gap somebody can close.
    for (const row of rows.filter(
      (entry) => entry.getAttribute('data-configured') === 'retired_unanswered',
    ))
      expect(row.querySelector('[data-score]')).toBeNull()
  })

  /*
   * Scoring opens over the record it is about: the level standing now and the
   * other eight assessments stay behind it, which a second page took away.
   */
  it('opens the instrument over the record, with the subject named', async () => {
    const user = userEvent.setup()
    const tab = await openTab(staffAkinyemi.id, NEVER_ASSESSED_FALLS)

    const act = tab.querySelector<HTMLElement>('[data-score="falls"]')
    if (act === null) throw new Error('Falls offers no scoring')
    await user.click(act)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', {
        name: `Falls Risk, ${NEVER_ASSESSED_FALLS.fullLegalName}`,
      }),
    ).toBeInTheDocument()
    // The write surface names who it is about wherever it is drawn.
    expect(dialog.querySelector('[data-subject-strip]')).not.toBeNull()
    expect(
      within(dialog).getByRole('button', { name: 'Add another intervention' }),
    ).toBeInTheDocument()
  })

  /*
   * The sign-off asks for the medication PIN in a dialog of its own, opened
   * from inside this one. Nested, it is the failure that would only show in the
   * product: a confirmation that cannot be reached is a form that cannot be
   * signed.
   */
  it('reaches the medication PIN step from inside the dialog', async () => {
    const user = userEvent.setup()
    const tab = await openTab(staffAkinyemi.id, NEVER_ASSESSED_FALLS)
    await user.click(tab.querySelector<HTMLElement>('[data-score="falls"]')!)

    const dialog = await screen.findByRole('dialog')
    for (const item of INSTRUMENT_ITEMS) {
      const choice = dialog.querySelector<HTMLElement>(`[data-choice="${item.id}:0"]`)
      if (choice === null) throw new Error(`No choice for ${item.id}`)
      await user.click(choice)
    }

    const signOff = within(dialog).getByRole('button', {
      name: 'Sign off this assessment',
    })
    await waitFor(() => expect(signOff).toBeEnabled())
    await user.click(signOff)

    /*
     * Radix hides the outer dialog from the accessibility tree while the inner
     * one is open, so the count stays at one and the sign-off is what it names.
     */
    const signOffDialog = await screen.findByRole('dialog')
    expect(within(signOffDialog).getByRole('heading').textContent).toMatch(
      /^Sign off Falls Risk for /,
    )
    expect(
      within(signOffDialog).getByLabelText('Enter your medication PIN'),
    ).toBeInTheDocument()
  })

  it('gives the care worker nothing to score with, and no reason either', async () => {
    const tab = await openTab(staffEze.id, NEVER_ASSESSED_FALLS)

    // The table still refuses them; the screen simply draws nothing about it.
    const grant = CARE_ACTS.score_risk_assessment[signInRoleOf(memberOf(staffEze.id))]
    if (grant.kind !== 'may_not')
      throw new Error('expected the table to refuse this person')

    expect(
      within(tab).queryByRole('button', { name: 'Score an assessment' }),
    ).toBeNull()
    expect(tab.querySelectorAll('[data-act-line]')).toHaveLength(0)
    expect(tab.textContent).not.toContain(grant.reason)
    for (const row of tab.querySelectorAll('[data-template]'))
      expect(row.querySelectorAll('a, button, input, textarea')).toHaveLength(0)
  })
})

describe('accessibility', () => {
  it('has no axe violations on the tab', async () => {
    const tab = await openTab(staffAkinyemi.id, NEVER_ASSESSED_FALLS)
    expect((await axe(tab)).violations).toEqual([])
  }, 60000)
})
