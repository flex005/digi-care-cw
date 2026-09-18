import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '@/components/shell/nav.icons'
import { ROUTES, isBuilt } from './routes'

/**
 * The route declaration against the pages on disk, in both directions.
 *
 * A nav item is live exactly when a route names its module, so a declaration
 * that drifts from the files is a navigation that lies: an item that opens a
 * 404, or a built screen nothing links to.
 */
const APP = path.join(process.cwd(), 'src/app')

function pagesOnDisk(dir = APP): { path: string; screen: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return pagesOnDisk(full)
    if (entry.name !== 'page.tsx') return []
    const segments = path
      .relative(APP, path.dirname(full))
      .split(path.sep)
      .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment))
    const screen = /screen="([^"]+)"/.exec(readFileSync(full, 'utf8'))?.[1]
    if (screen === undefined) throw new Error(`${full} renders no <ClientOnly screen>`)
    return [{ path: `/${segments.join('/')}`, screen }]
  })
}

describe('routes', () => {
  const onDisk = pagesOnDisk()

  it('finds the pages it is checking', () => {
    expect(onDisk.length).toBe(ROUTES.length)
  })

  it('declares every page on disk, with the screen that page renders', () => {
    for (const page of onDisk) {
      expect(ROUTES.find((route) => route.path === page.path)?.screen, page.path).toBe(
        page.screen,
      )
    }
  })

  it('has a page on disk for every declared route', () => {
    for (const route of ROUTES) {
      expect(
        onDisk.some((page) => page.path === route.path),
        route.path,
      ).toBe(true)
    }
  })

  it('points every live nav item at a declared route', () => {
    for (const item of NAV_ITEMS.filter((entry) => isBuilt(entry.module))) {
      expect(
        ROUTES.some((route) => route.path === item.path),
        item.label,
      ).toBe(true)
    }
  })

  it('reaches every module-building route from the navigation', () => {
    for (const route of ROUTES.filter((entry) => entry.module !== undefined)) {
      expect(
        NAV_ITEMS.some((item) => item.module === route.module),
        route.path,
      ).toBe(true)
    }
  })

  /*
   * Named, so a nav item cannot go live by accident in the phase that did not
   * build it. Phase 9 builds the dashboard at the root, Phase 7 Goals and
   * Activities, Phase 6 Incidents, Phase 5 Handover, Phase 4 Medications,
   * Phase 3 Care notes, Phase 2 Residents, Phase 0 Specimens.
   *
   * Risk assessments, Consent and Documents stay as rail items with no screen
   * of their own: Phase 8 built those acts on a resident's record, which is
   * where they belong, and a home-wide screen for each is not in the CW PRD.
   */
  it('has every module but Risk assessments, Consent and Documents live after Phase 9', () => {
    expect(
      NAV_ITEMS.filter((item) => isBuilt(item.module)).map((item) => item.label),
    ).toEqual([
      'Today',
      'Residents',
      'Care notes',
      'Handover',
      'Medications',
      'Incidents',
      'Goals',
      'Activities',
      'Specimens',
    ])
  })
})
