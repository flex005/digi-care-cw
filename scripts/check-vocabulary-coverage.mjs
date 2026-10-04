/**
 * How much of the terminology migration has happened, as a figure that can fall.
 *
 * **It fails when the number goes up, not when a finding exists.** Every
 * occurrence it counts is expected to be there until its module's phase lands,
 * so a guard that reported findings would report seventeen hundred of them on
 * day one and be switched off by lunchtime. This repository has already refused
 * two guards for needing their findings sorted into piles before any could be
 * acted on. Here nothing needs classifying: a word is converted or it is not,
 * and the only question asked is whether the total moved the wrong way.
 *
 * **What it is actually for is the regression nobody would otherwise see.** Six
 * phases is long enough that somebody types "resident" into a module converted
 * three phases earlier, in a commit about something else entirely, and no
 * screenshot or test notices. A number that can only fall is what notices.
 *
 * **There is no allowlist, deliberately.** A proper noun or a quoted PRD string
 * that genuinely has to stay hardcoded is counted as unconverted, and the total
 * simply never reaches zero. An exception list is wallpaper within a week — this
 * build has an §8 entry about exactly that — and the figure here is a direction
 * rather than a verdict, so it does not need to be exact to be useful.
 *
 * **It says nothing about whether the migration is correct.** A screen can read
 * badly in every converted word, and this would print the same number. That is a
 * screenshot's question and is recorded as one rather than counted as covered.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from './lib/strip-comments.mjs'

const SRC = new URL('../src', import.meta.url).pathname

/**
 * Measured 04/10/2026, before any copy was converted: every default form of
 * every term, in non-test `.tsx`, comments stripped, outside the two excluded
 * directories. It does not move. "Converted" is the distance from it, so a
 * baseline that drifted would quietly forgive whatever had been undone.
 */
const BASELINE = 1754
const BASELINE_FILES = 85

/**
 * Where a term word is not copy about a resident.
 *
 * **Named in the output, never silent.** A guard that excludes something without
 * saying so is a smaller guard than its success line claims — the §8 entry about
 * a check being exact about a subject narrower than its rule.
 */
const EXCLUDED = [
  {
    prefix: 'features/auth',
    why: 'names a product and an organisation, not a resident',
  },
  { prefix: 'features/specimens', why: 'documents the design system itself' },
]

/**
 * The default forms this build currently writes, per term.
 *
 * **Checked against `vocabulary.ts` in both directions below**, so this cannot
 * drift from the module it is counting: a word here that the vocabulary does not
 * declare fails, and a term the vocabulary declares that is missing here fails
 * too. One direction alone is the stale exception list this repository already
 * warns about.
 */
const WORDS = {
  subject: String.raw`[Rr]esidents?`,
  carePlan: String.raw`[Cc]are plans?`,
  staff: String.raw`[Ss]taff(?: members?)?`,
  manager: String.raw`[Mm]anagers?`,
  admission: String.raw`[Aa]dmissions?`,
  incidentReport: String.raw`[Ii]ncident reports?`,
  medication: String.raw`[Mm]edications?`,
  assessment: String.raw`[Aa]ssessments?`,
  family: String.raw`[Ff]amil(?:y|ies)`,
}

/** The literal words each pattern is meant to find, for the drift check. */
const DECLARED = {
  subject: ['resident', 'residents'],
  carePlan: ['care plan', 'care plans'],
  staff: ['staff member', 'staff'],
  manager: ['manager', 'managers'],
  admission: ['admission', 'admissions'],
  incidentReport: ['incident report', 'incident reports'],
  medication: ['medication', 'medications'],
  assessment: ['assessment', 'assessments'],
  family: ['family', 'families'],
}

const vocabulary = readFileSync(join(SRC, 'lib/vocabulary.ts'), 'utf8')

const ids = /export const TERM_IDS = \[([^\]]*)\]/.exec(vocabulary)
if (ids === null) {
  console.error(
    '✖ vocabulary coverage — vocabulary.ts declares no TERM_IDS, so this check has' +
      '\n  nothing to count and would pass everything.',
  )
  process.exit(1)
}
const termIds = [...ids[1].matchAll(/'([^']+)'/g)].map((m) => m[1])

