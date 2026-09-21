import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { IsoDateTime, Resident, RiskLevel, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { getResident, recordAssessment } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  Dialog,
  EmptyState,
  RadioGroup,
  SelectedMark,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, StatusPill, Unrecorded } from '@/components/status'
import { formatDate } from '@/lib/format'
import { MedicationPinStep } from '@/features/medications/MedicationPinStep'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { PlaceholderBanner } from './PlaceholderBanner'
import {
  EMPTY_INTERVENTION,
  levelFor,
  outstanding,
  runningScore,
  type Answers,
  type Intervention,
} from './assessment-form'
import { INSTRUMENT_ITEMS, LEVEL_LABEL, bandFor, isScored } from './instrument'
import { Icon } from '@/components/icon/Icon'
import { riskIcons } from './risk.icons'
import styles from './risk-form.module.css'

/**
 * Scoring a risk assessment. CW PRD RA-02, senior carers only.
 *
 * The sentence: **this is what the instrument reached, and it is not final
 * until every factor has an answer.**
 *
 * **The placeholder banner is on the form, not only the list.** A scorer who
 * meets the instrument here and nowhere else must still be told that the
 * weightings are invented.
 *
 * **The running score is a total of what has been answered and says so.** A
 * partial total that looked final would be a clinical band read off an
 * incomplete instrument, which is the worst figure this module could produce.
 *
 * **The subject comes from the route parameter** and stays on the screen while
 * it is filled in (CLAUDE.md §2), and the medication PIN — which is what this
 * build calls the code a person chooses at account setup — signs it.
 */
export function AssessmentFormRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ residentId: string; templateId: string }>()
  const residentId = params.residentId as Resident['id']
  const templateId = params.templateId as RiskTemplateId
  const [written, setWritten] = useState(0)
  /*
   * **Held here, not in the form.** Recording reloads the resident, which
   * remounts the form — a confirmation owned there would be destroyed by the
   * act it was reporting. The same shape the handover's status control and the
   * note review both found.
   */
  const [done, setDone] = useState('')

  const load = useCallback(() => getResident(residentId), [residentId])
  const resource = useResource<Resident>(load, [residentId, written])

  const template = RISK_ASSESSMENT_TEMPLATES.find((entry) => entry.id === templateId)

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the assessment…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error' || template === undefined)
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title={
              template === undefined
                ? 'That is not an assessment this build holds'
                : 'The record could not be loaded'
            }
            body="Nothing has been lost: nothing was recorded."
            actions={
              <Link
                href={`/residents/${residentId}/risk-assessments`}
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to the assessments
              </Link>
            }
          />
        </Card>
      </div>
    )

  return (
    <div className={styles.page}>
      {/* Above the head and on the left, as the MAR's is: the way out of a
          form is not one of the things the form offers. It was in the head's
          action slot, at the right, where the primary act of a screen goes —
          and the primary act here is scoring, at the foot of the form. */}
      <Link href={`/residents/${residentId}/risk-assessments`} className={styles.back}>
        <Icon name={riskIcons.back} size={16} />
        Back to {resource.data.preferredName}’s assessments
      </Link>
      <PageHead
        title={`${template.name}, ${resource.data.fullLegalName}`}
        lines={[activeSite.name, 'senior carers score an assessment']}
      />
      <AssessmentForm
        resident={resource.data}
        site={activeSite}
        templateId={templateId}
        templateName={template.name}
        done={done}
        onRecorded={(words) => {
          setDone(words)
          setWritten((count) => count + 1)
        }}
      />
    </div>
  )
}

/**
 * The instrument, the level and the sign-off, wherever they are opened.
 *
 * **Split from the route so a record's own Risk assessments tab can open it in
 * a dialog**, following the care note composer: scoring is done looking at what
 * is already on the record, and opening it over that record keeps the other
 * eight assessments behind it. The way out and the page head belong to the
 * route; `SubjectStrip` is inside the form, so the write surface names who it
 * is about wherever it is drawn (CLAUDE.md §2).
 */
