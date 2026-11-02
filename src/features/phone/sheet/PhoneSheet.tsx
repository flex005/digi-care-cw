import { useEffect, type ReactNode } from 'react'
import { SessionProvider } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { memberById } from '@/data/access/team-store'
import { staffEze, staffOsei } from '@/data/fixtures/organisation'
import type { StaffId } from '@/data/types'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { PhoneApp } from '../shell/PhoneApp'
import shell from '../shell/shell.module.css'
import styles from './sheet.module.css'

/**
 * Every phone screen at once, each in its own 390 x 844 frame, for one Figma
 * capture instead of six. The phone build's counterpart of Specimens.
 *
 * **Each frame is the real app**, started at an address and signed in as a
 * named person from the fixtures, so a change to any screen is a change here.
 * A drawn copy would be a second owner of every screen. Each frame has its own
 * session and its own stacks, and none of them touches the browser's address.
 */
const SHOTS: { caption: string; who: StaffId; address: string }[] = [
  { caption: 'Today', who: staffEze.id, address: '/m' },
  { caption: 'Your list', who: staffEze.id, address: '/m/people' },
  { caption: 'Everyone', who: staffEze.id, address: '/m/everyone' },
  { caption: 'Search', who: staffEze.id, address: '/m/search' },
  { caption: 'Nobody assigned', who: staffOsei.id, address: '/m/people' },
  {
    caption: `One ${VOCABULARY.subject.one}`,
    who: staffEze.id,
    address: '/m/people/res-okafor',
  },
]

export function PhoneSheet() {
  return (
    <div className={styles.sheet}>
      {SHOTS.map((shot) => (
        <figure key={shot.caption} className={styles.shot}>
          <figcaption className={styles.caption}>
            {shot.caption} · {memberById(shot.who)?.ref.fullName}
          </figcaption>
          <div className={shell.frame} data-phone-frame>
            <SessionProvider>
              <SignedInAs id={shot.who}>
                <PhoneApp address={shot.address} />
              </SignedInAs>
            </SessionProvider>
          </div>
        </figure>
      ))}
    </div>
  )
}

/**
 * Signs a frame's own session in as a named person at their home, the way the
 * demonstration list on the sign-in screen does, and draws nothing until then.
 */
function SignedInAs({ id, children }: { id: StaffId; children: ReactNode }) {
  const { signIn, signInAs, sites } = useSession()
  useEffect(() => {
    if (signIn.kind === 'signed_in') return
    const member = memberById(id)
    const site = sites.find((entry) => member?.siteIds.includes(entry.id))
    if (member === undefined || site === undefined)
      throw new Error(
        `The capture sheet cannot sign in ${id}: no such member at any home.`,
      )
    signInAs(member, site)
  }, [id, signIn, signInAs, sites])
  return signIn.kind === 'signed_in' ? <>{children}</> : null
}