/* Both directions, so neither list can go stale and keep excusing the other. */
const missing = termIds.filter((id) => !(id in WORDS))
const extra = Object.keys(WORDS).filter((id) => !termIds.includes(id))
if (missing.length > 0 || extra.length > 0) {
  console.error(
    '✖ vocabulary coverage — this check and the vocabulary disagree about which\n' +
      '  terms exist, so the figure would be counted over the wrong words.',
  )
  for (const id of missing)
    console.error(`  ${id} is a term and this check does not count it`)
  for (const id of extra)
    console.error(`  ${id} is counted here and is not a term any more`)
  process.exit(1)
}

/* Every word searched for is one the vocabulary really declares. */
const undeclared = Object.entries(DECLARED).flatMap(([id, words]) =>
  words
    .filter((word) => !vocabulary.includes(`'${word}'`))
    .map((word) => `${id}: ${word}`),
)
if (undeclared.length > 0) {
  console.error(
    '✖ vocabulary coverage — words are counted that vocabulary.ts does not declare,\n' +
      '  so the figure is over something other than the terms.',
  )
  for (const entry of undeclared) console.error(`  ${entry}`)
  process.exit(1)
}

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })

const patterns = Object.entries(WORDS).map(([id, body]) => [
  id,
  new RegExp(String.raw`\b(?:${body})\b`, 'g'),
])

let found = 0
let files = 0
let excluded = 0
const perTerm = Object.fromEntries(Object.keys(WORDS).map((id) => [id, 0]))
const perModule = new Map()

for (const file of walk(SRC)) {
  if (!file.endsWith('.tsx') || /\.test\./.test(file)) continue
  const relative = file.slice(SRC.length + 1)
  if (EXCLUDED.some((entry) => relative.startsWith(entry.prefix))) {
    excluded += 1
    continue
  }
  /*
   * Comments are not copy. A docblock explaining why a term is configurable
   * would otherwise count against the migration for ever, and stripping them
   * through the repository's own scanner is what the other guards do — a regex
   * over `/*` once blanked a third of a file and printed a tick over it.
   */
  const source = stripComments(readFileSync(file, 'utf8'))
  let here = 0
  for (const [id, pattern] of patterns) {
    pattern.lastIndex = 0
    const hits = [...source.matchAll(pattern)].length
    perTerm[id] += hits
    here += hits
  }
  if (here > 0) {
    files += 1
    const parts = relative.split('/')
    const module = parts[0] === 'features' ? `${parts[0]}/${parts[1]}` : parts[0]
    perModule.set(module, (perModule.get(module) ?? 0) + here)
  }
  found += here
}

const converted = BASELINE - found

if (found > BASELINE) {
  console.error(
    `✖ vocabulary coverage — ${String(found)} hardcoded term words, up from the` +
      `\n  baseline of ${String(BASELINE)}. ${String(found - BASELINE)} more than there were` +
      `\n  before any of this started, so a module converted earlier has had a term` +
      `\n  typed back into it — or a new screen was written without asking the` +
      `\n  vocabulary. Ask the words through src/lib/vocabulary-choice.ts.\n`,
  )
  const worst = [...perModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  for (const [module, count] of worst) console.error(`  ${module}: ${String(count)}`)
  process.exit(1)
}

const leading = Object.entries(perTerm)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([id, n]) => `${id} ${String(n)}`)
  .join(', ')

console.log(
  `✓ vocabulary coverage — ${String(found)} of ${String(BASELINE)} term words still ` +
    `hardcoded, ${String(converted)} converted, across ${String(files)} of ` +
    `${String(BASELINE_FILES)} files (${leading}). ${String(excluded)} files not ` +
    `counted: ${EXCLUDED.map((e) => `${e.prefix} (${e.why})`).join('; ')}. It counts ` +
    `how much has moved, not whether any of it reads well — that is a screenshot's ` +
    `question.`,
)
