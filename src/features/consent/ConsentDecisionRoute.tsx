import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type {
  CapacityAssessment,
  CapacityAssessmentId,
  ConsentMethod,
  ConsentTypeId,
  DecisionAuthority,
  IsoDateTime,
  Resident,
} from '@/data/types'
import { CONSENT_TYPES } from '@/data/types'
import { getResident, recordConsent } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  ActLine,
  Button,
  Card,
  CardHead,
  EmptyState,
  RadioGroup,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, Unrecorded } from '@/components/status'
import { zonedDate } from '@/lib/format'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { CONSENT_MEANS } from '@/features/residents/tabs/consent-meaning'
import {
  CONSENT_METHODS,
  EMPTY_DECISION,
  alreadyDecided,
  authoritiesFor,
  decidedLine,
  outstanding,
  splitConsulted,
  type DecisionDraft,
} from './consent-decision'
import styles from './consent.module.css'

/** Said at the act: nothing about a consent decision leaves this build. */
export const NOTHING_SENT_LINE =
  'Nothing is sent: no family is told, and the Family Portal — which is not built — receives nothing.'

/**
 * Recording a consent decision. Table 3: "Consent — record", senior carers
 * only, and the CW PRD draws no screen for it.
 *
 * The sentence: **before anything else, does this person have capacity for
 * this decision?**
 *
 * **It is a gate, not a field.** The question stands alone and nothing about
 * the consent is reachable until it is answered — the Mental Capacity Act asks
 * whether this person has capacity for *this* decision at *this* time, so it is
 * answered first and answered again for a different decision on a different
 * day. Adapted from the Admin build's capacity gate, narrowed to a senior
 * carer.
 *
 * **No default anywhere on it.** A pre-selected answer is an answer nobody
 * gave, and here the first one is a legal finding about somebody's mind.
 *
 * **Blanket capacity is not expressible.** The assessment this records names
 * the one decision it was made about, which the mapped type holds at compile
 * time.
 */
export function ConsentDecisionRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ residentId: string; consentType: string }>()
  const residentId = params.residentId as Resident['id']
  const typeId = params.consentType as ConsentTypeId
  const [written, setWritten] = useState(0)
  const [done, setDone] = useState('')

  const load = useCallback(() => getResident(residentId), [residentId])
  const resource = useResource<Resident>(load, [residentId, written])
  const type = CONSENT_TYPES.find((entry) => entry.id === typeId)

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the record…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error' || type === undefined)
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title={
              type === undefined
                ? 'That is not a consent type this home asks about'
                : 'The record could not be loaded'
            }
            body="Nothing has been lost: nothing was recorded."
            actions={
              <Link
                href={`/residents/${residentId}/consent`}
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to consent
              </Link>
            }
          />
        </Card>
      </div>
    )

  return (
    <Gate
      resident={resource.data}
      site={activeSite}
      typeId={typeId}
      typeName={type.name}
      done={done}
      onRecorded={(words) => {
        setDone(words)
        setWritten((count) => count + 1)
      }}
    />
  )
}

