import { describe, expect, it } from 'vitest'
import {
  EMPTY_DECISION,
  alreadyDecided,
  authoritiesFor,
  outstanding,
  splitConsulted,
  type DecisionDraft,
} from './consent-decision'

/**
 * The capacity gate's rules. Table 3: "Consent — record", senior carers.
 *
 * What it refuses is the point of it, so the refusals are what is tested.
 */

const draft = (over: Partial<DecisionDraft> = {}): DecisionDraft => ({
  ...EMPTY_DECISION,
  ...over,
})

const complete = draft({
  capacity: 'has_capacity',
  assessmentNote: 'Explained it twice; she repeated it back in her own words.',
  authority: 'the_resident',
  outcome: 'given',
  method: 'verbal',
})

describe('the gate', () => {
  it('asks capacity before anything else, and nothing else is reachable first', () => {
    expect(outstanding(draft())).toContain(
      'whether they have capacity for this decision',
    )
    // No authority is offered until it is answered.
    expect(authoritiesFor('not_answered', true)).toEqual([])
  })

  it('needs both Mental Capacity Act stages where somebody lacks capacity', () => {
    const lacking = draft({ capacity: 'lacks_capacity' })
    expect(outstanding(lacking)).toContain(
      'the impairment or disturbance of mind or brain',
    )
    expect(outstanding(lacking)).toContain('which part of deciding they cannot do')
    expect(
      outstanding({
        ...lacking,
        diagnostic: 'Advanced dementia',
        functional: 'Cannot weigh the options',
      }),
    ).not.toContain('the impairment or disturbance of mind or brain')
  })

  it('asks what was said and seen, whichever way the finding went', () => {
    expect(outstanding(draft({ capacity: 'has_capacity' }))).toContain(
      'what was said and seen in the assessment',
    )
  })
})

describe('who may have decided', () => {
  it('gives the decision to the resident where they have capacity, and to nobody else', () => {
    const offered = authoritiesFor('has_capacity', true)
    expect(offered.find((entry) => entry.id === 'the_resident')?.available).toBe(true)
    expect(offered.find((entry) => entry.id === 'best_interests')?.available).toBe(
      false,
    )
    expect(offered.find((entry) => entry.id === 'lpa_holder')?.available).toBe(false)
  })

  /*
   * Only a health-and-welfare LPA can consent to care. A financial LPA
   * consenting to photography is a real-world error, so the authority is not
   * offered and the screen says why.
   */
  it('offers the LPA holder only where a health and welfare LPA is on record', () => {
    const withLpa = authoritiesFor('lacks_capacity', true)
    expect(withLpa.find((entry) => entry.id === 'lpa_holder')?.available).toBe(true)

    const without = authoritiesFor('lacks_capacity', false)
    const lpa = without.find((entry) => entry.id === 'lpa_holder')
    expect(lpa?.available).toBe(false)
    expect(lpa?.why).toMatch(/A financial LPA cannot consent to care/)
  })

  it('needs somebody consulted and a reason for a best-interests decision', () => {
    const best = draft({
      capacity: 'lacks_capacity',
      diagnostic: 'Advanced dementia',
      functional: 'Cannot retain the information',
      assessmentNote: 'Tried twice, at her best time of day.',
      authority: 'best_interests',
      outcome: 'given',
      method: 'verbal',
    })
    expect(outstanding(best)).toEqual([
      'who was consulted',
      'why this is in their interests',
    ])
    expect(
      outstanding({
        ...best,
        consulted: 'Her daughter, Ada\nDr Achebe',
        rationale: 'She has always wanted the photographs taken.',
      }),
    ).toEqual([])
  })

  it('reads consulted names one per line or separated by commas', () => {
    expect(splitConsulted('Ada , Dr Achebe\n\n  ')).toEqual(['Ada', 'Dr Achebe'])
    expect(splitConsulted('   ')).toEqual([])
  })
})

describe('what was decided', () => {
  it('is ready once the outcome and its detail are there', () => {
    expect(outstanding(complete)).toEqual([])
    expect(outstanding({ ...complete, method: 'not_chosen' })).toEqual([
      'how consent was given',
    ])
  })

  /* A refusal is a record, not a failure: it is kept with what they said. */
  it('keeps what they said on a refusal', () => {
    expect(
      outstanding({ ...complete, outcome: 'refused', method: 'not_chosen' }),
    ).toEqual(['what they said'])
    expect(
      outstanding({
        ...complete,
        outcome: 'refused',
        method: 'not_chosen',
        refusalNote: 'She does not want her picture taken.',
      }),
    ).toEqual([])
  })

  it('knows a consent already decided cannot be decided again', () => {
    expect(alreadyDecided('given')).toBe(true)
    expect(alreadyDecided('refused')).toBe(true)
    expect(alreadyDecided('not_sought')).toBe(false)
    expect(alreadyDecided('withdrawn')).toBe(false)
  })
})
