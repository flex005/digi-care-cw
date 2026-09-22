import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DocumentRecord, Resident, ResidentId } from '@/data/types'
import { getSiteDocuments } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { PageHead } from '@/components/layout/PageHead'
import {
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  Button,
  usePaged,
} from '@/components/primitives'
import { NotYourHome } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount, pluralise } from '@/lib/format'
import { ExpiryChip, FileFactsText } from '@/features/residents/tabs/DocumentParts'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import {
  countExpiry,
  expiryFinding,
  type ExpiryCounts,
  type ExpiryFinding,
} from '@/features/residents/tabs/documents/expiry'
import { useSiteToday } from '@/features/residents/tabs/documents/today'
import { documentsIcons } from './documents.icons'
import styles from './documents-list.module.css'

/**
 * Expiry tracking. CW PRD DOC-01, which puts it top right of the library.
 *
 * The sentence: **what has expired, then what expires inside 30 days, then
 * what nobody has said anything about — three claims, never one countdown.**
 *
 * **A claim inside a filter carries the filter** (CLAUDE.md §1), and it
 * carries the page too: paging hides rows, so a reader looking at twenty-five
 * of three hundred has been told this home holds twenty-five unless the
 * sentence says otherwise.
 *
 * Read-only for both roles. Nothing here writes; the act that would change any
 * of these rows is filing a replacement, which is on the library.
 */
type Filter = 'all' | 'expired' | 'expiring' | 'not_recorded'

/**
 * Each filter carries a label and a phrase, because the words that read
 * correctly on a pill read wrongly in a sentence — and lowercasing at the call
 * site is the tidying that lets whoever is appending a value decide how
 * somebody else's label reads.
 */
const FILTERS: { id: Filter; label: string; phrase: string }[] = [
  { id: 'expired', label: 'Expired', phrase: 'the documents that have expired' },
  {
    id: 'expiring',
    label: 'Expiring within 30 days',
    phrase: 'the documents expiring within 30 days',
  },
  {
    id: 'not_recorded',
    label: 'No expiry recorded',
    phrase: 'the documents with no expiry recorded',
  },
  { id: 'all', label: 'Everything on file', phrase: 'everything on file' },
]

