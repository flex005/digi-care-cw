/**
 * The line for something not built on the phone, wherever it would be: a tab,
 * an act on a note.
 *
 * **A dash, not a verb.** "Care notes is not built" breaks on a plural, and a
 * label may be plural or a configured term the template cannot know, so
 * nothing in the line has to agree with it. One owner, so every unbuilt thing
 * on the phone is stated the same way.
 */
export const notBuiltOnPhone = (label: string): string =>
  `${label} — not built yet on the phone.`
