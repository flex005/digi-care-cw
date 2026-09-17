import { useCallback } from 'react'
import type { CategoryState, DocumentRecord, IsoDate, LibraryRow } from '@/data/types'
import { getResidentDocuments } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { dueSoonDays } from '@/data/access/settings-store'
import { Button, Card, CardHead, EmptyState } from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { assertNever } from '@/lib/assert-never'
import { formatCount, pluralise } from '@/lib/format'
import { BrokenReference, ExpiryChip, FileFactsText, FiledBy } from './DocumentParts'
import { DOCUMENT_CATEGORIES } from './documents/categories'
import { expiryFinding, type ExpiryCounts } from './documents/expiry'
import { residentLibrary } from './documents/library'
import { useSiteToday } from './documents/today'
import styles from './consent-and-documents.module.css'

/**
 * A resident's documents, read.
 *
 * The sentence: **what has expired, what is about to, and what nobody can tell
 * you about, then the seven categories in the order an emergency needs them.**
 *
 * All seven always listed, iterated from the constant. A library showing only
 * the categories it holds tells a reader there are four kinds of document.
 *
 * **Nothing opens.** There is no document viewer in this build, so a row
 * states its facts (what it is, when it expires, who filed it) and offers no
 * link that would lead nowhere. Uploading is the senior carer's act and is
 * drawn at the head.
 */
export function DocumentsTab() {
  const { resident, medications } = useOpenRecord()
  const viewer = useViewer()
  const today = useSiteToday()

  const load = useCallback(() => getResidentDocuments(resident.id), [resident.id])
  const resource = useResource(load, [resident.id])

  const act = (
    <ActPoint
      answer={viewer.ask('upload_document', resident.id)}
      label="Upload a document"
      notBuilt="Uploading is built in Phase 8, senior carer records."
      residentName={resident.preferredName}
    />
  )
  const head = (
    <CardHead
      title={`${resident.preferredName}’s documents`}
      subtitle="What is on file, when it expires, and who filed it."
      expand={{ kind: 'not_built' }}
    />
  )

  switch (resource.kind) {
    case 'loading':
      return (
        <Card>
          {head}
          <p className={styles.status} role="status">
            Loading documents…
          </p>
        </Card>
      )

    case 'refused':
      return <NotYourHome refusal={resource} />

    case 'error':
      return (
        <Card>
          {head}
          <EmptyState
            title="These documents could not be loaded"
            body={`Nothing is shown rather than a partial library. ${resource.message}`}
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      )

    case 'ready': {
      /*
       * **The subject comes from the route.** A library loaded for the resident
       * open a moment ago is still held while the next one loads, and showing
       * it would be one person's documents under another person's name. It
       * waits instead.
       */
      if (resource.data.resident.id !== resident.id)
        return (
          <Card>
            {head}
            <p className={styles.status} role="status">
              Loading documents…
            </p>
          </Card>
        )

      const library = residentLibrary(
        resident,
        resource.data.documents,
        medications,
        today,
      )

      return (
        <div className={styles.panel} data-documents-panel>
          <Card>
            {head}
            <div className={styles.head}>
              <Findings
                counts={library.counts}
                preferredName={resident.preferredName}
              />
              {act}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Library"
              subtitle={`All ${formatCount(DOCUMENT_CATEGORIES.length)} categories, in the order an emergency needs them.`}
              expand={{ kind: 'not_built' }}
            />
            <div className={styles.categories}>
              {library.categories.map((category) => (
                <section
                  key={category.id}
                  className={styles.category}
                  data-category={category.id}
                >
                  <header className={styles.categoryHead}>
                    <h3 className={styles.categoryTitle}>{category.label}</h3>
                    <p className={styles.rowMeta} data-category-count>
                      {category.state.kind === 'filled'
                        ? pluralise(category.state.rows.length, 'entry', 'entries')
                        : 'nothing on file'}
                    </p>
                  </header>
                  <CategoryBody
                    state={category.state}
                    holds={category.holds}
                    today={today}
                  />
                </section>
              ))}
            </div>
          </Card>
        </div>
      )
    }

    default:
      return assertNever(resource)
  }
}

/**
 * Three findings, never summed.
 *
 * Expired and expiring are findings about documents somebody decided about.
 * **No expiry recorded is not a milder third**: it is the absence of the fact
 * the other two are made of, so it takes the hatch while they take critical and
 * caution. A single "needs attention" number would weigh a lapsed DNAR and an
 * unclassified photograph the same.
 *
 * **A zero is a finding, not a gap**, so a count of nothing renders plain: a
 * red "0 expired" would be a finding nobody made, and a hatched "0 with no
 * expiry recorded" a gap the record says is not there.
 */
