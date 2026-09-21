import { useRouter } from 'next/navigation'
import { useSignedIn } from '@/app/session/use-session'
import { PageHead } from '@/components/layout/PageHead'
import { SignOutConfirmation } from './SignOutDialog'
import styles from './auth.module.css'

/**
 * Signing out at its own address (AUTH-09).
 *
 * **The rail, the account menu and the profile ask in a dialog** over whatever
 * the reader is looking at, because leaving the screen to be asked whether you
 * want to leave the screen loses the thing you were looking at before you have
 * agreed to lose anything. This address stays, and is the same question:
 * anybody who arrives at it directly gets it as a page.
 */
export function SignOutRoute() {
  const { member } = useSignedIn()
  const router = useRouter()
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <div>
      <PageHead
        title={`Sign out, ${firstName}?`}
        lines={['Signing out discards everything recorded this session']}
      />
      {/* A confirmation, not a card of content: it has nowhere to expand to,
          so it takes the card's surface without its head. */}
      <section className={styles.confirm}>
        <SignOutConfirmation onStay={() => router.push('/')} />
      </section>
    </div>
  )
}
