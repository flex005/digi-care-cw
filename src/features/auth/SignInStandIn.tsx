import { useRouter } from 'next/navigation'
import { STAFF_ROLE_NAMES, type StaffMember } from '@/data/types'
import { teamMembers } from '@/data/access/team-store'
import { useSession } from '@/app/session/use-session'
import { SIGN_IN_ROLES, isSignInRole } from '@/app/session/capabilities'
import { Logo } from '@/components/brand/Logo'
import styles from './SignInStandIn.module.css'

/**
 * Choose who to be. A stand-in for the authentication screens, which are not
 * built yet, so that the shell and every screen after it can be reviewed as
 * each role.
 *
 * **Only the people who could really sign in are offered**: a care worker or
 * senior carer whose access is live. Somebody suspended, gone, or never given
 * access is not a way in, and offering them would draw the product for a
 * person it refuses.
 */
export function SignInStandIn() {
  const { sites, signInAs } = useSession()
  const router = useRouter()

  const people = teamMembers().filter(
    (member) => isSignInRole(member.role) && member.standing.kind === 'has_access',
  )

  const enter = (member: StaffMember) => {
    const home = sites.find((site) => member.siteIds.includes(site.id))
    if (home === undefined)
      throw new Error(`${member.ref.fullName} holds no configured home.`)
    signInAs(member, home)
    const from = new URLSearchParams(window.location.search).get('from')
    router.replace(from !== null && from.startsWith('/') ? from : '/')
  }

  const homesOf = (member: StaffMember) =>
    sites
      .filter((site) => member.siteIds.includes(site.id))
      .map((site) => site.name)
      .join(' and ')

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <Logo variant="lockup" height={32} title="Radiant digicare" />
        <div className={styles.heading}>
          <h1 className={styles.title}>Choose who to sign in as</h1>
          <p className={styles.note}>Stand-in: nothing here checks who you are.</p>
        </div>

        {SIGN_IN_ROLES.map((role) => {
          const inRole = people.filter((member) => member.role === role)
          return (
            <section
              key={role}
              className={styles.group}
              aria-labelledby={`role-${role}`}
            >
              <h2 id={`role-${role}`} className={styles.groupTitle}>
                {STAFF_ROLE_NAMES[role]}
              </h2>
              <ul className={styles.people}>
                {inRole.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      className={styles.person}
                      onClick={() => enter(member)}
                      data-sign-in-as={member.id}
                    >
                      <span className={styles.name}>{member.ref.fullName}</span>
                      <span className={styles.homes}>{homesOf(member)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}
