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
 * **A historical measurement, and it cannot be re-derived from this tree.**
 *
 * Every default form of every term, in non-test `.tsx`, comments stripped,
 * outside the two excluded directories, **as the code stood at `a71e96c`** —
 * the commit before `vocabulary.ts` arrived. It is hand-typed because it is a
 * fact about a past commit, not about the present one: the present tree has
 * conversions in it, so running this against it can never produce the baseline
 * again by construction.
 *
 * **So nobody should "fix" it to make a run green.** A failing run means the
 * figure went up, which is the regression this exists to catch; raising the
 * constant would forgive it silently and lose every earlier phase's reading at
 * the same time. To check the baseline rather than change it, put this file and
 * `src/lib/vocabulary*.ts` into a worktree at `a71e96c` and run it there.
 *
 * It was checked that way on 04/10/2026, after `ACCESS` stripping was added:
 * **1754 across 85 files, unchanged**, because there were no vocabulary
 * accesses in the tree to strip. The numerator and the denominator therefore
 * come from the same instrument, which they had not been shown to before.
 */
const BASELINE = 2354
const BASELINE_FILES = 127

/**
 * What this counted before 04/10/2026, kept so the migration's own figures stay
 * comparable.
 *
 * Phases 1 to 5 quoted a denominator of **1754 across 85 files**, measured over
 * `.tsx` only. Widening to `.ts` under the four counted directories raised it to
 * **2354 across 127 files**, re-derived at `a71e96c` by the same worktree method
 * the `.tsx` figure was checked with on the same day. Every
 * figure in PROGRESS.md before phase 6 is against the old denominator and every
 * figure after is against the new; without both written down the two sets would
 * look like progress or regression where there was neither.
 */
/**
 * How many of the baseline's words were ever convertible, measured the same way.
 *
 * **This is what progress is against**, because `BASELINE` counts positions no
 * migration can reach: property accesses, import paths, route segments, union
 * members. Reporting "116 of 2354" described the work as 5% done when the work
 * that exists was a quarter done, and seven phase reports quoted it.
 *
 * The ratchet still compares the all-positions figure, deliberately: a term
 * typed back into any position is a regression, and subtracting a floor from
 * the number a check fails on is the allowlist this build has refused three
 * times. Two figures, two questions.
 *
 * Re-derived at `a71e96c` with the same classifier that reports it, **last on
 * the day the final floor categories were declared** — the instrument changed
 * three times while this work ran, and each time both halves were measured
 * again. A numerator and a denominator from different instruments is the defect
 * this whole correction is about. See PROGRESS.md, 04/10/2026.
 */
const CONVERTIBLE_BASELINE = 238

const BASELINE_TSX_ONLY = 1754
const BASELINE_TSX_ONLY_FILES = 85

/**
 * The fewest hardcoded term words this build has ever had, and what the check
 * actually fails on.
 *
 * **Failing against the baseline alone caught nothing.** With 51 words
 * converted there were 51 of headroom, so a term typed back into a converted
 * file took the figure from 2303 to 2304 and the run printed a tick — three
 * mutations in a row passed that way. A guard that only notices once the
 * migration has undone everything it did is not watching the migration.
 *
 * So the question is "is this worse than the best we have reached", not "is
 * this worse than before we started". `BASELINE` stays, because "converted" is
 * the distance from it and that is the figure worth reading.
 *
 * **Lowering this is the normal course of a phase; raising it is the move that
 * forgives a regression.** The success line says when it is stale and by how
 * much, so a phase that converted something lowers it in the same commit.
 */
const BEST = 2167

/**
 * Where copy lives, and therefore where this counts.
 *
 * **The extension was never the discriminator.** This read `.tsx` only until
 * 04/10/2026, on the assumption that copy lives in components — and `scopeLine`,
 * which produces "9 residents on your list" for every screen in the build, is in
 * a `.ts`. So is the MAR's cell sentence. Two files converted in phase 5 moved
 * the figure by nothing, because the figure could not see them.
 *
 * `src/data` is out, for both extensions: it is shared with the Admin build,
 * it is identifiers and fixture text, and `docs/DEPARTURES.md` records why a
 * care note's body is never rewritten to match a term choice.
 */
const COUNTED = ['features', 'app', 'components', 'lib']

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
  {
    prefix: 'lib/vocabulary',
    why: 'declares the words themselves; counting them would count the answer',
  },
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

