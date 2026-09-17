import { useCallback, useMemo, useState } from 'react'
import type { Resident } from '@/data/types'
import type { HandoverBoard } from '@/data/access/handover-store'
import { getHandoverBoard, getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { noListYetLine } from '@/app/session/resident-scope'
import { ActionCard } from '@/components/layout/ActionCard'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { PageHead } from '@/components/layout/PageHead'
import {
  ActLine,
  Avatar,
  Button,
  Card,
  CardHead,
  EmptyState,
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled } from '@/components/status'
import { formatCount, formatDate, pluralise } from '@/lib/format'
import { SHIFT_NAMES } from '@/lib/shift'
import { HandoverStatusBadge } from './HandoverStatusBadge'
import { LastNoteLine } from './LastNoteLine'
import { SignatureCard } from './SignatureCard'
import { StatusControl } from './StatusControl'
import { UnsignedHandover } from './UnsignedHandover'
import { groupRows, type GroupId } from './handover-groups'
import styles from './handover.module.css'

/** The line the head carries, decided and not to be reworded. */
export const NO_HANDOVER_PUSH_LINE =
  'Nothing is sent from this screen: no push, no alert, and no count goes anywhere else.'

/** What the board is counted over, said once, because it is not the viewer's list. */
export const WHOLE_HOME_LINE =
  'Every resident at this home, whether or not anybody has got to them yet.'

/**
 * Shift handover. CW PRD HO-01.
 *
 * The sentence this screen exists to say: **these residents have not been
 * looked at, and somebody is about to sign.** So the not-reviewed count is the
 * dark card, the only figure on the screen still changeable before the
 * signature goes on, and the other three sit beside it as supporting figures.
 *
 * **The board is the home's, not the viewer's list.** HO-01 says every resident
 * at the site, whether or not anybody has got to them, and a handover is a
 * property of the shift rather than of an assignment: the incoming shift is
 * taking the whole building. So nothing here is counted over the viewer's
 * residents and the head says what it is counted over instead. What *is* asked
 * per resident is the act: a care worker marking somebody off their list draws
 * the PRD's silence at the control (`update_handover_status`).
 *
 * **The rows are built from the home's residents, never from the handover's
 * entries.** A resident missing from the record renders as Not reviewed, which
 * is a true statement about them. Iterating the entries would make "nobody
 * looked at Mrs Adeyemi" indistinguishable from "Mrs Adeyemi is not here".
 */
export function HandoverRoute() {
  const { activeSite } = useSession()
  /*
   * Not reviewed is the pill that opens. Urgent is information the reader has
   * received either way; not reviewed is the only group still fixable before
   * the signature.
   */
  const [group, setGroup] = useState<GroupId>('not_reviewed')
  const [written, setWritten] = useState(0)
  const [done, setDone] = useState('')

  const load = useCallback(
    () =>
      Promise.all([
        getHandoverBoard(activeSite.id),
        getResidentsBySite(activeSite.id),
      ]).then(([board, residents]) => ({ board, residents })),
    [activeSite.id],
  )
  const resource = useResource<{ board: HandoverBoard; residents: Resident[] }>(load, [
    activeSite.id,
    written,
  ])

  const head = (lines: string[]) => <PageHead title="Handover" lines={lines} />

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head([activeSite.name])}
        <Card>
          <p className={styles.status} role="status">
            Loading the handover…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head([activeSite.name])}
        <Card>
          <EmptyState
            title="The handover could not be loaded"
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

  return (
    <Board
      board={resource.data.board}
      residents={resource.data.residents}
      siteName={activeSite.name}
      group={group}
      onGroup={setGroup}
      done={done}
      onWritten={(words) => {
        setDone(words)
        setWritten((count) => count + 1)
      }}
    />
  )
}

