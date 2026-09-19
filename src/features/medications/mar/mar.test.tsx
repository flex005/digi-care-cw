import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import type { MarCellState, Resident, ResidentId, StaffId } from '@/data/types'
import { residents } from '@/data/fixtures/residents'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import {
  marRecordsFor,
  medicationsFor,
  type MarRecord,
} from '@/data/fixtures/medications'
import { formatDate } from '@/lib/format'
import { renderProfileTab } from '@/test/render-signed-in'
import { NOT_GIVEN_REASON_LABEL } from '../medication-words'
import { historyOf, keyOf, monthLabel } from './mar-grid'
import { MarChartRoute } from './MarChartRoute'

/**
 * The MAR chart. CW PRD MED-04.
 *
 * What is under test is not that a grid renders. It is that the grid is a real
 * table a screen reader can walk, that each state says what it is in words and
 * a shape, that a closed omission and a half-signed dose each stay two facts,
 * that the months offered are the months the record holds, and that nothing on
 * the page can change a record.
 *
 * The fixtures are generated against the moment the suite runs, so each test
 * finds its record in the fixtures first and pages to that record's month.
 */

const navigation = vi.hoisted(() => ({
  pathname: '/residents',
  params: {} as { residentId?: string },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

function residentOf(id: string): Resident {
  const resident = residents.find((entry) => entry.id === id)
  if (resident === undefined) throw new Error(`No fixture resident ${id}`)
  return resident
}

async function openMar(staffId: StaffId, residentId: string) {
  const resident = residentOf(residentId)
  navigation.params = { residentId: resident.id }
  navigation.pathname = `/residents/${resident.id}/medications/mar`
  const view = renderProfileTab(staffId, <MarChartRoute />, resident.siteId)
  await screen.findByRole('table')
  return view.container.querySelector('[data-mar-chart]') as HTMLElement
}

/** The chart opens on a week; most tests want a whole month in view. */
async function showMonth(container: HTMLElement) {
  const month = within(container).getByRole('radio', {
    name: 'Month',
  }) as HTMLInputElement
  if (!month.checked) fireEvent.click(month)
}

/** The first record for a resident that passes the test. */
function recordWhere(residentId: string, test: (state: MarCellState) => boolean) {
  const found = marRecordsFor(residentId as ResidentId).find((record) =>
    test(record.state),
  )
  if (found === undefined) throw new Error(`No such record for ${residentId}`)
  return found
}

function monthOfDate(date: string) {
  return monthLabel({ year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) })
}

/** Pages back from the latest month until the chart shows the record's month. */
async function goToMonthOf(container: HTMLElement, date: string) {
  await showMonth(container)
  const target = `Month of ${monthOfDate(date)}`
  for (let step = 0; step < 24; step += 1) {
    const shown = container.querySelector('[data-range-label]')?.textContent
    if (shown === target) return
    fireEvent.click(within(container).getByRole('button', { name: 'Previous month' }))
  }
  throw new Error(`Never reached ${target}`)
}

async function cellFor(container: HTMLElement, record: MarRecord) {
  await goToMonthOf(container, record.date)
  const slot = container.querySelector(
    `[data-cell="${keyOf(record.medicationId, record.date, record.roundTime)}"]`,
  )
  if (slot === null) throw new Error('No cell for the record')
  return slot.querySelector('button') as HTMLButtonElement
}

/**
 * The hatch itself, not everything that borrows the unrecorded colour.
 *
 * `composes:` puts both class names on the element, so a plain `/unrecorded/`
 * also matched `unrecordedUnderline` — the dashed edge a given-but-unwitnessed
 * dose carries. They are different marks: one is the gradient that means
 * nobody recorded this, the other is the second of two facts on a cell that
 * *is* recorded.
 */
const isHatched = (element: Element) => /unrecorded(?![A-Za-z])/.test(element.className)

describe('a real table', () => {
  it('has a caption, day and round column headers, and a row header per medication', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const table = screen.getByRole('table')
    const medications = medicationsFor('res-okafor' as ResidentId)
    const rounds = new Set(medications.flatMap((m) => m.roundTimes)).size

    expect(table.querySelector('caption')?.textContent).toMatch(
      /Medication administration record for Emmanuel/,
    )
    const days = table.querySelectorAll('thead th[scope="colgroup"]')
    expect(days.length).toBeGreaterThan(0)
    // Every round under every day, plus the medication column and the row total.
    expect(table.querySelectorAll('thead th[scope="col"]')).toHaveLength(
      days.length * rounds + 2,
    )
    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(medications.length)
    for (const row of rows) {
      expect(row.querySelectorAll('th[scope="row"]')).toHaveLength(1)
      expect(row.querySelectorAll('td button')).toHaveLength(days.length * rounds)
    }
    expect(container.querySelector('[data-range-label]')?.textContent).toMatch(
      /^(Week|Month) of /,
    )
  })

  /*
   * **Rule 4 on every row, counted out of the rounds that medicine was
   * scheduled for.** Counting the row's cells would put a denominator on it
   * that nothing was ever expected against — most cells on a row are another
   * medicine's round — and it would grow whenever somebody else's medicine
   * gained a round time.
   */
  it('gives every row its own total, out of what that medicine was due', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const totals = [...container.querySelectorAll('[data-row-total]')]
    const rows = container.querySelectorAll('tbody tr')
    expect(totals).toHaveLength(rows.length)

    // Checked against the row's own cells rather than against a second build of
    // the grid: a total agreeing with a recomputation of itself agrees with
    // whatever the recomputation says.
    for (const row of rows) {
      const total = row.querySelector('[data-row-total]') as HTMLElement
      const cells = row.querySelectorAll('td button[data-mar]')
      const given = row.querySelectorAll(
        '[data-mar="given"], [data-mar="prn_given"]',
      ).length
      const omitted = row.querySelectorAll('[data-mar="omitted"]').length

      /*
       * The denominator is the cells this medicine actually had a record for —
       * every cell less the ones that are not its round, before it was
       * prescribed, or outside the window the record covers. A first version
       * asserted only `<= cells.length`, and a mutation that counted a
       * medicine's *unscheduled* rounds passed it: the row would have claimed
       * a denominator that grows when somebody else's medicine gains a round.
       */
      const covered = row.querySelectorAll('td[data-recorded="true"]').length

      const said = /(\d+) given of (\d+) due/.exec(total.textContent ?? '')
      expect(said).not.toBeNull()
      expect(Number(said?.[1])).toBe(given)
      expect(Number(said?.[2])).toBe(covered)
      expect(Number(said?.[2])).toBeGreaterThanOrEqual(given + omitted)
      expect(covered).toBeLessThanOrEqual(cells.length)

      // Never summed into the coverage: they are different facts.
      if (omitted > 0) expect(total.textContent).toContain(`${omitted} with no record`)
      else expect(total.textContent).not.toMatch(/with no record/)
    }
  })

  /*
   * The chart's own heading is the range on screen. The resident is named by
   * the profile header above it, which is always mounted, and in full in the
   * table's caption — which is what a screen reader announces on entering it.
   */
  it('names the resident in full in the table’s caption', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    expect(screen.getByRole('table').querySelector('caption')?.textContent).toContain(
      residentOf('res-okafor').fullLegalName,
    )
    expect(container.querySelector('[data-range-label]')?.textContent).toMatch(
      /^Week of /,
    )
  })

  it('gives every cell a full-sentence accessible name', async () => {
    await openMar(staffEze.id, 'res-okafor')
    const cells = within(screen.getByRole('table')).getAllByRole('button')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.getAttribute('aria-label')).toMatch(
        /^.+ \S+, \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} round: .+\.$/,
      )
    }
  })
})

