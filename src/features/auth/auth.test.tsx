import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memberById, resetSessionTeam, standingOf } from '@/data/access/team-store'
import {
  staffAdeyinka,
  staffAkinyemi,
  staffEze,
  staffPrice,
} from '@/data/fixtures/organisation'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import {
  hasChosenPin,
  medicationPinMatches,
  resetMedicationPins,
} from '@/app/session/medication-pins'
import { TooltipProvider } from '@/components/primitives'
import { SignInRoute } from './SignInRoute'
import { CodeStep } from './CodeStep'
import { InvitationSetupRoute } from './InvitationRoutes'
import { resetLockouts } from './lockout'

const router = { push: vi.fn(), replace: vi.fn() }
let params: Record<string, string> = {}
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => params,
  usePathname: () => '/',
}))

const wrap = (ui: React.ReactNode) =>
  render(
    <SessionProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </SessionProvider>,
  )

const type = (container: HTMLElement, field: string, value: string) => {
  const input = container.querySelector(`[data-field="${field}"]`)
  if (input === null) throw new Error(`no field ${field}`)
  fireEvent.change(input, { target: { value } })
}

beforeEach(() => {
  router.push.mockReset()
  router.replace.mockReset()
})

afterEach(() => {
  resetLockouts()
  resetSessionTeam()
  resetMedicationPins()
})

