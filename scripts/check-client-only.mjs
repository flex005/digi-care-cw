#!/usr/bin/env node
/**
 * No product module is ever loaded on a server.
 *
 * The fixtures are generated against the moment the page loads. A server
 * rendering a screen renders it against a different moment, so the page would
 * carry two records of the same fact. CLAUDE.md §1 and src/app/client-only.tsx
 * give the full reason; this holds the mechanism, in three parts:
 *
 *   1. A route file (page, layout, not-found and the other files Next.js
 *      renders on the server) imports only `next`, `react`, stylesheets, and
 *      the client-only component. Nothing that could reach a record.
 *   2. client-only.tsx reaches every product module through
 *      `dynamic(() => import(…), { ssr: false })` and imports nothing else.
 *   3. Nothing declares a server action.
 *
 * It states what it read, so a guard that silently read less would say so.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const APP = path.join(SRC, 'app')
const BOUNDARY = path.join(APP, 'client-only.tsx')

const ROUTE_FILE =
  /^(page|layout|template|not-found|error|global-error|loading|default|route)\.(tsx?|jsx?)$/

const IMPORT = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/g

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'assets') continue
      yield* walk(full)
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      yield full
    }
  }
}

const findings = []
let routeFiles = 0
let screens = 0
let filesRead = 0

const resolvesToBoundary = (from, specifier) => {
  if (specifier === '@/app/client-only') return true
  if (!specifier.startsWith('.')) return false
  return path.resolve(path.dirname(from), specifier) === BOUNDARY.replace(/\.tsx$/, '')
}

const allowedInRouteFile = (from, specifier) =>
  specifier === 'next' ||
  specifier === 'react' ||
  /\.css$/.test(specifier) ||
  resolvesToBoundary(from, specifier)

for await (const file of walk(SRC)) {
  filesRead += 1
  const relative = path.relative(ROOT, file)
  const source = stripComments(await readFile(file, 'utf8'))

  if (/(^|\n)\s*['"]use server['"]/.test(source))
    findings.push(
      `${relative} — declares a server action; there is no server in this build`,
    )

  if (file.startsWith(APP) && ROUTE_FILE.test(path.basename(file))) {
    routeFiles += 1
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1]
      if (!allowedInRouteFile(file, specifier))
        findings.push(
          `${relative} — imports '${specifier}'. A route file renders on the server; it may import only next, react, stylesheets and client-only.`,
        )
    }
  }

  if (file === BOUNDARY) {
    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1]
      if (specifier !== 'next/dynamic' && specifier !== 'react')
        findings.push(
          `${relative} — statically imports '${specifier}'. Every product module is reached through dynamic(…, { ssr: false }).`,
        )
    }
    const imports = [...source.matchAll(/\bimport\(/g)].length
    const dynamics = [...source.matchAll(/\bdynamic\(/g)].length
    const clientOnly = [...source.matchAll(/ssr:\s*false/g)].length
    screens = imports
    if (!(imports === dynamics && dynamics === clientOnly))
      findings.push(
        `${relative} — ${imports} import() calls, ${dynamics} dynamic() calls and ${clientOnly} ssr: false. Each screen needs all three.`,
      )
  }
}

if (routeFiles === 0 || screens === 0) {
  console.error(
    `✖ client-only: read ${routeFiles} route files and ${screens} screens. A guard that found nothing to check has checked nothing.`,
  )
  process.exit(1)
}

if (findings.length > 0) {
  console.error('✖ client-only: a product module can be reached from a server.\n')
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}

console.log(
  `✓ client-only — ${routeFiles} route files import nothing that reads a record; ${screens} screens load in the browser only; ${filesRead} files read, no server actions`,
)
