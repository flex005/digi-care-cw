import { vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { NEVER_SOUGHT_IS_NOT } from './consent-list'
import { ConsentListRoute } from './ConsentListRoute'

const navigation = vi.hoisted(() => ({ pathname: '/consent', params: {} }))
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
  const rendered = renderSignedIn(id, <ConsentListRoute />, ROSEWOOD)
  await screen.findByRole('group', { name: 'Which decisions' })
  return { user, ...rendered }
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-consent-row]')]
/** What the screen says it is showing, which is the figure the page is a page of. */
const claim = () => document.querySelector('[data-consent-claim]')?.textContent ?? ''
const view = (id: string) =>
  document.querySelector<HTMLElement>(`[data-consent-view="${id}"]`)!

describe('what the screen says', () => {
  /*
   * CON-01 requires this sentence verbatim, and it is the sentence the whole
   * product is built around: a reader who takes an absent consent for a given
   * one acts without it.
   */
  it('carries CON-01’s sentence, word for word', async () => {
    await openList()
    expect(screen.getByText(NEVER_SOUGHT_IS_NOT)).toBeTruthy()
    expect(NEVER_SOUGHT_IS_NOT).toBe(
      'Never sought is not refusal and it is not permission.',
    )
  })

  it('leads on the 42 never sought, with a hatched edge and its denominator', async () => {
    await openList()
    const card = document.querySelector('[data-action-card]')
    expect(card?.getAttribute('data-gap-card')).toBe('true')
    expect(within(card as HTMLElement).getByText('42')).toBeTruthy()
    expect(
      within(card as HTMLElement).getByText(
        /of 224 decisions this home is expected to hold/,
      ),
    ).toBeTruthy()
    expect(
      within(card as HTMLElement).getByText(/28 residents and 8 types/),
    ).toBeTruthy()
  })

  /*
   * The default tab is Never sought, so an offer to show them would do nothing
   * when pressed. It becomes a button only once the reader is somewhere else.
   */
  it('offers no dead control on the card while its own tab is the view', async () => {
    const { user } = await openList()
    expect(document.querySelector('[data-already-shown]')).not.toBeNull()
    expect(document.querySelector('[data-show-never-sought]')).toBeNull()

    await user.click(view('all'))
    expect(document.querySelector('[data-show-never-sought]')).not.toBeNull()
    await user.click(document.querySelector<HTMLElement>('[data-show-never-sought]')!)
    expect(claim()).toMatch(/42 of 224/)
  })

  it('states the 64 decisions made for somebody out of the decisions made', async () => {
    await openList()
    const said = document.querySelector('[data-for-them-figure]')?.textContent ?? ''
    expect(said).toMatch(/64/)
    expect(said).toMatch(/of 161 decisions that have been made/)
    expect(said).toMatch(/lawful and it is not the same thing/)
  })
})

describe('the tabs', () => {
  it('opens on never sought, and every row in it is a gap', async () => {
    await openList()
    // 42 matched; the list pages, so the claim carries the total and the
    // first page carries 25 of it.
    expect(claim()).toMatch(/42 of 224/)
    expect(rows()).toHaveLength(25)
    for (const row of rows()) expect(row.dataset.standing).toBe('never_sought')
  })

  /*
   * Who decided outranks what was decided. An attorney's refusal belongs under
   * "Decided for them", not under the resident saying no — putting it there
   * would file somebody else's decision under the resident's name.
   */
  it('keeps a decision made for somebody out of the Refused tab', async () => {
    const { user } = await openList()
    await user.click(view('refused'))
    for (const row of rows()) expect(row.dataset.standing).toBe('refused')

    await user.click(view('decided_for_them'))
    expect(claim()).toMatch(/64 of 224/)
    expect(rows()).toHaveLength(25)
    for (const row of rows()) expect(row.dataset.standing).toBe('decided_for_them')
  })

  it('counts all 224 under All, and pages through them', async () => {
    const { user } = await openList()
    await user.click(view('all'))
    expect(claim()).toMatch(/224 of 224/)
    expect(rows()).toHaveLength(25)
    // Nine pages of 25 holds 224, so the pager is drawn rather than suppressed.
    expect(document.querySelector('[data-pager]')).not.toBeNull()
  })
})

describe('who may seek consent', () => {
  it('gives a senior carer the act, routing into the decision screen', async () => {
    await openList(staffAkinyemi.id)
    const act = within(rows()[0]!).getByRole('link', { name: 'Seek consent' })
    expect(act.getAttribute('href')).toMatch(
      /^\/residents\/res-[\w-]+\/consent\/[\w_]+$/,
    )
  })

  it('refuses a care worker once, not 224 times, and leaves them reading', async () => {
    await openList(staffEze.id)
    const points = document.querySelectorAll('[data-answer]')
    expect(points).toHaveLength(1)
    expect(points[0]?.getAttribute('data-answer')).toBe('not_your_role')
    expect(screen.queryByRole('link', { name: 'Seek consent' })).toBeNull()
    expect(claim()).toMatch(/42 of 224/)
    expect(rows().length).toBeGreaterThan(0)
  })

  it('says what each consent permits, because a consent nobody can explain is not informed', async () => {
    await openList()
    for (const row of rows().slice(0, 5))
      expect(row.textContent).toMatch(/[a-z]{4}.*\./)
  })
})