describe('each state distinct, in words and shape', () => {
  it('draws a given dose with a tick and the word, and not hatched', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere(
      'res-okafor',
      (state) => state.kind === 'given' && state.witness.kind === 'not_required',
    )
    const medication = medicationsFor('res-okafor' as ResidentId).find(
      (m) => m.id === record.medicationId,
    )!
    const cell = await cellFor(container, record)
    expect(cell.getAttribute('data-mar')).toBe(medication.isPrn ? 'prn_given' : 'given')
    // A shape, not a word: the words are in the legend above the grid.
    expect(cell.querySelector('svg')).toBeTruthy()
    expect(cell.textContent).toBe('')
    expect(cell.getAttribute('aria-label')).toMatch(/given/i)
    expect(isHatched(cell)).toBe(false)
  })

  it('draws a PRN dose as a recorded dose, plainly, in its own word', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const prn = medicationsFor('res-okafor' as ResidentId).find((m) => m.isPrn)!
    const record = marRecordsFor('res-okafor' as ResidentId).find(
      (entry) => entry.medicationId === prn.id && entry.state.kind === 'given',
    )!
    const cell = await cellFor(container, record)
    expect(cell.getAttribute('data-mar')).toBe('prn_given')
    expect(cell.textContent).toBe('')
    expect(cell.querySelector('svg')).toBeTruthy()
    expect(cell.className).not.toMatch(/caution|Omitted|unrecorded/)
    expect(cell.getAttribute('aria-label')).toMatch(/given as required \(PRN\) at/)
  })

  it('draws a not given dose with a cross and the word, and gives the reason on tap', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere('res-okafor', (state) => state.kind === 'not_given')
    if (record.state.kind !== 'not_given') throw new Error('Not a refusal')
    const cell = await cellFor(container, record)
    expect(cell.getAttribute('data-mar')).toBe('not_given')
    expect(cell.textContent).toBe('')
    expect(cell.querySelector('svg')).toBeTruthy()
    expect(cell.querySelector('svg')).toBeTruthy()
    expect(isHatched(cell)).toBe(false)

    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-fact="Reason"]')?.textContent).toContain(
      NOT_GIVEN_REASON_LABEL[record.state.reason],
    )
    expect(dialog.querySelector('[data-fact="Recorded by"]')?.textContent).toContain(
      record.state.recordedBy.displayName,
    )
  })

  it('hatches an omission, says No record, and hatches nothing else in the grid', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere(
      'res-okafor',
      (state) => state.kind === 'omitted' && state.closure.kind === 'open',
    )
    const cell = await cellFor(container, record)
    expect(cell.getAttribute('data-mar')).toBe('omitted')
    // The only patterned cell in the grid, and the only one with no glyph:
    // every mark here means somebody acted.
    expect(cell.querySelector('svg')).toBeNull()
    expect(cell.getAttribute('aria-label')).toMatch(/no record|nobody/i)
    expect(isHatched(cell)).toBe(true)
    for (const button of within(screen.getByRole('table')).getAllByRole('button')) {
      expect(isHatched(button)).toBe(button.getAttribute('data-mar') === 'omitted')
    }
  })

  it('draws a round with no dose of this medicine as Not due, quietly', async () => {
    await openMar(staffEze.id, 'res-okafor')
    const notDue = within(screen.getByRole('table'))
      .getAllByRole('button')
      .find((button) => button.getAttribute('data-mar') === 'not_due')!
    // The one genuinely empty cell, and empty because nothing was scheduled.
    expect(notDue.textContent).toBe('')
    expect(notDue.querySelector('svg')).toBeNull()
    expect(isHatched(notDue)).toBe(false)
    expect(notDue.getAttribute('aria-label')).toMatch(/: not due/)
  })

  it('draws an open window as Due, with a ring, wherever the record holds one', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const due = container.querySelectorAll('button[data-mar="due"]')
    const inRecord = marRecordsFor('res-okafor' as ResidentId).filter(
      (entry) => entry.state.kind === 'due',
    )
    expect(due).toHaveLength(inRecord.length)
    for (const cell of due) {
      expect(cell.textContent).toBe('')
      expect(cell.querySelector('svg')).toBeTruthy()
      expect(cell.getAttribute('aria-label')).toMatch(/due, window open from/)
    }
  })
})

