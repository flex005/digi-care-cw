import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/app/session/use-session'

/**
 * Nothing in the product renders until somebody has signed in.
 *
 * **This enforces nothing about security and is not pretending to.** What it
 * does enforce is that a home is chosen before the first record is read, and
 * that the person every write will carry exists.
 *
 * Where somebody was going is carried to the sign-in screen, so signing in
 * lands there rather than on the front door.
 */
export function RequireSignIn({ children }: { children: ReactNode }) {
  const { signIn } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (signIn.kind !== 'signed_out') return
    const from = window.location.pathname
    router.replace(
      from === '/' ? '/sign-in' : `/sign-in?from=${encodeURIComponent(from)}`,
    )
  }, [signIn.kind, router])

  return signIn.kind === 'signed_out' ? null : <>{children}</>
}
