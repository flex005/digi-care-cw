import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Resident } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { notOnYourListLine } from '@/app/session/resident-scope'
import { ActionCard } from '@/components/layout/ActionCard'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NotYourHome, Settled, StatusPill, Unrecorded } from '@/components/status'
import { CONSENT_MEANS } from '@/features/residents/tabs/consent-meaning'
import { assertNever } from '@/lib/assert-never'
import { formatCount, pluralise } from '@/lib/format'
import {
  CONSENT_VIEWS,
  NEVER_SOUGHT_IS_NOT,
  STANDING_MEANS,
  countBy,
  madeForThem,
  ofView,
  rowsFor,
  type ConsentRow,
  type ConsentStanding,
  type ConsentView,
} from './consent-list'
import styles from './consent-list.module.css'

/** What the screen counts over, said once. CON-01's own sub-text. */
export const COUNTED_LINE = 'Every resident against every consent type.'

/**
 * The home's consent record. CW PRD CON-01.
 *
 * The sentence: **nobody has asked these people.**
 *
 * **Never sought is not refusal and it is not permission.** CON-01 requires
 * that sentence verbatim and it is the reason the screen exists: a reader who
 * treats an absent consent as a given one acts without it, and a reader who
 * treats it as a refusal withholds care nobody declined.
 *
 * **Decided for them is its own tab, not a shade of given.** A best-interests
 * decision and an attorney's are lawful, and they are not the resident
 * agreeing. The record already keeps who decided apart from what was decided;
 * this list reads that rather than flattening it.
 *
 * **Reach is the whole home**, per Table 3 for this screen. Whether the reader
 * can open the record behind a row is their own list's business, and where it
 * does not reach, the row says so as scope.
 */
