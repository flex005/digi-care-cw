import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import type { DocumentRecord, IsoDate, Resident, StaffRef } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { medicationsFor } from '@/data/fixtures/medications'
import { staffAkinyemi, staffEze, staffOkonkwo } from '@/data/fixtures/organisation'
import { residentDocuments } from '@/data/access/document-store'
import { memberById } from '@/data/access/team-store'
import { answerFor } from '@/app/session/capabilities'
import { residentScopeFor } from '@/app/session/resident-scope'
import { signInRoleOf } from '@/app/session/roles'
import { renderProfileTab } from '@/test/render-signed-in'
import { DocumentsTab } from './DocumentsTab'
import { DOCUMENT_CATEGORIES } from './documents/categories'
import { countExpiry, expiryFinding } from './documents/expiry'
import { brokenReferences, expectationFor, residentLibrary } from './documents/library'

/**
 * The Documents tab, read-only.
 *
 * **The module's hazard is that a blank category and an unfiled document look
 * identical.** So seven categories whether or not they hold anything, a
 * category another part of the record says should not be empty, an id that
 * resolves to nothing, and an expiry nobody has decided, each drawn as what it
 * is.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/documents',
  params: { residentId: 'res-okafor' },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

/**
 * A pinned day for the date arithmetic. `expiryFinding` takes the day as an
 * argument precisely so a test can hold it still.
 */
const TODAY = '2026-08-25' as IsoDate
const staff: StaffRef = staffOkonkwo

const document = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: 'doc-test-0001',
  owner: { kind: 'resident', residentId: residents[0]!.id },
  category: 'health_clinical',
  title: 'GP summary care record',
  file: { kind: 'described', format: 'PDF', bytes: 1024 * 1024 },
  expiry: { kind: 'not_recorded' },
  filedBy: staff,
  filedOn: '2026-01-04' as IsoDate,
  ...over,
})

function openAs(viewer: StaffRef, resident: Resident) {
  navigation.pathname = `/residents/${resident.id}/documents`
  navigation.params = { residentId: resident.id }
  return renderProfileTab(viewer.id, <DocumentsTab />)
}

const panelOf = (container: HTMLElement) =>
  waitFor(() => {
    const panel = container.querySelector<HTMLElement>('[data-documents-panel]')
    expect(panel).toBeTruthy()
    return panel!
  })

/** The running example: a DNAR on file, a broken prescription reference. */
const okafor = residents.find((resident) => resident.id === 'res-okafor')!
/** Photography consent withdrawn, with 14 photographs counted as remaining. */
const brennan = residents.find((resident) => resident.id === 'res-brennan')!

describe('expiry is a decision, not a date field', () => {
  it('separates a permanence decision from nobody having decided', () => {
    const decided = expiryFinding(
      { kind: 'does_not_expire', decidedBy: staff, on: '2026-03-12' as IsoDate },
      TODAY,
    )
    expect(decided).toEqual({
      kind: 'does_not_expire',
      decidedBy: staff,
      on: '2026-03-12',
    })
    expect(expiryFinding({ kind: 'not_recorded' }, TODAY).kind).toBe('not_recorded')
  })

  it('counts a document expiring today as expiring, not as expired', () => {
    expect(expiryFinding({ kind: 'expires', on: TODAY }, TODAY)).toEqual({
      kind: 'expiring',
      on: TODAY,
      inDays: 0,
    })
  })

  it('holds the window at 30 days with room either side', () => {
    expect(
      expiryFinding({ kind: 'expires', on: '2026-09-24' as IsoDate }, TODAY).kind,
    ).toBe('expiring')
    expect(
      expiryFinding({ kind: 'expires', on: '2026-09-25' as IsoDate }, TODAY).kind,
    ).toBe('in_date')
  })

  it('never sums the three findings', () => {
    const counts = countExpiry(
      [
        document({
          id: 'doc-a',
          expiry: { kind: 'expires', on: '2026-01-01' as IsoDate },
        }),
        document({
          id: 'doc-b',
          expiry: { kind: 'expires', on: '2026-09-01' as IsoDate },
        }),
        document({ id: 'doc-c', expiry: { kind: 'not_recorded' } }),
        document({
          id: 'doc-d',
          expiry: { kind: 'does_not_expire', decidedBy: staff, on: TODAY },
        }),
      ],
      TODAY,
    )
    expect(counts).toEqual({ expired: 1, expiring: 1, notRecorded: 1, total: 4 })
  })
})