export function AssessmentForm({
  resident,
  site,
  templateId,
  templateName,
  done,
  onRecorded,
}: {
  resident: Resident
  site: ReturnType<typeof useSession>['activeSite']
  templateId: RiskTemplateId
  templateName: string
  done: string
  onRecorded: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const id = useId()

  const [answers, setAnswers] = useState<Answers>({})
  const [chosenLevel, setChosenLevel] = useState<RiskLevel | 'not_chosen'>('not_chosen')
  const [interventions, setInterventions] = useState<Intervention[]>([
    EMPTY_INTERVENTION,
  ])
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const scored = isScored(templateId)
  const running = runningScore(answers)
  const waiting = outstanding({ templateId, answers, level: chosenLevel })
  const level = levelFor(templateId, answers, chosenLevel)
  const answer = viewer.ask('score_risk_assessment', resident.id)
  const before = resident.risks[templateId]

  const record = () => {
    const at = now().toISOString() as IsoDateTime
    if (level === 'not_chosen') return
    recordAssessment({
      residentId: resident.id,
      templateId,
      level,
      score: scored ? { kind: 'scored', value: running.total } : { kind: 'unscored' },
      by: member.ref,
      at,
    })
      .then(() => {
        setSigning(false)
        setError('')
        onRecorded(
          `${templateName} recorded for ${resident.fullLegalName} as ${LEVEL_LABEL[level]}${
            scored ? `, score ${running.total}` : ''
          }. The badge on their record says so from now, and nothing was sent.`,
        )
      })
      .catch((cause: unknown) => {
        setSigning(false)
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.')
      })
  }

  const signs = `${templateName} for ${resident.fullLegalName}: ${
    level === 'not_chosen' ? 'no level' : LEVEL_LABEL[level]
  }${scored ? `, score ${running.total} of the placeholder instrument` : ', unscored'}.`

  return (
    <div className={styles.form}>
      <Card>
        <SubjectStrip resident={resident} site={site} />
        <div className={styles.banner}>
          <PlaceholderBanner />
        </div>
        <PreviousAssessment templateName={templateName} status={before} />
      </Card>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-assessment-done>
          {done}
        </p>
      )}

      {scored ? (
        <>
          <Card>
            <div className={styles.running} data-running-score>
              <p className={styles.runningLabel}>Running score</p>
              <p className={styles.runningFigure} data-numeric>
                {running.total}
              </p>
              <p className={styles.runningOf}>
                <span data-numeric>
                  {running.answered} of {running.items}
                </span>{' '}
                items answered. The score is not final until every item has an answer.
              </p>
              <div className={styles.runningBand}>
                {running.complete ? (
                  <StatusPill
                    tone={BAND_TONE[running.band]}
                    label={`Band: ${LEVEL_LABEL[running.band].toUpperCase()}`}
                  />
                ) : (
                  <Unrecorded
                    variant="chip"
                    label={`Band so far: ${LEVEL_LABEL[bandFor(running.total)].toUpperCase()}`}
                    detail="not the band this assessment reaches until every item is answered"
                  />
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title="Assessment factors"
              subtitle={`All ${INSTRUMENT_ITEMS.length}. Every one needs an answer before this can be signed off.`}
              expand={{ kind: 'whole' }}
            />
            <ul className={styles.items}>
              {INSTRUMENT_ITEMS.map((item) => {
                const chosen = answers[item.id] ?? 'not_answered'
                return (
                  <li key={item.id} className={styles.item} data-item={item.id}>
                    <div className={styles.itemAbout}>
                      <p className={styles.itemQuestion}>{item.question}</p>
                      <p className={styles.itemGuidance}>{item.guidance}</p>
                      {chosen === 'not_answered' ? (
                        <Unrecorded
                          variant="chip"
                          label="Not answered"
                          detail="the score is incomplete until this has an answer"
                        />
                      ) : (
                        <Settled
                          label={`${item.choices[chosen]?.label ?? ''} · ${item.choices[chosen]?.points ?? 0} pts`}
                        />
                      )}
                    </div>
                    <div
                      className={styles.choices}
                      role="group"
                      aria-label={item.question}
                    >
                      {item.choices.map((choice, index) => (
                        <button
                          key={choice.label}
                          type="button"
                          className={
                            chosen === index ? styles.choiceChosen : styles.choice
                          }
                          aria-pressed={chosen === index}
                          onClick={() =>
                            setAnswers((current) => ({ ...current, [item.id]: index }))
                          }
                          data-choice={`${item.id}:${index}`}
                        >
                          <SelectedMark selected={chosen === index} />
                          <span>{choice.label}</span>
                          <span className={styles.choicePoints} data-numeric>
                            {choice.points} pts
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      ) : (
        <Card>
          <CardHead
            title="What this assessment reaches"
            subtitle="This template records findings and reaches a level without arithmetic: there is no score to compute, so the level is a judgement somebody makes and signs."
            expand={{ kind: 'whole' }}
          />
          <div className={styles.levelChoice}>
            <RadioGroup
              legend="The level this assessment reaches"
              value={chosenLevel === 'not_chosen' ? undefined : chosenLevel}
              onValueChange={(value) => setChosenLevel(value as RiskLevel)}
              options={(['low', 'moderate', 'high'] as const).map((entry) => ({
                value: entry,
                label: LEVEL_LABEL[entry],
              }))}
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHead
          title="Interventions"
          subtitle="What will be done about it, who is responsible, and when it is looked at again."
          expand={{ kind: 'whole' }}
        />
        <ul className={styles.interventions}>
          {interventions.map((entry, index) => (
            <li key={index} className={styles.intervention}>
              {/*
               * Drawn only where there is more than one, so the last row
               * cannot be taken away and leave the card with nothing in it,
               * and so nothing here is a control that refuses to work.
               */}
              {interventions.length > 1 ? (
                <div className={styles.interventionHead}>
                  <p className={styles.interventionLabel}>
                    Intervention {index + 1} of {interventions.length}
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setInterventions((current) =>
                        current.filter((_, at) => at !== index),
                      )
                    }
                    data-remove-intervention={index}
                  >
                    <Icon name={riskIcons.remove} size={16} />
                    Remove this intervention
                  </Button>
                </div>
              ) : null}
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`${id}-what-${index}`}>
                  What will be done
                </label>
                <textarea
                  id={`${id}-what-${index}`}
                  className={styles.textarea}
                  rows={2}
                  value={entry.what}
                  onChange={(event) =>
                    setInterventions((current) =>
                      current.map((item, at) =>
                        at === index ? { ...item, what: event.target.value } : item,
                      ),
                    )
                  }
                  data-intervention-what={index}
                />
              </div>
              <div className={styles.twoUp}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor={`${id}-who-${index}`}>
                    Responsible person
                  </label>
                  <input
                    id={`${id}-who-${index}`}
                    className={styles.input}
                    value={entry.who}
                    onChange={(event) =>
                      setInterventions((current) =>
                        current.map((item, at) =>
                          at === index ? { ...item, who: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor={`${id}-when-${index}`}>
                    Review date
                  </label>
                  <input
                    id={`${id}-when-${index}`}
                    className={styles.input}
                    type="date"
                    value={entry.reviewOn}
                    onChange={(event) =>
                      setInterventions((current) =>
                        current.map((item, at) =>
                          at === index
                            ? { ...item, reviewOn: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className={styles.interventionActs}>
          <Button
            variant="secondary"
            onClick={() =>
              setInterventions((current) => [...current, EMPTY_INTERVENTION])
            }
            data-add-intervention
          >
            Add another intervention
          </Button>
        </div>
      </Card>

      <Card>
        <div className={styles.foot}>
          <p className={styles.footState} data-assessment-waiting>
            {waiting.length === 0 ? (
              <>
                <strong>Everything needed is here.</strong>{' '}
                {scored
                  ? `The instrument reaches ${LEVEL_LABEL[running.band].toUpperCase()} on a score of ${running.total}.`
                  : `This records ${resident.preferredName} at ${
                      level === 'not_chosen' ? '' : LEVEL_LABEL[level].toUpperCase()
                    }.`}
              </>
            ) : (
              <>
                <strong>Waiting on:</strong> {waiting.join(' · ')}
              </>
            )}
          </p>

          {answer.kind === 'yes' ? (
            <Button
              size="large"
              disabled={waiting.length > 0}
              onClick={() => {
                setError('')
                setSigning(true)
              }}
              data-sign-off
            >
              Sign off this assessment
            </Button>
          ) : (
            <ActPoint
              answer={answer}
              label="Sign off this assessment"
              notBuilt="Signing off is not built."
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

      <Dialog
        open={signing}
        onOpenChange={setSigning}
        title={`Sign off ${templateName} for ${resident.fullLegalName}?`}
        description={`Room ${
          resident.room.kind === 'recorded' ? resident.room.value : 'not recorded'
        } · born ${formatDate(resident.dateOfBirth)}`}
      >
        {signing ? (
          <div className={styles.signing}>
            <BandChange
              templateName={templateName}
              before={before}
              after={level === 'not_chosen' ? 'low' : level}
              residentName={resident.fullLegalName}
            />
            <MedicationPinStep
              signs={signs}
              confirmLabel="Sign off"
              onConfirmed={record}
              onCancel={() => setSigning(false)}
            />
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}

const BAND_TONE: Record<RiskLevel, 'positive' | 'caution' | 'critical'> = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
}

/** What the record says now, so a re-score is visibly a re-score. */
function PreviousAssessment({
  templateName,
  status,
}: {
  templateName: string
  status: Resident['risks'][RiskTemplateId]
}) {
  const format = useSiteFormat()
  if (status.kind === 'not_assessed')
    return (
      <Unrecorded
        label={`${templateName} has never been assessed for this person`}
        detail="this is the first one: there is nothing to compare it with"
      />
    )
  return (
    <div className={styles.previous}>
      <Settled
        label={`On the record: ${LEVEL_LABEL[status.level]}${
          status.score.kind === 'scored' ? `, score ${status.score.value}` : ''
        }`}
        detail={format.attribution(status.assessedBy.displayName, status.assessedAt)}
      />
    </div>
  )
}

/**
 * What signing this changes, said before the PIN goes in.
 *
 * **A band that moves changes how this person reads on every screen**, and
 * RA-02 would have pushed that to the care workers assigned to them. Nothing is
 * sent here, so the person signing is told what they have to say out loud.
 */
function BandChange({
  templateName,
  before,
  after,
  residentName,
}: {
  templateName: string
  before: Resident['risks'][RiskTemplateId]
  after: RiskLevel
  residentName: string
}) {
  if (before.kind === 'not_assessed')
    return (
      <p className={styles.signingFacts}>
        {templateName} has never been assessed for {residentName}. Signing this puts{' '}
        {LEVEL_LABEL[after].toUpperCase()} on their record and on the badge strip
        wherever it appears.
      </p>
    )
  if (before.level === after)
    return (
      <p className={styles.signingFacts}>
        The band does not move: {residentName} stays at{' '}
        {LEVEL_LABEL[after].toUpperCase()}.
      </p>
    )
  return (
    <p className={styles.signingFacts} data-band-change>
      The band moves from {LEVEL_LABEL[before.level].toUpperCase()} to{' '}
      {LEVEL_LABEL[after].toUpperCase()}. The badge on {residentName}’s record changes
      wherever it appears, and nobody is told: say so to whoever is on shift.
    </p>
  )
}
