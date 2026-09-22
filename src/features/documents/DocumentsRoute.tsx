import { useCallback, useState } from 'react'
import type {
  DocumentRecord,
  IsoDate,
  IsoDateTime,
  Resident,
  ResidentId,
  Site,
} from '@/data/types'
import { getResidentsBySite, getSiteDocuments } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { now } from '@/data/fixtures/clock'
import { useViewer } from '@/app/session/use-viewer'
import Link from 'next/link'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  Dialog,
  EmptyState,
  Select,
  buttonClassName,
} from '@/components/primitives'
import {
  AggregateFigure,
  NotYourHome,
  StatusPill,
  Unrecorded,
} from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { listName } from '@/features/residents/list-name'
import { documentsIcons } from './documents.icons'
import { FileDocumentForm } from './UploadDocumentRoute'
import { zonedDate } from '@/lib/format'
import { formatCount, pluralise } from '@/lib/format'
import {
  EXPIRY_DECISION_MEANS,
  NO_EXPIRY_RECORDED,
  sharePercent,
  siteLibrary,
  withAnExpiryDecision,
  type CategorySummary,
} from './document-library'
import styles from './documents-list.module.css'

/**
 * Everything on file at the home. CW PRD DOC-01.
 *
 * The sentence: **nobody has said whether these documents are still valid.**
 *
 * **The lead figure is coverage, not a count of expired documents.** A home
 * that knows ten of its documents have lapsed is in better shape than one that
 * cannot say: the first has a finding and the second has no way to have one.
 * DOC-01 leads on the share carrying an expiry decision for that reason, and
 * the figure carries its parts because no figure stands alone.
 *
 * **Expired, expiring and no-expiry-recorded are never added together.** Two
 * are findings about documents somebody decided about; the third is the absence
 * of the fact they are made of, and it takes the hatch while they take critical
 * and caution.
 *
 * **All seven categories, always.** DOC-01 illustrates three; the library holds
 * seven, and a screen showing three headings tells a reader there are three
 * kinds of document. It is the empty headings that carry the finding.
 */