function Board({
  board,
  residents,
  siteName,
  group,
  onGroup,
  done,
  onWritten,
}: {
  board: HandoverBoard
  residents: Resident[]
  siteName: string
  group: GroupId
  onGroup: (id: GroupId) => void
  done: string
  onWritten: (words: string) => void
}) {
  const { session } = board
  const viewer = useViewer()
  /*
   * **One line, not one per row.** A care worker nobody has given a list is
   * refused at every resident, and six identical sentences down a list is the
   * shape the omissions screen already rejected: it says the same thing the
   * head says, once per row, between the reader and the record. The board is
   * still theirs to read — it is the shift's, not a list's.
   */
  const noList = viewer.scope.kind === 'not_decided'
  const byId = useMemo(() => {
    const map = new Map<string, Resident>()
    for (const resident of residents) map.set(resident.id, resident)
    return map
  }, [residents])

  const groups = groupRows(board.rows)
  const shown = groups.find((entry) => entry.id === group) ?? groups[0]!
  const countOf = (id: GroupId) =>
    groups.find((entry) => entry.id === id)?.rows.length ?? 0
  const total = board.rows.length

  return (
    <div className={styles.page}>
      <PageHead
        title={`${SHIFT_NAMES[session.outgoingShift]} shift handover`}
        lines={[
          siteName,
          formatDate(session.date),
          `handing over to the ${SHIFT_NAMES[session.incomingShift].toLowerCase()} shift`,
        ]}
        action={
          <a
            href="#handover-signature"
            className={buttonClassName({ variant: 'primary', size: 'large' })}
          >
            Go to the signature
          </a>
        }
      />

      <div className={styles.head}>
        <ActLine kind="not_performed">{NO_HANDOVER_PUSH_LINE}</ActLine>
      </div>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-handover-done>
          {done}
        </p>
      )}

      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker={`This shift at ${siteName}`}
            figure={formatCount(board.notReviewed)}
            of={`of ${pluralise(total, 'resident')} living at ${siteName} have not been looked at`}
            detail={
              <div className={styles.bannerDetail} data-handover-banner>
                <p>{WHOLE_HOME_LINE}</p>
                <p>
                  The only figure here you can still change before the handover is
                  signed.
                </p>
              </div>
            }
            footLabel="Reviewed so far"
            footValue={`${board.reviewed} of ${total}`}
            action={
              board.notReviewed === 0 ? (
                <span className={styles.bannerQuiet}>
                  Everybody living here has been looked at
                </span>
              ) : (
                <a
                  href="#handover-residents"
                  className={buttonClassName({ variant: 'secondary' })}
                  onClick={() => onGroup('not_reviewed')}
                  data-go-not-reviewed
                >
                  Go to the {board.notReviewed} nobody has seen
                </a>
              )
            }
          />
        </div>

        {/*
         * The three findings are counted over the residents somebody actually
         * looked at. That denominator is deliberately not the whole home:
         * counting the unreviewed in it would claim a coverage nobody has.
         */}
        <MetricTiles label={`This shift at ${siteName}`}>
          <MetricTile
            label="Urgent"
            icon={metricIcons.urgent}
            figure={<MetricValue>{formatCount(countOf('urgent'))}</MetricValue>}
            of={`of ${pluralise(board.reviewed, 'resident')} reviewed this shift`}
          />
          <MetricTile
            label="Needs attention"
            icon={metricIcons.attention}
            figure={
              <MetricValue>{formatCount(countOf('needs_attention'))}</MetricValue>
            }
            of={`of ${pluralise(board.reviewed, 'resident')} reviewed this shift`}
          />
          <MetricTile
            label="All well"
            icon={metricIcons.settled}
            figure={<MetricValue>{formatCount(countOf('all_well'))}</MetricValue>}
            of={`of ${pluralise(board.reviewed, 'resident')} reviewed this shift`}
          />
        </MetricTiles>
      </div>

      {/* ---- the residents ------------------------------------------------ */}
      <Card>
        <div id="handover-residents" className={styles.anchor}>
          <CardHead
            title="Residents"
            subtitle={WHOLE_HOME_LINE}
            expand={{ kind: 'whole' }}
          />
        </div>

        <div className={styles.pills} role="group" aria-label="Resident status">
          {groups.map((entry) => {
            const chosen = entry.id === shown.id
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => onGroup(entry.id)}
                data-status-pill={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.title} · {formatCount(entry.rows.length)}
                </span>
              </button>
            )
          })}
        </div>

        {noList ? (
          <div className={styles.noList} data-no-list>
            <ActLine kind="refused">{noListYetLine}</ActLine>
            <p className={styles.empty}>
              The handover is the shift&rsquo;s, so it is all here to read. Recording a
              status is per resident, and nobody has given you any.
            </p>
          </div>
        ) : null}

        <p className={styles.claim} data-group-claim>
          <span data-numeric>
            {shown.rows.length} of{' '}
            {shown.denominator === 'all_residents' ? total : board.reviewed}
          </span>{' '}
          {shown.denominator === 'all_residents'
            ? `residents living at ${siteName}`
            : 'residents somebody reviewed this shift'}
        </p>

        {shown.rows.length === 0 ? (
          <p className={styles.empty}>{shown.emptyNote}</p>
        ) : (
          <ul className={styles.rows}>
            {shown.rows.map((row) => {
              const resident = byId.get(row.residentId)
              if (resident === undefined) return null
              return (
                <li
                  key={row.residentId}
                  className={styles.row}
                  data-resident={row.residentId}
                  data-status={row.status.kind}
                >
                  <div className={styles.rowWho}>
                    <Avatar
                      photo={resident.photo}
                      name={resident.fullLegalName}
                      size="small"
                    />
                    <div>
                      <p className={styles.rowName}>{resident.preferredName}</p>
                      <p className={styles.rowFacts}>
                        {resident.fullLegalName}
                        {resident.room.kind === 'recorded'
                          ? ` · Room ${resident.room.value}`
                          : ' · Room not recorded'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.rowStatus}>
                    <HandoverStatusBadge status={row.status} />
                    {row.status.kind === 'needs_attention' ||
                    row.status.kind === 'urgent' ? (
                      <p className={styles.rowNote}>{row.status.note}</p>
                    ) : null}
                    {/* A hatched row with no context says only that nobody
                        looked. With the silence measured it says which
                        unreviewed resident to go to first. */}
                    {row.status.kind === 'not_reviewed' ? (
                      <LastNoteLine last={row.lastNote} />
                    ) : null}
                  </div>

                  {noList ? null : (
                    <div className={styles.rowAct}>
                      <StatusControl
                        handoverId={session.id}
                        resident={resident}
                        current={row.status}
                        onRecorded={(name, status) =>
                          onWritten(
                            `${name} recorded as ${status} on this handover. The incoming shift sees it here; nothing was sent.`,
                          )
                        }
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* ---- the signature ------------------------------------------------ */}
      <Card>
        <div id="handover-signature" className={styles.anchor}>
          <CardHead
            title="Signature"
            subtitle="A handover is complete only when both shifts have signed it."
            expand={{ kind: 'whole' }}
          />
        </div>
        <div className={styles.signatures}>
          <SignatureCard
            handoverId={session.id}
            side="outgoing"
            shift={session.outgoingShift}
            signature={session.outgoing}
            reviewed={board.reviewed}
            notReviewed={board.notReviewed}
            date={session.date}
            siteName={siteName}
            onSigned={onWritten}
          />
          <SignatureCard
            handoverId={session.id}
            side="incoming"
            shift={session.incomingShift}
            signature={session.incoming}
            reviewed={board.reviewed}
            notReviewed={board.notReviewed}
            date={session.date}
            siteName={siteName}
            onSigned={onWritten}
          />
        </div>
      </Card>

      {/* ---- earlier handovers -------------------------------------------- */}
      <Card>
        <CardHead
          title="Earlier handovers still missing a signature"
          subtitle={`Counted over every handover recorded for ${siteName}, not only recent ones.`}
          expand={{ kind: 'whole' }}
        />
        {board.unsigned.length === 0 ? (
          <Settled
            label={`Every earlier handover at ${siteName} has both signatures.`}
            detail="Nothing was handed over without somebody recording that they took it."
          />
        ) : (
          <ul className={styles.unsignedList}>
            {board.unsigned.map((session) => (
              <UnsignedHandover key={session.id} session={session} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
