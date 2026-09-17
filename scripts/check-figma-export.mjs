#!/usr/bin/env node
/**
 * The build stays importable into Figma. Rules from the start, not a repair.
 *
 * The running build is not the deliverable: a Figma import of it is. The Admin
 * build established what its importer keeps and drops, by experiment
 * (docs/FIGMA-HANDOFF.md in that repository), and four rules follow:
 *
 *   1. **Flex, not grid.** Figma has no grid; the importer builds auto-layout
 *      from flex and gap. `display: grid` and every `grid-*` property is a
 *      finding. A table is a <table>, which is neither.
 *   2. **No `url(#…)`.** The importer drops referenced SVG definitions, so a
 *      pattern fill, a gradient stroke or a clip path arrives blank. For the
 *      hatch that inverts the meaning: a gap looks like a recorded value.
 *   3. **Fonts are the committed static files, through plain @font-face.**
 *      `next/font` renames the family to a hashed name, and @fontsource's
 *      woff2 files name themselves "Manrope ExtraLight"; either way, a tool
 *      reading the family name sees the wrong font.
 *   4. **One breakpoint.** Any @media condition other than the two written in
 *      tokens.css, or prefers-reduced-motion, is a finding.
 *
 * `/* grid-ok: <why> *\/` on the line opts one declaration out of rule 1, and
 * the count is printed.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const TOKENS = path.join(SRC, 'styles/tokens.css')
const SKIP = new Set(['node_modules', 'icons', 'icons-generated', 'fonts'])

const GRID =
  /\bdisplay\s*:\s*(inline-)?grid\b|\bgrid-(template|area|column|row|auto)[\w-]*\s*:/
const GRID_INLINE = /display:\s*['"](inline-)?grid['"]|gridTemplate\w*:/
const URL_REF = /url\(\s*['"]?#/
const FONT_IMPORT = /['"](next\/font(\/[\w-]+)?|@fontsource\/[\w-]+)['"]/
const MEDIA = /@media\s+([^{]+)\{/g
const ALLOWED_MEDIA = new Set([
  '(width < 1024px)',
  '(width >= 1024px)',
  '(prefers-reduced-motion: reduce)',
])
const GRID_OK = /\/\*\s*grid-ok:\s*\S/

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(css|tsx?|svg)$/.test(entry.name)) {
      yield full
    }
  }
}

const findings = []
const read = { css: 0, script: 0, svg: 0 }
let gridOptOuts = 0

for await (const file of walk(SRC)) {
  const relative = path.relative(ROOT, file)
  const raw = await readFile(file, 'utf8')

  if (file.endsWith('.svg')) {
    read.svg += 1
    if (URL_REF.test(raw)) findings.push(`${relative} — an SVG referencing url(#…)`)
    continue
  }

  const isCss = file.endsWith('.css')
  isCss ? (read.css += 1) : (read.script += 1)
  const source = isCss ? stripCssComments(raw) : stripComments(raw)
  const rawLines = raw.split('\n')

  source.split('\n').forEach((line, index) => {
    const where = `${relative}:${index + 1}`
    if (isCss ? GRID.test(line) : GRID_INLINE.test(line)) {
      if (GRID_OK.test(rawLines[index] ?? '')) gridOptOuts += 1
      else findings.push(`${where} — grid. Figma has no grid; use flex and gap.`)
    }
    if (URL_REF.test(line))
      findings.push(`${where} — url(#…). The importer drops referenced definitions.`)
    if (!isCss && FONT_IMPORT.test(line))
      findings.push(
        `${where} — a font package. Use the committed files in src/assets/fonts.`,
      )
  })

  if (isCss) {
    for (const match of source.matchAll(MEDIA)) {
      const condition = match[1].trim()
      if (!ALLOWED_MEDIA.has(condition)) {
        const line = source.slice(0, match.index).split('\n').length
        findings.push(
          `${relative}:${line} — @media ${condition}. The breakpoints are written in tokens.css.`,
        )
      }
    }
    if (file !== TOKENS && /@font-face/.test(source))
      findings.push(`${relative} — @font-face outside tokens.css`)
  }
}

const tokens = await readFile(TOKENS, 'utf8')
const faces = [...tokens.matchAll(/src:\s*url\(['"]?([^'")]+)['"]?\)/g)].map(
  (m) => m[1],
)
for (const face of faces) {
  if (!/^\.\.\/assets\/fonts\/Manrope-[A-Za-z]+\.woff2$/.test(face))
    findings.push(
      `src/styles/tokens.css — @font-face loads ${face}, not a committed Manrope file`,
    )
}
if (faces.length !== 5)
  findings.push(
    `src/styles/tokens.css — ${faces.length} font faces, expected the 5 committed weights`,
  )

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
  if (name.startsWith('@fontsource/'))
    findings.push(`package.json — depends on ${name}`)

if (read.css === 0 || read.script === 0) {
  console.error(
    '✖ figma export: read no stylesheets or no scripts, so checked nothing.',
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error('✖ figma export: something here will not survive the import.\n')
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}

console.log(
  `✓ figma export — ${read.css} stylesheets, ${read.script} scripts, ${read.svg} SVGs: no grid (${gridOptOuts} opted out), no url(#…), 5 committed font faces, one breakpoint`,
)