export function DocumentsRoute() {
  const { activeSite } = useSession()
  const format = useSiteFormat()
  const viewer = useViewer()

  const [filed, setFiled] = useState(0)
  const [done, setDone] = useState('')

  const load = useCallback(() => getSiteDocuments(activeSite.id), [activeSite.id])
  const resource = useResource<{ documents: DocumentRecord[]; residents: Resident[] }>(
    load,
    [activeSite.id, filed],
  )

  /* Asked before the early returns, because the head carries the act and the
     head is drawn in every state the screen can be in. */
  const uploadAnswer = viewer.ask('upload_document')

  const head = (
    <PageHead
      title="Documents"
      lines={[
        `Everything on file at ${activeSite.name}`,
        'the residents’ documents and the home’s own',
      ]}
      action={
        /*
         * DOC-01 puts both of these top right: "Expiry tracking >" and
         * "Upload a document (Senior Carer and above only)". The queue is
         * every reader's — it is a read — and filing is the senior carer's.
         *
         * Uploading opens over this library rather than sending the reader to
         * the residents list to find their way back: a document belongs to
         * somebody, so the dialog asks who first and draws nothing else until
         * it has an answer.
         */
        <>
          <Link
            href="/documents/expiry"
            className={buttonClassName({ variant: 'secondary', size: 'large' })}
            data-expiry-link
          >
            Expiry tracking
            <Icon name={documentsIcons.open} size={16} />
          </Link>
          {uploadAnswer.kind === 'yes' ? (
            <FileForSomebody
              site={activeSite}
              onFiled={(words) => {
                setDone(words)
                setFiled((count) => count + 1)
              }}
            />
          ) : null}
        </>
      }
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading the documents…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The documents could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  /* The site's day, from the fixture clock, never the viewer's: at 00:10 in
     London a document expiring today would read as expiring tomorrow. */
  const today: IsoDate = zonedDate(
    now().toISOString() as IsoDateTime,
    activeSite.timeZone,
  )
  const library = siteLibrary(resource.data.documents, today)
  const coverage = withAnExpiryDecision(library.counts)

  return (
    <div className={styles.page}>
      {head}

      {done === '' ? null : (
        <p className={styles.status} role="status" data-document-done>
          {done}
        </p>
      )}

      <Card>
        <CardHead
          title="Documents carrying an expiry decision"
          subtitle={EXPIRY_DECISION_MEANS}
          expand={{ kind: 'whole' }}
        />
        <AggregateFigure
          caption="Of documents on file carry an expiry decision"
          aggregate={{
            kind: 'measured',
            unit: 'percentage',
            value: sharePercent(coverage.decided, coverage.total),
            coverage: { covered: coverage.decided, total: coverage.total },
          }}
          denominatorNoun="documents on file"
          relation="of"
          emphasis="lead"
        />
        {library.counts.notRecorded > 0 ? (
          <div className={styles.aside} data-no-decision>
            <Unrecorded
              variant="chip"
              label={`${formatCount(library.counts.notRecorded)} with no expiry recorded`}
              detail={NO_EXPIRY_RECORDED}
            />
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHead
          title="By category"
          subtitle={`All ${pluralise(library.categories.length, 'category', 'categories')}, in the order an emergency needs them.`}
          expand={{ kind: 'whole' }}
        />
        <ul className={styles.rows}>
          {library.categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
        <p className={styles.claim} data-documents-claim>
          <span data-numeric>{formatCount(library.counts.total)}</span> on file at{' '}
          {activeSite.name}, as of {format.date(today)}
        </p>
      </Card>
    </div>
  )
}

/**
 * One category, with its three findings kept apart.
 *
 * A category holding nothing still renders, with what belongs in it — the empty
 * headings are the finding, not an omission to tidy away.
 */
function CategoryRow({ category }: { category: CategorySummary }) {
  const { counts } = category
  return (
    <li className={styles.row} data-category={category.id}>
      <div className={styles.rowWhat}>
        <p className={styles.rowTitle}>{category.label}</p>
        <p className={styles.rowMeta}>It holds {category.holds}.</p>
      </div>
      <div className={styles.rowCounts}>
        <p className={styles.onFile} data-on-file>
          <span data-numeric>{formatCount(counts.total)}</span> on file
        </p>
        <div className={styles.findings}>
          {counts.expired > 0 ? (
            <StatusPill
              tone="critical"
              label={`${formatCount(counts.expired)} expired`}
            />
          ) : null}
          {counts.expiring > 0 ? (
            <StatusPill
              tone="caution"
              label={`${formatCount(counts.expiring)} expiring within 30 days`}
            />
          ) : null}
          {counts.notRecorded > 0 ? (
            <Unrecorded
              variant="chip"
              label={`${formatCount(counts.notRecorded)} with no expiry recorded`}
              detail={NO_EXPIRY_RECORDED}
            />
          ) : null}
          {counts.total > 0 &&
          counts.expired === 0 &&
          counts.expiring === 0 &&
          counts.notRecorded === 0 ? (
            /* A plain sentence, never a green mark: nothing is positive for
               being unremarkable, and every document here carries a decision
               somebody made. */
            <p className={styles.settledLine}>
              Every one carries an expiry decision, and none has lapsed
            </p>
          ) : null}
          {counts.total === 0 ? (
            <p className={styles.settledLine} data-empty-category>
              Nothing is filed here
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/**
 * "Upload a document" on the home's library.
 *
 * **A document belongs to somebody, so the dialog asks who before anything
 * else.** It used to be a link to the residents list, where a reader had to
 * find the person, open their record, find the Documents tab and file it
 * there — four moves away from the library they were looking at, with no way
 * back. Choosing the resident here is the same question, asked in place.
 *
 * The form is the resident tab's, so the categories, the expiry decision and
 * the save are one implementation, and the subject travels with it.
 */
function FileForSomebody({
  site,
  onFiled,
}: {
  site: Site
  onFiled: (words: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<ResidentId | 'not_chosen'>('not_chosen')

  const load = useCallback(() => getResidentsBySite(site.id), [site.id])
  const residents = useResource<Resident[]>(load, [site.id])
  const people = residents.kind === 'ready' ? residents.data : []
  const resident = people.find((person) => person.id === chosen)

  return (
    <>
      <Button size="large" onClick={() => setOpen(true)} data-upload-document>
        Upload a document
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setChosen('not_chosen')
        }}
        title={`File a document at ${site.name}`}
        size="form"
      >
        <div className={styles.fileFor}>
          <Select
            labelVisible
            label="Who the document is about"
            placeholder="Choose a resident"
            value={chosen === 'not_chosen' ? undefined : chosen}
            onValueChange={(value) => setChosen(value as ResidentId)}
            options={people.map((person) => ({
              value: person.id,
              label: listName(person),
            }))}
          />
          {/* Nothing until somebody is chosen: a form with no subject is the
              wrong-subject failure waiting to happen (CLAUDE.md §2). */}
          {resident === undefined ? null : (
            <FileDocumentForm
              resident={resident}
              site={site}
              done=""
              onFiled={(words) => {
                setOpen(false)
                setChosen('not_chosen')
                onFiled(words)
              }}
            />
          )}
        </div>
      </Dialog>
    </>
  )
}
