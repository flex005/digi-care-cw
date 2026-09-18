import { describe, expect, it } from 'vitest'
import type { IsoDate, ResidentId } from '@/data/types'
import { staffEze, staffNwosu, staffOkonkwo } from '@/data/fixtures/organisation'
import { CARE_ACTS, answerFor, type CareActId, type Grant } from './capabilities'
import type { ResidentScope } from './resident-scope'

/**
 * The role table, held cell by cell against the PRD's Table 3.
 *
 * **Written out by hand rather than derived from `CARE_ACTS`.** A test that
 * iterates the declaration and checks each cell against itself agrees with
 * whatever the declaration says, including a wrong cell. This table is typed
 * from the PRD, so a cell that drifts from it fails here by name.
 *
 * Each cell is what the role may do and over whom: `no` for a refusal, and for
 * a grant the reach. The row each act answers to is written beside it.
 */
type Cell = 'no' | 'contradicted' | Extract<Grant, { kind: 'may' }>['over']

const PRD_TABLE_3: Record<
  CareActId,
  { row: string; care_worker: Cell; senior_carer: Cell }
> = {
  open_resident_record: {
    row: 'Dashboard — view all residents',
    care_worker: 'your_list',
    senior_carer: 'every_resident',
  },
  edit_resident_profile: {
    row: 'Residents — edit profile',
    care_worker: 'no',
    senior_carer: 'no',
  },
  write_care_note: {
    row: 'Care Notes — write',
    care_worker: 'your_list',
    senior_carer: 'every_resident',
  },
  correct_care_note: {
    row: 'docs/DEPARTURES.md, Care notes: only the author corrects a note',
    care_worker: 'records_you_wrote',
    senior_carer: 'records_you_wrote',
  },
  mark_flagged_note_reviewed: {
    row: 'Care Notes — mark flagged reviewed',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  write_care_plan: { row: 'Care Plan — view', care_worker: 'no', senior_carer: 'no' },
  update_handover_status: {
    row: 'HO-01',
    care_worker: 'not_stated_beyond_your_list',
    senior_carer: 'your_list',
  },
  sign_handover: {
    row: 'Handover — sign off',
    care_worker: 'no',
    senior_carer: 'no_resident',
  },
  record_medication: {
    row: 'Medications — record Given/Not Given/PRN',
    care_worker: 'not_stated_beyond_your_list',
    senior_carer: 'your_list',
  },
  record_controlled_drug_dose: {
    row: 'Medications — countersign controlled drugs',
    care_worker: 'contradicted',
    senior_carer: 'your_list',
  },
  close_omission: { row: 'MED-01', care_worker: 'no', senior_carer: 'your_list' },
  view_controlled_drug_register: {
    row: 'MED-03',
    care_worker: 'no',
    senior_carer: 'no_resident',
  },
  countersign_controlled_drug: {
    row: 'Medications — countersign controlled drugs',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  add_interim_medication: {
    row: 'Medications — add interim',
    care_worker: 'no',
    senior_carer: 'no',
  },
  report_incident: {
    row: 'Incidents — report',
    care_worker: 'not_stated_beyond_your_list',
    senior_carer: 'your_list',
  },
  acknowledge_incident: {
    row: 'Incidents — acknowledge or close',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  close_incident: {
    row: 'Incidents — acknowledge or close',
    care_worker: 'no',
    senior_carer: 'no',
  },
  decide_cqc_notification: {
    row: 'INC-01',
    care_worker: 'no',
    senior_carer: 'no',
  },
  score_risk_assessment: {
    row: 'Risk Assessments — score/re-score',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  conduct_review: {
    row: 'Reviews — conduct',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  add_goal_progress_note: {
    row: 'Goals — add progress note',
    care_worker: 'not_stated_beyond_your_list',
    senior_carer: 'your_list',
  },
  set_or_close_goal: {
    row: 'Goals — create or close',
    care_worker: 'no',
    senior_carer: 'no',
  },
  record_attendance: {
    row: 'Activities — record attendance',
    care_worker: 'not_stated_beyond_your_list',
    senior_carer: 'your_list',
  },
  create_activity_session: {
    row: 'Activities — create session',
    care_worker: 'no',
    senior_carer: 'no_resident',
  },
  record_consent: {
    row: 'Consent — record',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  upload_document: {
    row: 'Documents — upload',
    care_worker: 'no',
    senior_carer: 'your_list',
  },
  change_your_email: {
    row: 'PROF-01',
    care_worker: 'no',
    senior_carer: 'no',
  },
  change_your_role: {
    row: 'PROF-01',
    care_worker: 'no',
    senior_carer: 'no',
  },
  open_compliance_and_reports: {
    row: 'Compliance and Reports',
    care_worker: 'no',
    senior_carer: 'no',
  },
  open_settings_and_team: {
    row: 'Settings / Team Management',
    care_worker: 'no',
    senior_carer: 'no',
  },
}

const cellOf = (grant: Grant): Cell =>
  grant.kind === 'may_not'
    ? 'no'
    : grant.kind === 'contradicted'
      ? 'contradicted'
      : grant.over

describe('the role table', () => {
  for (const [act, expected] of Object.entries(PRD_TABLE_3) as [
    CareActId,
    (typeof PRD_TABLE_3)[CareActId],
  ][]) {
    for (const role of ['care_worker', 'senior_carer'] as const) {
      it(`${role}: ${act} is ${expected[role]}`, () => {
        expect(cellOf(CARE_ACTS[act][role])).toBe(expected[role])
      })
    }

    it(`${act} names the row or screen it came from`, () => {
      const source = CARE_ACTS[act].source
      expect(
        source.kind === 'role_table'
          ? source.row
          : source.kind === 'screen'
            ? source.screen
            : source.see,
      ).toBe(expected.row)
    })
  }

  it('gives every refusal a reason somebody can read at the point of the act', () => {
    for (const act of Object.values(CARE_ACTS)) {
      for (const grant of [act.care_worker, act.senior_carer]) {
        if (grant.kind !== 'may_not') continue
        expect(grant.reason).toMatch(/^[A-Z].+\.$/)
        // One short line, never a paragraph.
        expect(grant.reason.length).toBeLessThanOrEqual(70)
      }
    }
  })

  it('confirms with the medication PIN exactly the acts the PRD signs with it', () => {
    const signed = (Object.keys(CARE_ACTS) as CareActId[]).filter(
      (act) => CARE_ACTS[act].confirmation === 'medication_pin',
    )
    expect(signed.sort()).toEqual(
      [
        'countersign_controlled_drug',
        'record_controlled_drug_dose',
        'record_medication',
        'score_risk_assessment',
        'sign_handover',
      ].sort(),
    )
  })

  it('holds the three things a level per module could not', () => {
    // "both shifts must sign"
    expect(CARE_ACTS.sign_handover.completion).toEqual({
      kind: 'needs_a_second_signature',
      by: 'the_other_shift',
      when: 'always',
    })
    // "Witness 2" on a controlled drug
    expect(CARE_ACTS.record_controlled_drug_dose.completion).toEqual({
      kind: 'needs_a_second_signature',
      by: 'a_second_senior_witness',
      when: 'always',
    })
    // "Can acknowledge · Manager closes"
    expect(CARE_ACTS.acknowledge_incident.completion).toMatchObject({
      kind: 'handed_on',
      by: 'manager',
    })
  })
})

describe('asking', () => {
  const viewer = staffEze.id

  const listed = 'res-okafor' as ResidentId
  const notListed = 'res-whitcombe' as ResidentId
  const named: ResidentScope = {
    kind: 'named_residents',
    residents: [listed],
    decidedBy: staffOkonkwo,
    on: '2026-07-15' as IsoDate,
  }
  const senior: ResidentScope = { kind: 'every_resident', because: 'senior_carer' }

  it('opens a resident on the list', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'open_resident_record',
        {
          kind: 'resident',
          id: listed,
        },
        viewer,
      ),
    ).toEqual({
      kind: 'yes',
      confirmation: 'none',
      completion: { kind: 'done_when_done' },
    })
  })

  it('says a resident is not on the list, rather than refusing the role', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'open_resident_record',
        {
          kind: 'resident',
          id: notListed,
        },
        viewer,
      ),
    ).toEqual({ kind: 'not_on_your_list' })
  })

  it('says nobody has given a list, rather than that the resident is not on it', () => {
    expect(
      answerFor(
        'care_worker',
        { kind: 'not_decided' },
        'write_care_note',
        {
          kind: 'resident',
          id: listed,
        },
        viewer,
      ),
    ).toEqual({ kind: 'no_list_yet' })
  })

  it('answers yes on the list, where the PRD is not silent', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'record_medication',
        { kind: 'resident', id: listed },
        viewer,
      ).kind,
    ).toBe('yes')
  })

  it('quotes both rows of a contradiction, and does not decide it', () => {
    const answer = answerFor(
      'care_worker',
      named,
      'record_controlled_drug_dose',
      { kind: 'resident', id: listed },
      viewer,
    )
    expect(answer.kind).toBe('contradicted')
    expect(answer).toMatchObject({
      question: expect.stringContaining('Can (PIN required)'),
    })
    expect(answer).toMatchObject({
      question: expect.stringContaining('Both must be Senior+'),
    })
  })

  it('surfaces a silence as a question for a resident off the list, never as yes or no', () => {
    const answer = answerFor(
      'care_worker',
      named,
      'record_medication',
      {
        kind: 'resident',
        id: notListed,
      },
      viewer,
    )
    expect(answer.kind).toBe('not_stated')
    expect(answer).toMatchObject({ question: expect.stringContaining('care worker') })
  })

  it('refuses the role with the table’s own words', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'record_consent',
        {
          kind: 'resident',
          id: listed,
        },
        viewer,
      ),
    ).toEqual({
      kind: 'not_your_role',
      reason: 'Recording consent is for a senior carer.',
    })
  })

  it('reaches every resident for a senior carer', () => {
    expect(
      answerFor(
        'senior_carer',
        senior,
        'score_risk_assessment',
        {
          kind: 'resident',
          id: notListed,
        },
        viewer,
      ),
    ).toMatchObject({ kind: 'yes', confirmation: 'medication_pin' })
  })

  it('refuses to answer an act about the home as though it were about a resident', () => {
    expect(() =>
      answerFor(
        'senior_carer',
        senior,
        'sign_handover',
        {
          kind: 'resident',
          id: listed,
        },
        viewer,
      ),
    ).toThrow(/not an act on a resident/)
  })

  it('lets the author correct their own note, about a resident on their list', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'correct_care_note',
        { kind: 'record', resident: listed, writtenBy: staffEze },
        viewer,
      ).kind,
    ).toBe('yes')
  })

  it('tells anybody else, a senior carer included, who wrote it', () => {
    const answer = answerFor(
      'senior_carer',
      senior,
      'correct_care_note',
      { kind: 'record', resident: listed, writtenBy: staffNwosu },
      viewer,
    )
    expect(answer).toEqual({
      kind: 'not_the_author',
      author: staffNwosu,
      reason: 'Only C. Nwosu, who wrote it, can correct it.',
    })
  })

  it('refuses the author a correction about a resident no longer on their list', () => {
    expect(
      answerFor(
        'care_worker',
        named,
        'correct_care_note',
        { kind: 'record', resident: notListed, writtenBy: staffEze },
        viewer,
      ),
    ).toEqual({ kind: 'not_on_your_list' })
  })
})