export function ExpiryQueueRoute() {
  const { activeSite } = useSession()
  const today = useSiteToday()
  const [filter, setFilter] = useState<Filter>('expired')

  const load = useCallback(() => getSiteDocuments(activeSite.id), [activeSite.id])
  const resource = useResource<{ documents: DocumentRecord[]; residents: Resident[] }>(
    load,
    [activeSite.id],
  )

  const head = (
    <PageHead
      title="Expiry tracking"
      lines={[
        `Every document at ${activeSite.name}`,
        'by what its expiry decision says today',
      ]}
    />
  )

  const back = (
    <Link href="/documents" className={styles.back} data-library-link>
      <Icon name={documentsIcons.back} size={16} />
      Back to the library
    </Link>
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {back}
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading documents…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {back}
        {head}
        <Card>
          <EmptyState
            title="The documents could not be loaded"
            body="Nothing is shown rather than a partial queue."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  return (
    <div className={styles.page} data-expiry-queue>
      {back}
      {head}
      <Queue
        documents={resource.data.documents}
        residents={resource.data.residents}
        today={today}
        siteName={activeSite.name}
        filter={filter}
        onFilter={setFilter}
      />
    </div>
  )
}

export interface QueueRow {
  document: DocumentRecord
  finding: ExpiryFinding
  subject: string
  residentId: ResidentId | 'the_home'
}

function Queue({
  documents,
  residents,
  today,
  siteName,
  filter,
  onFilter,
}: {
  documents: DocumentRecord[]
  residents: Resident[]
  today: ReturnType<typeof useSiteToday>
  siteName: string
  filter: Filter
  onFilter: (next: Filter) => void
}) {
  const rows = useMemo(() => {
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    return documents
      .map((document): QueueRow => {
        const owner = document.owner
        return {
          document,
          finding: expiryFinding(document.expiry, today),
          subject:
            owner.kind === 'site'
              ? siteName
              : (byId.get(owner.residentId)?.fullLegalName ??
                'A resident this home does not hold'),
          residentId: owner.kind === 'site' ? 'the_home' : owner.residentId,
        }
      })
      .filter((row) => matches(row.finding, filter))
      .sort((a, b) => order(a.finding) - order(b.finding))
  }, [documents, residents, today, siteName, filter])

  const paged = usePaged(rows, 25)
  const counts = countExpiry(documents, today)
  const selected = FILTERS.find((entry) => entry.id === filter)

  return (
    <Card>
      <CardHead
        title="Every document, by its expiry decision"
        subtitle="Expired first, then expiring, then the ones nobody has decided about."
        expand={{ kind: 'whole' }}
      />

      <div className={styles.filters} role="group" aria-label="Filter by expiry">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={filter === entry.id ? styles.pillChosen : styles.pill}
            aria-pressed={filter === entry.id}
            onClick={() => onFilter(entry.id)}
            data-expiry-filter={entry.id}
          >
            <SelectedMark selected={filter === entry.id} />
            {entry.label}
            <span data-numeric>{formatCount(countFor(entry.id, counts))}</span>
          </button>
        ))}
      </div>

      {/* The claim carries the filter, or it is a claim about a different set. */}
      <p className={styles.claim} data-expiry-claim>
        <span data-numeric>{formatCount(rows.length)}</span> of{' '}
        <span data-numeric>{formatCount(counts.total)}</span>{' '}
        {pluralise(counts.total, 'document').replace(/^\d+\s/, '')} at {siteName},
        showing <b>{selected?.phrase ?? 'everything on file'}</b>.
      </p>

      {rows.length === 0 ? (
        <p className={styles.plain} data-expiry-empty>
          Nothing at {siteName} matches {selected?.label ?? 'this filter'}. That is a
          statement about the filter, not about the record.
        </p>
      ) : (
        <>
          <ul className={styles.rows}>
            {paged.shown.map((row) => (
              <li key={row.document.id}>
                <div className={styles.queueRow} data-queue-row={row.document.id}>
                  <div className={styles.queueAbout}>
                    <p className={styles.rowTitle}>{row.document.title}</p>
                    <p className={styles.rowMeta}>
                      {DOCUMENT_CATEGORIES.find(
                        (entry) => entry.id === row.document.category,
                      )?.label ?? 'Category not recorded'}{' '}
                      · <FileFactsText file={row.document.file} />
                    </p>
                  </div>

                  <p className={styles.queueSubject} data-queue-subject>
                    {row.residentId === 'the_home' ? (
                      row.subject
                    ) : (
                      <Link href={`/residents/${row.residentId}/documents`}>
                        {row.subject}
                      </Link>
                    )}
                  </p>

                  <div className={styles.queueState}>
                    <ExpiryChip finding={row.finding} />
                  </div>

                  <div className={styles.queueAct}>
                    <OpenDocument document={row.document} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pager paged={paged} total={rows.length} noun="documents" />
        </>
      )}
    </Card>
  )
}

/**
 * **A document added this session has no type to sample and nothing filed
 * behind it**, so it says so rather than opening a page about nothing.
 *
 * Shared with the category library, so the two lists offer a way in on the
 * same terms: there is one rule about which documents can be opened.
 */
export function OpenDocument({ document }: { document: DocumentRecord }) {
  if (document.file.kind === 'not_retrievable')
    return (
      <p className={styles.notRetrievable} data-action="not_retrievable">
        Not retrievable: added this session
      </p>
    )

  return (
    <Link
      href={`/documents/${document.id}`}
      className={styles.openLink}
      data-action="open"
      aria-label={`Open ${document.title}`}
    >
      Open
      <Icon name={documentsIcons.open} size={16} />
    </Link>
  )
}

function matches(finding: ExpiryFinding, filter: Filter): boolean {
  if (filter === 'all') return true
  return finding.kind === filter
}

function countFor(filter: Filter, counts: ExpiryCounts): number {
  switch (filter) {
    case 'all':
      return counts.total
    case 'expired':
      return counts.expired
    case 'expiring':
      return counts.expiring
    case 'not_recorded':
      return counts.notRecorded
  }
}

/** Expired first, then expiring, then everything else. Urgency, not filing. */
function order(finding: ExpiryFinding): number {
  switch (finding.kind) {
    case 'expired':
      return 0
    case 'expiring':
      return 1
    case 'not_recorded':
      return 2
    case 'in_date':
      return 3
    case 'does_not_expire':
      return 4
  }
}
