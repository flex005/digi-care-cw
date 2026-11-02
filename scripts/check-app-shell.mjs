#!/usr/bin/env node
/**
 * The phone app is an app, not a page: the mechanical half of
 * docs/MOBILE_APP_SHELL.md.
 *
 * **Written because the phone build drifted twice into a responsive web page
 * at phone width**, and "feels like an app" cannot be reviewed. Some of what
 * makes it one can be read off the source, and this reads it, over the phone
 * tree only (`src/features/phone/`, `src/app/m/`):
 *
 *  1. No container: `max-width` in any unit but `ch` or `100%`, or an `auto`
 *     margin, is a finding (§4). A `ch` measure is a line of text, and `100%`
 *     only stops overflow; neither centres anything.
 *  2. No `:hover` (§6). There is no cursor.
 *  3. No `@media` but `prefers-reduced-motion` (§10, and CLAUDE.md §4).
 *  4. Safe areas: the tab bar carries `env(safe-area-inset-bottom)` and the
 *     bar carries `env(safe-area-inset-top)` (§5).
 *  5. One scroll pane: `overflow` `auto` or `scroll` on anything but `.pane`
 *     is a finding, `.pane` must contain its overscroll, and the document
 *     root must be locked at `100dvh` with `overflow: hidden` (§1).
 *  6. Places, not tasks: every entry in `PHONE_PLACES` is `kind: 'place'`, and
 *     no address under `/m` names a task (§3).
 *  7. No `next/link` in the phone tree, which replaces the document (§2).
 *
 * **What its tick would still print if the rule were broken in a way nobody
 * wrote a mutation for** (CLAUDE.md §8): a push that does not animate, a sheet
 * that cannot be dragged, a tab that loses its scroll, a bar with two actions,
 * a primary action inside the pane, a field under the keyboard. Review those.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments, stripCssComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PHONE = path.join(ROOT, 'src/features/phone')
const ROUTES = path.join(ROOT, 'src/app/m')
const PLACES = path.join(PHONE, 'phone-paths.ts')

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
const rel = (file) => path.relative(ROOT, file)

/**
 * Every block in a stylesheet with the preludes it sits inside and its own
 * declarations, so a rule inside `@media` is still read as a rule and a
 * keyframe step is known to be one.
 */
function blocks(css) {
  const found = []
  const stack = []
  let text = ''
  let line = 1
  let startLine = 1
  for (const char of css) {
    if (char === '\n') line += 1
    if (char === '{') {
      stack.push({ prelude: text.trim(), line: startLine, body: '' })
      text = ''
      startLine = line
    } else if (char === '}') {
      const open = stack.pop()
      if (open !== undefined) {
        open.body += text
        found.push({ ...open, within: stack.map((entry) => entry.prelude) })
      }
      text = ''
      startLine = line
    } else if (char === ';' && stack.length > 0) {
      stack[stack.length - 1].body += `${text};`
      text = ''
      startLine = line
    } else {
      if (text.trim() === '') startLine = line
      text += char
    }
  }
  return found
}

const declarations = (body) =>
  body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf(':')
      return { property: part.slice(0, at).trim(), value: part.slice(at + 1).trim() }
    })

const findings = []
const files = walk(PHONE)
const sheets = files.filter((file) => file.endsWith('.css'))
const components = files.filter(
  (file) => /\.tsx?$/.test(file) && !/\.test\./.test(file),
)

let rules = 0
let containers = 0
let medias = 0
let overflows = 0
let lock = false
let pane = { found: false, contained: false }
let tabBar = { found: false, inset: false }
let bar = { found: false, inset: false }

for (const sheet of sheets) {
  const css = stripCssComments(readFileSync(sheet, 'utf8'))
  for (const block of blocks(css)) {
    if (block.prelude.startsWith('@media')) {
      medias += 1
      const condition = block.prelude.slice('@media'.length).trim()
      if (condition !== '(prefers-reduced-motion: reduce)')
        findings.push(
          `${rel(sheet)}:${block.line} — @media ${condition}. The phone app has one width: whatever it is given.`,
        )
      continue
    }
    if (
      block.prelude.startsWith('@') ||
      block.within.some((p) => p.startsWith('@keyframes'))
    )
      continue
    rules += 1
    const selector = block.prelude
    const decls = declarations(block.body)

    if (/:hover\b/.test(selector))
      findings.push(
        `${rel(sheet)}:${block.line} — ${selector} uses :hover. There is no cursor; use :active.`,
      )

    for (const { property, value } of decls) {
      if (property === 'max-width') {
        containers += 1
        if (!/(ch|100%)$/.test(value))
          findings.push(
            `${rel(sheet)}:${block.line} — ${selector} { max-width: ${value} }. Edge to edge: no container.`,
          )
      }
      if (/^margin(-inline|-left|-right)?$/.test(property) && /\bauto\b/.test(value)) {
        containers += 1
        findings.push(
          `${rel(sheet)}:${block.line} — ${selector} { ${property}: ${value} }. An auto margin centres a column.`,
        )
      }
      if (/^overflow(-x|-y)?$/.test(property) && /\b(auto|scroll)\b/.test(value)) {
        overflows += 1
        if (selector !== '.pane')
          findings.push(
            `${rel(sheet)}:${block.line} — ${selector} { ${property}: ${value} }. Only .pane scrolls.`,
          )
      }
    }

    const all = decls.map((d) => `${d.property}: ${d.value}`).join('; ')
    if (selector === '.pane') {
      pane = { found: true, contained: /overscroll-behavior: contain/.test(all) }
    }
    /*
     * **The inset has to be in the padding**, not merely in the rule. The first
     * version matched the rule's text, and a bar whose padding lost the inset
     * still passed because its min-height mentioned it: the content went under
     * the notch and the tick stayed.
     */
    const padded = (side, inset) =>
      decls.some(
        ({ property, value }) =>
          (property === 'padding' || property === `padding-${side}`) &&
          value.includes(`env(safe-area-inset-${inset})`),
      )
    if (selector === '.tabBar')
      tabBar = { found: true, inset: padded('bottom', 'bottom') }
    if (selector === '.bar') bar = { found: true, inset: padded('top', 'top') }
    if (
      /\bbody\b/.test(selector) &&
      /height: 100dvh/.test(all) &&
      /overflow: hidden/.test(all)
    )
      lock = true
  }
}

