import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The converted copy says the organisation's word, not this build's.
 *
 * **Every other test in this module passed the moment the conversion landed,
 * and none of them could have failed.** The default vocabulary renders the
 * identical string, so an assertion on "A resident — choose the person below."
 * cannot tell a sentence that asked the vocabulary from one with the word typed
 * into it. The coverage guard counts, and the browser check proves the
 * parameter reaches the product — neither asserts that *this* module's call
 * sites ask. This does, through the rendered screen.
 *
 * **The vocabularies are chosen so they cannot be confused with the default.**
 * "Person supported", "clinical manager", "healthcare professionals" and "next
 * of kin" share no token with "resident", "manager", "staff" or "family", so a
 * pass cannot come from two vocabularies happening to agree — which would be
 * the vacuous assertion again, in a file written to remove one.
 *
 * Each case re-imports the module graph, because the vocabulary is read once at
 * load from the address as it stood then.
 */

const navigation = vi.hoisted(() => ({ pathname: '/incidents', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

/** A vocabulary with no word in common with this build's own. */
const OTHER =
  'subject:person_supported,manager:clinical_manager,staff:healthcare_professional,family:next_of_kin'

beforeEach(() => {
  vi.resetModules()
})

/**
 * Loads the module graph with a vocabulary on the address.
 *
 * The address has to be written before the import, not before the render: the
 * vocabulary is captured once, when `first-address.ts` is first evaluated.
 */
async function loadUnder(terms: string) {
  window.history.replaceState(
    null,
    '',
    `/incidents?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [
    incidentsRoute,
    report,
    row,
    acknowledge,
    fixtures,
    people,
    residents,
    session,
    store,
    render,
  ] = await Promise.all([
    import('./IncidentsRoute'),
    import('./ReportIncidentRoute'),
    import('./IncidentRow'),
    import('./AcknowledgeControl'),
    import('@/data/fixtures/incidents'),
    import('@/data/fixtures/organisation'),
    import('@/data/fixtures/residents'),
    import('@/data/access/session-losses'),
    import('@/data/access/incident-store'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  store.resetSessionIncidents()
  return {
    IncidentsRoute: incidentsRoute.IncidentsRoute,
    ReportIncidentForm: report.ReportIncidentForm,
    IncidentRow: row.IncidentRow,
    AcknowledgeControl: acknowledge.AcknowledgeControl,
    incidents: fixtures.incidents,
    staffAkinyemi: people.staffAkinyemi,
    residentById: residents.residentById,
    renderSignedIn: render.renderSignedIn,
  }
}

describe('the report form asks the vocabulary for its words', () => {
  it('names the subject in the chosen word, mid-sentence and as a label', async () => {
    const m = await loadUnder(OTHER)
    const user = userEvent.setup()
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.ReportIncidentForm onReported={vi.fn()} />,
      ROSEWOOD,
    )
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })

    // Mid-sentence singular, in two sentences.
    expect(document.body.textContent).toContain(
      'A person supported — choose the person below.',
    )
    expect(document.body.textContent).toContain('No person supported was involved')
    expect(document.body.textContent).not.toContain(
      'A resident — choose the person below.',
    )
    expect(document.body.textContent).not.toContain('No resident was involved')

    /*
     * The label is the `One` form, which only exists once somebody is the
     * subject — a different form of the same word, and the one a call site
     * would get wrong by capitalising `one` itself.
     */
    await user.click(screen.getByRole('radio', { name: /^A person supported/ }))
    expect(await screen.findByText('Person supported')).toBeTruthy()
    expect(screen.queryByText('Resident')).toBeNull()
  })

  /** A plural form and a second term, in one sentence. */
  it('uses the plural form where the sentence is plural', async () => {
    const m = await loadUnder(OTHER)
    const user = userEvent.setup()
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.ReportIncidentForm onReported={vi.fn()} />,
      ROSEWOOD,
    )
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })
    await user.click(screen.getByRole('radio', { name: /^Somebody saw it/ }))

    const hint = await screen.findByText(/Names, separated by commas/)
    expect(hint.textContent).toContain('Healthcare professionals')
    expect(hint.textContent).toContain('next of kin')
    expect(hint.textContent).not.toContain('Staff,')
  })

  it('names the manager in the chosen word', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.ReportIncidentForm onReported={vi.fn()} />,
      ROSEWOOD,
    )
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })
    const said = document.body.textContent ?? ''
    expect(said).toContain('a clinical manager tonight')
    expect(said).toContain('The clinical manager writes their own account')
    expect(said).not.toContain('a manager tonight')
  })
})

describe('the record asks the vocabulary for its words', () => {
  it('says which word on a row about nobody', async () => {
    const m = await loadUnder(OTHER)
    const nobody = m.incidents.find(
      (incident) => incident.subject.kind === 'no_resident_involved',
    )
    expect(nobody, 'no fixture incident involves nobody').toBeTruthy()
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <ul>
        <m.IncidentRow
          incident={nobody!}
          resident={undefined}
          at={nobody!.reported.at}
        />
      </ul>,
      ROSEWOOD,
    )
    expect(document.body.textContent).toContain('No person supported was involved')
    expect(document.body.textContent).not.toContain('No resident was involved')
  })

  /*
   * **The possessive, which is the form a call site is most likely to get
   * wrong** by taking `one` and appending an apostrophe-s. "Clinical manager’s"
   * is what the vocabulary declares; nothing here builds it.
   */
  it('uses the possessive form, with the apostrophe the vocabulary declares', async () => {
    const m = await loadUnder(OTHER)
    const user = userEvent.setup()
    const waiting = m.incidents.find(
      (incident) =>
        incident.siteId === ROSEWOOD &&
        incident.status.kind === 'reported_not_acknowledged',
    )!
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.AcknowledgeControl
        incident={waiting}
        resident={
          waiting.subject.kind === 'resident'
            ? m.residentById(waiting.subject.residentId)
            : undefined
        }
        onAcknowledged={vi.fn()}
      />,
      ROSEWOOD,
    )
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/is a clinical manager’s act/)).toBeTruthy()
    expect(dialog.textContent).not.toContain('is a manager’s act')
  })
})

describe('a different kind of service', () => {
  /*
   * `org:hospital` changes the subject through the organisation type rather
   * than by naming a term, which is the other way in and has its own branch.
   */
  it('takes the default for the type when a type is chosen', async () => {
    const m = await loadUnder('org:hospital')
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.ReportIncidentForm onReported={vi.fn()} />,
      ROSEWOOD,
    )
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })
    const said = document.body.textContent ?? ''
    expect(said).toContain('A patient — choose the person below.')
    expect(said).not.toContain('A resident — choose the person below.')
  })

  /** And with nothing asked for, the build says what it has always said. */
  it('says this build’s own words when nothing is asked for', async () => {
    const m = await loadUnder('')
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.ReportIncidentForm onReported={vi.fn()} />,
      ROSEWOOD,
    )
    await screen.findByRole('radiogroup', { name: 'Who this happened to' })
    const said = document.body.textContent ?? ''
    expect(said).toContain('A resident — choose the person below.')
    expect(said).not.toContain('person supported')
  })
})
