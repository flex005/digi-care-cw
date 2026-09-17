import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { IsoDateTime, Site, SiteId, StaffMember } from '@/data/types'
import { organisation } from '@/data/fixtures/organisation'
import { now as appNow } from '@/data/fixtures/clock'
import { configuredSites, organisationAsConfigured } from '@/data/access/settings-store'
import { endSession } from '@/data/access/session-losses'
import { resetViewerScope, setViewer } from '@/data/access/viewer-scope'
import { SessionContext, TimeZoneContext, type SignInState } from './context'

/**
 * Holds who is signed in and at which home.
 *
 * Starts signed out, and a reload signs you out again: nothing in this build
 * persists anywhere, and no record data may sit in browser storage.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [activeSiteId, setActiveSiteId] = useState<SiteId>('site-rosewood-court')
  const [signIn, setSignIn] = useState<SignInState>({ kind: 'signed_out' })

  const configuredAll = useMemo(() => configuredSites(), [])

  /*
   * **Keyed on which homes, never on the sign-in itself.** Every sign-in stores
   * a fresh timestamp, so memoising on `signIn` gives the array a new identity
   * on each one even when the homes are identical, and anything depending on it
   * re-runs. The Admin build met that as a render loop in its test helper. A
   * value that means "these homes" changes when the homes do.
   */
  const homeKey =
    signIn.kind === 'signed_in' ? signIn.member.siteIds.join('|') : 'signed-out'
  const sites = useMemo(() => {
    if (homeKey === 'signed-out') return configuredAll
    const held = homeKey.split('|')
    return configuredAll.filter((site) => held.includes(site.id))
  }, [configuredAll, homeKey])

  const configuredOrganisation = useMemo(
    () => organisationAsConfigured(organisation),
    [],
  )

  /*
   * Falls back to the first home this viewer holds, never to the first home
   * there is: a selected home that is not theirs would put another home's
   * residents on the screen without anybody switching to it.
   */
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0]
  if (activeSite === undefined)
    throw new Error(
      'The signed-in member holds no configured home, so there is no home whose records this session could read.',
    )

  const signInAs = useCallback((member: StaffMember, site: Site) => {
    /*
     * The loaders cannot read React context, so the viewer's id is handed to
     * them here and their homes are derived from it at call time.
     */
    setViewer(member.id)
    setActiveSiteId(site.id)
    setSignIn({
      kind: 'signed_in',
      member,
      at: appNow().toISOString() as IsoDateTime,
    })
  }, [])

  /* Destroys the work before it changes the state, so no screen re-renders
     against a signed-out session while the stores still hold this one's writes. */
  const signOut = useCallback(() => {
    endSession()
    setSignIn({ kind: 'signed_out' })
  }, [])

  /*
   * A session ends when this provider goes, not only when somebody signs out.
   * The viewer pointer is module-level, so without this it outlives the
   * provider that set it.
   */
  useEffect(() => resetViewerScope, [])

  const value = useMemo(
    () => ({
      organisation: configuredOrganisation,
      sites,
      activeSite,
      setActiveSite: (site: Site) => setActiveSiteId(site.id),
      signIn,
      signInAs,
      signOut,
    }),
    [activeSite, sites, configuredOrganisation, signIn, signInAs, signOut],
  )

  return (
    <SessionContext.Provider value={value}>
      <TimeZoneContext.Provider value={activeSite.timeZone}>
        {children}
      </TimeZoneContext.Provider>
    </SessionContext.Provider>
  )
}

/**
 * Overrides the timezone for a subtree, so a resident's records render in the
 * zone of the home that holds them.
 */
export function SiteTimeZone({
  timeZone,
  children,
}: {
  timeZone: string
  children: ReactNode
}) {
  return (
    <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>
  )
}
