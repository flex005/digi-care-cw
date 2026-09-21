#!/usr/bin/env node
/**
 * Every session store is asked before a sign-out destroys it.
 *
 * Signing out is the one act in this build that destroys work rather than
 * failing to save it: every write lives in this browser tab and nowhere else.
 * The confirmation therefore has to name what would go, and a store nobody
 * asks is work nobody warns about — a sign-out that says "nothing to lose"
 * with plenty to lose, which is worse than no confirmation at all.
 *
 * `session-losses.ts` has claimed this guard exists since the file was ported
 * from the Admin build. It did not exist here. Written in Phase 10, when the
 * profile added the first new session store since that claim was made.
 *
 * Two halves, because a store can fail either way:
 *
 *  1. Every `*Holdings` export is reached by something that assembles the loss
 *     list — `session-losses.ts` for the record stores, `SignOutDialog.tsx` for
 *     the three the session itself holds. (It was `SignOutRoute.tsx` until the
 *     confirmation moved into a dialog; the guard named the move on the first
 *     run after it, which is what it is for.)
 *  2. Every `reset*` export beside one is called where a session ends —
 *     `endSession()` or the provider's `signOut`.
 *
 * A store listed in neither fails by name, and the message says which half.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const source = join(root, 'src')

const LOSS_LIST = [
  'src/data/access/session-losses.ts',
  'src/features/auth/SignOutDialog.tsx',
]
const RESETTERS = [
  'src/data/access/session-losses.ts',
  'src/app/session/SessionProvider.tsx',
]

function everyFile(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return everyFile(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** Comments stripped, so a name mentioned in a docblock never counts as a call. */
const code = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')

/**
 * Imports stripped as well, for the two files that have to *use* what they
 * name.
 *
 * The first mutation run against this guard removed the profile store from the
 * sign-out screen's list and the guard passed: the import at the top of the
 * file still carried the name, and a mention is not a call. It is the §8 shape
 * exactly — a check reporting what it asked rather than what it saw.
 */
const body = (path) => code(path).replace(/^\s*import[\s\S]*?from\s*'[^']*'/gm, ' ')

const asked = LOSS_LIST.map(body).join('\n')
const reset = RESETTERS.map(body).join('\n')

const missing = []
let stores = 0

for (const path of everyFile(source)) {
  const text = code(path)
  const holdings = [...text.matchAll(/export (?:const|function) (\w*Holdings)\b/g)].map(
    (match) => match[1],
  )
  if (holdings.length === 0) continue
  stores += 1
  const where = relative(root, path)

  for (const name of holdings)
    if (!new RegExp(`\\b${name}\\b`).test(asked))
      missing.push(`${where}: ${name}() is asked by nothing that builds the loss list`)

  const resets = [...text.matchAll(/export function (reset\w+)\b/g)].map(
    (match) => match[1],
  )
  if (resets.length === 0)
    missing.push(`${where}: holds session state and exports no reset`)
  for (const name of resets)
    if (!new RegExp(`\\b${name}\\s*\\(`).test(reset))
      missing.push(`${where}: ${name}() is called by nothing that ends a session`)
}

if (missing.length > 0) {
  console.error(
    '✖ session losses — a store this session writes to is not asked before it is destroyed:',
  )
  for (const line of missing) console.error(`  ${line}`)
  console.error(
    '\n  Add it to SOURCES in src/data/access/session-losses.ts, or to the list the sign-out screen composes.',
  )
  process.exit(1)
}

console.log(
  `✓ session losses — ${stores} session stores, every one asked before a sign-out and cleared by it`,
)