function Findings({
  counts,
  preferredName,
}: {
  counts: ExpiryCounts
  preferredName: string
}) {
  const of = `of ${pluralise(counts.total, 'document')} on file for ${preferredName}`

  return (
    <div className={styles.findings}>
      <Finding
        kind="expired"
        value={counts.expired}
        title="expired"
        of={of}
        treatment={counts.expired > 0 ? 'critical' : 'plain'}
      />
      <Finding
        kind="expiring"
        value={counts.expiring}
        title={`expire within ${pluralise(dueSoonDays(), 'day')}`}
        of={of}
        treatment={counts.expiring > 0 ? 'caution' : 'plain'}
      />
      <Finding
        kind="not_recorded"
        value={counts.notRecorded}
        title="no expiry recorded"
        of={of}
        treatment={counts.notRecorded > 0 ? 'hatched' : 'plain'}
      />
    </div>
  )
}

type Treatment = 'plain' | 'critical' | 'caution' | 'hatched'

const TREATMENT_CLASS: Record<Treatment, string> = {
  plain: styles.finding,
  critical: styles.findingCritical,
  caution: styles.findingCaution,
  hatched: styles.findingHatched,
}

function Finding({
  kind,
  value,
  title,
  of,
  treatment,
}: {
  kind: 'expired' | 'expiring' | 'not_recorded'
  value: number
  title: string
  of: string
  treatment: Treatment
}) {
  return (
    <p
      className={TREATMENT_CLASS[treatment]}
      data-finding={kind}
      /* The hatch, marked as the hatch: the same `data-state` the Unrecorded
         component sets, so the treatment is checkable wherever it appears. */
      data-state={treatment === 'hatched' ? 'unrecorded' : undefined}
    >
      <span className={styles.findingFigure} data-numeric>
        {formatCount(value)}
      </span>
      <span className={styles.findingTitle}>{title}</span>
      <span className={styles.findingOf}>
        {of}
        {treatment === 'hatched' ? '. Nobody has said whether they expire.' : ''}
      </span>
    </p>
  )
}

function CategoryBody({
  state,
  holds,
  today,
}: {
  state: CategoryState
  holds: string
  today: IsoDate
}) {
  switch (state.kind) {
    case 'filled':
      return (
        <ul className={styles.list}>
          {state.rows.map((row) => (
            <li key={rowKey(row)}>
              <Row row={row} today={today} />
            </li>
          ))}
        </ul>
      )

    /*
     * Empty is not always emptiness. A category nothing implies anything about
     * is quietly empty; a category another part of the record says should hold
     * something is a gap, and the two are opposite states behind the same blank
     * space.
     */
    case 'expected_but_empty':
      return (
        <div data-empty="expected">
          <Unrecorded
            variant="panel"
            label={state.missing}
            detail={state.because}
            caption="The care record says a document exists"
          />
        </div>
      )

    case 'empty':
      return (
        <p className={styles.categoryEmpty} data-empty="nothing">
          No documents in this category. It holds {holds}.
        </p>
      )

    default:
      return assertNever(state)
  }
}

const rowKey = (row: LibraryRow) =>
  row.kind === 'document' ? row.document.id : row.reference.id

function Row({ row, today }: { row: LibraryRow; today: IsoDate }) {
  if (row.kind === 'referenced_not_on_file') {
    return (
      <div className={styles.documentRow} data-row="referenced_not_on_file">
        <div className={styles.about}>
          <p className={styles.rowTitle}>{row.reference.title}</p>
          <p className={styles.rowMeta}>Referenced by {row.reference.origin}</p>
        </div>
        <div className={styles.expiryCell}>
          <BrokenReference reference={row.reference} />
        </div>
      </div>
    )
  }

  return <DocumentRow document={row.document} today={today} />
}

function DocumentRow({
  document,
  today,
}: {
  document: DocumentRecord
  today: IsoDate
}) {
  return (
    <div className={styles.documentRow} data-row="document" data-document={document.id}>
      <div className={styles.about}>
        <p className={styles.rowTitle}>{document.title}</p>
        <p className={styles.rowMeta}>
          <FileFactsText file={document.file} />
        </p>
      </div>
      <div className={styles.expiryCell}>
        <ExpiryChip finding={expiryFinding(document.expiry, today)} />
      </div>
      <p className={styles.filedCell} data-filed>
        <FiledBy staff={document.filedBy} on={document.filedOn} />
      </p>
    </div>
  )
}