/**
 * How a converted call site reaches a word, so it is not counted as one.
 *
 * **Four of the nine term ids are themselves counted words**, so
 * `VOCABULARY.manager.one` contains "manager" and `VOCABULARY.family.one`
 * contains "family". Counting those made converting a manager or a family term
 * change the figure by exactly nothing — the hardcoded word went and the
 * property path replaced it — and the guard would have reported a phase as
 * having done less than it did, or nothing at all. Found by converting
 * `features/incidents` and watching ten of twenty conversions fail to move the
 * number.
 *
 * A property path is an identifier, which `docs/DEPARTURES.md` already puts out
 * of scope, so this removes the access before counting rather than excusing it
 * afterwards.
 */
const ACCESS = /\bVOCABULARY\.\w+\.\w+/g

const choice = readFileSync(join(SRC, 'lib/vocabulary-choice.ts'), 'utf8')
if (!/export const VOCABULARY\b/.test(choice)) {
  console.error(
    '✖ vocabulary coverage — vocabulary-choice.ts no longer exports VOCABULARY, so\n' +
      '  the access pattern this check ignores is out of date and every converted\n' +
      '  call site would be counted as unconverted.',
  )
  process.exit(1)
}

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

/**
 * What can never be converted, and why, so the remainder is a figure somebody
 * can act on.
 *
 * **"2281 remaining" at the end of a migration is a number that will be
 * misread.** Most of what this counts is not copy at all: a property access, an
 * import path, a route, a discriminant. Reported as one total it looks like work
 * left undone, and the next person starts converting things that must not
 * change — a `kind: 'resident'` renamed breaks a type for nothing, and a quoted
 * PRD row stops being a quotation.
 *
 * So each match is placed, and the success line says how many of the remainder
 * are genuinely convertible. **This is not an allowlist**: nothing is excused or
 * subtracted from the count the check fails on. It is the same number, said in
 * four parts.
 *
 * The placing is a scanner rather than a judgement, and it is approximate at the
 * edges — a proportion, reported as one.
 */
const FIXED_COPY = [
  {
    pattern: /row\('[^']*'\)/g,
    why: 'quotes a row of the PRD’s role table, and a quotation does not move',
  },
  {
    pattern: /medication PIN/g,
    why: 'the credential is named the medication PIN (CLAUDE.md §6)',
  },
  {
    pattern: /Medication administration record/g,
    why: 'a standard UK document name, like a statutory title',
  },
  {
    pattern: /\b[Aa]ssessments?\b/g,
    why: 'every use names an instrument — a risk assessment on the Waterlow, a capacity assessment under the MCA — never the configurable term, which has no site in this build',
  },
  {
    pattern: /Family Portal/g,
    why: 'the name of the other product, not a word for a relative',
  },
  {
    pattern: /Advance care plan/g,
    why: 'a named UK document, like a DNACPR, rather than this home’s plan for somebody',
  },
]

/**
 * Files whose term words belong to a published instrument.
 *
 * `instrument.ts` holds the Morse Fall Scale's items and their wording. The
 * scale's questions are the scale's, and a service renaming its own terms does
 * not get to reword a validated instrument — the same rule that keeps the
 * Waterlow and the MUST out of reach.
 */
const INSTRUMENT_FILES = ['features/risk/instrument.ts']

/**
 * Files whose term words are fixed whole, with the reason.
 *
 * **`capabilities.ts` is the role table**, and its act names and refusal reasons
 * sit line by line beside `row('…')` citations of the PRD. A file that quotes a
 * document in one line and rewrites itself in the next is harder to read against
 * that document than one that does neither — and since the 19/09 sweep none of
 * those reasons reaches a screen, because `ActPoint` draws nothing for a
 * refusal. The one string there that is rendered, the `not_stated` question, is
 * converted and so is not counted here either way.
 *
 * `plan-fields.ts` holds the two labels written in the subject's own voice.
 */
const FIXED_FILES = [
  {
    prefix: 'app/session/capabilities.ts',
    why: 'the role table’s own words, beside its quotations of the PRD, and none of them drawn',
  },
  {
    prefix: 'features/residents/tabs/plan-fields.ts',
    why: 'two labels in the subject’s own voice',
  },
]

/**
 * Where each character sits: inside a string or template, inside JSX text, or in
 * code. Rough at the edges, and the figure it feeds is reported as a proportion.
 */
