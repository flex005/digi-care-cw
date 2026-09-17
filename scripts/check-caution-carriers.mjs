#!/usr/bin/env node
/**
 * The caution fill is never drawn without words naming the state beside it.
 *
 * `--status-caution` measures 2.75:1 on the surface, under the 3:1 WCAG 1.4.11
 * asks of a non-text indicator, and it stays there by decision
 * (docs/DEPARTURES.md): an orange dot or bar carries no meaning on its own, and
 * that is acceptable only because the colour is never on its own. This is the
 * one place in the build where a rule would otherwise be held by a sentence, so
 * it is held by construction instead:
 *
 *   1. The fill token may be declared only by the components that carry words
 *      inside the coloured element: StatusPill (its required `label`) and Toast
 *      (its required `title`). Anywhere else is a finding.
 *   2. A status token name built at run time (`--status-${tone}`) is a finding
 *      outside the token sheet, because no script can see which status it names.
 *   3. `caution-carriers.test.tsx` holds the other half: each carrier renders its
 *      words inside the coloured element, refuses empty words, and keeps the
 *      prop required.
 *
 * **What this cannot check, said plainly.** Whether the words *name the state*
 * is a question about meaning, and no script can answer it: `label="Recorded"`
 * on a caution pill passes. Nor can it see whether the words are visible on
 * screen once styled; that is the screenshot's job. What it guarantees is
 * narrower and exact: no caution fill is drawn by anything that does not also
 * draw non-empty words inside it.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets'])

/** The fill token itself, not its ink or tint. */
const FILL = /--status-caution(?![\w-])/
/** A status token name assembled at run time. */
const BUILT = /--status-\$\{/

const CARRIERS = [
  {
    file: 'src/components/status/StatusPill.module.css',
    why: 'StatusPill renders its required label inside the bordered pill',
  },
  {
    file: 'src/components/primitives/Toast.module.css',
    why: 'Toast renders its required title inside the edged panel',
  },
]
const TOKENS = 'src/styles/tokens.css'
/** Where a status token name may be built from a variable. */
const TEMPLATE_ALLOWED = {
  file: 'src/features/specimens/TokenSheet.tsx',
  why: 'swatches of the tokens themselves, each named by its token name, not a state',
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(css|tsx?)$/.test(entry.name)) {
      yield full
    }
  }
}

const findings = []
const carriersSeen = new Set()
let templateSeen = false
let read = 0

for await (const file of walk(SRC)) {
  const relative = path.relative(ROOT, file)
  if (relative === TOKENS) continue
  read += 1
  const raw = await readFile(file, 'utf8')
  const source = file.endsWith('.css') ? stripCssComments(raw) : stripComments(raw)

  source.split('\n').forEach((line, index) => {
    const where = `${relative}:${index + 1}`
    if (FILL.test(line)) {
      if (CARRIERS.some((carrier) => carrier.file === relative))
        carriersSeen.add(relative)
      else
        findings.push(
          `${where} — the caution fill, drawn by something that does not carry words inside it\n      ${line.trim()}`,
        )
    }
    if (BUILT.test(line)) {
      if (relative === TEMPLATE_ALLOWED.file) templateSeen = true
      else
        findings.push(
          `${where} — a status token name built at run time; no check can see which status it names\n      ${line.trim()}`,
        )
    }
  })
}

const dead = CARRIERS.filter((carrier) => !carriersSeen.has(carrier.file))
if (!templateSeen) dead.push(TEMPLATE_ALLOWED)
if (dead.length > 0) {
  console.error(
    '✖ caution carriers: an allowed place no longer reaches the fill. It excuses nothing and still reads as a decision.\n',
  )
  for (const entry of dead) console.error(`  ${entry.file} — ${entry.why}`)
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    '✖ caution carriers: the caution fill is under 3:1 by decision, so it may never mark a state alone.\n',
  )
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\n  Draw a caution state with <StatusPill tone="caution" label="…" /> or a caution\n' +
      '  <Toast title="…" />, which carry the words inside the colour. docs/DEPARTURES.md.',
  )
  process.exit(1)
}

console.log(
  `✓ caution carriers — ${read} files read; the fill is drawn only by ${CARRIERS.length} components that carry words inside it`,
)
