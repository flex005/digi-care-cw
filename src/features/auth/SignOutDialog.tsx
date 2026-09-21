import { useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { sessionLosses } from '@/data/access/session-losses'
import { pinHoldings } from '@/app/session/medication-pins'
import { draftHoldings } from '@/features/notes/composer/draft-store'
import { preferenceHoldings } from '@/features/profile/preference-store'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { Button, Dialog } from '@/components/primitives'
import { formatCount, pluralise } from '@/lib/format'
import styles from './auth.module.css'

/**
 * Signing out (AUTH-09), asked over the screen the reader is on.
 *
 * **It was a page**, and a page is the wrong shape for it: leaving the screen
 * to be asked whether you want to leave the screen loses the thing you were
 * looking at before you have agreed to lose anything. The question is asked
 * over the work it would destroy, and answering "Stay signed in" puts the
 * reader back exactly where they were rather than at the home page.
 *
 * **The one act in this build that destroys work rather than failing to save
 * it**, so it is a confirmation that names what would go, item by item, with
 * counts (CLAUDE.md §2: a confirmation says what it is about).
 */
let asked = 0
const listeners = new Set<() => void>()

/** Ask for the sign-out confirmation, from the rail, the menu or the profile. */
export function askToSignOut(): void {
  asked += 1
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const read = () => asked

/**
 * Mounted once in the shell, so every way of asking opens the same dialog and
 * none of them needs to know what signing out would cost.
 */
export function SignOutDialog() {
  const count = useSyncExternalStore(subscribe, read, () => asked)
  /*
   * Starts even with whatever has been asked already, so a dialog mounting
   * after a question was put does not open on it. The counter outlives any one
   * shell — a sign-in after a sign-out mounts a second one — and without this
   * the new shell would open on the old shell's question.
   */
  const [answered, setAnswered] = useState(() => asked)
  const open = count > answered

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAnswered(count)
      }}
      title="Sign out?"
    >
      {/* Keyed on the asking, so the losses are read when the question is put
          rather than when the shell mounted: the list somebody agrees to is
          the list destroyed. */}
      {open ? (
        <SignOutConfirmation key={count} onStay={() => setAnswered(count)} />
      ) : null}
    </Dialog>
  )
}

/**
 * What signing out would destroy, and the two answers.
 *
 * Shared with `/sign-out`, which is the same question at its own address.
 * **Read once, on the way in**: the list somebody agreed to is the list
 * destroyed.
 */
export function SignOutConfirmation({ onStay }: { onStay: () => void }) {
  const { signOut } = useSession()
  const { member } = useSignedIn()
  const router = useRouter()
  const [losses] = useState(() => [
    ...sessionLosses(),
    ...pinHoldings(),
    ...draftHoldings(),
    ...preferenceHoldings(),
  ])
  const total = losses.reduce((running, entry) => running + entry.count, 0)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <div className={styles.signOutBody} data-sign-out>
      <p className={styles.signOutLede}>
        {firstName}, signing out discards everything recorded this session.
      </p>
      <h2 className={styles.confirmTitle}>
        {losses.length > 0 ? 'What you would lose' : 'Nothing to lose'}
      </h2>
      {losses.length > 0 ? (
        <ul className={styles.losses} data-loss-list>
          {losses.map((entry) => (
            <li key={entry.what} className={styles.loss} data-loss={entry.what}>
              <span>{entry.what.charAt(0).toUpperCase() + entry.what.slice(1)}</span>
              <span className={styles.lossCount} data-numeric>
                {formatCount(entry.count)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.nothingToLose} data-nothing-to-lose>
          Nothing has been recorded this session, so signing out loses nothing.
        </p>
      )}
      <div className={styles.signOutActions}>
        <Button variant="secondary" size="large" onClick={onStay}>
          Stay signed in
        </Button>
        <Button
          variant="destructive"
          size="large"
          onClick={() => {
            signOut()
            router.replace('/sign-in')
          }}
          data-confirm-sign-out
        >
          {total === 0
            ? 'Sign out'
            : `Sign out and discard ${pluralise(total, 'record')}`}
        </Button>
      </div>
    </div>
  )
}
