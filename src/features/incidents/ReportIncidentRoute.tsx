import { useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  BodyRegionId,
  CommunalAreaId,
  ImmediateResponse,
  Incident,
  IncidentLocation,
  IncidentSeverityId,
  IncidentSubject,
  IncidentTypeId,
  InjuryMap,
  IsoDateTime,
  Resident,
  StaffRef,
} from '@/data/types'
import { COMMUNAL_AREAS, INCIDENT_TYPES } from '@/data/types'
import { getResidentsBySite, reportIncident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { BodyMap } from '@/assets/body-map/BodyMap'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  ActLine,
  Avatar,
  Button,
  Card,
  CardHead,
  RadioGroup,
  Select,
} from '@/components/primitives'
import { AllergyBadge, NotYourHome, Unrecorded } from '@/components/status'
import { instantFromZonedWallClock, pluralise, zonedWallClockInput } from '@/lib/format'
import { HARM_GLOSS, regionName, severityName, typePhrase } from './incident-words'
import {
  EMPTY_DRAFT,
  asksAboutInjury,
  canHaveNoResident,
  outstanding,
  subjectOf,
  type EmergencyChoice,
  type InjuryChoice,
  type ReportDraft,
} from './report-rules'
import styles from './incidents.module.css'

/** Said at the act, because INC-03's confirmation claims a notification. */
export const NOT_NOTIFIED_LINE =
  'Nothing is sent when you report this: no manager is notified, and no badge changes anywhere else.'

/** The three injury answers, in INC-03's own words. */
const INJURY_OPTIONS: { value: InjuryChoice; label: string }[] = [
  {
    value: 'not_checked',
    label:
      'Not checked yet — nobody has examined them. This is a gap, and it shows as one.',
  },
  {
    value: 'none_found',
    label:
      'Checked: no injury found — somebody looked. A recorded negative, not a blank.',
  },
  {
    value: 'found',
    label: 'Checked: injuries found — mark each site on the body map.',
  },
]

/**
 * Report an incident. CW PRD INC-02 and INC-03, on one screen as INC-02 asks.
 *
 * The sentence: **this happened to this person, and you are the one recording
 * it.**
 *
 * **Everything on one screen, no wizard.** An incident is written up minutes
 * after it happened by somebody who wants to get back to the resident; a wizard
 * makes them answer in an order somebody else chose and hides how much is left.
 *
 * **This is the one write surface where the subject is chosen rather than
 * given**, so §2's usual protection — identity from the route parameter — does
 * not apply, and what replaces it is that the choice is explicit and closed: a
 * resident, or a recorded statement that no resident was involved. Never a
 * blank, never a default, and the chosen resident's photo, room and date of
 * birth stay on the screen while it is filled in.
 *
 * **The role table is asked about the resident, and the question is drawn at
 * the act.** Table 3 gives a care worker "Can (any time)" and does not say for
 * whose residents, so a resident off their list leaves the submit unavailable
 * with the PRD's own question beside it rather than a yes or a no. An incident
 * with no resident involved carries no resident at all, so nothing is asked.
 */