export function ConsentListRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [view, setView] = useState<ConsentView>('never_sought')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  const head = (
    <PageHead
      title="Consent"
      lines={[activeSite.name, 'every resident against every consent type']}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading the consent record…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The consent record could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  const residents = resource.data
  const all = rowsFor(residents)
  const counts = countBy(all)
  const shown = ofView(all, view)
  const forThem = madeForThem(all)
  const seekAnswer = viewer.ask('record_consent')

  return (
    <div className={styles.page}>
      {head}

      <ActionCard
        gap
        kicker="Consents that have never been sought"
        figure={formatCount(counts.never_sought)}
        of={`of ${formatCount(all.length)} decisions this home is expected to hold`}
        detail={
          <div className={styles.bannerDetail} data-consent-banner>
            <p>
              Across {pluralise(residents.length, 'resident')} and{' '}
              {pluralise(CONSENT_TYPES.length, 'type')} at {activeSite.name}.{' '}
              <b>{NEVER_SOUGHT_IS_NOT}</b>
            </p>
          </div>
        }
        footLabel="Read in this order"
        footValue="Never sought first"
        action={
          /* **No button while they are already the view.** Never sought is the
             default tab, so a control offering to show what is on the screen
             is the grey-link problem inverted: it looks reachable and does
             nothing when pressed. */
          counts.never_sought === 0 ? (
            <span className={styles.bannerQuiet}>
              Every consent this home asks has been sought from everybody
            </span>
          ) : view === 'never_sought' ? (
            <span className={styles.bannerQuiet} data-already-shown>
              Listed below, never sought first
            </span>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: 'secondary' })}
              onClick={() => setView('never_sought')}
              data-show-never-sought
            >
              Show the {counts.never_sought} never sought
            </button>
          )
        }
      />

      {/* CON-01 gives this its own paragraph, and the reason is that it is
          lawful and it is not the same thing. Counted over decisions that were
          made, never over every row: a consent nobody sought was not made for
          anybody either. */}
      <Card>
        <CardHead
          title="Decisions made for somebody rather than by them"
          subtitle="A best-interests process, or an attorney acting under a health and welfare LPA."
          expand={{ kind: 'whole' }}
        />
        <p className={styles.figure} data-for-them-figure>
          <span className={styles.figureNumber} data-numeric>
            {formatCount(forThem.forThem)}
          </span>{' '}
          of {formatCount(forThem.decided)} decisions that have been made were made for
          somebody rather than by them. That is lawful and it is not the same thing,
          which is why the two are separate tabs.
        </p>
      </Card>

      {seekAnswer.kind === 'yes' ? null : (
        <Card>
          <CardHead
            title="Seeking consent"
            subtitle="Who may seek a consent decision, and record what was decided."
            expand={{ kind: 'whole' }}
          />
          {/* Once, at the head, rather than 224 times down the list. */}
          <div className={styles.acts}>
            <ActPoint
              answer={seekAnswer}
              label="Seek consent"
              notBuilt="Seeking consent is not built."
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHead
          title="Decisions"
          subtitle={COUNTED_LINE}
          expand={{ kind: 'whole' }}
        />

        <div className={styles.pills} role="group" aria-label="Which decisions">
          {CONSENT_VIEWS.map((entry) => {
            const chosen = entry.id === view
            const count = entry.id === 'all' ? all.length : ofView(all, entry.id).length
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => setView(entry.id)}
                data-consent-view={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>

        <p className={styles.claim} data-consent-claim>
          <span data-numeric>
            {shown.length} of {all.length}
          </span>{' '}
          shown · {COUNTED_LINE.toLowerCase()}
        </p>

        {shown.length === 0 ? (
          <p className={styles.empty}>Nothing in this view is waiting.</p>
        ) : (
          <Rows rows={shown} viewer={viewer} canSeek={seekAnswer.kind === 'yes'} />
        )}
      </Card>
    </div>
  )
}

/**
 * The rows, a page at a time — 224 of them under All.
 *
 * Its own component so the paging hook sits below the route's early returns,
 * beside the rows it pages rather than above every state the route can be in.
 */
function Rows({
  rows,
  viewer,
  canSeek,
}: {
  rows: ConsentRow[]
  viewer: ReturnType<typeof useViewer>
  canSeek: boolean
}) {
  const paged = usePaged(rows)
  return (
    <>
      <ul className={styles.rows}>
        {paged.shown.map((row) => (
          <Row
            key={`${row.resident.id}:${row.typeId}`}
            row={row}
            canSeek={canSeek}
            canOpen={viewer.ask('open_resident_record', row.resident.id).kind === 'yes'}
          />
        ))}
      </ul>
      <Pager paged={paged} total={rows.length} noun="decisions" />
    </>
  )
}

function Row({
  row,
  canSeek,
  canOpen,
}: {
  row: ConsentRow
  canSeek: boolean
  canOpen: boolean
}) {
  const { resident, typeId, typeName, standing } = row
  return (
    <li
      className={styles.row}
      data-consent-row={`${resident.id}:${typeId}`}
      data-standing={standing.kind}
    >
      <div className={styles.rowWho}>
        <p className={styles.rowName}>{resident.fullLegalName}</p>
        <p className={styles.rowMeta}>
          {resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'}
        </p>
      </div>
      <div className={styles.rowWhat}>
        <p className={styles.rowTitle}>{typeName}</p>
        {/* What consenting to this actually permits. A consent nobody can
            explain is not informed, and the list is where most readers meet
            the type for the first time. */}
        <p className={styles.rowMeans}>{CONSENT_MEANS[typeId]}</p>
      </div>
      <div className={styles.rowState}>
        <Standing standing={standing} />
      </div>
      <div className={styles.rowAct}>
        {canOpen ? (
          canSeek ? (
            <Link
              href={`/residents/${resident.id}/consent/${typeId}`}
              className={buttonClassName({ variant: 'secondary' })}
              data-seek-consent={`${resident.id}:${typeId}`}
            >
              Seek consent
            </Link>
          ) : (
            <Link
              href={`/residents/${resident.id}/consent`}
              className={buttonClassName({ variant: 'ghost' })}
              data-open-consent={`${resident.id}:${typeId}`}
            >
              Read the record
            </Link>
          )
        ) : (
          <p className={styles.notYours} data-not-on-your-list>
            {notOnYourListLine(resident.preferredName)}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * The four states CON-01 names, in the treatments it names them in: hatched,
 * amber, red and purple. The two it does not name — the resident agreeing, and
 * a consent given and taken back — render as the record they are.
 */
function Standing({ standing }: { standing: ConsentStanding }) {
  switch (standing.kind) {
    case 'never_sought':
      return (
        <Unrecorded
          variant="badge"
          label="Never sought"
          detail={STANDING_MEANS.never_sought}
        />
      )
    case 'awaiting':
      return (
        <StatusPill
          tone="caution"
          label="Awaiting a decision"
          detail={STANDING_MEANS.awaiting}
        />
      )
    case 'refused':
      return (
        <StatusPill tone="critical" label="Refused" detail={STANDING_MEANS.refused} />
      )
    case 'decided_for_them':
      return (
        <StatusPill
          tone="brand"
          label="Decided for them"
          detail={
            standing.how === 'lpa_holder'
              ? 'an attorney under a health and welfare LPA'
              : 'a best-interests decision'
          }
        />
      )
    case 'given_by_them':
      return <Settled label="Given" detail={STANDING_MEANS.given_by_them} />
    case 'withdrawn':
      return (
        <StatusPill
          tone="critical"
          label="Withdrawn"
          detail={STANDING_MEANS.withdrawn}
        />
      )
    default:
      return assertNever(standing)
  }
}
