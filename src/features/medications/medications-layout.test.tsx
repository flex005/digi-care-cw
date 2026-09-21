import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { renderSignedIn } from '@/test/render-signed-in'
import { MedicationsLayout } from './MedicationsLayout'

const navigation = vi.hoisted(() => ({ pathname: '/medications', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const tabs = () =>
  within(screen.getByRole('navigation', { name: 'Medications' })).getAllByRole('link')

describe('Medications layout', () => {
  it.each([staffAkinyemi.id, staffEze.id])(
    'draws the same three tabs for %s, with no Pharmacy cycle and no Add interim',
    (id) => {
      navigation.pathname = '/medications'
      renderSignedIn(id, <MedicationsLayout />)
      expect(tabs().map((tab) => [tab.textContent, tab.getAttribute('href')])).toEqual([
        ['Omissions', '/medications'],
        ['Round', '/medications/round'],
        ['Controlled drug register', '/medications/register'],
      ])
      expect(screen.queryByText(/Pharmacy cycle/)).toBeNull()
      expect(screen.queryByText(/Add interim/)).toBeNull()
    },
  )

  it.each([
    ['/medications', 'Omissions'],
    ['/medications/round', 'Round'],
    ['/medications/register', 'Controlled drug register'],
  ])('marks %s as the current tab, and only that one', (path, label) => {
    navigation.pathname = path
    renderSignedIn(staffAkinyemi.id, <MedicationsLayout />)
    const current = tabs().filter((tab) => tab.getAttribute('aria-current') === 'page')
    expect(current.map((tab) => tab.textContent)).toEqual([label])
  })

  it('names the module and the home in the head, with the children beneath', () => {
    navigation.pathname = '/medications'
    renderSignedIn(
      staffEze.id,
      <MedicationsLayout>
        <p data-child>Beneath</p>
      </MedicationsLayout>,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Medications')
    expect(screen.getByText(/Rosewood Court/)).toBeInTheDocument()
    expect(document.querySelector('[data-child]')).toBeTruthy()
  })
})
