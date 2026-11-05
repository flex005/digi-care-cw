#!/usr/bin/env node
/**
 * The phone's visual baseline, held by construction where it can be:
 * docs/PHONE_VISUAL_BASELINE.md, over the phone tree (`src/features/phone/`,
 * `src/app/m/`).
 *
 *  1. **Two corners.** Every `border-radius` resolves to 8px (`--radius-sm`, a
 *     card) or 999px (`--radius-pill`, a pill), through the tokens. A `0` is
 *     allowed, because it is no corner at all: the sheet's bottom edge.
 *     Rules 1 and 2.
 *  2. **No status tint.** `--status-positive-tint`, `--status-caution-tint`,
 *     `--status-critical-tint` and `--status-info-tint` were the decoration;
 *     the solid status tokens stay. Rule 6.
 *  3. **Gradients are purple into purple.** Every colour in a gradient is a
 *     `--purple-*` token: no other token, no `transparent`, no literal. Rule 5.
 *  4. **No pasted icon.** No `<svg>`, `<path>` or kin in a component, and no
 *     SVG data URL in a stylesheet: icons come from the set through `<Icon>`.
 *     Rule 8.
 *
 * **What its tick would still print if the baseline were broken in a way
 * nobody wrote a mutation for** (CLAUDE.md §8):
 *  - A shared component drawn inside a phone screen keeps its own corners and
 *    colours, because it lives outside the tree: `NotYourHome` at 14px today,
 *    and anything the phone imports later. So do the phone's own forms that live
 *    with their owners — the moved-clock notice's phone form, the hatch's phone
 *    card and panel. Those are review.
 *  - A purple used where status should speak (a dose given drawn in purple)
 *    passes rules 2 and 3. Whether a colour is decoration or a record speaking
 *    is a question about meaning; review.
 *  - A radius set from script as an inline style is read only when it is
 *    written as a `borderRadius` property in the component source.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TREE = [path.join(ROOT, 'src/features/phone'), path.join(ROOT, 'src/app/m')]
const TOKENS = path.join(ROOT, 'src/styles/tokens.css')

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
const rel = (file) => path.relative(ROOT, file)

/** Every custom property in the token sheet, by name. */
const tokens = new Map(
  [
    ...stripCssComments(readFileSync(TOKENS, 'utf8')).matchAll(
      /(--[\w-]+):\s*([^;]+);/g,
    ),
  ].map(([, name, value]) => [name, value.trim()]),
)

const ALLOWED_CORNERS = new Set(['8px', '999px', '0'])
const TINT = /--status-(positive|caution|critical|info)-tint(?![\w-])/
const PURPLE = /^--purple-\d+$/
const PASTED = /<(svg|path|polygon|polyline|circle|rect|line|ellipse|g)\b[\s/>]/
const SVG_DATA = /url\(\s*['"]?data:image\/svg/

/** A value with every var() replaced by what the token sheet says it is. */
function resolve(value, depth = 0) {
  if (depth > 5) return value
  return value.replace(/var\((--[\w-]+)\)/g, (whole, name) =>
    tokens.has(name) ? resolve(tokens.get(name), depth + 1) : whole,
  )
}

/** The text inside each `…-gradient(` call, matching its own parentheses. */
function gradients(source) {
  const found = []
  const opening = /[\w-]*gradient\(/g
  let match
  while ((match = opening.exec(source)) !== null) {
    let depth = 1
    let at = match.index + match[0].length
    const start = at
    while (at < source.length && depth > 0) {
      if (source[at] === '(') depth += 1
      if (source[at] === ')') depth -= 1
      at += 1
    }
    found.push({ index: match.index, body: source.slice(start, at - 1) })
  }
  return found
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length

const findings = []
let files = 0
let corners = 0
let gradientCount = 0

for (const file of TREE.flatMap(walk)) {
  if (!/\.(css|tsx?)$/.test(file) || /\.test\./.test(file)) continue
  files += 1
  const isCss = file.endsWith('.css')
  const raw = readFileSync(file, 'utf8')
  const source = isCss ? stripCssComments(raw) : stripComments(raw)

  /* 1. Corners. */
  const radii = isCss
    ? source.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/g)
    : source.matchAll(/borderRadius\s*:\s*['"`]?([^,'"`}]+)/g)
  for (const found of radii) {
    corners += 1
    const resolved = resolve(found[1].trim())
    const bad = resolved.split(/\s+/).filter((part) => !ALLOWED_CORNERS.has(part))
    if (bad.length > 0)
      findings.push(
        `${rel(file)}:${lineOf(source, found.index)} — border-radius ${found[1].trim()} is ${resolved}. ` +
          'A card corner is --radius-sm (8px), a pill is --radius-pill (999px); nothing between.',
      )
  }

  /* 2. Tints. */
  source.split('\n').forEach((line, index) => {
    const tint = TINT.exec(line)
    if (tint)
      findings.push(
        `${rel(file)}:${index + 1} — ${tint[0]}. The status tints were the decoration; on the phone a status speaks in its solid token on white.`,
      )
  })

  /* 3. Gradients. */
  for (const { index, body } of gradients(source)) {
    gradientCount += 1
    const names = [...body.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
    const strays = names.filter((name) => !PURPLE.test(name))
    const literal =
      /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\btransparent\b|\bcurrentcolor\b/i.exec(
        body,
      )
    if (strays.length > 0 || literal !== null || names.length === 0)
      findings.push(
        `${rel(file)}:${lineOf(source, index)} — a gradient over ${
          [...strays, ...(literal ? [literal[0]] : [])].join(', ') || 'no purple token'
        }. Gradients are purple into purple: every stop a --purple-* token.`,
      )
  }

  /* 4. Pasted icons. */
  source.split('\n').forEach((line, index) => {
    if (!isCss && PASTED.test(line))
      findings.push(
        `${rel(file)}:${index + 1} — inline SVG. Icons come from src/assets/icons/ through <Icon name="…" />.\n      ${line.trim()}`,
      )
    if (isCss && SVG_DATA.test(line))
      findings.push(
        `${rel(file)}:${index + 1} — an SVG data URL. Icons come from src/assets/icons/ through <Icon name="…" />.`,
      )
  })
}

if (findings.length > 0) {
  console.error(`✖ phone visuals — ${findings.length} finding(s) in the phone tree:\n`)
  for (const finding of findings) console.error(`  ${finding}`)
  console.error('\n  docs/PHONE_VISUAL_BASELINE.md says what each rule is for.')
  process.exit(1)
}

console.log(
  `✓ phone visuals — ${files} files: ${corners} corners, every one 8px, 999px or none; ` +
    `no status tint; ${gradientCount} gradient(s), every stop purple; no inline SVG.`,
)
console.log(
  '  It reads the phone tree only: a shared component drawn in a phone screen, and the phone forms kept with their owners, are review.',
)
