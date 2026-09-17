#!/usr/bin/env node
/**
 * Which residents a care worker has been given is read in one place.
 *
 * **In this product the assignment decides something, which is exactly why it
 * needs a guard.** A care worker sees the residents they were given: that is
 * scope, and it is a fact about what a person can see. The same field read
 * anywhere that counts gaps turns a record nobody wrote into a mark against
 * whoever was assigned — a performance record about a person dressed as a
 * finding about a home. Nothing will push back the day somebody filters "not
 * written up today" by who was responsible, so this does.
 *
 * So the assignment is read by `src/app/session/resident-scope.ts` and nowhere
 * else in the product. Screens receive a `ResidentScope`, never the assignment,
 * and this fails for any file not listed below.
 *
 * The list is short and every entry carries a reason. If it ever needs another,
 * the question is not how to word the reason but whether the rule still holds.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from './lib/strip-comments.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const SKIP = new Set(['node_modules', 'assets', 'dist', 'coverage'])
/*
 * **Matched case-insensitively, because the first version missed the writer.**
 * `line.includes('residentAssignment')` is false for `setResidentAssignment`
 * and for the type `ResidentAssignment`, so the invite drawer — the one screen
 * that writes an assignment — did not register as reaching for it at all. A
 * guard that cannot see the write is not guarding the field, it is guarding
 * one spelling of it.
 */
const FIELD = /residentassignment/i

/**
 * Where it may be reached, and why: declaring the type, holding it, and the one
 * module that turns it into a scope. Nothing that counts, aggregates, ranks or
 * renders a gap. Only `src` is walked, so this script naming it is not a reach.
 */
const ALLOWED = [
  { file: 'src/data/types/team.ts', why: 'declares the union' },
  {
    file: 'src/data/types/index.ts',
    why: 're-exports the type, and a barrel skipping one type is the inconsistency somebody fixes without reading this',
  },
  {
    file: 'src/data/access/team-store.ts',
    why: 'holds it and seeds it from the fixtures',
  },
  {
    file: 'src/app/session/resident-scope.ts',
    why: 'the one reader: turns an assignment into what somebody can see',
  },
]

const allowed = new Set(ALLOWED.map((entry) => entry.file))

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
const touched = new Set()
let reaches = 0

for await (const file of walk(SRC)) {
  const relative = path.relative(ROOT, file)
  const source = stripComments(await readFile(file, 'utf8'))
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    if (!FIELD.test(line)) return
    reaches += 1
    touched.add(relative)
    if (allowed.has(relative)) return
    findings.push({ where: `${relative}:${index + 1}`, line: line.trim() })
  })
}

/*
 * The other direction: an entry naming a file that no longer reaches the field
 * narrows nothing and still reads as a decision somebody took. A finding.
 */
const reached = new Set(findings.map((finding) => finding.where.split(':')[0]))
for (const file of touched) reached.add(file)
const dead = ALLOWED.filter((entry) => !reached.has(entry.file))

if (dead.length > 0) {
  console.error(
    '✖ assignment reach: an entry excuses a file that does not reach the field.\n' +
      '  It narrows nothing for anybody and still reads as a decision somebody took.\n',
  )
  for (const entry of dead) console.error(`  ${entry.file} — ${entry.why}`)
  process.exit(1)
}

if (findings.length > 0) {
  console.error(
    '✖ assignment reach: which residents a care worker has been given is read somewhere it must not be.\n' +
      '\n' +
      "  A gap in the record carries nobody's name. Read through an assignment, it\n" +
      '  acquires one and becomes a performance record about a person. Screens take a\n' +
      '  ResidentScope from src/app/session/resident-scope.ts: scope, never blame.\n',
  )
  for (const finding of findings) console.error(`  ${finding.where}  ${finding.line}`)
  process.exit(1)
}

console.log(
  `✓ assignment reach — ${reaches} references across ${touched.size} files, every one of the ${ALLOWED.length} allowed places live`,
)
