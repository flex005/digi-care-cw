import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type {
  DocumentCategoryId,
  DocumentRecord,
  Resident,
  ResidentId,
} from '@/data/types'
import { getSiteDocuments } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  usePaged,
} from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { formatCount, pluralise } from '@/lib/format'
import { ExpiryChip, FileFactsText } from '@/features/residents/tabs/DocumentParts'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import {
  countExpiry,
  expiryFinding,
  type ExpiryFinding,
} from '@/features/residents/tabs/documents/expiry'
import { useSiteToday } from '@/features/residents/tabs/documents/today'
import { NO_EXPIRY_RECORDED } from './document-library'
import { OpenDocument } from './ExpiryQueueRoute'
import { documentsIcons } from './documents.icons'
import styles from './documents-list.module.css'

/**
 * One category of the home's library, and the documents in it. CW PRD DOC-01.
 *
 * The library says a category holds 109 documents; this is the 109. Without it
 * the count was the end of the road — a reader who wanted the clinical letter
 * had to know whose record it was on and go there instead, which is the thing
 * a library exists to save them.
 *
 * **Read-only for both roles.** Table 3 makes a care worker read-only on
 * documents and opening one is reading, so nothing here is a senior carer's.
 *
 * **Ordered by urgency, like everything else that lists documents here**:
 * expired first, then expiring, then what nobody has decided, then the rest.
 * The order is the finding.
 */
export function CategoryLibraryRoute() {
  const { activeSite } = useSession()
  const today = useSiteToday()
  const params = useParams<{ categoryId: string }>()
  const category = DOCUMENT_CATEGORIES.find((entry) => entry.id === params.categoryId)

  const load = useCallback(() => getSiteDocuments(activeSite.id), [activeSite.id])
  const resource = useResource<{ documents: DocumentRecord[]; residents: Resident[] }>(
    load,
    [activeSite.id],
  )

  const back = (
    <Link href="/documents" className={styles.back} data-library-link>
      <Icon name={documentsIcons.back} size={16} />
      Back to the library
    </Link>
  )

  if (category === undefined)
    return (
      <div className={styles.page}>
        {back}
        <Card>
          <EmptyState
            title="That is not a category this home files under"
            body={`The library holds ${formatCount(DOCUMENT_CATEGORIES.length)}, and this is not one of them.`}
          />
        </Card>
      </div>
    )

  const head = (
    <PageHead
      title={category.label}
      lines={[
        `Everything filed here at ${activeSite.name}`,
        `It holds ${category.holds}.`,
      ]}
    />
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
            body="Nothing is shown rather than a partial category."
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
    <div className={styles.page} data-category-library={category.id}>
      {back}
      {head}
      <Filed
        categoryId={category.id}
        holds={category.holds}
        documents={resource.data.documents}
        residents={resource.data.residents}
        today={today}
        siteName={activeSite.name}
      />
    </div>
  )
}

function Filed({
  categoryId,
  holds,
  documents,
  residents,
  today,
  siteName,
}: {
  categoryId: DocumentCategoryId
  holds: string
  documents: DocumentRecord[]
  residents: Resident[]
  today: ReturnType<typeof useSiteToday>
  siteName: string
}) {
  const mine = useMemo(
    () => documents.filter((entry) => entry.category === categoryId),
    [documents, categoryId],
  )

  const rows = useMemo(() => {
    const byId = new Map(residents.map((resident) => [resident.id, resident]))
    return mine
      .map((document) => {
        const owner = document.owner
        return {
          document,
          finding: expiryFinding(document.expiry, today),
          subject:
            owner.kind === 'site'
              ? siteName
              : (byId.get(owner.residentId)?.fullLegalName ??
                'A resident this home does not hold'),
          residentId: (owner.kind === 'site' ? 'the_home' : owner.residentId) as
            ResidentId | 'the_home',
        }
      })
      .sort((a, b) => order(a.finding) - order(b.finding))
  }, [mine, residents, today, siteName])

  const paged = usePaged(rows, 25)
  const counts = countExpiry(mine, today)

  return (
    <Card>
      <CardHead
        title={`${pluralise(counts.total, 'document')} on file`}
        subtitle="Expired first, then expiring, then the ones nobody has decided about."
        expand={{ kind: 'whole' }}
      />

      {/* The same four figures the library's row carries, so the count a
          reader followed here is the count they find. */}
      <div className={styles.categoryFigures} data-category-figures>
        <Figure value={counts.total} label="on file" what="total" />
        <Figure
          value={counts.expired}
          label="expired"
          what="expired"
          tone={counts.expired > 0 ? 'critical' : undefined}
        />
        <Figure
          value={counts.expiring}
          label="expiring within 30 days"
          what="expiring"
          tone={counts.expiring > 0 ? 'caution' : undefined}
        />
        <div className={styles.categoryGap} data-not-recorded>
          {counts.notRecorded > 0 ? (
            <Unrecorded
              variant="chip"
              label={`${formatCount(counts.notRecorded)} with no expiry recorded`}
              detail={NO_EXPIRY_RECORDED}
            />
          ) : (
            <Figure value={0} label="with no expiry recorded" what="not_recorded" />
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        /*
         * Empty, and said as what it is: this category holds a kind of thing,
         * and nobody has filed one. Not a gap — nothing in the record says a
         * document ought to be here, which is what the resident tab's
         * expected-but-empty state is for.
         */
        <p className={styles.plain} data-category-empty>
          Nothing is filed here at {siteName}. It holds {holds}.
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
                      <FileFactsText file={row.document.file} />
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

/** The library's figure, drawn the same way so the two screens agree. */
function Figure({
  value,
  label,
  what,
  tone,
}: {
  value: number
  label: string
  what: string
  tone?: 'critical' | 'caution'
}) {
  return (
    <p className={styles.figure} data-figure={what}>
      <span
        className={
          tone === 'critical'
            ? styles.figureCritical
            : tone === 'caution'
              ? styles.figureCaution
              : styles.figureValue
        }
        data-numeric
      >
        {formatCount(value)}
      </span>
      <span className={styles.figureLabel}>{label}</span>
    </p>
  )
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