if (!pane.found)
  findings.push('no .pane rule in the phone tree, so nothing is the one scroll pane')
else if (!pane.contained)
  findings.push('.pane does not set overscroll-behavior: contain')
if (!tabBar.found)
  findings.push(
    'no .tabBar rule in the phone tree, so the safe area check watches nothing',
  )
else if (!tabBar.inset)
  findings.push(
    '.tabBar has no env(safe-area-inset-bottom) in its padding: it sits under the home indicator',
  )
if (!bar.found)
  findings.push(
    'no .bar rule in the phone tree, so the top safe area check watches nothing',
  )
else if (!bar.inset)
  findings.push(
    '.bar has no env(safe-area-inset-top) in its padding: it sits under the notch',
  )
if (!lock)
  findings.push(
    'no rule locks html and body at 100dvh with overflow: hidden, so the document scrolls',
  )

/* §3: places, not tasks. */
const TASK = /^(new|edit|add|compose|confirm|form|create|write)$/
const routeFiles = walk(ROUTES).filter((file) =>
  /^page\.tsx?$/.test(path.basename(file)),
)
for (const file of routeFiles) {
  const segments = path
    .relative(ROUTES, path.dirname(file))
    .split(path.sep)
    .filter(Boolean)
  for (const segment of segments)
    if (TASK.test(segment))
      findings.push(
        `${rel(file)} — the address names a task (${segment}). A task is a sheet over a place.`,
      )
}

const places = stripComments(readFileSync(PLACES, 'utf8'))
const declared = /export const PHONE_PLACES = \{([\s\S]*?)\n\}/.exec(places)
let placeCount = 0
if (declared === null)
  findings.push(`${rel(PLACES)} declares no PHONE_PLACES, so no place is checked`)
else
  for (const [, name, kind] of declared[1].matchAll(/(\w+):\s*\{\s*kind:\s*'(\w+)'/g)) {
    placeCount += 1
    if (kind !== 'place')
      findings.push(
        `${rel(PLACES)} — ${name} is a ${kind}. Forms and confirmations are sheets, not places.`,
      )
  }
for (const [, address] of places.matchAll(/[`'](\/m\/[^`'$]*)/g))
  for (const segment of address.split('/').filter(Boolean))
    if (TASK.test(segment))
      findings.push(
        `${rel(PLACES)} — ${address} names a task (${segment}). A task is a sheet over a place.`,
      )

/* §2: no document loads. */
let links = 0
for (const file of components) {
  const source = stripComments(readFileSync(file, 'utf8'))
  if (/from\s+['"]next\/link['"]/.test(source)) {
    links += 1
    findings.push(
      `${rel(file)} — imports next/link, which replaces the document. Push with StackLink.`,
    )
  }
}

if (findings.length > 0) {
  console.error(`✖ app shell — ${findings.length} finding(s) in the phone tree:\n`)
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\n  docs/MOBILE_APP_SHELL.md says why each is a web page rather than an app.',
  )
  process.exit(1)
}

console.log(
  `✓ app shell — ${sheets.length} stylesheets, ${rules} rules: ` +
    `${containers} max-width, every one a text measure, and no auto margin; ` +
    `0 :hover of ${rules} rules; ${medias} @media, all reduced motion; ` +
    `${overflows} scrolling overflow, all on .pane; root locked; both safe areas set; ` +
    `${placeCount} places of ${placeCount} declared as places, ${routeFiles.length} route file(s), no task addresses; ` +
    `${links} next/link imports of ${components.length} components.`,
)
console.log(
  '  It cannot see whether a push animates, a sheet drags, a tab keeps its scroll, or a field clears the keyboard: those are review.',
)
