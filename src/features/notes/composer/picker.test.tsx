import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { residentsBySite } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze, staffOsei } from '@/data/fixtures/organisation'
import { renderSignedIn } from '@/test/render-signed-in'
import { ResidentPickerRoute } from './ResidentPickerRoute'

const navigation = vi.hoisted(() => ({ pathname: '/care-notes/new', params: {} }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const rows = () =>
  within(
    screen.getByRole('list', { name: 'Residents you can write about' }),
  ).getAllByRole('link')

describe('who is this note about?', () => {
  it('lists a care worker the residents on their list, each opening that resident’s composer', async () => {
    renderSignedIn(staffEze.id, <ResidentPickerRoute />)
    await screen.findByRole('list', { name: 'Residents you can write about' })
    expect(rows().map((link) => link.getAttribute('href'))).toEqual([
      '/residents/res-pemberton/notes/new',
      '/residents/res-hutchinson/notes/new',
      '/residents/res-okafor/notes/new',
      '/residents/res-adeyemi/notes/new',
    ])
    expect(screen.getByText('4 of your 4 residents')).toBeTruthy()
  })

  it('lists a senior carer every resident at the home', async () => {
    renderSignedIn(staffAkinyemi.id, <ResidentPickerRoute />, 'site-rosewood-court')
    await screen.findByRole('list', { name: 'Residents you can write about' })
    const rosewood = residentsBySite('site-rosewood-court')
    expect(rows()).toHaveLength(rosewood.length)
    expect(rows()).toHaveLength(28)
  })

  it('finds a resident by name or by room', async () => {
    const user = userEvent.setup()
    renderSignedIn(staffEze.id, <ResidentPickerRoute />)
    const search = await screen.findByRole('searchbox', {
      name: 'Search residents by name or room',
    })
    await user.type(search, 'okafor')
    expect(rows().map((link) => link.getAttribute('href'))).toEqual([
      '/residents/res-okafor/notes/new',
    ])

    const okafor = residentsBySite('site-rosewood-court').find(
      (resident) => resident.id === 'res-okafor',
    )
    if (okafor?.room.kind !== 'recorded') throw new Error('Okafor’s room is recorded')
    await user.clear(search)
    await user.type(search, okafor.room.value)
    expect(rows().map((link) => link.getAttribute('href'))).toContain(
      '/residents/res-okafor/notes/new',
    )

    await user.clear(search)
    await user.type(search, 'nobody by this name')
    expect(screen.getByText('No resident matches “nobody by this name”')).toBeTruthy()
  })

  it('states that nobody has given a care worker a list, rather than an empty picker', async () => {
    renderSignedIn(staffOsei.id, <ResidentPickerRoute />)
    expect(
      await screen.findByText('Nobody has given you a list of residents yet.'),
    ).toBeTruthy()
    expect(document.querySelector('[data-state="unrecorded"]')).not.toBeNull()
    expect(
      screen.queryByRole('list', { name: 'Residents you can write about' }),
    ).toBeNull()
    expect(document.querySelector('[data-picker-resident]')).toBeNull()
  })
})
