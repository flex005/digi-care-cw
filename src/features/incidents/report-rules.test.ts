import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  asksAboutInjury,
  canHaveNoResident,
  outstanding,
  subjectOf,
  type ReportDraft,
} from './report-rules'

/**
 * The report form's rules, as arithmetic. CW PRD INC-02, INC-03.
 *
 * Tested without the screen, because the rule is the thing under test.
 */

const NOW = '2026-09-18T19:20:00.000Z'

const draft = (over: Partial<ReportDraft> = {}): ReportDraft => ({
  ...EMPTY_DRAFT,
  ...over,
})

const complete = draft({
  subject: 'resident',
  residentId: 'res-okafor',
  type: 'fall_witnessed',
  occurredAt: '2026-09-18T19:00',
  place: 'lounge',
  description: 'He slipped by the window and sat down heavily.',
  severity: 'low_harm',
  injury: 'none_found',
  witnesses: 'nobody',
  immediateAction: 'Stayed with him, checked him over, told the senior.',
  emergency: 'not_called',
})

describe('an empty form', () => {
  it('names everything it is waiting on, in the order it asks', () => {
    expect(outstanding(draft(), NOW)).toEqual([
      'what kind of incident it was',
      'who this happened to',
      'when it happened',
      'where it happened',
      'what happened, in your own words',
      'how much harm was caused',
      'whether anybody saw it',
      'what you did about it',
      'whether emergency services were called',
    ])
  })

  it('is ready when every answer is there', () => {
    expect(outstanding(complete, NOW)).toEqual([])
  })
})

describe('who it happened to', () => {
  it('offers "no resident was involved" only for an equipment failure or a near miss', () => {
    expect(canHaveNoResident('not_chosen')).toBe(false)
    expect(canHaveNoResident('fall_witnessed')).toBe(false)
    expect(canHaveNoResident('equipment_failure')).toBe(true)
    expect(canHaveNoResident('near_miss')).toBe(true)
  })

  it('takes the choice back if the type changes under it', () => {
    const chosen = draft({ subject: 'no_resident', type: 'near_miss' })
    expect(subjectOf(chosen)).toBe('no_resident')
    // A fall recorded against nobody is a lost subject, not a statement.
    expect(subjectOf({ ...chosen, type: 'fall_unwitnessed' })).toBe('not_chosen')
    expect(outstanding({ ...chosen, type: 'fall_unwitnessed' }, NOW)).toContain(
      'who this happened to',
    )
  })

  it('asks which resident once a resident is the answer', () => {
    expect(outstanding(draft({ subject: 'resident' }), NOW)).toContain('which resident')
  })
})

describe('the injury question', () => {
  it('is asked about a person and not about a hoist', () => {
    expect(asksAboutInjury(complete)).toBe(true)
    const equipment = draft({
      subject: 'no_resident',
      type: 'equipment_failure',
      occurredAt: '2026-09-18T19:00',
      place: 'corridor',
      description: 'The hoist sling was frayed at the left strap.',
      severity: 'no_harm',
      witnesses: 'nobody',
      immediateAction: 'Took it out of use and labelled it.',
      emergency: 'not_called',
    })
    expect(asksAboutInjury(equipment)).toBe(false)
    expect(outstanding(equipment, NOW)).toEqual([])
  })

  it('holds the form until one of the three answers is given', () => {
    expect(outstanding({ ...complete, injury: 'not_chosen' }, NOW)).toEqual([
      'whether they were checked for injury',
    ])
  })

  /*
   * The two states this module exists to keep apart. Both are complete
   * answers, and neither is the absence of one.
   */
  it('treats "not checked yet" as an answer, not a gap in the form', () => {
    expect(outstanding({ ...complete, injury: 'not_checked' }, NOW)).toEqual([])
    expect(outstanding({ ...complete, injury: 'none_found' }, NOW)).toEqual([])
  })

  it('holds "injuries found" until a site is marked', () => {
    expect(outstanding({ ...complete, injury: 'found', marked: [] }, NOW)).toEqual([
      'at least one injury site',
    ])
    expect(
      outstanding({ ...complete, injury: 'found', marked: ['head'] }, NOW),
    ).toEqual([])
  })
})

describe('when it happened', () => {
  it('refuses a time in the future, because it is a record of something that happened', () => {
    expect(outstanding({ ...complete, occurredAt: '2026-09-19T08:00' }, NOW)).toEqual([
      'a time that is not in the future',
    ])
  })
})

describe('emergency services', () => {
  /*
   * Two answers and no absence. A form that did not ask would write "nobody
   * called an ambulance" in the reporter's name, which is the claim the
   * evidence invariant exists to stop.
   */
  it('is asked, and an answer of "called" names what they said', () => {
    expect(outstanding({ ...complete, emergency: 'not_chosen' }, NOW)).toEqual([
      'whether emergency services were called',
    ])
    expect(outstanding({ ...complete, emergency: 'ambulance_999' }, NOW)).toEqual([
      'what the emergency service said',
    ])
    expect(
      outstanding(
        {
          ...complete,
          emergency: 'nhs_111',
          emergencyOutcome: 'Advised to watch him and call back if he worsens.',
        },
        NOW,
      ),
    ).toEqual([])
  })
})

describe('who saw it', () => {
  it('needs an answer, and names where "somebody saw it" has no names', () => {
    expect(outstanding({ ...complete, witnesses: 'not_chosen' }, NOW)).toEqual([
      'whether anybody saw it',
    ])
    expect(
      outstanding({ ...complete, witnesses: 'witnessed', witnessNames: '  ' }, NOW),
    ).toEqual(['who saw it'])
    expect(
      outstanding(
        { ...complete, witnesses: 'witnessed', witnessNames: 'S. Patel' },
        NOW,
      ),
    ).toEqual([])
  })
})
