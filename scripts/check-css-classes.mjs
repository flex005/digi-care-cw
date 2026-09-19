#!/usr/bin/env node
/**
 * Every `styles.x` a component reaches for is declared in the stylesheet it
 * imports.
 *
 * **A missing class is silent.** CSS Modules resolves an undeclared name to
 * `undefined`, React drops the attribute, and the element renders with no
 * styling and no error — the typechecker cannot see inside the generated
 * module, and no test that asserts on text or roles will notice. It reached
 * `main` once in Phase 8: a row's act had `className={styles.rowAct}` and the
 * class was never added to the sheet, because the shell command meant to add it
 * was piped into `head`, so the `||` fallback tested `head`'s exit status
 * rather than `grep`'s and never ran.
 *
 * It states what it read, so a guard that silently read less would say so.
 */

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

/** `styles.thing`, but never `styles.thing` inside a longer identifier. */
const USED = /\bstyles\.([A-Za-z_]\w*)/g
/**
 * A class anywhere in a selector, not only at the start of a line: a sheet may
 * declare `.table .num` or `.cards > .wide`, and both are exported.
 */
const DECLARED = /\.(-?[_a-zA-Z]+[\w-]*)/g

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'assets') continue
      yield* walk(full)
    } else yield full
  }
}

/** Selector text only: a class named in a comment or a value is not declared. */
function declaredIn(sheet) {
  const withoutComments = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
  const names = new Set()
  for (const block of withoutComments.split('{')) {
    const selector = block.split('}').pop() ?? ''
    for (const match of selector.matchAll(DECLARED)) names.add(match[1])
  }
  // `composes: x from './other.css'` brings a name in from another sheet.
  for (const match of withoutComments.matchAll(/composes:\s*([^;]+);/g)) {
    for (const name of match[1].split(/\s+/)) {
      if (name === 'from' || name.startsWith("'") || name.startsWith('"')) break
      names.add(name)
    }
  }
  return names
}

/**
 * A class that composes a class that itself composes another.
 *
 * **`composes:` does not chain**, and the failure is silent. `.cellQuiet
 * { composes: cellNotDue }` where `.cellNotDue { composes: cell }` puts
 * `cellQuiet cellNotDue` on the element and *not* `cell`: the grandparent's
 * declarations are simply absent. The MAR legend drew two 2px squares where
 * 34px ones belonged, and nothing anywhere said so — the classes exist, the
 * references resolve, the typechecker has no opinion, and the only symptom is
 * an element that renders to almost nothing.
 *
 * So a composition whose target is itself a composition fails here, and the
 * fix is to compose the base directly alongside it.
 */
function chainedComposes(sheet) {
  const withoutComments = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
  /** Which local classes each rule composes, by the class it declares. */
  const composedBy = new Map()
  for (const block of withoutComments.split('}')) {
    const open = block.indexOf('{')
    if (open === -1) continue
    const selector = block.slice(0, open)
    const body = block.slice(open + 1)
    const names = [...selector.matchAll(DECLARED)].map((match) => match[1])
    const composes = []
    for (const match of body.matchAll(/composes:\s*([^;]+);/g)) {
      for (const name of match[1].trim().split(/\s+/)) {
        /* `from './other.css'` is another sheet's class and cannot chain here. */
        if (name === 'from' || name.startsWith("'") || name.startsWith('"')) break
        composes.push(name)
      }
    }
    if (composes.length > 0) for (const name of names) composedBy.set(name, composes)
  }

  const chained = []
  for (const [name, composes] of composedBy) {
    for (const target of composes) {
      const theirs = composedBy.get(target)
      if (theirs === undefined) continue
      const absent = theirs.filter((base) => !composes.includes(base))
      if (absent.length > 0)
        chained.push(
          `.${name} composes .${target}, which composes .${absent.join(', .')} — composes does not chain, so name the base here too`,
        )
    }
  }
  return chained
}

const missing = []
let files = 0
let references = 0

for await (const file of walk(SRC)) {
  if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue
  const source = await readFile(file, 'utf8')
  const importMatch = /import styles from '([^']+\.css)'/.exec(source)
  if (!importMatch) continue

  const sheetPath = path.resolve(path.dirname(file), importMatch[1])
  let sheet
  try {
    sheet = await readFile(sheetPath, 'utf8')
  } catch {
    missing.push(
      `${path.relative(ROOT, file)} imports ${importMatch[1]}, which is not there`,
    )
    continue
  }

  files += 1
  const declared = declaredIn(sheet)
  for (const name of new Set([...source.matchAll(USED)].map((match) => match[1]))) {
    references += 1
    if (!declared.has(name))
      missing.push(
        `${path.relative(ROOT, file)} — styles.${name} is not in ${path.basename(sheetPath)}`,
      )
  }
}

/* Every stylesheet, not only the ones a component imports by name. */
for await (const sheet of walk(SRC)) {
  if (!/\.css$/.test(sheet)) continue
  for (const finding of chainedComposes(await readFile(sheet, 'utf8')))
    missing.push(`${path.relative(ROOT, sheet)} — ${finding}`)
}

if (missing.length > 0) {
  console.error(
    '✖ css classes: a class that is not in the sheet renders as no class at all, silently.\n',
  )
  for (const entry of missing) console.error(`  ${entry}`)
  process.exit(1)
}

console.log(
  `✓ css classes — ${references} references across ${files} components, every one declared`,
)
