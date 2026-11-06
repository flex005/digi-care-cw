import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Answer } from '@/app/session/capabilities'
import { staffEze } from '@/data/fixtures/organisation'
import { phoneRefusalOf } from './phone-refusal'

/**
 * The role table's open questions are for the PRD's author. **Nothing on the
 * phone prints one at a reader**: the words are said in the reader's terms by
 * `phoneRefusalOf`, and no phone file reaches the question another way.
 */

const QUESTION =
  'The PRD’s role table says both A and B. Which applies is for the PRD’s author.'
const NOT_YES: Exclude<Answer, { kind: 'yes' }>[] = [
  { kind: 'not_stated', question: QUESTION },
  { kind: 'contradicted', question: QUESTION },
  { kind: 'not_on_your_list' },
  { kind: 'no_list_yet' },
  { kind: 'not_your_role', reason: 'Care workers cannot close an omission.' },
  {
    kind: 'not_the_author',
    author: staffEze,
    reason: 'Only the author corrects a note.',
  },
]

describe('the phone’s refusals', () => {
  it.each(NOT_YES.map((answer) => [answer.kind, answer] as const))(
    'says %s in the reader’s terms, never quoting the PRD',
    (_, answer) => {
      const line = phoneRefusalOf(answer, 'Ron Ashworth')
      expect(line).not.toMatch(/PRD|role table/)
      expect(line.length).toBeGreaterThan(0)
    },
  )

  it('is the only way a phone file reaches a refusal, and none reads the question', () => {
    const root = join(process.cwd(), 'src/features/phone')
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return walk(path)
        return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : []
      })
    })(root)
    expect(files.length).toBeGreaterThan(20)
    const offenders = files.filter((path) => {
      const code = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      return (
        /\.question\b/.test(code) ||
        (/from '@\/app\/session\/refusal'/.test(code) &&
          !path.endsWith('phone-refusal.ts')) ||
        /<ActPoint\b/.test(code) ||
        /\bPRD\b/.test(code)
      )
    })
    expect(offenders.map((path) => path.slice(root.length + 1))).toEqual([])
  })
})