describe("a resident's library", () => {
  it('lists all seven categories, in the emergency order', async () => {
    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const rendered = [...panel.querySelectorAll('[data-category]')].map((section) =>
      section.getAttribute('data-category'),
    )
    expect(rendered).toEqual(DOCUMENT_CATEGORIES.map((category) => category.id))
    expect(rendered[0]).toBe('legal_authority')
  })

  it('states the denominator on every finding', async () => {
    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const onFile = residentDocuments(okafor.id).length
    for (const kind of ['expired', 'expiring', 'not_recorded']) {
      const finding = panel.querySelector(`[data-finding="${kind}"]`)!
      expect(finding.textContent, kind).toContain(`of ${onFile} documents on file`)
    }
  })

  it('hatches the third finding only where there is a gap, and never the other two', async () => {
    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    // The rendered figure decides the treatment: a gap counted is hatched, a
    // zero is a finding and is not.
    const gap = panel.querySelector('[data-finding="not_recorded"]')!
    const figure = Number(gap.querySelector('[data-numeric]')?.textContent)
    expect(Number.isInteger(figure)).toBe(true)
    expect(gap.getAttribute('data-state')).toBe(figure > 0 ? 'unrecorded' : null)
    expect(panel.querySelector('[data-finding="expired"]')).not.toHaveAttribute(
      'data-state',
      'unrecorded',
    )
    expect(panel.querySelector('[data-finding="expiring"]')).not.toHaveAttribute(
      'data-state',
      'unrecorded',
    )
  })

  it('shows who filed every document and when', async () => {
    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const rows = panel.querySelectorAll('[data-row="document"]')
    expect(rows.length).toBe(residentDocuments(okafor.id).length)
    for (const row of rows) {
      expect(row.querySelector('[data-filed]')?.textContent).toMatch(
        /^Filed by .+, \d{2}\/\d{2}\/\d{4}$/,
      )
      expect(row.querySelector('[data-expiry]')).toBeTruthy()
    }
  })

  it('offers nothing to open, because nothing opens in this build', async () => {
    const { container } = openAs(staffAkinyemi, okafor)
    const panel = await panelOf(container)

    for (const category of panel.querySelectorAll<HTMLElement>('[data-category]')) {
      expect(within(category).queryByRole('link')).toBeNull()
      expect(within(category).queryByRole('button')).toBeNull()
    }
  })
})

describe('the pinned lapsed DNACPR', () => {
  it('renders as a finding in Legal and authority', async () => {
    const resuscitation = okafor.futurePlans.resuscitation
    if (resuscitation.kind !== 'dnar_in_place') throw new Error('needs a DNAR')

    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const row = panel.querySelector(`[data-document="${resuscitation.documentId}"]`)!
    expect(row.closest('[data-category]')).toHaveAttribute(
      'data-category',
      'legal_authority',
    )
    expect(
      row.querySelector('[data-expiry="expired"] [data-tone="critical"]'),
    ).toBeTruthy()
  })
})

describe('a reference that resolves to nothing', () => {
  it('is a hatched row in its category, naming the id and what holds it', async () => {
    const broken = brokenReferences(
      okafor,
      residentDocuments(okafor.id),
      medicationsFor(okafor.id),
    )
    const first = broken[0]
    if (first === undefined) throw new Error('needs the pinned broken reference')

    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    const hatch = panel.querySelector(`[data-broken-reference="${first.id}"]`)!
    expect(hatch.querySelector('[data-state="unrecorded"]')).toBeTruthy()
    expect(hatch.textContent).toContain(first.id)
    expect(hatch.textContent).toContain(first.origin)
    expect(hatch.closest('[data-category]')).toHaveAttribute(
      'data-category',
      first.category,
    )
  })
})

