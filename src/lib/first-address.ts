/**
 * What the address said when this app first loaded, captured once.
 *
 * **Every parameter this build reads has to be read before the app rewrites the
 * address, and that is a load-order requirement rather than a convention.**
 * Signing in replaces the URL — a reviewer who opens
 * `/incidents?at=20:20&terms=subject:person_supported` is sent to
 * `/sign-in?from=%2Fincidents`, and nothing of what they asked for survives in
 * `location.search`. A module that reads the address when it happens to be
 * imported therefore gets whatever is there at that moment, which for anything
 * in the product shell is after the rewrite.
 *
 * **The clock got this right by accident and the vocabulary got it wrong.**
 * `clock.ts` is pulled in by the fixtures, which the sign-in screen itself
 * needs for its demonstration list, so it read the address on the very first
 * render and its value was correct. `vocabulary-choice.ts` was reached only
 * through `MovedClockLine`, which mounts after the rewrite — so `?terms=` was
 * read from an address that no longer carried it, every time, and the override
 * silently did nothing. Found by driving a browser, not by reading: the
 * parameter worked in tests, because a test sets the address and imports the
 * module in the same breath.
 *
 * So the capture has one owner and one moment. Both parameters derive from
 * this; neither touches `location.search` itself.
 *
 * **It is imported by `clock.ts`**, which is the earliest module in the graph
 * that every screen reaches, so this is evaluated on the first load whatever
 * the reader opened.
 */

/**
 * Throws on a server for the same reason the clock does: a parameter read in
 * one place and not the other would produce two records of one page.
 */
if (typeof window === 'undefined')
  throw new Error(
    'The address was read without a window. Every parameter in this build is read on the first browser load: see src/app/client-only.tsx.',
  )

/** The query string as it stood at startup. Read once; never read again. */
export const FIRST_SEARCH: URLSearchParams = new URLSearchParams(window.location.search)

/** What that address asked for under a name, or `null` if it asked nothing. */
export const askedFor = (name: string): string | null => FIRST_SEARCH.get(name)
