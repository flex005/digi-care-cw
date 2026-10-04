import { describe, expect, it } from 'vitest'
import { medications } from '@/data/fixtures/medications'
import { doseAndForm } from './medication-words'

/**
 * The dose beside the form, said once.
 *
 * **The register printed "10mg · 10mg · modified release tablets"** for five of
 * its six controlled drugs: `form` carries the strength and the presentation,
 * and the row put `dose` in front of it. Each field was correct on its own,
 * which is why reading either one never showed it — it took reading the
 * rendered string back.
 */
describe('a strength is stated once', () => {
  it('drops the dose when the form already opens with it', () => {
    expect(doseAndForm({ dose: '10mg', form: '10mg · modified release tablets' })).toBe(
      '10mg · modified release tablets',
    )
  })

  /*
   * Two facts rather than one repeated: a 1g dose of 500mg tablets is two
   * tablets, and 2.5mg of a 10mg/5ml solution is a volume somebody measures.
   */
  it('keeps both where they are different facts', () => {
    expect(doseAndForm({ dose: '1g', form: '500mg · tablets' })).toBe(
      '1g · 500mg · tablets',
    )
    expect(doseAndForm({ dose: '2.5mg', form: '10mg/5ml · oral solution' })).toBe(
      '2.5mg · 10mg/5ml · oral solution',
    )
  })

  /** Never a prefix match that is not a whole field: "10mg" against "100mg". */
  it('does not treat a longer strength as the same one', () => {
    expect(doseAndForm({ dose: '10mg', form: '100mg · tablets' })).toBe(
      '10mg · 100mg · tablets',
    )
  })

  /*
   * Over the fixtures themselves, so the claim is about this home's record
   * rather than about three examples.
   */
  it('says no strength twice anywhere in the register', () => {
    const controlled = medications.filter((entry) => entry.isControlledDrug)
    expect(controlled.length).toBeGreaterThan(0)
    for (const entry of controlled) {
      const said = doseAndForm(entry)
      const strength = entry.form.split(' · ')[0]
      const times = said.split(strength).length - 1
      expect(times, `${entry.name}: ${said}`).toBe(1)
    }
  })
})
