import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/app/session/SessionProvider'
import { SignInStandIn } from './SignInStandIn'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const offered = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.querySelector('span')?.textContent)
    .sort()

describe('the sign-in stand-in', () => {
  it('offers exactly the care workers and senior carers whose access is live, by name', () => {
    render(
      <SessionProvider>
        <SignInStandIn />
      </SessionProvider>,
    )
    expect(offered()).toEqual(
      [
        'Chidinma Nwosu',
        'Tolu Akinyemi',
        'Ngozi Eze',
        'Sunita Patel',
        'Douglas Morrison',
        'Yusuf Ibrahim',
        'Kwame Osei',
      ].sort(),
    )
  })

  it('does not offer somebody suspended, gone, or never given access', () => {
    render(
      <SessionProvider>
        <SignInStandIn />
      </SessionProvider>,
    )
    const names = offered()
    for (const name of ['Folake Adebayo', 'Joseph Whitfield', 'Funke Adeyinka']) {
      expect(names).not.toContain(name)
    }
  })

  it('says Tolu Akinyemi works at both homes', () => {
    render(
      <SessionProvider>
        <SignInStandIn />
      </SessionProvider>,
    )
    expect(screen.getByText('Rosewood Court and Ashgrove Lodge')).toBeTruthy()
  })
})
