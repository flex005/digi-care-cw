/**
 * The diGi application family, for the app switcher in the top bar.
 *
 * **Only apps the documents actually name appear here.** Two do besides this
 * one, and both are named in the Admin build's PRD, which this build shares a
 * home and a design language with:
 *
 *  - **diGiLog** — the design language this product inherits its palette and
 *    chrome from.
 *  - **diGi-Time** — where a care note's shift comes from: the CW PRD's
 *    "shift (auto, editable with reason)" is diGi-Time's.
 *
 * A launcher is exactly the kind of surface that invites a plausible-looking
 * list — diGi-Pay, diGi-Recruit — and each invented name would be a fictional
 * product sitting in a real product's chrome, indistinguishable from a real
 * one to anybody reviewing this.
 *
 * **None of them is reachable.** This build is a design specification with no
 * backend and no shared session, so there is no address to send anybody to.
 * They are listed as what they are — the family this product belongs to — and
 * each says in visible text that it is not part of this prototype. Give an app
 * a real address when there is one.
 */
export interface DigiApp {
  name: string
  /** What it does, in a few words. */
  description: string
  /** True for the app you are already in. Exactly one, asserted in tests. */
  isCurrent: boolean
}

export const DIGI_APPS: DigiApp[] = [
  { name: 'diGi-Care', description: 'Care management', isCurrent: true },
  { name: 'diGiLog', description: 'Dashboard and alerts', isCurrent: false },
  { name: 'diGi-Time', description: 'Shifts', isCurrent: false },
]

/** Said in full on every app that has nowhere to go, never on hover alone. */
export const NOT_IN_THIS_BUILD = 'Not part of this prototype'