export function ReportIncidentRoute() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  const router = useRouter()
  const id = useId()

  const [draft, setDraft] = useState<ReportDraft>(() => ({
    ...EMPTY_DRAFT,
    // INC-02: defaults to now, with the prompt to correct it.
    occurredAt: zonedWallClockInput(
      now().toISOString() as IsoDateTime,
      activeSite.timeZone,
    ),
  }))
  const [view, setView] = useState<'front' | 'back'>('front')
  const [error, setError] = useState('')
  const [reported, setReported] = useState<Incident | 'not_yet'>('not_yet')

  const load = useMemo(() => () => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  const set = (next: Partial<ReportDraft>) =>
    setDraft((current) => ({ ...current, ...next }))

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />
  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <PageHead title="Report an incident" lines={[activeSite.name]} />
        <Card>
          <p className={styles.status} role="status">
            Loading…
          </p>
        </Card>
      </div>
    )
  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        <PageHead title="Report an incident" lines={[activeSite.name]} />
        <Card>
          <p className={styles.formError} role="alert">
            The residents could not be loaded, so there is nobody to report about.
          </p>
        </Card>
      </div>
    )

  const residents = resource.data
  const at = now().toISOString() as IsoDateTime
  const subject = subjectOf(draft)
  const resident = residents.find((person) => person.id === draft.residentId)
  const waiting = outstanding(draft, at)

  /*
   * Asked of the role table for the resident chosen, and only where one is.
   * "No resident was involved" is not a report about somebody the viewer's list
   * may or may not reach, so it asks for the role alone.
   */
  const answer =
    subject === 'resident' && resident !== undefined
      ? viewer.ask('report_incident', resident.id)
      : viewer.ask('report_incident')

  const submit = () => {
    if (waiting.length > 0 || answer.kind !== 'yes') return
    /*
     * Never a fallback. `outstanding` has already refused every one of these,
     * so a missing answer here is a bug in the rule rather than a value to
     * invent — and inventing one would put a type or a harm level on a clinical
     * record that nobody chose.
     */
    if (draft.type === 'not_chosen' || draft.severity === 'not_chosen')
      throw new Error('The form submitted with nothing chosen for type or harm.')
    const occurredAt = instantFromZonedWallClock(draft.occurredAt, activeSite.timeZone)
    const chosenSubject: IncidentSubject =
      subject === 'resident' && resident !== undefined
        ? { kind: 'resident', residentId: resident.id }
        : { kind: 'no_resident_involved', recordedBy: member.ref }

    const location: IncidentLocation =
      draft.place === 'resident_room'
        ? resident !== undefined && resident.room.kind === 'recorded'
          ? { kind: 'resident_room', room: resident.room.value }
          : { kind: 'not_recorded' }
        : draft.place === 'not_chosen'
          ? { kind: 'not_recorded' }
          : { kind: 'communal', area: draft.place }

    const injuries: InjuryMap = injuryFrom(draft, { by: member.ref, at })

    const response: ImmediateResponse = {
      immediateAction: draft.immediateAction,
      witnesses:
        draft.witnesses === 'witnessed'
          ? {
              kind: 'witnessed',
              people: draft.witnessNames
                .split(',')
                .map((name) => name.trim())
                .filter((name) => name !== '') as [string, ...string[]],
              recordedBy: member.ref,
            }
          : { kind: 'nobody_witnessed', recordedBy: member.ref },
      /*
       * INC-02 and INC-03 ask for none of these three, and the record has no
       * blank for any of them.
       *
       * **The GP and the family are recorded as not yet contacted**, which is
       * what is true the moment a report is written: it is the unfinished
       * member, it renders as unfinished, and it can only ever under-claim.
       *
       * **Emergency services are asked**, because their record has two members
       * and neither is an absence: writing "nobody called an ambulance" because
       * a form did not ask would be a claim in the reporter's name that the
       * reporter never made.
       */
      gp: { kind: 'not_yet' },
      family: { kind: 'not_yet' },
      emergencyServices:
        draft.emergency === 'not_called' || draft.emergency === 'not_chosen'
          ? { kind: 'not_called' }
          : {
              kind: 'called',
              service: draft.emergency,
              at,
              by: member.ref,
              outcome: draft.emergencyOutcome.trim(),
            },
    }

    reportIncident({
      siteId: activeSite.id,
      subject: chosenSubject,
      type: draft.type,
      severity: draft.severity,
      occurredAt,
      location,
      description: draft.description,
      injuries,
      response,
      by: member.ref,
      at,
    })
      .then((incident) => {
        setReported(incident)
        setError('')
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was reported.'),
      )
  }

  if (reported !== 'not_yet')
    return (
      <div className={styles.page}>
        <PageHead title="Incident reported" lines={[activeSite.name]} />
        <Card>
          <CardHead
            title={`${
              reported.subject.kind === 'resident' && resident !== undefined
                ? `${resident.fullLegalName}’s ${typePhrase(reported.type)}`
                : `A ${typePhrase(reported.type)} with no resident involved`
            } is on the record`}
            subtitle={`Reported by ${member.ref.displayName}, and held in this session only.`}
            expand={{ kind: 'whole' }}
          />
          <Unrecorded
            variant="panel"
            label="Not acknowledged"
            detail="nobody has picked it up yet: it waits on the incidents list until a senior carer does"
          />
          <ActLine kind="not_performed">{NOT_NOTIFIED_LINE}</ActLine>
          <div className={styles.foot}>
            <Button
              variant="secondary"
              size="large"
              onClick={() => router.push('/incidents')}
            >
              Back to incidents
            </Button>
          </div>
        </Card>
      </div>
    )

  return (
    <div className={styles.page}>
      <PageHead
        title="Report an incident"
        lines={[activeSite.name, 'everything on one screen']}
      />

      <Card>
        {/* ---- who ------------------------------------------------------- */}
        <section className={styles.section} aria-labelledby="who-heading">
          <h2 className={styles.sectionTitle} id="who-heading">
            Who this happened to
          </h2>
          <RadioGroup
            legend="Who this happened to"
            value={subject === 'not_chosen' ? undefined : subject}
            onValueChange={(value) => set({ subject: value as ReportDraft['subject'] })}
            options={[
              { value: 'resident', label: 'A resident — choose the person below.' },
              {
                value: 'no_resident',
                label: canHaveNoResident(draft.type)
                  ? 'No resident was involved — a statement that nobody was, not a blank.'
                  : 'No resident was involved — available for an equipment failure or a near miss. Choose the type first.',
                disabled: !canHaveNoResident(draft.type),
              },
            ]}
          />

          {subject === 'resident' ? (
            <div className={styles.field}>
              <Select
                labelVisible
                label="Resident"
                placeholder="Choose the person this happened to"
                value={draft.residentId === '' ? undefined : draft.residentId}
                onValueChange={(value) => set({ residentId: value })}
                options={residents.map((person) => ({
                  value: person.id,
                  label: `${person.fullLegalName}${
                    person.room.kind === 'recorded'
                      ? ` · Room ${person.room.value}`
                      : ' · Room not recorded'
                  }`,
                }))}
              />
              {resident === undefined ? null : (
                <SubjectCard resident={resident} siteName={activeSite.name} />
              )}
            </div>
          ) : null}
        </section>

        {/* ---- what ------------------------------------------------------ */}
        <section className={styles.section} aria-labelledby="what-heading">
          <h2 className={styles.sectionTitle} id="what-heading">
            What happened
          </h2>

          <div className={styles.twoUp}>
            <Select
              labelVisible
              label="Type"
              placeholder="Choose a type"
              value={draft.type === 'not_chosen' ? undefined : draft.type}
              onValueChange={(value) => set({ type: value as IncidentTypeId })}
              options={INCIDENT_TYPES.map((entry) => ({
                value: entry.id,
                label: entry.name,
              }))}
            />
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${id}-when`}>
                When it happened
              </label>
              <input
                id={`${id}-when`}
                className={styles.input}
                type="datetime-local"
                value={draft.occurredAt}
                onChange={(event) => set({ occurredAt: event.target.value })}
                data-occurred-at
              />
              <span className={styles.fieldHint}>
                Not when you are writing this up. The clock is {activeSite.name}’s.
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <Select
              labelVisible
              label="Where it happened"
              placeholder="Choose where"
              value={draft.place === 'not_chosen' ? undefined : draft.place}
              onValueChange={(value) =>
                set({ place: value as CommunalAreaId | 'resident_room' })
              }
              options={[
                ...(resident !== undefined && resident.room.kind === 'recorded'
                  ? [
                      {
                        value: 'resident_room',
                        label: `${resident.preferredName}’s room (Room ${resident.room.value})`,
                      },
                    ]
                  : []),
                ...COMMUNAL_AREAS.map((entry) => ({
                  value: entry.id,
                  label: entry.name,
                })),
              ]}
            />
          </div>

          <div className={styles.field}>
            <RadioGroup
              legend="Anyone who saw it"
              value={draft.witnesses === 'not_chosen' ? undefined : draft.witnesses}
              onValueChange={(value) =>
                set({ witnesses: value as ReportDraft['witnesses'] })
              }
              options={[
                {
                  value: 'nobody',
                  label: 'Nobody saw it — recorded as unwitnessed, in your name.',
                },
                { value: 'witnessed', label: 'Somebody saw it' },
              ]}
            />
            {draft.witnesses === 'witnessed' ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor={`${id}-witnesses`}>
                  Who saw it
                </label>
                <input
                  id={`${id}-witnesses`}
                  className={styles.input}
                  value={draft.witnessNames}
                  onChange={(event) => set({ witnessNames: event.target.value })}
                  data-witness-names
                />
                <span className={styles.fieldHint}>
                  Names, separated by commas. Staff, family, anybody who was there.
                </span>
              </div>
            ) : null}
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${id}-description`}>
              In your own words
            </label>
            <textarea
              id={`${id}-description`}
              className={styles.textarea}
              rows={5}
              placeholder="What you found, what you saw, what the resident said."
              value={draft.description}
              onChange={(event) => set({ description: event.target.value })}
              data-description
            />
            <span className={styles.fieldHint}>
              Written for whoever reads this next: a manager tonight, an inspector in a
              year.
            </span>
          </div>
        </section>

        {/* ---- harm ------------------------------------------------------ */}
        <section className={styles.section} aria-labelledby="harm-heading">
          <h2 className={styles.sectionTitle} id="harm-heading">
            How much harm was caused
          </h2>
          <RadioGroup
            legend="How much harm was caused"
            value={draft.severity === 'not_chosen' ? undefined : draft.severity}
            onValueChange={(value) => set({ severity: value as IncidentSeverityId })}
            options={(
              ['no_harm', 'low_harm', 'moderate_harm', 'severe_harm'] as const
            ).map((id) => ({
              value: id,
              label: `${severityName(id)} — ${HARM_GLOSS[id]}`,
            }))}
          />
        </section>

        {/* ---- injury ---------------------------------------------------- */}
        {asksAboutInjury(draft) ? (
          <section className={styles.section} aria-labelledby="injury-heading">
            <h2 className={styles.sectionTitle} id="injury-heading">
              Injury
            </h2>
            <RadioGroup
              legend="Injury"
              value={draft.injury === 'not_chosen' ? undefined : draft.injury}
              onValueChange={(value) => set({ injury: value as InjuryChoice })}
              options={INJURY_OPTIONS}
            />

            {draft.injury === 'found' ? (
              <div className={styles.bodyMap} data-body-map>
                <div className={styles.pills} role="group" aria-label="Body map view">
                  {(['front', 'back'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={view === side ? styles.pillChosen : styles.pill}
                      aria-pressed={view === side}
                      onClick={() => setView(side)}
                      data-body-view={side}
                    >
                      {side === 'front' ? 'Front' : 'Back'}
                    </button>
                  ))}
                </div>
                <div className={styles.bodyMapFigure}>
                  <BodyMap
                    view={view}
                    marked={draft.marked}
                    onToggle={(regionId: BodyRegionId) =>
                      set({
                        marked: draft.marked.includes(regionId)
                          ? draft.marked.filter((entry) => entry !== regionId)
                          : [...draft.marked, regionId],
                      })
                    }
                  />
                </div>
                {/* The map is the input; this list is the record. */}
                {draft.marked.length === 0 ? (
                  <Unrecorded
                    label="No injury site marked yet"
                    detail="injuries found, and the record does not say where"
                  />
                ) : (
                  <p className={styles.markedList} data-marked-sites>
                    {pluralise(draft.marked.length, 'site')} marked:{' '}
                    {draft.marked.map(regionName).join(', ')}
                  </p>
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ---- who else was called --------------------------------------- */}
        <section className={styles.section} aria-labelledby="called-heading">
          <h2 className={styles.sectionTitle} id="called-heading">
            Were emergency services called?
          </h2>
          <p className={styles.fieldHint}>
            Asked because the record has no blank for it: either somebody dialled or
            nobody did, and this build will not answer it in your name. The GP and the
            family are recorded as not yet contacted, which is what is true as you write
            this.
          </p>
          <RadioGroup
            legend="Were emergency services called?"
            value={draft.emergency === 'not_chosen' ? undefined : draft.emergency}
            onValueChange={(value) => set({ emergency: value as EmergencyChoice })}
            options={[
              { value: 'not_called', label: 'Nobody called them' },
              { value: 'ambulance_999', label: '999 — ambulance' },
              { value: 'nhs_111', label: 'NHS 111' },
            ]}
          />
          {draft.emergency === 'ambulance_999' || draft.emergency === 'nhs_111' ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${id}-emergency`}>
                What they said or did
              </label>
              <input
                id={`${id}-emergency`}
                className={styles.input}
                value={draft.emergencyOutcome}
                onChange={(event) => set({ emergencyOutcome: event.target.value })}
                data-emergency-outcome
              />
            </div>
          ) : null}
        </section>

        {/* ---- what you did ---------------------------------------------- */}
        <section className={styles.section} aria-labelledby="did-heading">
          <h2 className={styles.sectionTitle} id="did-heading">
            What you did about it
          </h2>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${id}-action`}>
              Immediate action taken
            </label>
            <textarea
              id={`${id}-action`}
              className={styles.textarea}
              rows={4}
              placeholder="What you did in the minutes after."
              value={draft.immediateAction}
              onChange={(event) => set({ immediateAction: event.target.value })}
              data-immediate-action
            />
            <span className={styles.fieldHint}>
              Your words, at the time. The manager writes their own account when they
              review it.
            </span>
          </div>
        </section>

        <div className={styles.foot}>
          <p className={styles.footState} data-report-waiting>
            {waiting.length === 0 ? (
              <>
                <strong>Everything needed is here.</strong> It is reported as not
                acknowledged until a senior carer picks it up.
              </>
            ) : (
              <>
                <strong>Waiting on:</strong> {waiting.join(' · ')}
              </>
            )}
          </p>

          <ActLine kind="not_performed">{NOT_NOTIFIED_LINE}</ActLine>

          {answer.kind === 'yes' ? (
            <Button
              size="large"
              disabled={waiting.length > 0}
              onClick={submit}
              data-report-submit
            >
              Report this incident
            </Button>
          ) : (
            <ActPoint
              answer={answer}
              label="Report this incident"
              notBuilt="Reporting is not built."
              residentName={resident?.preferredName}
            />
          )}

          {error === '' ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

/** The injury record, from the three answers the form offers. */
function injuryFrom(
  draft: ReportDraft,
  recorded: { by: StaffRef; at: IsoDateTime },
): InjuryMap {
  if (!asksAboutInjury(draft)) return { kind: 'not_recorded' }
  switch (draft.injury) {
    case 'none_found':
      return { kind: 'no_injuries_found', recorded }
    case 'found':
      return {
        kind: 'marked',
        regions: draft.marked as [BodyRegionId, ...BodyRegionId[]],
        recorded,
      }
    case 'not_checked':
    case 'not_chosen':
      return { kind: 'not_recorded' }
  }
}

/**
 * The subject card, and the allergy on it.
 *
 * **An allergy is an attribute of the person, not an alert on a task.** It is
 * here for the same reason it is on the round: once a subject card carries
 * allergies anywhere, carrying them everywhere is what keeps their absence
 * unambiguous, and it renders in all three states.
 */
function SubjectCard({ resident, siteName }: { resident: Resident; siteName: string }) {
  return (
    <div className={styles.subjectCard} data-subject={resident.id}>
      <Avatar photo={resident.photo} name={resident.fullLegalName} size="medium" />
      <div className={styles.subjectWho}>
        <p className={styles.subjectName}>{resident.fullLegalName}</p>
        <p className={styles.subjectMeta}>
          {resident.preferredName} ·{' '}
          {resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'}{' '}
          · {siteName}
        </p>
      </div>
      <AllergyBadge status={resident.allergies} />
    </div>
  )
}
