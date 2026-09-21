import { useCallback, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import type { ResidentId } from '@/data/types'
import { getMedications, getResidentProfile } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Button, Card, EmptyState } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import { NotYourHome } from '@/components/status'
import { SiteTimeZone } from '@/app/session/SessionProvider'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { assertNever } from '@/lib/assert-never'
import { ProfileContext, type OpenRecord } from './ProfileContext'
import { ProfileHeader } from './ProfileHeader'
import { TabStrip } from './TabStrip'
import { NotOnYourList } from './NotOnYourList'
import { profileIcons } from './profile.icons'
import styles from './profile.module.css'

/**
 * A resident's record: the head that stays, the tab strip, and the tab. RES-02,
 * RES-03.
 *
 * **The subject comes from the address and nothing else** (CLAUDE.md §2), so
 * this reads the route parameter and loads by it, and every tab beneath reads
 * the record from here.
 *
 * **Asked before it is drawn.** Whether the viewer may open this resident is a
 * question for the role table, answered for this resident. A care worker whose
 * list does not reach them sees who it is and that they are not on the list,
 * never the record, and never a claim that the record does not exist.
 *
 * The head stays mounted across tabs because the tabs are children of this
 * layout. It is not sticky: nothing on these tabs writes, and a pinned head
 * this tall would cost the record the screen.
 */
export function ResidentProfileLayout({ children }: { children?: ReactNode }) {
  const params = useParams<{ residentId: string }>()
  const pathname = usePathname()
  const residentId = params.residentId as ResidentId
  /* The record's front page, which is the General Information tab's address. */
  const front = pathname === `/residents/${residentId}`
  const viewer = useViewer()
  const { activeSite } = useSession()

  /* Bumped when a tab writes, so what it wrote is what it then shows. */
  const [read, setRead] = useState(0)
  const reload = useCallback(() => setRead((count) => count + 1), [])

  const load = useCallback(
    () =>
      Promise.all([getResidentProfile(residentId), getMedications(residentId)]).then(
        ([profile, medications]): Omit<OpenRecord, 'reload'> => ({
          ...profile,
          medications,
        }),
      ),
    [residentId],
  )
  const resource = useResource<Omit<OpenRecord, 'reload'>>(load, [residentId, read])

  const back = (
    <Link href="/residents" className={styles.back}>
      <Icon name={profileIcons.back} size={16} />
      All residents
    </Link>
  )

  switch (resource.kind) {
    case 'loading':
      return (
        <div className={styles.page}>
          {back}
          <Card>
            <p className={styles.status} role="status">
              Loading resident…
            </p>
          </Card>
        </div>
      )

    case 'refused':
      return (
        <div className={styles.page}>
          {back}
          <NotYourHome refusal={resource} />
        </div>
      )

    case 'error':
      return (
        <div className={styles.page}>
          {back}
          <Card>
            <EmptyState
              title="This resident could not be loaded"
              body={`Nothing in this build answers to ${residentId}.`}
              actions={
                <Button variant="secondary" onClick={resource.retry}>
                  Try again
                </Button>
              }
            />
          </Card>
        </div>
      )

    case 'ready': {
      const record: OpenRecord = { ...resource.data, reload }
      const answer = viewer.ask('open_resident_record', record.resident.id)
      if (answer.kind !== 'yes')
        return (
          <div className={styles.page}>
            {back}
            <NotOnYourList answer={answer} resident={record.resident} />
          </div>
        )

      return (
        <SiteTimeZone timeZone={record.site.timeZone}>
          <ProfileContext.Provider value={record}>
            <div className={styles.page}>
              {back}
              {record.site.id === activeSite.id ? null : (
                <p className={styles.otherHome}>
                  {record.resident.preferredName} lives at {record.site.name}. You are
                  signed in at {activeSite.name}, and this record’s times are{' '}
                  {record.site.name}’s.
                </p>
              )}
              <ProfileHeader record={record} front={front} />
              <TabStrip resident={record.resident} />
              <div className={styles.tab}>{children}</div>
            </div>
          </ProfileContext.Provider>
        </SiteTimeZone>
      )
    }

    default:
      return assertNever(resource)
  }
}
