import type {
  DocumentCategoryId,
  ExpiryDecision,
  IsoDate,
  StaffRef,
} from '@/data/types'

/**
 * Filing a document. Table 3: "Documents — upload", senior carers, and the CW
 * PRD draws no screen for it.
 *
 * **There is no file in this build**, so what is being recorded is the fact
 * that a document exists and what is known about it. The form says so where
 * the file would be chosen, in the shape MED-04's export and RES-02's call
 * button already use.
 */

/**
 * What somebody decided about expiry.
 *
 * **Three answers and no blank**, because DOC-01's rule is that a document has
 * an expiry decision only if it carries a specific date or somebody has
 * recorded that it does not expire. Anything else is the unknown-validity
 * hatch, and a form that let the question be skipped would produce that state
 * by accident rather than by record.
 */
export type ExpiryChoice = 'expires' | 'does_not_expire' | 'not_recorded' | 'not_chosen'

export interface UploadDraft {
  category: DocumentCategoryId | 'not_chosen'
  title: string
  format: string
  expiry: ExpiryChoice
  expiresOn: string
}

export const EMPTY_UPLOAD: UploadDraft = {
  category: 'not_chosen',
  title: '',
  format: 'PDF',
  expiry: 'not_chosen',
  expiresOn: '',
}

/** The formats a home files. Text on the screen, never a glyph. */
export const FORMATS = ['PDF', 'Word document', 'Photograph', 'Scan'] as const

export function outstanding(draft: UploadDraft): string[] {
  const waiting: string[] = []
  if (draft.title.trim() === '') waiting.push('what the document is')
  if (draft.category === 'not_chosen') waiting.push('which part of the file it goes in')
  if (draft.expiry === 'not_chosen') waiting.push('whether it expires')
  if (draft.expiry === 'expires' && draft.expiresOn === '')
    waiting.push('the date it expires')
  return waiting
}

/**
 * The expiry decision a form produces.
 *
 * **`not_recorded` is a real answer here**, chosen rather than fallen into:
 * somebody filing a letter that may or may not have an expiry is saying they do
 * not know, and the document wears the unknown-validity hatch honestly. It is
 * not the same as `does_not_expire`, which carries a name and a date.
 */
export function expiryFrom(
  draft: UploadDraft,
  by: StaffRef,
  on: IsoDate,
): ExpiryDecision | 'not_chosen' {
  switch (draft.expiry) {
    case 'expires':
      return draft.expiresOn === ''
        ? 'not_chosen'
        : { kind: 'expires', on: draft.expiresOn as IsoDate }
    case 'does_not_expire':
      return { kind: 'does_not_expire', decidedBy: by, on }
    case 'not_recorded':
      return { kind: 'not_recorded' }
    case 'not_chosen':
      return 'not_chosen'
  }
}
