import Link from 'next/link'
import { buttonClassName } from '@/components/primitives'
import { AuthPage } from './AuthPage'

/**
 * Signed out by inactivity (AUTH-09).
 *
 * **It names the consequence, not only the event.** Being returned to a screen
 * with no explanation reads as something having gone wrong; what happened is a
 * rule doing its job, and the work is not waiting to be picked up. There is no
 * draft recovery on the next sign-in, because nothing survives a sign-out.
 */
export function SignedOutRoute() {
  return (
    <AuthPage
      title="You were signed out due to inactivity"
      lede="Everything recorded in that session is gone: nothing in this build is saved."
      data-signed-out
    >
      <Link href="/sign-in" className={buttonClassName({ size: 'large' })}>
        Log in again
      </Link>
    </AuthPage>
  )
}