describe('the legend', () => {
  it('names every state in words beside the face the grid draws', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const legend = within(container).getByRole('list', { name: 'What each cell means' })
    const entries = [...legend.querySelectorAll('[data-legend]')]
    const faces = entries.map((entry) =>
      entry.querySelector('[data-mar]')?.getAttribute('data-mar'),
    )
    expect(new Set(faces)).toEqual(
      new Set([
        'given',
        'prn_given',
        'not_given',
        'omitted',
        'due',
        'not_due',
        'not_prescribed_yet',
        'not_held',
      ]),
    )
    for (const entry of entries) {
      expect(entry.textContent?.length).toBeGreaterThan(10)
    }
    const due = entries.find((entry) => entry.getAttribute('data-legend') === 'Due')!
    expect(due.querySelector('[data-mar="due"] svg')).toBeTruthy()
    // The words live here now, beside the face: the cells carry the shape.
    expect(due.textContent).toContain('Due')
    expect(due.querySelector('[data-mar="due"]')?.textContent).toBe('')
  })
})

describe('two facts stay two', () => {
  it('shows a closed omission still hatched, with a plain Closed mark, and who, when and why in the detail', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere(
      'res-okafor',
      (state) => state.kind === 'omitted' && state.closure.kind === 'closed',
    )
    if (record.state.kind !== 'omitted' || record.state.closure.kind !== 'closed')
      throw new Error('Not a closed omission')
    const closure = record.state.closure

    const cell = await cellFor(container, record)
    /*
     * Still hatched, and now carrying a glyph. Closing records a decision
     * *about* the gap and does not fill it, so the hatch stays; the mark is
     * what says somebody acted, which is the difference between this cell and
     * the omission nobody has touched.
     */
    expect(isHatched(cell)).toBe(true)
    expect(cell.getAttribute('data-closure')).toBe('closed')
    expect(cell.querySelector('svg')).toBeTruthy()

    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    const record_ = dialog.querySelector('[data-fact="Record"]')!
    expect(record_.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'No record',
    )
    const closed = dialog.querySelector('[data-closure-record]')!
    expect(closed.querySelector('[data-state="unrecorded"]')).toBeNull()
    expect(closed.textContent).toContain(`Closed by ${closure.by.displayName}`)
    expect(closed.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(closed.textContent).toContain(closure.reason)
    expect(closed.textContent).toContain('The dose still has no record.')
  })

  it('shows a dose given without its second signature as Given and a hatched mark, both in the detail', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere(
      'res-okafor',
      (state) =>
        state.kind === 'given' && state.witness.kind === 'required_not_recorded',
    )
    const cell = await cellFor(container, record)
    /*
     * Two facts, two marks, neither in small print: the settled fill and tick
     * for the dose that was given, and the unrecorded dashed edge for the
     * signature nobody recorded. Never a third fill averaging the two.
     */
    expect(cell.getAttribute('data-second-signature')).toBe('missing')
    expect(cell.querySelector('svg')).toBeTruthy()
    expect(isHatched(cell)).toBe(false)
    expect(cell.className).toMatch(/unrecordedUnderline/)
    // The tick is still the given mark: the gap did not replace it.
    const plain = await (async () => {
      const given = recordWhere(
        'res-okafor',
        (state) => state.kind === 'given' && state.witness.kind === 'not_required',
      )
      return cellFor(container, given)
    })()
    expect(plain.className).not.toMatch(/unrecordedUnderline/)
    expect(cell.getAttribute('aria-label')).toMatch(
      /: given at .+ by .+, second signature not recorded\.$/,
    )

    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-fact="Record"]')?.textContent).toContain('Given')
    expect(
      dialog.querySelector('[data-fact="Record"] [data-state="unrecorded"]'),
    ).toBeNull()
    const signature = dialog.querySelector('[data-fact="Second signature"]')!
    expect(signature.querySelector('[data-state="unrecorded"]')?.textContent).toContain(
      'Second signature not recorded',
    )
  })
})

