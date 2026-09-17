import { describe, expect, it } from 'vitest'
import { CARE_ACTS, holdingFor, type CareActId } from './capabilities'

/**
 * The role table, held cell by cell against the PRD's Table 3.
 *
 * **Written out by hand rather than derived from `CARE_ACTS`.** A test that
 * iterates the declaration and checks each cell against itself agrees with
 * whatever the declaration says, including a wrong cell. This table is typed
 * from the PRD, so a cell that drifts from the PRD fails here by name.
 */
const PRD_TABLE_3: Record<CareActId, { care_worker: boolean; senior_carer: boolean }> =
  {
    edit_resident_profile: { care_worker: false, senior_carer: false },
    write_care_note: { care_worker: true, senior_carer: true },
    mark_flagged_note_reviewed: { care_worker: false, senior_carer: true },
    write_care_plan: { care_worker: false, senior_carer: false },
    update_handover_status: { care_worker: true, senior_carer: true },
    sign_handover: { care_worker: false, senior_carer: true },
    record_medication: { care_worker: true, senior_carer: true },
    view_controlled_drug_register: { care_worker: false, senior_carer: true },
    countersign_controlled_drug: { care_worker: false, senior_carer: true },
    add_interim_medication: { care_worker: false, senior_carer: false },
    report_incident: { care_worker: true, senior_carer: true },
    acknowledge_incident: { care_worker: false, senior_carer: true },
    close_incident: { care_worker: false, senior_carer: false },
    score_risk_assessment: { care_worker: false, senior_carer: true },
    conduct_review: { care_worker: false, senior_carer: true },
    add_goal_progress_note: { care_worker: true, senior_carer: true },
    set_or_close_goal: { care_worker: false, senior_carer: false },
    record_attendance: { care_worker: true, senior_carer: true },
    create_activity_session: { care_worker: false, senior_carer: true },
    record_consent: { care_worker: false, senior_carer: true },
    upload_document: { care_worker: false, senior_carer: true },
    open_compliance_and_reports: { care_worker: false, senior_carer: false },
    open_settings_and_team: { care_worker: false, senior_carer: false },
  }

describe('the role table', () => {
  for (const [act, expected] of Object.entries(PRD_TABLE_3) as [
    CareActId,
    (typeof PRD_TABLE_3)[CareActId],
  ][]) {
    for (const role of ['care_worker', 'senior_carer'] as const) {
      it(`${role} ${expected[role] ? 'holds' : 'is refused'} ${act}`, () => {
        expect(holdingFor(role, act).kind).toBe(expected[role] ? 'holds' : 'refused')
      })
    }
  }

  it('gives every refusal a reason somebody can read at the point of the act', () => {
    for (const act of Object.values(CARE_ACTS)) {
      for (const holding of [act.care_worker, act.senior_carer]) {
        if (holding.kind !== 'refused') continue
        expect(holding.reason).toMatch(/^[A-Z].+\.$/)
        // One short line, never a paragraph.
        expect(holding.reason.length).toBeLessThanOrEqual(70)
      }
    }
  })

  it('confirms with the medication PIN exactly the four acts the PRD signs with it', () => {
    const signed = (Object.keys(CARE_ACTS) as CareActId[]).filter(
      (act) => CARE_ACTS[act].confirmedWithMedicationPin,
    )
    expect(signed.sort()).toEqual(
      [
        'countersign_controlled_drug',
        'record_medication',
        'score_risk_assessment',
        'sign_handover',
      ].sort(),
    )
  })
})