describe('empty is not always emptiness', () => {
  it("carries the withdrawal's counted photographs through to a hatched category", async () => {
    const expectation = expectationFor(brennan, 'photographs_media')
    expect(expectation?.missing).toContain('14')

    const { container } = openAs(staffAkinyemi, brennan)
    const panel = await panelOf(container)

    const section = panel.querySelector('[data-category="photographs_media"]')!
    expect(
      section.querySelector('[data-empty="expected"] [data-state="unrecorded"]'),
    ).toBeTruthy()
    expect(section.querySelector('[data-empty="nothing"]')).toBeNull()
  })

  it('renders a category nothing implies anything about quietly, saying what it holds', async () => {
    // Whether a category is empty does not depend on the day, so the pinned one serves.
    const subject = residents.find((candidate) =>
      residentLibrary(
        candidate,
        residentDocuments(candidate.id),
        medicationsFor(candidate.id),
        TODAY,
      ).categories.some((category) => category.state.kind === 'empty'),
    )
    if (subject === undefined) throw new Error('needs a quietly empty category')

    const { container } = openAs(staffAkinyemi, subject)
    const panel = await panelOf(container)

    const quiet = [...panel.querySelectorAll('[data-empty="nothing"]')]
    expect(quiet.length).toBeGreaterThan(0)
    for (const empty of quiet) {
      expect(empty.textContent).toMatch(
        /^No documents in this category\. It holds .+\.$/,
      )
      expect(empty.querySelector('[data-state="unrecorded"]')).toBeNull()
    }
  })
})

describe('uploading is the senior carer’s act', () => {
  const answerOf = (viewer: StaffRef, resident: Resident) => {
    const member = memberById(viewer.id)!
    return answerFor(
      signInRoleOf(member),
      residentScopeFor(member),
      'upload_document',
      {
        kind: 'resident',
        id: resident.id,
      },
      member.id,
    )
  }

  /*
   * Phase 8: filing is live, and it is about the file rather than any one row,
   * so it stays at the head where the refusal was. It opens over the library
   * it changes rather than at a second address, and the form names the subject
   * in full (CLAUDE.md §2).
   */
  it('opens the form over the library for Akinyemi, naming the subject', async () => {
    expect(answerOf(staffAkinyemi, okafor).kind).toBe('yes')

    const user = userEvent.setup()
    const { container } = openAs(staffAkinyemi, okafor)
    const panel = await panelOf(container)
    expect(panel.querySelector('[data-act-line]')).toBeNull()
    expect(within(panel).queryByRole('link', { name: 'File a document' })).toBeNull()

    await user.click(within(panel).getByRole('button', { name: 'File a document' }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', {
        name: `File a document for ${okafor.fullLegalName}`,
      }),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Title')).toBeInTheDocument()
  })

  it('offers Eze nothing to file with, and says nothing about whose act it is', async () => {
    const answer = answerOf(staffEze, okafor)
    if (answer.kind !== 'not_your_role') throw new Error('expected a refusal by role')

    const { container } = openAs(staffEze, okafor)
    const panel = await panelOf(container)

    expect(within(panel).queryByRole('button', { name: 'File a document' })).toBeNull()
    expect(within(panel).queryByRole('link', { name: 'File a document' })).toBeNull()
    expect(panel.querySelector('[data-act-line]')).toBeNull()
    expect(panel.textContent).not.toContain(answer.reason)
  })
})

describe('accessibility', () => {
  it('has no violations on the resident library', async () => {
    const { container } = openAs(staffEze, okafor)
    await panelOf(container)
    expect(await axe(container)).toHaveNoViolations()
  }, 30000)
})
