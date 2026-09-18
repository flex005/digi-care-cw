import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/app/routes'
import { NAV_ITEMS } from '@/components/shell/nav.icons'

/**
 * Reports and Compliance, confirmed absent rather than designed as a refusal.
 *
 * **Table 3 gives both roles no access, so there is nothing to draw.** RPT-01
 * exists in the CW PRD as a design reference for a screen the Admin build
 * owns, and the temptation it creates is to build a handsome restricted-access
 * page — which would be a screen this product does not have, reachable at an
 * address this product does not serve, telling somebody about a module they
 * were never shown.
 *
 * **Absence here is not the same as absence from a list.** A resident with no
 * risk assessment is a gap in a record somebody should have written; a module
 * neither role has any access to is not this product's record at all. The rail
 * says so in its own docblock, and this holds it: no route, no nav item, and
 * no link anywhere in the source.
 *
 * The one place either word may appear is the role table, which has to name
 * the row it is refusing.
 */

const SOURCE = join(process.cwd(), 'src')

function everyFile(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return everyFile(path)
    return /\.(ts|tsx|css)$/.test(entry.name) ? [path] : []
  })
}

describe('reports and compliance', () => {
  /*
   * The module, not the word. `reportIncident` is a care worker reporting an
   * incident, which Table 3 gives them: a check that matched any "report"
   * anywhere would fail on an act the PRD grants and teach whoever met it to
   * loosen the check rather than read it.
   */
  it('has no route at any address', () => {
    for (const route of ROUTES) {
      expect(route.path).not.toMatch(/^\/(reports|compliance)\b/i)
      expect(route.screen).not.toMatch(/^(reports|compliance)/i)
    }
  })

  it('has no navigation entry, disabled or otherwise', () => {
    for (const item of NAV_ITEMS) {
      expect(item.module).not.toMatch(/report|complian|settings|team/i)
      expect(item.path).not.toMatch(/report|complian/i)
    }
  })

  /**
   * A link is what a route table cannot see. `href="/reports"` in a feature
   * would be a dead address nobody declared, and the nav test above would
   * still pass.
   */
  it('is linked to from nowhere in the build', () => {
    const offenders = everyFile(SOURCE)
      .filter((path) => !path.includes('restricted-access.test'))
      .filter((path) =>
        /href=["'][^"']*(reports|compliance)/i.test(readFileSync(path, 'utf8')),
      )
    expect(offenders).toEqual([])
  })

  /*
   * The refusal itself is asserted in `capabilities.test.ts`, against the PRD's
   * Table 3, and is not repeated here: `check-role-names.mjs` reads test files
   * too, and it is right to — a second file naming a role is a second place a
   * disputed row would have to move.
   */
})
