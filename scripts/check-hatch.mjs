#!/usr/bin/env node
/**
 * The unrecorded treatment has exactly one owner.
 *
 * Stylelint enforces that colour comes only from tokens, but it cannot tell a
 * hand-rolled hatch from a legitimate gradient, and a second, slightly
 * different copy of the most load-bearing visual in the product is exactly the
 * drift that survives review.
 *
 * So `repeating-linear-gradient`, the dashed unrecorded border and the
 * unrecorded tint may be declared in src/styles/unrecorded.module.css and
 * nowhere else. Everything else reaches the hatch through <Unrecorded>, which
 * requires the words, or through `composes:`.
 *
 * **One medium, and an SVG pattern is a finding anywhere.** The Admin build
 * had a second owner, an SVG `<pattern>` for its charts, and the Figma importer
 * drops every `url(#…)` reference: its hatched chart regions arrived blank,
 * so "nobody recorded this" looked like a recorded value. This build draws
 * every gap, charts included, as HTML carrying the CSS gradient.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const CANONICAL = path.join(SRC, 'styles/unrecorded.module.css')
const TOKENS = path.join(SRC, 'styles/tokens.css')
const SKIP = new Set(['node_modules', 'assets', 'coverage'])

const FORBIDDEN_CSS = [
  { pattern: /repeating-linear-gradient\s*\(/, what: 'the diagonal hatch' },
  {
    pattern: /dashed\s+var\(--border-unrecorded\)/,
    what: 'the dashed unrecorded border',
  },
  { pattern: /--status-unrecorded-tint/, what: 'the unrecorded tint' },
]
const FORBIDDEN_TSX = [
  { pattern: /repeating-linear-gradient\s*\(/, what: 'the diagonal hatch, inline' },
  { pattern: /<pattern[\s>]/, what: 'an SVG hatch pattern' },
]

/**
 * Two sizes in the owner file, and the number is the point. One bands the tint
 * for boxes, where the hatch covers enough area to read as texture. One bands
 * the solid colour for regions a few pixels tall — a bar per round — where the
 * tint measures 1.12:1 and a hatch nobody can see is a plain neutral fill.
 */
const OWNER_GRADIENTS = 2
const GRADIENT_DECLARATION = /^\s*background:\s*repeating-linear-gradient\(/

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(css|tsx|ts)$/.test(entry.name)) {
      yield full
    }
  }
}

const findings = []
let read = 0

for await (const file of walk(SRC)) {
  if (file === CANONICAL || file === TOKENS) continue
  read += 1
  const isCss = file.endsWith('.css')
  const raw = await readFile(file, 'utf8')
  const source = isCss ? stripCssComments(raw) : stripComments(raw)
  const rules = isCss ? FORBIDDEN_CSS : FORBIDDEN_TSX
  source.split('\n').forEach((line, index) => {
    for (const { pattern, what } of rules) {
      if (pattern.test(line))
        findings.push(
          `${path.relative(ROOT, file)}:${index + 1} — ${what}\n      ${line.trim()}`,
        )
    }
  })
}

const ownerGradients = stripCssComments(await readFile(CANONICAL, 'utf8'))
  .split('\n')
  .filter((line) => GRADIENT_DECLARATION.test(line)).length

if (ownerGradients !== OWNER_GRADIENTS) {
  console.error(
    `✖ hatch: ${path.relative(ROOT, CANONICAL)} declares ${ownerGradients} gradients, expected ${OWNER_GRADIENTS}.\n` +
      '  .unrecorded bands the tint, for boxes. .unrecordedChart bands the solid colour,\n' +
      '  for regions a few pixels tall. A third is a size nobody has justified.',
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error(`✖ hatch: the unrecorded treatment is defined outside its owner.\n`)
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\n  The one definition is src/styles/unrecorded.module.css, reached through\n' +
      '  <Unrecorded label="…" /> or `composes:`. SVG patterns are refused outright:\n' +
      '  the Figma importer drops url(#…), and the gap arrives blank. CLAUDE.md §1.',
  )
  process.exit(1)
}

console.log(
  `✓ hatch — one owner, ${OWNER_GRADIENTS} sizes; ${read} other files read, none redraws it`,
)
