import type { Answer } from '@/app/session/capabilities'
import { phoneRefusalOf } from '../phone-refusal'
import { notBuiltOnPhone } from '../not-built'

/**
 * Why a controlled drug dose is not recorded here, for whoever is reading.
 *
 * **Two different truths, and the reader gets their own.** A care worker may
 * not record one at all: the role table's refusal says who does, "A senior
 * carer records controlled drugs." A senior carer may, and the phone does not
 * do it yet, which is about this build and is true only for her. One owner, so
 * the chart, the sheet and the round cannot tell the two readers different
 * stories about the same dose.
 */
export interface ControlledDrugLine {
  kind: 'refused' | 'not_built'
  words: string
}

export function controlledDrugLine(answer: Answer, name: string): ControlledDrugLine {
  return answer.kind === 'yes'
    ? { kind: 'not_built', words: notBuiltOnPhone('Recording a controlled drug') }
    : { kind: 'refused', words: phoneRefusalOf(answer, name) }
}
