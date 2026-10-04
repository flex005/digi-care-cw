import { vi } from 'vitest'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The notification table says the organisation's words, in three forms.
 *
 * **The conversion is asserted here or nowhere.** Every other test in this
 * module passed the moment the words moved, because the default vocabulary
 * renders the identical string — so an assertion on this build's own word
 * cannot tell a sentence that asked from one with the word typed into it. The
 * ratchet in `check-vocabulary-coverage` catches a word coming back, but it
 * cannot say which position it is in. This can.
 *
 * The vocabulary shares no token with the default, so a pass cannot come from
 * two vocabularies agreeing on a word.
 */

vi.setConfig({ testTimeout: 20_000 })

const navigation = vi.hoisted(() => ({ pathname: '/profile', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const OTHER =
  'subject:person_supported,staff:healthcare_professional,medication:medicines'

beforeEach(() => {
  vi.resetModules()
})

async function loadUnder(terms: string) {
  vi.resetModules()
  window.history.replaceState(
    null,
    '',
    `/profile?at=09:37${terms === '' ? '' : `&terms=${terms}`}`,
  )
  const [table, session] = await Promise.all([
    import('./notification-table'),
    import('@/data/access/session-losses'),
  ])
  session.endSession()
  return { NOTIFICATIONS: table.NOTIFICATIONS }
}

describe('what the table says it would send', () => {
  const what = (m: { NOTIFICATIONS: { what: string; reaches: string }[] }) =>
    m.NOTIFICATIONS.map((row) => row.what)

  it('names the subject and the medication term in the singular', async () => {
    const m = await loadUnder(OTHER)
    expect(what(m)).toContain('Medicine round due in 30 minutes')
    expect(what(m)).toContain(
      'Care note not written for an assigned person supported for 4 hours',
    )
    expect(what(m)).not.toContain('Medication round due in 30 minutes')
  })

  /*
   * **The possessive**, which is the form a call site is likeliest to build by
   * hand — and the one no test can catch it building, since `ones` is derived
   * from `one`. This asserts the word arrived; `check-term-forms` asserts
   * nobody assembled it.
   */
  it('uses the declared possessive, with the apostrophe the vocabulary prints', async () => {
    const m = await loadUnder(OTHER)
    expect(what(m)).toContain(
      'A person supported’s risk band changed to a higher level',
    )
    expect(what(m)).not.toContain('A resident’s risk band changed to a higher level')
    for (const row of what(m)) expect(row).not.toContain("person supported's")
  })

  /** And the plural, in who a notification would reach. */
  it('uses the declared plural for who it would reach', async () => {
    const m = await loadUnder(OTHER)
    const reaches = m.NOTIFICATIONS.map((row) => row.reaches)
    expect(reaches).toContain('Responsible healthcare professionals')
    expect(reaches).not.toContain('Responsible staff')
  })

  it('says this build’s own words when nothing is asked for', async () => {
    const m = await loadUnder('')
    expect(what(m)).toContain('Medication round due in 30 minutes')
    expect(what(m)).toContain('A resident’s risk band changed to a higher level')
  })
})
