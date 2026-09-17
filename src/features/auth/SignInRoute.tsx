import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { useSession } from '@/app/session/use-session'
import { ActLine, Button, PasswordField, TextField } from '@/components/primitives'
import { AuthActions, AuthPage, AuthStack, authLinkClass } from './AuthPage'
import { forbiddenWords, unmetRules } from './password-rules'
import {
  ATTEMPTS_BEFORE_LOCK,
  LOCK_MINUTES,
  clearFailures,
  lockState,
  recordFailure,
} from './lockout'
import {
  DEMONSTRATION_PASSWORD,
  personForAddress,
  primaryAddress,
  signInPeople,
} from './sign-in-people'
import { destinationFrom } from './destination'
import styles from './auth.module.css'

const hhmm = (at: number) => {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

type Refusal =
  | { kind: 'none' }
  | { kind: 'not_recognised'; left: number }
  | { kind: 'locked'; until: number }

/**
 * Signing in (AUTH-04, and AUTH-06 at a phone's width).
 *
 * **"Email or password not recognised", and never which.** A message naming
 * the field tells somebody guessing that the address is real. The Admin build
 * says "No account here uses that address"; this follows the PRD instead, and
 * the divergence is recorded in docs/DEPARTURES.md.
 *
 * **A password is refused when it breaks the account's own rules**, which is a
 * real check: nobody could have set it. After five refusals the address locks
 * for fifteen minutes on the real clock.
 *
 * **No registration link.** Care workers are invited; they never sign up.
 */
export function SignInRoute() {
  const { sites, signIn, awaitCode } = useSession()
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [refusal, setRefusal] = useState<Refusal>({ kind: 'none' })
  /* Read as the screen mounts, while the address still carries it. */
  const [destination] = useState(() => destinationFrom(window.location.search))
  const [, setTick] = useState(0)

  useEffect(() => {
    if (signIn.kind === 'signed_in') router.replace(destination)
  }, [signIn.kind, router, destination])

  // A lock counts down, so the screen redraws while one is showing.
  useEffect(() => {
    if (refusal.kind !== 'locked') return
    const timer = setInterval(() => setTick((value) => value + 1), 15_000)
    return () => clearInterval(timer)
  }, [refusal.kind])

  const submit = () => {
    const lock = lockState(address)
    if (lock.kind === 'locked') {
      setRefusal(lock)
      return
    }
    const person = personForAddress(address, sites)
    const homes =
      person === undefined
        ? []
        : sites.filter((site) => person.siteIds.includes(site.id))
    const refused =
      person === undefined ||
      unmetRules(password, forbiddenWords(person, homes)).length > 0
    if (refused) {
      const after = recordFailure(address)
      setRefusal(
        after.kind === 'locked'
          ? after
          : { kind: 'not_recognised', left: ATTEMPTS_BEFORE_LOCK - after.failures },
      )
      return
    }
    clearFailures(address)
    awaitCode(person, address.trim().toLowerCase(), 'sign_in', destination)
    router.push('/sign-in/code')
  }

  const people = signInPeople()

  return (
    <AuthPage
      title="Sign in"
      lede="Use the email address your invitation was sent to."
      data-sign-in
      after={
        <>
          <Link
            href="/forgot-password"
            className={authLinkClass()}
            data-forgot-password
          >
            Forgot password?
          </Link>
          <Link href="/invitation" className={authLinkClass()} data-invited>
            I have been invited
          </Link>
        </>
      }
    >
      <AuthStack>
        <TextField
          label="Email"
          type="email"
          value={address}
          onChange={(next) => {
            setAddress(next)
            setRefusal({ kind: 'none' })
          }}
          autoComplete="username"
          data-field="email"
        />
        <PasswordField
          label="Password"
          value={password}
          onChange={(next) => {
            setPassword(next)
            setRefusal({ kind: 'none' })
          }}
          autoComplete="current-password"
          data-field="password"
        />

        {refusal.kind === 'not_recognised' ? (
          <p className={styles.refusal} role="alert" data-refusal="not_recognised">
            Email or password not recognised.{' '}
            {refusal.left === 1
              ? 'One more attempt, then this address is locked for 15 minutes.'
              : `${refusal.left} more attempts, then this address is locked for ${LOCK_MINUTES} minutes.`}
          </p>
        ) : null}
        {refusal.kind === 'locked' ? (
          <div className={styles.refusalBlock} role="alert" data-refusal="locked">
            <p className={styles.refusal}>
              This address is locked until {hhmm(refusal.until)}, after five attempts
              that were not recognised.
            </p>
            <ActLine kind="not_performed">
              No alert email is sent, and no manager is told.
            </ActLine>
          </div>
        ) : null}

        <AuthActions>
          <Button size="large" onClick={submit} data-sign-in-submit>
            Log in
          </Button>
        </AuthActions>

        <div className={styles.compactOnly}>
          <ActLine kind="not_built">
            Face ID and fingerprint sign-in are not available here.
          </ActLine>
        </div>
      </AuthStack>

      <div className={styles.people} data-who-list>
        <p className={styles.peopleTitle}>Who would you like to sign in as?</p>
        <ActLine kind="not_built">
          Demonstration: fills in an address and a password that meets the rules.
        </ActLine>
        <ul className={styles.peopleList}>
          {people.map((member) => {
            const fill = primaryAddress(member, sites)
            return (
              <li key={member.id}>
                <button
                  type="button"
                  className={address === fill ? styles.personOn : styles.person}
                  onClick={() => {
                    setAddress(fill)
                    setPassword(DEMONSTRATION_PASSWORD)
                    setRefusal({ kind: 'none' })
                  }}
                  data-sign-in-as={member.id}
                >
                  <span className={styles.personName}>{member.ref.fullName}</span>
                  <span className={styles.personMeta}>
                    {STAFF_ROLE_NAMES[member.role]} ·{' '}
                    {sites
                      .filter((site) => member.siteIds.includes(site.id))
                      .map((site) => site.name)
                      .join(' and ')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </AuthPage>
  )
}
