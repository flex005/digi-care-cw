import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { STAFF_ROLE_NAMES, type SiteId } from '@/data/types'
import { residentsBySite } from '@/data/fixtures/residents'
import { useSession } from '@/app/session/use-session'
import { ActLine, Button, SelectedMark } from '@/components/primitives'
import { pluralise } from '@/lib/format'
import { AuthActions, AuthPage, AuthStack, authLinkClass } from './AuthPage'
import styles from './auth.module.css'

/**
 * Which home, for somebody who works at more than one (AUTH-07). Skipped for
 * everybody else.
 *
 * **Name, role, residents and timezone on each card.** The PRD also asks for
 * the address and when the person last visited; no home's address and no
 * visit is held, so neither is drawn. The timezone is shown because the choice
 * decides which zone every record written today carries.
 *
 * **Nothing remembers the choice**, and the screen says so: there is nowhere in
 * this build to keep a default.
 */
export function HomeChoiceRoute() {
  const { pending, signIn, sites, signInAs, cancelPending } = useSession()
  const router = useRouter()
  const [chosen, setChosen] = useState<SiteId | undefined>(undefined)

  useEffect(() => {
    if (pending.kind !== 'choosing_home' && signIn.kind === 'signed_out')
      router.replace('/sign-in')
  }, [pending.kind, signIn.kind, router])

  if (pending.kind !== 'choosing_home') return null
  const { member } = pending
  const homes = sites.filter((site) => member.siteIds.includes(site.id))
  const home = homes.find((site) => site.id === chosen)

  return (
    <AuthPage
      title="Which site are you working at today?"
      lede={`You work at ${homes.map((site) => site.name).join(' and ')}.`}
      data-home-choice
      after={
        <Link
          href="/sign-in"
          className={authLinkClass()}
          onClick={() => cancelPending()}
        >
          Use a different account
        </Link>
      }
    >
      <AuthStack>
        <fieldset className={styles.homes}>
          <legend className={styles.visuallyHiddenLegend}>Home</legend>
          {homes.map((site) => {
            const selected = site.id === chosen
            return (
              <label
                key={site.id}
                className={selected ? styles.homeOn : styles.home}
                data-home-option={site.id}
              >
                <input
                  type="radio"
                  name="home"
                  className={styles.homeRadio}
                  checked={selected}
                  onChange={() => setChosen(site.id)}
                />
                <span className={styles.homeText}>
                  <span className={styles.homeName}>{site.name}</span>
                  <span className={styles.homeMeta}>
                    {STAFF_ROLE_NAMES[member.role]} ·{' '}
                    {pluralise(residentsBySite(site.id).length, 'resident')} ·{' '}
                    {site.timeZone}
                  </span>
                </span>
                <SelectedMark selected={selected} />
              </label>
            )
          })}
        </fieldset>
        <ActLine kind="not_performed">
          Nothing remembers this choice: you choose each time you sign in.
        </ActLine>
        <AuthActions>
          <Button
            size="large"
            disabled={home === undefined}
            onClick={() => {
              if (home === undefined) return
              signInAs(member, home)
              router.replace('/')
            }}
            data-home-continue
          >
            Continue
          </Button>
        </AuthActions>
      </AuthStack>
    </AuthPage>
  )
}