describe('the detail panel', () => {
  it('opens from a cell, names the medicine, the round and the resident, and closes', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const record = recordWhere('res-okafor', (state) => state.kind === 'given')
    const cell = await cellFor(container, record)
    const medication = medicationsFor('res-okafor' as ResidentId).find(
      (m) => m.id === record.medicationId,
    )!

    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toBe(
      `${medication.name}, ${record.roundTime} round on ${formatDate(record.date)}`,
    )
    expect(dialog.textContent).toContain(residentOf('res-okafor').fullLegalName)
    for (const fact of ['Medicine', 'Dose', 'Route', 'Round', 'Given by', 'Given at'])
      expect(dialog.querySelector(`[data-fact="${fact}"]`), fact).toBeTruthy()
    expect(dialog.querySelector('[data-fact="Dose"]')?.textContent).toContain(
      medication.dose,
    )

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('how much of the record is on screen', () => {
  /*
   * A week to start, because a week is what a shift reads. The month is one
   * press away, and the two are presentations of one record rather than two
   * records — which is what the segmented control means (CLAUDE.md §6).
   */
  it('opens on the last week the record holds, and offers nothing after it', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    expect(
      (within(container).getByRole('radio', { name: 'Week' }) as HTMLInputElement)
        .checked,
    ).toBe(true)
    expect(container.querySelector('[data-range-label]')?.textContent).toMatch(
      /^Week of /,
    )
    expect(within(container).getByRole('button', { name: 'Next week' })).toBeDisabled()
  })

  it('names the range the totals are counted over, not a fixed one', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const head = () =>
      [...container.querySelectorAll('thead th')].find((th) =>
        /^This /.test(th.textContent ?? ''),
      )?.textContent
    expect(head()).toBe('This week')
    fireEvent.click(within(container).getByRole('radio', { name: 'Month' }))
    expect(head()).toBe('This month')
  })

  it('switches to the month without moving the record', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const daysInWeek = container.querySelectorAll('thead th[scope="colgroup"]').length

    fireEvent.click(within(container).getByRole('radio', { name: 'Month' }))
    expect(container.querySelector('[data-range-label]')?.textContent).toMatch(
      /^Month of /,
    )
    expect(
      container.querySelectorAll('thead th[scope="colgroup"]').length,
    ).toBeGreaterThan(daysInWeek)
  })

  it('stops where the record starts, and says where that is', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const history = historyOf(marRecordsFor('res-okafor' as ResidentId))
    if (history.kind !== 'held') throw new Error('No record')
    await showMonth(container)

    const previous = within(container).getByRole('button', { name: 'Previous month' })
    for (let step = 1; step < history.months.length; step += 1)
      fireEvent.click(previous)

    expect(container.querySelector('[data-range-label]')?.textContent).toBe(
      `Month of ${monthLabel(history.months[0]!)}`,
    )
    expect(
      within(container).getByRole('button', { name: 'Previous month' }),
    ).toBeDisabled()
    expect(container.querySelector('[data-record-bounds]')?.textContent).toContain(
      `starts on ${formatDate(history.firstDate)}`,
    )
    // Clipped to the record: the first column is the first day it holds.
    const firstDay = container.querySelector('thead th[scope="colgroup"]')
    expect(firstDay?.textContent).toContain(
      `${history.firstDate.slice(8, 10)}/${history.firstDate.slice(5, 7)}`,
    )
  })
})