function regions(source, isTsx) {
  const out = new Uint8Array(source.length)
  /*
   * **A stack, because a template literal resumes after its interpolation**,
   * and **JSX text is read before quotes**, because an apostrophe in "this
   * person's record" is a letter rather than a string opener.
   *
   * Both were found by the figures moving further than the edits: with one
   * `quote` flag, `${…}` ended the string and the rest of the sentence was read
   * as code, so `paths` fell by 36 across a phase that converted no path. With
   * the stack but no JSX-first rule, one apostrophe in prose opened a string
   * that swallowed the file.
   */
  const stack = []
  const top = () => stack[stack.length - 1]
  let i = 0
  let inTag = false
  let jsxText = false
  let jsxBraces = 0

  while (i < source.length) {
    const c = source[i]
    const here = top()

    if (here !== undefined && here.kind === 'string') {
      out[i] = 1
      if (c === '\\') {
        out[i + 1] = 1
        i += 2
        continue
      }
      if (c === here.quote) stack.pop()
      else if (here.quote === '`' && c === '$' && source[i + 1] === '{') {
        stack.push({ kind: 'interpolation', depth: 1 })
        i += 2
        continue
      }
      i += 1
      continue
    }

    /* JSX text, before anything treats a quote as code. */
    if (isTsx && jsxText && stack.length === 0 && jsxBraces === 0) {
      if (c === '<') {
        jsxText = false
        if (/[A-Za-z/>]/.test(source[i + 1] ?? '')) inTag = true
      } else if (c === '{') {
        jsxText = false
        jsxBraces = 1
      } else out[i] = 2
      i += 1
      continue
    }

    if (c === "'" || c === '"' || c === '`') {
      stack.push({ kind: 'string', quote: c })
      out[i] = 1
      i += 1
      continue
    }

    if (here !== undefined && here.kind === 'interpolation') {
      if (c === '{') here.depth += 1
      else if (c === '}') {
        here.depth -= 1
        if (here.depth === 0) stack.pop()
      }
      i += 1
      continue
    }

    if (isTsx) {
      if (c === '<' && /[A-Za-z/>]/.test(source[i + 1] ?? '')) inTag = true
      else if (c === '>' && inTag) {
        inTag = false
        jsxText = true
      } else if (jsxBraces > 0) {
        if (c === '{') jsxBraces += 1
        else if (c === '}') {
          jsxBraces -= 1
          if (jsxBraces === 0) jsxText = true
        }
      }
    }
    i += 1
  }
  return out
}

/**
 * A one-token literal that is a key rather than a word on a screen.
 *
 * **Capitalisation is the signal, and it is the only one available.** This
 * build's discriminants and screen keys are lowercase — `'resident'`,
 * `'resident_room'`, `'residentNeeds'` — and a one-word label somebody reads is
 * capitalised: `title="Residents"`. Counting every single-token literal as a key
 * put card titles in with the union members and understated the work by
 * nineteen words.
 */
const IS_KEY = /^[a-z][A-Za-z0-9_]*$/

