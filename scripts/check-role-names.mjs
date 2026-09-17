#!/usr/bin/env node
/**
 * No screen decides what a role can do.
 *
 * **The CW PRD is a draft.** Its role table is the authority for what a care
 * worker and a senior carer can do, and it is not signed off, so a row may move
 * on review. It moves in one edit only if every role rule lives in
 * `src/app/session/capabilities.ts` and every screen asks that file rather than
 * comparing a role itself. One `role === 'senior_carer'` in a tab is a second
 * owner of a row, and the row that moved would still be drawn the old way there.
 *
 * So outside the files below, this fails on either role's name and on any
 * comparison against a `.role`. Screens ask `useViewer().ask(act, resident)` and
 * draw the answer. Test files are read too: a test that signs in "a senior
 * carer" does it by naming a person from the fixtures, never by building a
 * role.
 *
 * It states what it read, so a guard that silently read less would say so.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets', 'coverage'])

/**
 * Where a role may be named, and why. Nothing here draws a screen.
 */
const ALLOWED = [
  { prefix: 'src/app/session/roles.ts', why: 'declares which roles sign in' },
  { prefix: 'src/app/session/capabilities.ts', why: 'the role table' },
  {
    prefix: 'src/app/session/capabilities.test.ts',
    why: 'holds the role table against the PRD, cell by cell',
  },
  {
    prefix: 'src/app/session/resident-scope',
    why: 'turns an assignment into a scope, which differs by role, and its test',
  },
  {
    prefix: 'src/data/',
    why: 'the fixtures and stores, shared with the Admin build, where a role is a fact about a person',
  },
]

const ROLE_NAME = /\b(care_worker|senior_carer)\b/
const ROLE_COMPARISON = /\.role(Name)?\s*[!=]==|[!=]==\s*[\w.]*\.role(Name)?\b/

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue
      yield* walk(full)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield full
    }
  }
}

const findings = []
let read = 0

for await (const file of walk(SRC)) {
  const relative = path.relative(ROOT, file)
  if (ALLOWED.some((entry) => relative.startsWith(entry.prefix))) continue
  read += 1
  const source = stripComments(await readFile(file, 'utf8'))
  source.split('\n').forEach((line, index) => {
    const what = ROLE_NAME.test(line)
      ? 'names a role'
      : ROLE_COMPARISON.test(line)
        ? 'compares a role'
        : undefined
    if (what) findings.push(`${relative}:${index + 1} — ${what}\n      ${line.trim()}`)
  })
}

if (findings.length > 0) {
  console.error('✖ role names: a role rule is decided outside the role table.\n')
  for (const finding of findings) console.error(`  ${finding}`)
  console.error(
    '\n  Ask useViewer().ask(act, resident) and draw the answer. What a role can do\n' +
      '  lives in src/app/session/capabilities.ts, because the CW PRD is a draft and a\n' +
      '  row that moves on review must move in one place. CLAUDE.md, Scope.',
  )
  process.exit(1)
}

console.log(
  `✓ role names — ${read} files read outside the role table, none names or compares a role`,
)
