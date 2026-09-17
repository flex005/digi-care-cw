import type { AnyConsent } from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { configuredState, type ConfiguredState } from '@/data/access/site-config-store'
import { Card, CardHead } from '@/components/primitives'
import { ConsentBadge, GapCount } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { consentGaps } from '@/features/residents/profile/record-gaps'
import { formatCount, pluralise } from '@/lib/format'
import { ConsentAuthority, EffectCountValue } from './ConsentParts'
import { CONSENT_MEANS } from './consent-meaning'
import styles from './consent-and-documents.module.css'

/**
 * A resident's consents, read.
 *
 * The sentence: **these consents have never been sought.**
 *
 * Every type always listed, iterated from the constant: a list of only the
 * ones somebody got round to asking about reads as a complete picture, and
 * absence from a list is the same bug as a blank cell.
 *
 * **Never sought is not refusal and it is not permission.** Care given without
 * either is care given without consent, which is why it takes the hatch rather
 * than sitting quietly at the bottom of the list. A refusal and a withdrawal
 * are decisions somebody recorded, and read as records.
 *
 * **The lead figure is `consentGaps`**, the function the tab's name reads, so
 * "Consent · 3 of 8 never sought" above and the figure below are one fact
 * computed once. Recording a decision is the senior carer's act and is drawn
 * at the head; nothing on this tab writes.
 */
export function ConsentTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()

  const gaps = consentGaps(resident)
  const notAsked = CONSENT_TYPES.length - gaps.asked
  const rows = CONSENT_TYPES.map((type) => {
    const status = resident.consents[type.id] as AnyConsent
    return {
      type,
      status,
      state: configuredState(resident.siteId, type.id, status.kind !== 'not_sought'),
    }
  })

  const figureOf = `of ${pluralise(gaps.asked, 'consent')} ${gaps.neverSought === 1 ? 'has' : 'have'} never been sought`
  const detail = `Nobody has asked ${resident.preferredName} or decided on their behalf, so care given now is given without consent.`

  return (
    <div className={styles.panel} data-consent-panel>
      <Card>
        <CardHead
          title={`${resident.preferredName}’s consent`}
          subtitle="What was agreed, refused or withdrawn, and who decided."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.head}>
          <div
            className={styles.lead}
            data-never-sought={gaps.neverSought}
            data-asked={gaps.asked}
          >
            {/*
             * A zero is a finding, not a gap. Hatching "0 of 8" would claim a
             * gap the record says is not there, so the hatch is drawn only
             * when there is something nobody has asked.
             */}
            {gaps.neverSought > 0 ? (
              <GapCount
                label="Never sought"
                value={gaps.neverSought}
                of={figureOf}
                detail={detail}
              />
            ) : (
              <p className={styles.plainFigure}>
                <span className={styles.figure} data-numeric>
                  {formatCount(gaps.neverSought)}
                </span>{' '}
                <span className={styles.figureOf}>{figureOf}</span>
              </p>
            )}
            {notAsked > 0 ? (
              <p className={styles.note} data-not-asked-note>
                {formatCount(notAsked)} of the {formatCount(CONSENT_TYPES.length)}{' '}
                consent types are not asked at this home and are not counted above;
                anything already recorded against them is still below.
              </p>
            ) : null}
          </div>
          <ActPoint
            answer={viewer.ask('record_consent', resident.id)}
            label="Record a consent decision"
            notBuilt="Recording consent is built in Phase 8, senior carer records."
            residentName={resident.preferredName}
          />
        </div>
      </Card>

      <Card>
        <CardHead
          title="Consent decisions"
          subtitle={`All ${formatCount(CONSENT_TYPES.length)} consent types, whether or not anybody has asked.`}
          expand={{ kind: 'whole' }}
        />
        <ul className={styles.list}>
          {rows.map(({ type, status, state }) => (
            <li
              key={type.id}
              className={styles.consentRow}
              data-consent={type.id}
              data-configured={state}
            >
              <div className={styles.about}>
                <p className={styles.rowTitle}>{type.name}</p>
                {/* A consent nobody can explain is not informed. */}
                <p className={styles.rowMeta} data-means>
                  {CONSENT_MEANS[type.id]}
                </p>
                {status.kind === 'withdrawn' && status.remains.length > 0 ? (
                  <Remains status={status} />
                ) : null}
              </div>
              <Decision status={status} state={state} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/**
 * What was decided and who decided it: two columns, because they are two
 * questions.
 *
 * **A type this home does not ask, and nobody has answered, is plain text.**
 * The hatch says nobody has looked and invites somebody to look; here the home
 * has decided there is nothing to ask. A decision already recorded against a
 * type the home has since stopped asking keeps everything it had, quietly, with
 * a line saying why nobody is being asked again.
 */
function Decision({ status, state }: { status: AnyConsent; state: ConfiguredState }) {
  if (state === 'retired_unanswered') {
    return (
      <p className={styles.notAsked} data-not-asked>
        Not asked at this home, and nothing is recorded.
      </p>
    )
  }

  return (
    <>
      <div className={styles.outcome} data-outcome={status.kind}>
        <ConsentBadge status={status} />
        {state === 'retired_answered' ? (
          <span className={styles.note} data-retired>
            This home no longer asks for this consent. The record stays.
          </span>
        ) : null}
      </div>
      <ConsentAuthority status={status} />
    </>
  )
}

/**
 * What withdrawing did not undo, still true today.
 *
 * Rendered from the record rather than from a sentence, so a withdrawal that
 * left photographs on file cannot read as one that removed them. Plain, not
 * hatched: these are counted facts, and the one nobody counted carries its own
 * hatch.
 */
function Remains({ status }: { status: Extract<AnyConsent, { kind: 'withdrawn' }> }) {
  return (
    <div className={styles.remains} data-remains={status.remains.length}>
      <p className={styles.remainsTitle}>What withdrawing did not undo</p>
      <p className={styles.rowMeta}>
        Withdrawing stopped anything new and removed nothing: each of these is
        somebody’s job.
      </p>
      <ul className={styles.list}>
        {status.remains.map((effect) => (
          <li className={styles.effect} key={effect.name} data-effect={effect.name}>
            <span className={styles.about}>
              <span className={styles.effectName}>{effect.name}</span>
              <span className={styles.rowMeta}>{effect.explanation}</span>
            </span>
            <EffectCountValue count={effect.count} />
          </li>
        ))}
      </ul>
    </div>
  )
}
