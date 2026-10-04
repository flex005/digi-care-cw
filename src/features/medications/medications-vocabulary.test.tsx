import { vi } from 'vitest'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * Medications say the organisation's words — on screen and in the accessible
 * names, which are a second medium for the same word.
 *
 * **The MAR is the reason this module needs its own file.** Its grid is a real
 * `<table>` and every cell carries a full sentence as its accessible name
 * (CLAUDE.md §7), so each term word exists twice: once where a reader sees it
 * and once where a screen reader hears it. **A screenshot cannot read an
 * accessible name, and the coverage count cannot tell which of two strings in a
 * file is which** — so the two can disagree with nothing noticing. One of these
 * cases asserts the sentence rather than the text, and its mutation is
 * converting the visible half and leaving the spoken one hardcoded.
 *
 * Two terms move together here, and `medication` is the one that changes the
 * default rendering: the build said "medicine" in some places and "medication"
 * in others, and asking the vocabulary made it one word.
 */

vi.setConfig({ testTimeout: 20_000 })

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

/** Two terms, neither sharing a token with the word this build uses. */
const OTHER = 'subject:person_supported,medication:medication_record'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  window.history.replaceState(
    null,
    '',
    `/medications?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [mar, round, layout, residents, people, session, render] = await Promise.all([
    import('./mar/MarChartRoute'),
    import('./round/RoundRoute'),
    import('./MedicationsLayout'),
    import('@/data/fixtures/residents'),
    import('@/data/fixtures/organisation'),
    import('@/data/access/session-losses'),
    import('@/test/render-signed-in'),
  ])
  session.endSession()
  return {
    MarChartRoute: mar.MarChartRoute,
    RoundRoute: round.RoundRoute,
    OFF_LIST_LINE: round.OFF_LIST_LINE,
    MedicationsLayout: layout.MedicationsLayout,
    residents: residents.residents,
    staffAkinyemi: people.staffAkinyemi,
    staffEze: people.staffEze,
    renderProfileTab: render.renderProfileTab,
    renderSignedIn: render.renderSignedIn,
  }
}

async function openMar(terms: string) {
  const m = await loadUnder(terms)
  const resident = m.residents.find((entry) => entry.id === 'res-okafor')!
  navigation.params = { residentId: resident.id }
  navigation.pathname = `/residents/${resident.id}/medications/mar`
  m.renderProfileTab(m.staffAkinyemi.id, <m.MarChartRoute />, resident.siteId)
  await screen.findByRole('table')
  return m
}

describe('the MAR says the chosen word where it is read', () => {
  /*
   * **The caption is the document's name and does not move; the column head
   * names the things on the chart and does.** Built from the term, the caption
   * read "Medication record administration record" under one of the three
   * options — the vocabulary's own rule keeps standard document names out of
   * reach of a configurable word, and that is the rule proving itself.
   */
  it('keeps the document’s name and takes the term for the column', async () => {
    await openMar(OTHER)
    const said = document.body.textContent ?? ''
    expect(said).toContain('Medication administration record for')
    expect(said).not.toContain('Medication record administration record')
    const heads = [...document.querySelectorAll('th')].map((node) =>
      (node.textContent ?? '').trim(),
    )
    expect(heads).toContain('Medication record')
    expect(heads).not.toContain('Medication')
  })

  /*
   * **The accessible name, which no screenshot can read.** Every cell is
   * announced as a whole sentence, and one of the states names the term:
   * "no dose of this medicine is prescribed at this round". It lives only in
   * `aria-label`, so the visible text and the spoken name can part company with
   * nothing noticing — which is what this case is for.
   */
  /*
   * **Three vocabularies, because the hardcoded word was one of the options.**
   * This sentence said "medicine", which is the `medicines` option's singular —
   * so asserting it under that vocabulary passes whether the call site asks or
   * not, and the mutation that leaves it hardcoded sails through. The word has
   * to be checked under a vocabulary it cannot coincide with, and the cheapest
   * way to be sure is to check all three.
   */
  it.each([
    ['', 'medication'],
    ['medication:medicines', 'medicine'],
    ['medication:medication_record', 'medication record'],
  ])('announces a cell in the word %s asks for', async (terms, word) => {
    await openMar(terms)
    const spoken = [...document.querySelectorAll('[aria-label]')]
      .map((node) => node.getAttribute('aria-label') ?? '')
      .filter((name) => /no dose of this .+ is prescribed at this round/.test(name))
    expect(
      spoken.length,
      'no cell is announced as not due on this round',
    ).toBeGreaterThan(0)
    for (const name of spoken)
      expect(name).toContain(`no dose of this ${word} is prescribed`)
  })

  it('says this build’s own word when nothing is asked for', async () => {
    await openMar('')
    expect(document.body.textContent).toContain('Medication administration record for')
    const heads = [...document.querySelectorAll('th')].map((node) =>
      (node.textContent ?? '').trim(),
    )
    expect(heads).toContain('Medication')
    expect(heads).not.toContain('Medication record')
  })
})

describe('the round and the module head', () => {
  it('names both terms, and agrees the denominator with its plural', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(m.staffAkinyemi.id, <m.RoundRoute />, 'site-rosewood-court')
    // The round has no heading of its own — the module layout owns that — so
    // wait for the figure's own sentence rather than for a landmark.
    await screen.findByText(/recorded for \d\d:\d\d round\./)
    const said = document.body.textContent ?? ''
    expect(said).toMatch(/of \d+ medication records recorded for \d\d:\d\d round\./)
    expect(said).not.toMatch(/of \d+ medications recorded for/)
  })

  /*
   * The line a care worker with no list is shown. The subject word is plural
   * and sentence-initial, which is the one form a call site cannot reach by
   * capitalising another.
   */
  it('names the subject plural at the head of the off-list line', async () => {
    const m = await loadUnder(OTHER)
    expect(m.OFF_LIST_LINE).toContain('People supported not on your list')
    expect(m.OFF_LIST_LINE).not.toContain('Residents not on your list')
  })

  it('names the module by the term, in its heading and its landmark', async () => {
    const m = await loadUnder(OTHER)
    m.renderSignedIn(
      m.staffAkinyemi.id,
      <m.MedicationsLayout>{null}</m.MedicationsLayout>,
      'site-rosewood-court',
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Medication records' }),
    ).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Medication records' })).toBeTruthy()
  })
})