function Gate({
  resident,
  site,
  typeId,
  typeName,
  done,
  onRecorded,
}: {
  resident: Resident
  site: ReturnType<typeof useSession>['activeSite']
  typeId: ConsentTypeId
  typeName: string
  done: string
  onRecorded: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const id = useId()
  const [draft, setDraft] = useState<DecisionDraft>(EMPTY_DECISION)
  const [error, setError] = useState('')

  const set = (next: Partial<DecisionDraft>) =>
    setDraft((current) => ({ ...current, ...next }))

  const current = resident.consents[typeId]
  const answer = viewer.ask('record_consent', resident.id)
  const lpa = resident.importantPeople.lpaHolder
  const hasWelfareLpa =
    lpa.kind === 'recorded' && lpa.value.lpaType === 'health_and_welfare'
  const authorities = authoritiesFor(draft.capacity, hasWelfareLpa)
  const waiting = outstanding(draft)
  const settled = alreadyDecided(current.kind)

  const record = () => {
    const at = now().toISOString() as IsoDateTime
    const on = zonedDate(at, site.timeZone)
    const assessment: CapacityAssessment<typeof typeId> = {
      id: `cap-session-${resident.id}-${typeId}` as CapacityAssessmentId,
      residentId: resident.id,
      finding:
        draft.capacity === 'lacks_capacity'
          ? {
              kind: 'lacks_capacity',
              diagnosticTest: draft.diagnostic.trim(),
              functionalTest: draft.functional.trim(),
            }
          : { kind: 'has_capacity' },
      covers: { [typeId]: true } as { readonly [K in typeof typeId]: true },
      assessedOn: on,
      assessedBy: member.ref,
      note: draft.assessmentNote.trim(),
    }

    const authority: DecisionAuthority<typeof typeId> | 'not_chosen' =
      draft.authority === 'the_resident'
        ? { kind: 'the_resident', assessment }
        : draft.authority === 'best_interests'
          ? {
              kind: 'best_interests',
              assessment,
              consulted: splitConsulted(draft.consulted) as [string, ...string[]],
              rationale: draft.rationale.trim(),
            }
          : draft.authority === 'lpa_holder' && lpa.kind === 'recorded'
            ? {
                kind: 'lpa_holder',
                assessment,
                who: lpa.value.name,
                documentId: lpa.value.documentId,
              }
            : 'not_chosen'

    if (authority === 'not_chosen' || draft.outcome === 'not_chosen') return

    recordConsent({
      residentId: resident.id,
      consentType: typeId,
      outcome:
        draft.outcome === 'given'
          ? { kind: 'given', method: draft.method as ConsentMethod }
          : { kind: 'refused', note: draft.refusalNote.trim() },
      authority,
      by: member.ref,
      on,
    })
      .then(() => {
        setError('')
        setDraft(EMPTY_DECISION)
        onRecorded(
          `${typeName} recorded for ${resident.fullLegalName} as ${
            draft.outcome === 'given' ? 'given' : 'refused'
          }, in your name and held in this session only.`,
        )
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.'),
      )
  }

  return (
    <div className={styles.page}>
      <PageHead
        title={`${typeName}, ${resident.fullLegalName}`}
        lines={[site.name, 'senior carers record a consent decision']}
        action={
          <Link
            href={`/residents/${resident.id}/consent`}
            className={buttonClassName({ variant: 'secondary' })}
          >
            Back to consent
          </Link>
        }
      />

      <Card>
        <SubjectStrip resident={resident} site={site} />
        <p className={styles.means} data-means>
          {CONSENT_MEANS[typeId]}
        </p>
        {settled ? (
          <Settled
            label={`${typeName} already has a decision on this record`}
            detail={decidedLine(typeName)}
          />
        ) : (
          <Unrecorded
            label="Nothing has been decided about this yet"
            detail="what you record here is the first decision on this consent"
          />
        )}
      </Card>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-consent-done>
          {done}
        </p>
      )}

      {settled ? null : (
        <>
          <Card>
            <CardHead
              title="Capacity for this decision"
              subtitle="Asked about this decision and this day, never as a standing claim about a person."
              expand={{ kind: 'whole' }}
            />
            <div className={styles.section}>
              <RadioGroup
                legend="Do they have capacity for this decision?"
                value={draft.capacity === 'not_answered' ? undefined : draft.capacity}
                onValueChange={(value) =>
                  set({
                    capacity: value as DecisionDraft['capacity'],
                    authority: 'not_chosen',
                  })
                }
                options={[
                  { value: 'has_capacity', label: 'They have capacity for it' },
                  {
                    value: 'lacks_capacity',
                    label: 'They lack capacity for it',
                  },
                ]}
              />

              {draft.capacity === 'lacks_capacity' ? (
                <div className={styles.twoUp}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${id}-diagnostic`}>
                      The impairment of, or disturbance in, mind or brain
                    </label>
                    <textarea
                      id={`${id}-diagnostic`}
                      className={styles.textarea}
                      rows={3}
                      value={draft.diagnostic}
                      onChange={(event) => set({ diagnostic: event.target.value })}
                      data-diagnostic
                    />
                    <span className={styles.fieldHint}>
                      Stage 1 of the Mental Capacity Act’s test.
                    </span>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${id}-functional`}>
                      Which part of deciding they cannot do, because of it
                    </label>
                    <textarea
                      id={`${id}-functional`}
                      className={styles.textarea}
                      rows={3}
                      value={draft.functional}
                      onChange={(event) => set({ functional: event.target.value })}
                      data-functional
                    />
                    <span className={styles.fieldHint}>
                      Stage 2. Both stages, or it is not an assessment.
                    </span>
                  </div>
                </div>
              ) : null}

              {draft.capacity === 'not_answered' ? null : (
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor={`${id}-note`}>
                    What was said and seen
                  </label>
                  <textarea
                    id={`${id}-note`}
                    className={styles.textarea}
                    rows={3}
                    value={draft.assessmentNote}
                    onChange={(event) => set({ assessmentNote: event.target.value })}
                    data-assessment-note
                  />
                  <span className={styles.fieldHint}>
                    A record of the conversation, not a conclusion.
                  </span>
                </div>
              )}
            </div>
          </Card>

          {draft.capacity === 'not_answered' ? null : (
            <Card>
              <CardHead
                title="Who decided"
                subtitle="Recorded with the decision, because who made it is part of what was decided."
                expand={{ kind: 'whole' }}
              />
              <div className={styles.section}>
                <RadioGroup
                  legend="Who made this decision?"
                  value={draft.authority === 'not_chosen' ? undefined : draft.authority}
                  onValueChange={(value) =>
                    set({ authority: value as DecisionDraft['authority'] })
                  }
                  options={authorities.map((entry) => ({
                    value: entry.id,
                    label: entry.available
                      ? entry.label
                      : `${entry.label} — ${entry.why}`,
                    disabled: !entry.available,
                  }))}
                />

                {draft.authority === 'best_interests' ? (
                  <>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor={`${id}-consulted`}>
                        Who was consulted
                      </label>
                      <textarea
                        id={`${id}-consulted`}
                        className={styles.textarea}
                        rows={2}
                        value={draft.consulted}
                        onChange={(event) => set({ consulted: event.target.value })}
                        data-consulted
                      />
                      <span className={styles.fieldHint}>
                        One per line, or separated by commas. A best-interests decision
                        reached without consulting anybody is not one.
                      </span>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor={`${id}-rationale`}>
                        Why this is in their interests
                      </label>
                      <textarea
                        id={`${id}-rationale`}
                        className={styles.textarea}
                        rows={3}
                        value={draft.rationale}
                        onChange={(event) => set({ rationale: event.target.value })}
                        data-rationale
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </Card>
          )}

          {draft.authority === 'not_chosen' ? null : (
            <Card>
              <CardHead
                title="What was decided"
                subtitle="A refusal is a record, not a failure: it is kept with what they said."
                expand={{ kind: 'whole' }}
              />
              <div className={styles.section}>
                <RadioGroup
                  legend="What was decided?"
                  value={draft.outcome === 'not_chosen' ? undefined : draft.outcome}
                  onValueChange={(value) =>
                    set({ outcome: value as DecisionDraft['outcome'] })
                  }
                  options={[
                    { value: 'given', label: 'Consent was given' },
                    { value: 'refused', label: 'Consent was refused' },
                  ]}
                />

                {draft.outcome === 'given' ? (
                  <RadioGroup
                    legend="How was it given?"
                    value={draft.method === 'not_chosen' ? undefined : draft.method}
                    onValueChange={(value) => set({ method: value as ConsentMethod })}
                    options={CONSENT_METHODS.map((entry) => ({
                      value: entry.id,
                      label: entry.label,
                    }))}
                  />
                ) : null}

                {draft.outcome === 'refused' ? (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor={`${id}-refusal`}>
                      What they said
                    </label>
                    <textarea
                      id={`${id}-refusal`}
                      className={styles.textarea}
                      rows={3}
                      value={draft.refusalNote}
                      onChange={(event) => set({ refusalNote: event.target.value })}
                      data-refusal-note
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          )}

          <Card>
            <div className={styles.foot}>
              <p className={styles.footState} data-consent-waiting>
                {waiting.length === 0 ? (
                  <>
                    <strong>Everything needed is here.</strong> It goes on the record in
                    your name.
                  </>
                ) : (
                  <>
                    <strong>Waiting on:</strong> {waiting.join(' · ')}
                  </>
                )}
              </p>

              <ActLine kind="not_performed">{NOTHING_SENT_LINE}</ActLine>

              {answer.kind === 'yes' ? (
                <Button
                  size="large"
                  disabled={waiting.length > 0}
                  onClick={record}
                  data-record-consent
                >
                  {`Record this for ${resident.preferredName}`}
                </Button>
              ) : (
                <ActPoint
                  answer={answer}
                  label="Record a consent decision"
                  notBuilt="Recording consent is not built."
                  residentName={resident.preferredName}
                />
              )}

              {error === '' ? null : (
                <p className={styles.formError} role="alert">
                  {error}
                </p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
