import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The vocabulary guard stops counting module specifiers, type names and type
 * field names. **Narrowing a guard's scope is how a guard stops catching
 * things**, so this holds both directions over a copy of the tree: a term a
 * reader could see still fails it, and a term in one of the three positions
 * does not move it.
 *
 * Each case is one new file in a copy, so the real tree is never written and
 * the figure moves by exactly what the case adds.
 */

/* The repository root: vitest runs from it, and `import.meta.url` is a Vite path here. */
const ROOT = process.cwd()
const SCRIPT = join(ROOT, 'scripts/check-vocabulary-coverage.mjs')
let copy = ''

beforeAll(() => {
  copy = mkdtempSync(join(tmpdir(), 'vocabulary-coverage-'))
  for (const top of ['features', 'app', 'components', 'lib'])
    cpSync(join(ROOT, 'src', top), join(copy, top), { recursive: true })
})
afterAll(() => rmSync(copy, { recursive: true, force: true }))

/** The figure the guard counted, from either its success or its failure line. */
function countOf(run) {
  const match = /(\d+) hardcoded/.exec(`${run.stdout}${run.stderr}`)
  if (match === null) throw new Error(`No figure in:\n${run.stdout}${run.stderr}`)
  return Number(match[1])
}

const run = () =>
  spawnSync('node', [SCRIPT], {
    env: { ...process.env, VOCABULARY_COVERAGE_SRC: copy },
    encoding: 'utf8',
  })

function runWith(source) {
  const file = join(copy, 'features', 'probe.tsx')
  writeFileSync(file, source)
  try {
    return run()
  } finally {
    rmSync(file)
  }
}

/*
 * **Each case is measured by how far it moves the figure, never by the exit
 * status alone.** The first version asserted only that the guard failed, and a
 * mutation that widened the exclusions turned every case red — the label and
 * the sentence too, which the mutation never touched — because the figure fell
 * below the floor and one added word no longer crossed it. A test that fails
 * for a reason other than the one under test proves nothing about that reason.
 */
describe('the vocabulary guard, narrowed', () => {
  let before = 0
  beforeAll(() => {
    const first = run()
    expect(first.status).toBe(0)
    before = countOf(first)
  })

  it.each([
    ['a label', 1, 'export const A = () => <input aria-label="Residents" />\n'],
    ['a heading', 1, 'export const A = () => <h2>Residents</h2>\n'],
    [
      'a heading after a comment',
      2,
      'export const A = () => (\n  <p>\n    {/* why */}\n    Residents on Medications\n  </p>\n)\n',
    ],
    [
      'text inside a conditional, after a colon, which the scanner once read as code',
      1,
      'export const A = ({ on }: { on: boolean }) => (\n  <div>\n    {on ? (\n      <p className={on ? "a" : "b"}>Reason: Medication refused</p>\n    ) : null}\n  </div>\n)\n',
    ],
    ['a sentence', 1, "export const line = 'Nobody has asked this resident yet.'\n"],
    [
      'a template sentence',
      1,
      'export const line = (n: number) => `${n} residents waiting`\n',
    ],
    [
      'a local variable',
      2,
      'export function f() {\n  const residents = 1\n  return residents\n}\n',
    ],
  ])('counts a term in %s', (_, words, source) => {
    expect(countOf(runWith(source)) - before).toBe(words)
  })

  it('fails when a term a reader could see takes the figure above the floor', () => {
    const result = runWith('export const A = () => <h2>Residents</h2>\n')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/up from the\s+\d+ this build had at its best/)
  })

  it.each([
    [
      'an import path',
      "import { x } from '@/features/residents/list-name'\nexport { x }\n",
    ],
    [
      'a type name',
      "import type { Resident } from '@/data/types'\nexport type A = Resident[]\n",
    ],
    ['a type field name', 'export interface A {\n  medication: string\n}\n'],
    [
      'a field read',
      'export const f = (row: { medication: string }) => row.medication\n',
    ],
  ])('does not count a term in %s', (_, source) => {
    expect(countOf(runWith(source)) - before).toBe(0)
  })
})
