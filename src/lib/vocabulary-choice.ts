import {
  ORGANISATION_TYPES,
  TERM_IDS,
  TERM_OPTIONS,
  vocabularyFor,
  type OrganisationType,
  type TermId,
  type Vocabulary,
} from './vocabulary'

/**
 * Which vocabulary this build is rendering in, and how it was told.
 *
 * **This build cannot be told the way the Admin build is told.** Over there a
 * manager picks the terms in Settings and the choice is held with the
 * organisation. Here there is no settings screen and there should not be:
 * choosing what an organisation calls the people it holds records about is an
 * Admin act, and a care worker configuring it would be a permission defect, not
 * a feature. There is also no backend and no shared state, so this build has no
 * way to read what the Admin build was told.
 *
 * **So it is a query parameter, read once at module load — the clock's
 * pattern, for the clock's reason.** `?at=` works because the fixtures are
 * built at import time and a reload is needed to rebuild them. Terminology has
 * exactly the same constraint and a sharper version of it: the fixtures contain
 * the word. A care note whose text says "the resident was unsettled" is its
 * author's words and is never touched, but a generated label is, and both are
 * produced at import. Nothing here can change the vocabulary without a reload,
 * so the address is where it belongs — visible, shareable, and not a hidden
 * mode somebody can leave switched on.
 *
 * **The default is the care-home vocabulary this build already renders**, so a
 * reader who asks for nothing sees exactly what they saw before this file
 * existed.
 *
 * **It says so on screen when it is not the default**, through the same line
 * the moved clock uses, and for the same reason: a reviewer looking at
 * "Service user" must not take it for what the product says by default. One
 * line, not two — see `MovedClockLine`.
 */

/** `?terms=org:hospital,subject:service_user`. One parameter, one reader. */
export const TERMS_PARAM = 'terms'

/**
 * What the address asked for, as three facts rather than two.
 *
 * **A value that could not be read is not the same fact as no value**, and a
 * single `undefined` covering both is the defect this repository has already
 * paid for once: `?at=` returned one for "nobody asked" and for "asked, and it
 * could not be read", so the notice built to announce a moved clock went silent
 * on exactly the case it existed for (CLAUDE.md §8). The raw text travels with
 * the refusal so the screen can quote back what was typed.
 */
export type VocabularyRequest =
  | { kind: 'nothing_asked' }
  | {
      kind: 'chosen'
      type: OrganisationType
      chosen: Partial<Record<TermId, string>>
      /** Every element, as it arrived, for a screen that has to say what it took. */
      said: string
    }
  | { kind: 'unreadable'; raw: string; why: string }

const ORGANISATION_TYPE_IDS = ORGANISATION_TYPES.map((entry) => entry.id)
const isTermId = (value: string): value is TermId =>
  (TERM_IDS as readonly string[]).includes(value)
const isOrganisationType = (value: string): value is OrganisationType =>
  (ORGANISATION_TYPE_IDS as string[]).includes(value)

/**
 * Reads the parameter, or says why it could not.
 *
 * **One bad element refuses the whole request.** Taking the readable half and
 * dropping the rest would render a vocabulary nobody asked for, with no way for
 * the reader to tell which of their choices had landed — a half-applied setting
 * that looks applied. The refusal names the element, because the reader needs
 * to see which word was wrong rather than retype all of them.
 */
function requested(): VocabularyRequest {
  if (typeof window === 'undefined') return { kind: 'nothing_asked' }
  const raw = new URLSearchParams(window.location.search).get(TERMS_PARAM)
  if (raw === null || raw.trim() === '') return { kind: 'nothing_asked' }

  let type: OrganisationType = 'care_home'
  const chosen: Partial<Record<TermId, string>> = {}

  for (const element of raw.split(',')) {
    const text = element.trim()
    if (text === '') continue
    const at = text.indexOf(':')
    if (at === -1)
      return {
        kind: 'unreadable',
        raw,
        why: `“${text}” is not a term and a choice. Each one reads like subject:service_user.`,
      }
    const key = text.slice(0, at).trim()
    const value = text.slice(at + 1).trim()

    if (key === 'org') {
      if (!isOrganisationType(value))
        return {
          kind: 'unreadable',
          raw,
          why: `“${value}” is not a kind of service. They are ${ORGANISATION_TYPE_IDS.join(', ')}.`,
        }
      type = value
      continue
    }
    if (!isTermId(key))
      return {
        kind: 'unreadable',
        raw,
        why: `“${key}” is not a term this build names. They are org, ${TERM_IDS.join(', ')}.`,
      }
    if (!TERM_OPTIONS[key].some((option) => option.id === value))
      return {
        kind: 'unreadable',
        raw,
        why: `“${value}” is not one of the words offered for ${key}: ${TERM_OPTIONS[key]
          .map((option) => option.id)
          .join(', ')}.`,
      }
    chosen[key] = value
  }

  return { kind: 'chosen', type, chosen, said: raw.trim() }
}

/** What the address asked for. Everything below is derived from this. */
export const VOCABULARY_REQUEST: VocabularyRequest = requested()

/** What this build says when nobody has asked for anything else. */
const BUILT_IN: Vocabulary = vocabularyFor('care_home', {})

/**
 * The vocabulary in force.
 *
 * Read once, like the clock. A second read could disagree with the first, and
 * two screens rendering the same record under different words is the defect
 * this whole module is here to stop between two builds — it would be worse
 * inside one.
 */
export const VOCABULARY: Vocabulary =
  VOCABULARY_REQUEST.kind === 'chosen'
    ? vocabularyFor(VOCABULARY_REQUEST.type, VOCABULARY_REQUEST.chosen)
    : BUILT_IN

/**
 * Whether the words on screen are anything other than this build's default.
 *
 * **Decided by comparing the words, not by whether somebody typed something.**
 * `?terms=subject:resident` is a request, and it asks for exactly what this
 * build already says — announcing it would be a notice about nothing, which is
 * the failure the clock line was corrected for twice. So the question is "do
 * the words differ", and `?terms=org:care_home,subject:resident` is silent for
 * the same reason.
 *
 * **False for a refused request**, which is deliberate: a request that could
 * not be read leaves the vocabulary exactly where it would have been, and
 * saying "the words have changed" would be untrue. The refusal still has to be
 * announced, and that is a separate fact — the same pair the clock keeps apart
 * as `CLOCK_IS_OVERRIDDEN` and `CLOCK_NEEDS_SAYING`.
 */
export const VOCABULARY_IS_OVERRIDDEN = TERM_IDS.some((id) =>
  (Object.keys(BUILT_IN[id]) as (keyof Vocabulary[TermId])[]).some(
    (form) => VOCABULARY[id][form] !== BUILT_IN[id][form],
  ),
)

/** Whether the shell has something to say about the words. */
export const VOCABULARY_NEEDS_SAYING =
  VOCABULARY_IS_OVERRIDDEN || VOCABULARY_REQUEST.kind === 'unreadable'

/** Builds the URL that re-renders the record in this build's own words. */
export function defaultVocabularyHref(): string {
  if (typeof window === 'undefined') return '?'
  const url = new URL(window.location.href)
  url.searchParams.delete(TERMS_PARAM)
  return url.toString()
}
