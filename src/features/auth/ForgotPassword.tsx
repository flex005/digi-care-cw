import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSession } from '@/app/session/use-session'
import {
  ActLine,
  Button,
  PasswordField,
  TextField,
  buttonClassName,
} from '@/components/primitives'
import { AuthActions, AuthPage, AuthStack, authLinkClass } from './AuthPage'
import { PasswordRules } from './PasswordRules'
import { forbiddenWords, unmetRules } from './password-rules'
import { personForAddress } from './sign-in-people'

/**
 * Forgotten password, four screens (AUTH-08).
 *
 * **Nothing is sent and nothing is saved, and each screen says so at the act.**
 * The address travels between the first two screens in the URL, because it is
 * what somebody typed rather than a record.
 *
 * **The last screen does not say the password was updated**, because nothing
 * was: any password that meets the rules signs in. It says what is true.
 */
const toHref = (base: string, address: string) =>
  address === '' ? base : `${base}?to=${encodeURIComponent(address)}`

const readAddress = () =>
  typeof window === 'undefined'
    ? ''
    : (new URLSearchParams(window.location.search).get('to') ?? '')

const backToSignIn = (
  <Link href="/sign-in" className={authLinkClass()}>
    Back to sign in
  </Link>
)

export function ForgotPasswordRoute() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  return (
    <AuthPage
      title="Forgot your password?"
      lede="Enter the address you sign in with, and we'll send a link to reset it."
      data-forgot-step="request"
      after={backToSignIn}
    >
      <AuthStack>
        <TextField
          label="Email"
          type="email"
          value={address}
          onChange={setAddress}
          autoComplete="username"
        />
        <ActLine kind="not_performed">No email is sent.</ActLine>
        <AuthActions>
          <Button
            size="large"
            disabled={address.trim() === ''}
            onClick={() => router.push(toHref('/forgot-password/sent', address.trim()))}
          >
            Send reset link
          </Button>
        </AuthActions>
      </AuthStack>
    </AuthPage>
  )
}

export function ForgotPasswordSentRoute() {
  const [address] = useState(readAddress)
  return (
    <AuthPage
      title="Check your email"
      lede={`If an account uses ${address === '' ? 'that address' : address}, a link to reset its password is on its way. It works for one hour.`}
      data-forgot-step="sent"
      after={backToSignIn}
    >
      <AuthStack>
        <ActLine kind="not_performed">
          Nothing was sent. The link would open the next screen.
        </ActLine>
        <Link
          href={toHref('/forgot-password/reset', address)}
          className={buttonClassName({ variant: 'secondary', size: 'large' })}
          data-open-reset-link
        >
          Open the reset link here
        </Link>
      </AuthStack>
    </AuthPage>
  )
}

export function ForgotPasswordResetRoute() {
  const { sites } = useSession()
  const router = useRouter()
  const [address] = useState(readAddress)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const person = personForAddress(address, sites)
  const forbidden =
    person === undefined
      ? []
      : forbiddenWords(
          person,
          sites.filter((site) => person.siteIds.includes(site.id)),
        )
  const ready = unmetRules(password, forbidden).length === 0 && password === confirm

  return (
    <AuthPage
      title="Choose a new password"
      data-forgot-step="reset"
      after={backToSignIn}
    >
      <AuthStack>
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <PasswordRules password={password} confirm={confirm} forbidden={forbidden} />
        <ActLine kind="not_performed">
          Nothing is saved and no session is ended: any password that meets the rules
          signs in.
        </ActLine>
        <AuthActions>
          <Button
            size="large"
            disabled={!ready}
            onClick={() => router.push('/forgot-password/done')}
          >
            Save
          </Button>
        </AuthActions>
      </AuthStack>
    </AuthPage>
  )
}

export function ForgotPasswordDoneRoute() {
  return (
    <AuthPage
      title="You can sign in"
      lede="Nothing was changed: any password that meets the rules signs you in. Your medication PIN is not affected by a password reset."
      data-forgot-step="done"
    >
      <AuthStack>
        <ActLine kind="not_performed">No confirmation email is sent.</ActLine>
        <Link href="/sign-in" className={buttonClassName({ size: 'large' })}>
          Go to sign in
        </Link>
      </AuthStack>
    </AuthPage>
  )
}
