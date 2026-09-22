import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { DocumentId, IsoDateTime } from '@/data/types'
import { documents as allDocuments } from '@/data/fixtures/documents'
import { residents as allResidents } from '@/data/fixtures/residents'
import { now } from '@/data/fixtures/clock'
import { useSession } from '@/app/session/use-session'
import { Card, CardHead, EmptyState, buttonClassName } from '@/components/primitives'
import { PageHead } from '@/components/layout/PageHead'
import { Icon } from '@/components/icon/Icon'
import { zonedDate } from '@/lib/format'
import {
  ExpiryChip,
  FileFactsText,
  FiledBy,
} from '@/features/residents/tabs/DocumentParts'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import { expiryFinding } from '@/features/residents/tabs/documents/expiry'
import { DocumentSample } from './DocumentSample'
import { documentReferrers } from './referrers'
import { documentsIcons } from './documents.icons'
import styles from './viewer.module.css'

/**
 * Opening a document. CW PRD DOC-01, whose care worker story is "so that I can
 * access clinical letters, DNAR forms and other reference documents during
 * care delivery".
 *
 * **Read-only for both roles, which is what makes it theirs.** Table 3 makes a
 * care worker read-only on documents; opening one is reading. Nothing on this
 * screen writes.
 *
 * **It replaces "not retrievable" for a document whose metadata is real, and
 * replaces nothing else.** A broken reference still says it cannot be opened,
 * because that message is the product working: a record claiming a document
 * exists that the library cannot produce is a finding, and it is a different
 * thing from a document that is on file in a build with no file storage.
 *
 * The stage shows a representative sample of the document type and the banner
 * above it says so. The side panel is why the viewer is worth opening rather
 * than being a picture of a page: it carries what points at this document,
 * each linked, which is the broken-reference relationship seen from the other
 * end — not "a record says this exists and it does not", but "if this went,
 * here is what would break".
 */
export function DocumentViewerRoute() {
  const params = useParams<{ documentId: string }>()
  const { activeSite } = useSession()

  const document = allDocuments.find((entry) => entry.id === params.documentId)

  const back = (
    <Link href="/documents" className={styles.back} data-back-link>
      <Icon name={documentsIcons.back} size={16} />
      Back to the library
    </Link>
  )

  if (document === undefined)
    return (
      <div className={styles.page}>
        {back}
        <Card>
          <EmptyState
            title="No document on file has that reference"
            body="Nothing is shown rather than a page invented to fill the address."
            actions={
              <Link
                href="/documents"
                className={buttonClassName({ variant: 'secondary', size: 'large' })}
              >
                Back to the library
              </Link>
            }
          />
        </Card>
      </div>
    )

  const ownership = document.owner
  const owner =
    ownership.kind === 'resident'
      ? allResidents.find((entry) => entry.id === ownership.residentId)
      : undefined

  const today = zonedDate(now().toISOString() as IsoDateTime, activeSite.timeZone)
  const finding = expiryFinding(document.expiry, today)
  const referrers = documentReferrers(document.id as DocumentId, allResidents)
  const category = DOCUMENT_CATEGORIES.find((entry) => entry.id === document.category)

  return (
    <div className={styles.page} data-document-viewer={document.id}>
      {back}
      <PageHead
        title={document.title}
        lines={[
          owner === undefined ? activeSite.name : owner.fullLegalName,
          category?.label ?? 'Category not recorded',
        ]}
      />

      <div className={styles.viewer}>
        <Card>
          {/*
           * Above the page, never across it. A watermark would make the sample
           * unreadable, and an interface that obscures its own content tells a
           * reader less than the row they opened it from.
           */}
          <p className={styles.sampleBanner} data-sample-banner>
            <b>This is a sample document.</b> It shows how a representative{' '}
            {document.title} renders; no file is stored behind this record.
          </p>
          <DocumentSample document={document} resident={owner} />
        </Card>

        <div className={styles.rail}>
          <Card>
            <CardHead
              title="This document"
              subtitle="What the library holds about it."
              expand={{ kind: 'whole' }}
            />
            <dl className={styles.railFields}>
              <RailField label="Category" value={category?.label ?? 'Not recorded'} />
              <RailField
                label="Filed"
                value={<FiledBy staff={document.filedBy} on={document.filedOn} />}
              />
              <RailField
                label="Format"
                value={<FileFactsText file={document.file} />}
              />
              <RailField label="Expiry" value={<ExpiryChip finding={finding} />} />
            </dl>
          </Card>

          <Card>
            <CardHead
              title="What points at this document"
              subtitle="What would render as a broken reference if it were removed."
              expand={{ kind: 'whole' }}
            />
            {referrers.length === 0 ? (
              /*
               * Zero is an answer, and a different one from a broken
               * reference: nothing relies on this document, so removing it
               * would take evidence away from no record. A plain zero, not a
               * gap — the hatch would claim nobody had looked.
               */
              <p className={styles.railHint} data-no-referrers>
                No record in this build points at this document.
              </p>
            ) : (
              <>
                <ul className={styles.usedBy}>
                  {referrers.map((referrer) => (
                    <li key={`${referrer.label}-${referrer.href}`}>
                      <Link
                        href={referrer.href}
                        className={styles.usedByRow}
                        data-referrer={referrer.href}
                      >
                        <span>{referrer.label}</span>
                        <span className={styles.usedByGo}>
                          Open
                          <Icon name={documentsIcons.open} size={16} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className={styles.railHint} data-referrer-count>
                  {referrers.length === 1
                    ? 'One record relies'
                    : `${referrers.length} records rely`}{' '}
                  on this document. If it were removed,{' '}
                  {referrers.length === 1 ? 'it' : 'each'} would render as a broken
                  reference.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function RailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.railField}>
      <dt className={styles.railKey}>{label}</dt>
      <dd className={styles.railValue}>{value}</dd>
    </div>
  )
}
