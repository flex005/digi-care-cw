/**
 * A call site asks the vocabulary for a form; it never builds one.
 *
 * **This exists because a test cannot tell the difference.** `ones` is declared
 * as `` `${one}’s` ``, so a call site writing `` `${term.one}’s` `` renders the
 * byte-identical string, and the vocabulary test written to catch exactly that
 * mutation passed. The rule is real — §6's "a value whose correct rendering
 * depends on where it appears gets one owner" — and the only instrument that
 * can see it is one that reads the source rather than the screen.
 *
 * **It is not hypothetical.** Every term offered today has a regular
 * possessive, so building one by hand is invisible now and wrong the first time
 * somebody adds a term whose possessive is not `one` plus an apostrophe-s. The
 * same argument the six declared forms rest on: the plural broke first because
 * "person supported" exists, and the possessive will break the same way.
 *
 * §8 records `.toLowerCase()` destroying a label twice, so the case transforms
 * are here too. A term is already in the case its form declares.
 *
 * **What it cannot see**, said rather than implied: a form passed through a
 * variable and transformed somewhere else, or a possessive assembled from two
 * string pieces. It reads an access and what is done to it on the spot.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const SRC = new URL('../src', import.meta.url).pathname

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

/**
 * An access to a **declared** form of a term: `VOCABULARY.subject.one`.
 *
 * **The form names come from `Term` rather than from `\w+`, and that is a fix
 * rather than a nicety.** With `\w+` the plural rule matched the clean tree:
 * `VOCABULARY.manager.ones` backtracks to `…manager.one` followed by an `s`,
 * which reads exactly like a plural built by hand. Naming the forms and ending
 * on a word boundary makes `one` unable to match inside `ones`. A guard whose
 * first run fails on correct code teaches people to switch it off.
 */
const vocabulary = readFileSync(join(SRC, 'lib/vocabulary.ts'), 'utf8')
const term = /export interface Term \{([\s\S]*?)\n\}/.exec(vocabulary)
if (term === null) {
  console.error(
    '✖ term forms — vocabulary.ts declares no Term interface, so this check has no\n' +
      '  forms to look for and would pass everything.',
  )
  process.exit(1)
}
const FORMS = [...term[1].matchAll(/^\s*(\w+):\s*string/gm)].map((m) => m[1])
if (FORMS.length === 0) {
  console.error('✖ term forms — Term declares no forms; nothing would be checked.')
  process.exit(1)
}
const ACCESS =
  String.raw`VOCABULARY\.\w+\.(?:` +
  [...FORMS].sort((a, b) => b.length - a.length).join('|') +
  String.raw`)\b`

/**
 * The two forms that are already possessive, so an apostrophe after them is the
 * word rather than an assembly.
 *
 * Checked against `Term` below, so renaming a form cannot leave this naming
 * something the interface no longer declares.
 */
const POSSESSIVE_FORMS = ['ones', 'Ones']

/** Any declared form that is not already a possessive. */
const NOT_POSSESSIVE = String.raw`VOCABULARY\.\w+\.(?:${FORMS.filter(
  (form) => !POSSESSIVE_FORMS.includes(form),
)
  .sort((a, b) => b.length - a.length)
  .join('|')})\b`

const unknownPossessive = POSSESSIVE_FORMS.filter((form) => !FORMS.includes(form))
if (unknownPossessive.length > 0) {
  console.error(
    '✖ term forms — this check names possessive forms that Term does not declare,\n' +
      `  so a possessive could be built out of one unwatched: ${unknownPossessive.join(', ')}.`,
  )
  process.exit(1)
}

const RULES = [
  {
    what: 'a possessive built at the call site',
    /*
     * **Any form that is not already a possessive, followed by an apostrophe —
     * with or without an `s`.** It required the `s` until 04/10/2026, and
     * `${term.many}’ documents` went straight through: a plural possessive,
     * built out of a plural and a bare apostrophe, correct for the thirty
     * declared plurals that end in s and wrong for the four that do not. It
     * reached the build and a test was written asserting it.
     */
    pattern: new RegExp(String.raw`${NOT_POSSESSIVE}\s*\}?\s*(?:’|'|&rsquo;)s?`, 'g'),
    instead:
      'ask for `ones` or `Ones` where the singular is possessive; a plural possessive has no form, so reword the sentence',
  },
  {
    what: 'a plural built at the call site',
    pattern: new RegExp(String.raw`${ACCESS}\s*\}?\s*s\b`, 'g'),
    instead: 'ask for `many` or `Many`; "people supported" is why',
  },
  {
    what: 'a case transform on a declared form',
    pattern: new RegExp(String.raw`${ACCESS}\s*\.\s*to(?:Lower|Upper)Case`, 'g'),
    instead: 'ask for the form in the case you need; every one is declared',
  },
]

const findings = []
let accesses = 0

for (const file of walk(SRC)) {
  if (!/\.(ts|tsx)$/.test(file) || /\.test\./.test(file)) continue
  const raw = readFileSync(file, 'utf8')
  const source = stripComments(raw)
  accesses += [...source.matchAll(new RegExp(ACCESS, 'g'))].length
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0
    let hit
    while ((hit = rule.pattern.exec(source)) !== null) {
      const line = source.slice(0, hit.index).split('\n').length
      findings.push({
        file: file.slice(SRC.length + 1),
        line,
        what: rule.what,
        instead: rule.instead,
        text: (source.split('\n')[line - 1] ?? '').trim().slice(0, 96),
      })
    }
  }
}

if (findings.length > 0) {
  console.error(
    `✖ term forms — ${String(findings.length)} call site(s) build a form instead of` +
      '\n  asking for one. Six forms are declared so that no caller has to.\n',
  )
  for (const finding of findings) {
    console.error(`  ${finding.file}:${String(finding.line)} — ${finding.what}`)
    console.error(`    ${finding.text}`)
    console.error(`    Instead: ${finding.instead}\n`)
  }
  process.exit(1)
}

console.log(
  `✓ term forms — ${String(FORMS.length)} declared form(s); ${String(accesses)} ` +
    `vocabulary access(es), none building a ` +
    `possessive, a plural or a case change at the call site. It reads what is done ` +
    `to an access on the spot; a form put in a variable and transformed elsewhere, ` +
    `it cannot see.`,
)
