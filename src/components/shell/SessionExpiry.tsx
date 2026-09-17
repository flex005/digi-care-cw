import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSession } from '@/app/session/use-session'
import { WARN_WITHIN_MINUTES } from '@/app/session/session-timeout'
import { Button } from '@/components/primitives'
import styles from './SessionExpiry.module.css'

/**
 * A session that ends, and says so before it does (AUTH-09).
 *
 * **The one thing in the authentication phase that is not a drawing.** The
 * clock is real, the inactivity is real, and reaching zero genuinely destroys
 * everything the session wrote. It warns for the last ten minutes, and the
 * sign-out that follows lands on a screen that says what happened.
 *
 * **Activity is a click or a keypress**, not moving between screens: somebody
 * who left the tab open on one screen is not working.
 *
 * **Caution tint and caution ink, never the fill**, and the words carry it.
 */
export function SessionExpiry() {
  const { signIn, signOut, timeoutMinutes } = useSession()
  const router = useRouter()
  const [lastActive, setLastActive] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const touch = () => setLastActive(Date.now())
    for (const event of ['pointerdown', 'keydown'] as const)
      window.addEventListener(event, touch)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      for (const event of ['pointerdown', 'keydown'] as const)
        window.removeEventListener(event, touch)
      clearInterval(tick)
    }
  }, [])

  const left = Math.max(0, lastActive + timeoutMinutes * 60_000 - now)
  const signedIn = signIn.kind === 'signed_in'

  useEffect(() => {
    if (!signedIn || left > 0) return
    signOut()
    router.replace('/signed-out')
  }, [signedIn, left, signOut, router])

  if (!signedIn || left > WARN_WITHIN_MINUTES * 60_000) return null

  const minutes = Math.floor(left / 60_000)
  const seconds = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')

  return (
    <div className={styles.bar} role="status" data-session-expiry>
      <p className={styles.text}>
        <b>
          Your session will expire in{' '}
          <span data-numeric>
            {minutes}:{seconds}
          </span>
        </b>
        , and everything recorded in it goes with it.
      </p>
      <Button
        variant="secondary"
        onClick={() => setLastActive(Date.now())}
        data-stay-signed-in
      >
        Stay signed in
      </Button>
    </div>
  )
}
