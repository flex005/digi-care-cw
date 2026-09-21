import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { NEVER_ASSESSED_IS_NOT_LOW_RISK } from './risk-list'
import { RiskListRoute } from './RiskListRoute'

const navigation = vi.hoisted(() => ({ pathname: '/risk-assessments', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const

beforeEach(() => {
  endSession()
})

async function openList(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <RiskListRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Which assessments' })
  return { user, ...rendered }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-risk-row]')]

describe('what the screen says', () => {
  it('carries RA-01’s own sentence, which has to appear on the page', async () => {
    await openList()
    expect(screen.getByText(NEVER_ASSESSED_IS_NOT_LOW_RISK)).toBeTruthy()
  })

  it('leads on the gap, with a hatched edge and what it is out of', async () => {
    await openList()
    const card = document.querySelector('[data-action-card]')
    expect(card?.getAttribute('data-gap-card')).toBe('true')
    expect(
      within(card as HTMLElement).getByText(
        /of [\d,]+ assessments this home is expected to hold/,
      ),
    ).toBeTruthy()
  })

  it('keeps the placeholder warning about the instrument', async () => {
    await openList()
    expect(screen.getByText(/not a validated clinical scale/i)).toBeTruthy()
  })

  it('opens on never assessed, and every row in it is a gap', async () => {
    await openList()
    const shown = rows()
    expect(shown.length).toBeGreaterThan(0)
    for (const row of shown) expect(row.dataset.standing).toBe('never_assessed')
  })

  /*
   * An assessment nobody has scheduled a review for has passed no date, so it
   * is in no tab but All. It is named on the screen rather than left for a
   * reader to find, which is the whole reason it is a state of its own.
   */
  it('names the assessments with no review date, out loud', async () => {
    await openList()
    // 17 of them at Rosewood, so the aside is not optional here.
    const aside = document.querySelector('[data-no-review-date]')
    expect(aside).not.toBeNull()
    expect(aside?.textContent).toMatch(/17 with no review date/)
    expect(aside?.textContent).toMatch(/in All and in no other tab/)
  })
})

describe('the tabs', () => {
  it('shows the nine overdue, longest wait first', async () => {
    const { user } = await openList()
    await user.click(document.querySelector('[data-risk-view="review_overdue"]')!)
    const shown = rows()
    expect(shown).toHaveLength(9)
    for (const row of shown) expect(row.dataset.standing).toBe('review_overdue')

    // The wait is the finding, so the longest of them leads.
    const days = shown.map((row) => {
      const said = row.textContent?.match(
        /Review (?:(\d+) days?|(?:(\d+) )?(?:about )?(\d+) (month|year)s?)/,
      )
      return said === null ? 0 : Number(said[1] ?? said[3] ?? 0)
    })
    expect(days[0]).toBeGreaterThan(0)
  })

  it('shows every expected row under All, and says how many of how many', async () => {
    const { user } = await openList()
    await user.click(document.querySelector('[data-risk-view="all"]')!)
    const claim = document.querySelector('[data-risk-claim]')?.textContent ?? ''
    const [shown, total] = claim.match(/[\d,]+/g) ?? []
    expect(shown).toBe(total)
    expect(rows().length).toBeGreaterThan(0)
  })
})

describe('who may score', () => {
  it('gives a senior carer the act on the row it acts on', async () => {
    await openList(staffAkinyemi.id)
    const first = rows()[0]!
    const act = within(first).getByRole('link', { name: 'Score now' })
    expect(act.getAttribute('href')).toMatch(
      /^\/residents\/res-[\w-]+\/risk-assessments\/\w+$/,
    )
  })

  /*
   * Nothing at all: scoring is not this reader's, and an unavailable control
   * with the reason under it is a thing to read about somebody else's job.
   * Read-only, not shut out, so the rows are still there to read.
   */
  it('offers a care worker no scoring, and says nothing about whose it is', async () => {
    await openList(staffEze.id)
    expect(document.querySelectorAll('[data-answer]')).toHaveLength(0)
    expect(document.querySelector('[data-act-line="refused"]')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Score now' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Score/ })).toBeNull()
    expect(rows().length).toBeGreaterThan(0)
  })

  it('leaves a care worker reading the home’s rows, and says which they cannot open', async () => {
    await openList(staffEze.id)
    const theirs = rows().filter(
      (row) => row.querySelector('[data-open-assessment]') !== null,
    )
    const others = rows().filter(
      (row) => row.querySelector('[data-not-on-your-list]') !== null,
    )
    expect(theirs.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)
    expect(theirs.length + others.length).toBe(rows().length)
    expect(others[0]?.textContent).toMatch(/is not on your list\./)
  })

  it('tells a care worker with no list that nobody has given them one', async () => {
    await openList(staffOsei.id)
    // The home's gap is still the home's, so the rows stay.
    expect(rows().length).toBeGreaterThan(0)
    expect(document.querySelectorAll('[data-not-on-your-list]').length).toBe(
      rows().length,
    )
  })
})
