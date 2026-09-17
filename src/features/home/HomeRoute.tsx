import Link from 'next/link'
import { Card, CardHead, EmptyState, buttonClassName } from '@/components/primitives'
import { PageHead } from '@/components/layout/PageHead'
import type { IsoDateTime } from '@/data/types'
import { now } from '@/data/fixtures/clock'
import { residentsBySite } from '@/data/fixtures/residents'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { scopeLine } from '@/app/session/resident-scope'
import { SHIFT_NAMES, greetingAt, shiftAt, shiftHours } from '@/lib/shift'
import styles from './home.module.css'

/**
 * Where signing in lands while no module is built.
 *
 * The head is the one every screen will carry: who it is for, their shift, and
 * their list, said as scope. The body says what is true today and names the one
 * thing that is reachable, rather than a greeting over nothing.
 */
export function HomeRoute() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()

  const at = now().toISOString() as IsoDateTime
  const shift = shiftAt(at, activeSite.timeZone)
  const residentIds = residentsBySite(activeSite.id).map((resident) => resident.id)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  return (
    <div className={styles.page}>
      <PageHead
        title={greetingAt(at, activeSite.timeZone)}
        emphasis={firstName}
        lines={[
          `${SHIFT_NAMES[shift]} shift`,
          shiftHours(shift),
          activeSite.name,
          scopeLine(viewer.scope, residentIds, activeSite.name),
        ]}
        aside={format.dateTime(at)}
      />
      <Card>
        <CardHead
          title="Nothing is built here yet"
          subtitle="Every module opens once its screen exists."
          expand={{ kind: 'link', href: '/specimens' }}
        />
        <EmptyState
          title="No module is built yet"
          body="The tokens, primitives, shapes and evidence states are under Specimens."
          actions={
            <Link
              href="/specimens"
              className={buttonClassName({ variant: 'secondary' })}
            >
              Open specimens
            </Link>
          }
        />
      </Card>
    </div>
  )
}
