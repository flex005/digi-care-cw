#!/usr/bin/env node
/**
 * Every way into a module goes somewhere, and somewhere is the module it names.
 *
 * **Written because three rail entries pointed at screens nobody had built**,
 * and for nine phases nothing said so. `isBuilt()` kept them honest at the
 * point of the click — a module with no route drew "not built yet" rather than
 * a dead link — so the navigation never lied to a reader. What nothing checked
 * was whether anybody had noticed, and the answer was no: Risk assessments,
 * Consent and Documents are full screen specifications in the CW PRD, and the
 * build had quietly settled into treating them as out of scope.
 *
 * So this checks the two things `isBuilt` cannot:
 *
 *  1. **Every nav item's `path` is a path the route table declares**, and the
 *     route at that path builds the module the item names. `isBuilt` matches on
 *     the module alone, so an item whose path drifted from its route's would
 *     pass it and 404 on click.
 *  2. **A nav item with no route is deliberate, and named here.** Anything
 *     unbuilt has to be listed below with the reason, which turns "we have not
 *     got to it" into a line somebody has to write down — and read again the
 *     next time they open this file.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Modules with a rail entry and no screen, each with why.
 *
 * **Empty, and that is the point.** It was not empty in spirit before this
 * guard existed; it was empty in the sense that nobody had written the three
 * down anywhere. A name here is a claim somebody made on purpose.
 */
const DELIBERATELY_UNBUILT = {}

const routes = stripComments(readFileSync(path.join(ROOT, 'src/app/routes.ts'), 'utf8'))
const nav = stripComments(
  readFileSync(path.join(ROOT, 'src/components/shell/nav.icons.ts'), 'utf8'),
)

/** Each declared route, as the pair a nav item has to match. */
const declared = [...routes.matchAll(/\{[^{}]*?path:\s*'([^']+)'[^{}]*?\}/gs)].map(
  (match) => {
    const body = match[0]
    const module = /module:\s*'([^']+)'/.exec(body)
    return { path: match[1], module: module === null ? undefined : module[1] }
  },
)

const byModule = new Map()
for (const route of declared)
  if (route.module !== undefined) byModule.set(route.module, route.path)

const items = [
  ...nav.matchAll(
    /\{\s*module:\s*'([^']+)',\s*label:\s*'([^']+)',\s*path:\s*'([^']+)'/gs,
  ),
].map((match) => ({ module: match[1], label: match[2], path: match[3] }))

const findings = []

if (items.length === 0)
  findings.push('no nav items were read at all: this guard is checking nothing')

for (const item of items) {
  const routePath = byModule.get(item.module)

  if (routePath === undefined) {
    const why = DELIBERATELY_UNBUILT[item.module]
    if (why === undefined)
      findings.push(
        `${item.label} (${item.module}) has a rail entry and no screen. Build it, or name it in DELIBERATELY_UNBUILT with the reason.`,
      )
    continue
  }

  if (routePath !== item.path)
    findings.push(
      `${item.label} (${item.module}) links to ${item.path} and its screen is declared at ${routePath}: the link would not resolve.`,
    )
}

for (const module of Object.keys(DELIBERATELY_UNBUILT))
  if (byModule.has(module))
    findings.push(
      `${module} is named in DELIBERATELY_UNBUILT and has a screen now. Remove the entry.`,
    )

if (findings.length > 0) {
  console.error('✖ nav reach: a way into a module does not go where it says.')
  for (const line of findings) console.error(`  ${line}`)
  process.exit(1)
}

console.log(
  `✓ nav reach — ${items.length} nav items, every one resolving to the screen it names (${Object.keys(DELIBERATELY_UNBUILT).length} deliberately unbuilt)`,
)