describe('signing in', () => {
  it('refuses a password that breaks the rules and an address that is nobody with the same words, naming neither field', () => {
    const { container } = wrap(<SignInRoute />)
    type(container, 'email', 'n.eze@rosewoodcourt.example')
    type(container, 'password', 'short')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const refusedPassword = container.querySelector(
      '[data-refusal="not_recognised"]',
    )?.textContent

    type(container, 'email', 'nobody@rosewoodcourt.example')
    type(container, 'password', 'Kept-Safe-2026!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    const refusedAddress = container.querySelector(
      '[data-refusal="not_recognised"]',
    )?.textContent

    expect(refusedPassword).toMatch(/^Email or password not recognised\./)
    expect(refusedAddress).toMatch(/^Email or password not recognised\./)
    for (const message of [refusedPassword, refusedAddress]) {
      expect(message).not.toMatch(
        /no account|address is not|password is wrong|too short/i,
      )
    }
    expect(router.push).not.toHaveBeenCalled()
  })

  it('locks the address after five refusals, and keeps it locked', () => {
    const { container } = wrap(<SignInRoute />)
    type(container, 'email', 'n.eze@rosewoodcourt.example')
    for (let attempt = 0; attempt < 5; attempt++) {
      type(container, 'password', `short${attempt}`)
      fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    }
    const locked = container.querySelector('[data-refusal="locked"]')
    expect(locked?.textContent).toMatch(/locked until \d\d:\d\d/)
    expect(locked?.querySelector('[data-act-line]')).toBeNull()

    // Locked means locked: a password that meets the rules does not get through.
    type(container, 'password', 'Kept-Safe-2026!')
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(router.push).not.toHaveBeenCalled()
  })

  it('carries where the reader was going from the address it arrived in', () => {
    window.history.replaceState(null, '', '/sign-in?from=%2Fresidents%2Fres-okafor')
    const seen: string[] = []
    function Peek() {
      const { pending } = useSession()
      if (pending.kind === 'awaiting_code') seen.push(pending.destination)
      return null
    }
    const { container } = wrap(
      <>
        <SignInRoute />
        <Peek />
      </>,
    )
    // The address changes before Log in, as it would once the page had moved on.
    window.history.replaceState(null, '', '/sign-in')
    fireEvent.click(container.querySelector(`[data-sign-in-as="${staffEze.id}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(seen.at(-1)).toBe('/residents/res-okafor')
    window.history.replaceState(null, '', '/')
  })

  it('sends a recognised person to the code step, and offers nobody without live access', () => {
    const { container } = wrap(<SignInRoute />)
    expect(container.querySelector(`[data-sign-in-as="${staffPrice.id}"]`)).toBeNull()
    expect(
      container.querySelector(`[data-sign-in-as="${staffAdeyinka.id}"]`),
    ).toBeNull()
    fireEvent.click(container.querySelector(`[data-sign-in-as="${staffEze.id}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(router.push).toHaveBeenCalledWith('/sign-in/code')
  })
})

/** Puts a sign-in part-way through, as the sign-in screen would have. */
function Awaiting({
  id,
  destination = '/',
  children,
}: {
  id: string
  destination?: string
  children: React.ReactNode
}) {
  const { pending, awaitCode } = useSession()
  useEffect(() => {
    if (pending.kind === 'none')
      awaitCode(memberById(id)!, 'someone@example', 'sign_in', destination)
  }, [pending.kind, awaitCode, id, destination])
  return pending.kind === 'awaiting_code' ? <>{children}</> : null
}

describe('the code step', () => {
  const verify = async (id: string, destination = '/') => {
    const { container } = wrap(
      <Awaiting id={id} destination={destination}>
        <CodeStep purpose="sign_in" />
      </Awaiting>,
    )
    const input = await screen.findByLabelText('6-digit code')
    fireEvent.change(input, { target: { value: '482915' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
    })
    return container
  }

  it('asks for the code and says nothing about what was or was not sent', async () => {
    const { container } = wrap(
      <Awaiting id={staffEze.id}>
        <CodeStep purpose="sign_in" />
      </Awaiting>,
    )
    await screen.findByLabelText('6-digit code')
    const card = container.querySelector('[data-code-step="sign_in"] section')!
    expect(card.querySelector('[data-act-line]')).toBeNull()
    expect(card.textContent).not.toMatch(/is sent|is saved/)
  })

  it('signs somebody at one home straight in', async () => {
    await verify(staffEze.id)
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('lands where the reader was going before the sign-in gate stopped them', async () => {
    await verify(staffEze.id, '/residents/res-okafor/consent')
    expect(router.replace).toHaveBeenCalledWith('/residents/res-okafor/consent')
  })

  it('sends somebody at two homes to choose one', async () => {
    await verify(staffAkinyemi.id)
    expect(router.replace).toHaveBeenCalledWith('/sign-in/home')
  })
})

describe('setting up an account from an invitation', () => {
  it('shows an expired invitation as expired, with no form', () => {
    params = { staffId: staffPrice.id }
    const { container } = wrap(<InvitationSetupRoute />)
    expect(
      container.querySelector(`[data-invitation-expired="${staffPrice.id}"]`),
    ).not.toBeNull()
    expect(container.querySelector('[data-set-up-account]')).toBeNull()
  })

  it('refuses 1234 as a PIN, and grants access for the session on a valid form', () => {
    params = { staffId: staffAdeyinka.id }
    const { container } = wrap(<InvitationSetupRoute />)
    expect(container.querySelector('[data-act-line]')).toBeNull()

    type(container, 'password', 'Kept-Safe-2026!')
    type(container, 'confirm', 'Kept-Safe-2026!')
    const [pin, pinConfirm] = screen.getAllByLabelText(/medication PIN/i)
    fireEvent.change(pin!, { target: { value: '1234' } })
    fireEvent.change(pinConfirm!, { target: { value: '1234' } })
    const submit = container.querySelector('[data-set-up-account]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)

    fireEvent.change(pin!, { target: { value: '4821' } })
    fireEvent.change(pinConfirm!, { target: { value: '4821' } })
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    expect(standingOf(staffAdeyinka.id)?.kind).toBe('has_access')
    expect(hasChosenPin(staffAdeyinka.id)).toBe(true)
    expect(medicationPinMatches(staffAdeyinka.id, '4821')).toBe(true)
    expect(router.push).toHaveBeenCalledWith(`/invitation/${staffAdeyinka.id}/verify`)
  })
})