/** The literal a match sits in, so a path or a key can be told from prose. */
function literalAround(source, where, index) {
  let a = index
  let b = index
  while (a > 0 && where[a - 1] === 1) a -= 1
  while (b < source.length - 1 && where[b + 1] === 1) b += 1
  return source.slice(a, b + 1)
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
/** Every match, placed. The parts add up to `found`. */
const placed = { code: 0, paths: 0, keys: 0, fixedCopy: 0, prose: 0 }

for (const file of walk(SRC)) {
  if (!/\.tsx?$/.test(file) || /\.test\./.test(file) || file.endsWith('.d.ts')) continue
  const relative = file.slice(SRC.length + 1)
  if (!COUNTED.some((top) => relative.startsWith(`${top}/`))) continue
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
  const source = stripComments(readFileSync(file, 'utf8')).replace(ACCESS, (m) =>
    ' '.repeat(m.length),
  )
  const where = regions(source, file.endsWith('.tsx'))
  const fixedWholeFile =
    FIXED_FILES.some((entry) => relative.startsWith(entry.prefix)) ||
    INSTRUMENT_FILES.some((prefix) => relative.startsWith(prefix))
  /* Spans a declared fixed-copy pattern covers, so a match inside one is placed. */
  const fixedSpans = []
  for (const entry of FIXED_COPY) {
    entry.pattern.lastIndex = 0
    let hit
    while ((hit = entry.pattern.exec(source)) !== null)
      fixedSpans.push([hit.index, hit.index + hit[0].length])
  }
  let here = 0
  for (const [id, pattern] of patterns) {
    pattern.lastIndex = 0
    let hit
    while ((hit = pattern.exec(source)) !== null) {
      perTerm[id] += 1
      here += 1
      const at = hit.index
      if (fixedWholeFile || fixedSpans.some(([a, b]) => at >= a && at < b))
        placed.fixedCopy += 1
      else if (where[at] === 0) placed.code += 1
      else if (where[at] === 2) placed.prose += 1
      else {
        const literal = literalAround(source, where, at)
        if (literal.includes('/')) placed.paths += 1
        else if (IS_KEY.test(literal.replace(/^[`'"]|[`'"]$/g, ''))) placed.keys += 1
        else placed.prose += 1
      }
    }
  }
  if (here > 0) {
    files += 1
    const parts = relative.split('/')
    const module = parts[0] === 'features' ? `${parts[0]}/${parts[1]}` : parts[0]
    perModule.set(module, (perModule.get(module) ?? 0) + here)
  }
  found += here
}

if (found > BEST) {
  console.error(
    `✖ vocabulary coverage — ${String(found)} hardcoded term words, up from the` +
      `\n  ${String(BEST)} this build had at its best. ${String(found - BEST)} more than` +
      `\n  the fewest it has ever carried, so a module converted earlier has had a` +
      `\n  term typed back into it — or a new screen was written without asking the` +
      `\n  vocabulary. Ask the words through src/lib/vocabulary-choice.ts.` +
      `\n\n  Raising BEST in scripts/check-vocabulary-coverage.mjs forgives this` +
      `\n  silently. Lowering it is what a phase does after converting something.\n`,
  )
  const worst = [...perModule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  for (const [module, count] of worst) console.error(`  ${module}: ${String(count)}`)
  process.exit(1)
}

/*
 * Said rather than left for somebody to notice: a phase that converted words
 * and did not lower `BEST` leaves the next regression unwatched by exactly the
 * amount it converted.
 */
const stale =
  found < BEST
    ? ` ${String(BEST - found)} fewer than the recorded best of ${String(BEST)} — lower BEST to ${String(found)} in this commit, or a regression of that size passes.`
    : ''

const floor = placed.code + placed.paths + placed.keys + placed.fixedCopy
const convertedConvertible = CONVERTIBLE_BASELINE - placed.prose

const leading = Object.entries(perTerm)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([id, n]) => `${id} ${String(n)}`)
  .join(', ')

console.log(
  `✓ vocabulary coverage — ${String(convertedConvertible)} of ` +
    `${String(CONVERTIBLE_BASELINE)} convertible term words converted, ` +
    `${String(placed.prose)} to go.` +
    `\n  Ratchet: ${String(found)} hardcoded in every position (best ` +
    `${String(BEST)}, baseline ${String(BASELINE)} at a71e96c); this fails when that ` +
    `rises above the best, wherever it rises.${stale}` +
    `\n  Of those ${String(found)}, ${String(floor)} can never be converted — ` +
    `${String(placed.code)} code and type positions, ${String(placed.paths)} paths and ` +
    `specifiers, ${String(placed.keys)} single-token keys and discriminants, ` +
    `${String(placed.fixedCopy)} named fixed copy.` +
    `\n  Fixed by name: ${[...FIXED_COPY, ...FIXED_FILES].map((e) => e.why).join('; ')}; the Morse Fall Scale's own items.` +
    `\n  Read across ${String(files)} of ${String(BASELINE_FILES)} files (${leading}); ` +
    `${String(excluded)} not counted: ${EXCLUDED.map((e) => `${e.prefix} (${e.why})`).join('; ')}.` +
    `\n  It counts how much has moved, not whether any of it reads well — that is a ` +
    `screenshot's question. A VOCABULARY.<term>.<form> access is an identifier and is ` +
    `not counted. Phases 1–5 quoted a .tsx-only denominator of ` +
    `${String(BASELINE_TSX_ONLY)} across ${String(BASELINE_TSX_ONLY_FILES)} files, and ` +
    `every phase before 8 quoted progress against the all-positions figure; see ` +
    `PROGRESS.md, 04/10/2026.`,
)