describe('read-only, for both people', () => {
  /*
   * The export line went with the others: the button produces no file, and
   * saying so beside it was a sentence about what the build cannot do rather
   * than about the record. The departure is recorded in DEPARTURES.md.
   */
  it('keeps the export at the head, with no line under it', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeTruthy()
    expect(container.querySelector('[data-act-line]')).toBeNull()
  })

  it('puts the way back above the chart rather than inside it', async () => {
    const container = await openMar(staffEze.id, 'res-okafor')
    const back = within(container).getByRole('link', { name: /^Back to / })
    const card = container.querySelector('[data-card]')
    expect(card).not.toBeNull()
    // Before the first card in document order, and not inside one.
    expect(back.closest('[data-card]')).toBeNull()
    expect(
      back.compareDocumentPosition(card as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it.each([
    ['Eze', staffEze.id],
    ['Akinyemi', staffAkinyemi.id],
  ] as const)('draws no control that edits a record, for %s', async (_who, staffId) => {
    const container = await openMar(staffId, 'res-okafor')
    const chart = container
    expect(within(chart).queryAllByRole('textbox')).toHaveLength(0)
    expect(within(chart).queryAllByRole('checkbox')).toHaveLength(0)
    // The two radios are the week/month control: a presentation of the record,
    // not a change to it.
    expect(
      within(chart)
        .queryAllByRole('radio')
        .map((entry) => entry.closest('label')?.textContent),
    ).toEqual(['Week', 'Month'])
    expect(within(chart).queryAllByRole('combobox')).toHaveLength(0)
    for (const button of within(chart).getAllByRole('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent ?? ''
      const isCell = button.getAttribute('aria-haspopup') === 'dialog'
      if (isCell) continue
      expect(name).toMatch(
        /^(Previous (week|month)|Next (week|month)|Export PDF|Show only these|Show every medicine)/,
      )
    }
    expect(
      within(chart).queryAllByRole('link', { name: /edit|record|change|delete/i }),
    ).toHaveLength(0)
  })
})

describe('accessibility', () => {
  it('has no axe violations', async () => {
    const chart = await openMar(staffAkinyemi.id, 'res-nwachukwu')
    expect(await axe(chart.parentElement!.parentElement!)).toHaveNoViolations()
  }, 30_000)
})
