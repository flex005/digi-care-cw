import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { ActLine, Button, DigitField } from '@/components/primitives'
import { AuthActions, AuthPage, AuthStack, authLinkClass } from './AuthPage'
import styles from './auth.module.css'

const WINDOW_SECONDS = 10 * 60
const RESEND_AFTER_SECONDS = 60

/**
 * The six digits: "One more step" when signing in (AUTH-05), "Verify your
 * email" when setting up an account (AUTH-03).
 *
 * **Nothing is sent and nothing is checked, and that is the first line on the
 * screen**, not behind a link: a reader who is not told waits for an email.
 * Any six digits continue, as in the Admin build, because accepting one
 * particular code would be a check that looks real and is not. So the PRD's
 * "five wrong attempts" state cannot be reached, and that is recorded as a
 * departure rather than faked.
 *
 * **The timer and the resend are real**: the window counts down on the real
 * clock, and asking again resets it. Neither sends anything.
 *
 * Reachable only by passing the step before it. Arrived at any other way,
 * there is no sign-in waiting, and the screen goes back to where one starts.
 */
export function CodeStep({ purpose }: { purpose: 'sign_in' | 'set_up_account' }) {
  const { pending, signIn, acceptCode, cancelPending } = useSession()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [left, setLeft] = useState(WINDOW_SECONDS)

  const waiting = pending.kind === 'awaiting_code' && pending.purpose === purpose

  useEffect(() => {
    if (!waiting && signIn.kind === 'signed_out' && pending.kind === 'none')
      router.replace(purpose === 'sign_in' ? '/sign-in' : '/invitation')
  }, [waiting, signIn.kind, pending.kind, purpose, router])

  useEffect(() => {
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(timer)
  }, [])

  if (pending.kind !== 'awaiting_code') return null

  const minutes = Math.floor(left / 60)
  const seconds = String(left % 60).padStart(2, '0')
  const canResend = left <= WINDOW_SECONDS - RESEND_AFTER_SECONDS
  const ready = /^\d{6}$/.test(code) && left > 0
  const settingUp = purpose === 'set_up_account'

  const verify = () => {
    const outcome = acceptCode()
    router.replace(outcome === 'signed_in' ? '/' : '/sign-in/home')
  }

  return (
    <AuthPage
      title={settingUp ? 'Verify your email' : 'One more step'}
      lede={
        settingUp
          ? `We've sent a 6-digit code to ${pending.address}. Enter it below.`
          : `To keep your account secure, we've sent a 6-digit code to ${pending.address}.`
      }
      data-code-step={purpose}
      after={
        settingUp ? (
          <Link
            href={`/invitation/${pending.member.id}`}
            className={authLinkClass()}
            onClick={() => cancelPending()}
          >
            Back
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className={authLinkClass()}
            onClick={() => cancelPending()}
          >
            Use a different account
          </Link>
        )
      }
    >
      <AuthStack>
        <ActLine kind="not_performed">
          No code is sent: any six digits continue.
        </ActLine>
        <DigitField
          label="6-digit code"
          length={6}
          value={code}
          onValueChange={setCode}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- AUTH-03 and AUTH-05 ask for it: the screen has one field and nothing else to do
          autoFocus
        />
        <p className={styles.timer} data-code-window>
          {left > 0 ? (
            <>
              Good for another{' '}
              <span data-numeric>
                {minutes}:{seconds}
              </span>{' '}
              of ten minutes.
            </>
          ) : (
            'That code has run out. Ask for another.'
          )}
        </p>
        {settingUp ? (
          <ActLine kind="not_performed">
            Your account lasts until you sign out: nothing is saved.
          </ActLine>
        ) : null}
        <AuthActions>
          <Button size="large" disabled={!ready} onClick={verify} data-code-submit>
            Verify
          </Button>
          <Button
            variant="ghost"
            disabled={!canResend}
            onClick={() => {
              setLeft(WINDOW_SECONDS)
              setCode('')
            }}
            data-resend
          >
            {canResend
              ? 'Send another code'
              : `Another code can be asked for in ${RESEND_AFTER_SECONDS - (WINDOW_SECONDS - left)}s`}
          </Button>
        </AuthActions>
      </AuthStack>
    </AuthPage>
  )
}

export const SignInCodeRoute = () => <CodeStep purpose="sign_in" />
export const InvitationVerifyRoute = () => <CodeStep purpose="set_up_account" />
