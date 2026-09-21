import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { DocumentCategoryId, IsoDateTime, Resident } from '@/data/types'
import { fileDocument, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  RadioGroup,
  Select,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { zonedDate } from '@/lib/format'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { DOCUMENT_CATEGORIES } from '@/features/residents/tabs/documents/categories'
import {
  EMPTY_UPLOAD,
  FORMATS,
  expiryFrom,
  outstanding,
  type UploadDraft,
} from './upload-rules'
import styles from './documents.module.css'

/**
 * Filing a document. Table 3: "Documents — upload", senior carers only, and
 * the CW PRD draws no screen for it.
 *
 * The sentence: **this document exists, and this is what is known about it.**
 *
 * **The expiry question cannot be skipped.** DOC-01's rule is that a document
 * has an expiry decision only if it carries a date or somebody recorded that it
 * does not expire; anything else takes the unknown-validity hatch. Asking makes
 * that state something somebody chose rather than something a blank produced.
 */
export function UploadDocumentRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ residentId: string }>()
  const residentId = params.residentId as Resident['id']
  const [written, setWritten] = useState(0)
  const [done, setDone] = useState('')

  const load = useCallback(() => getResident(residentId), [residentId])
  const resource = useResource<Resident>(load, [residentId, written])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the record…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="The record could not be loaded"
            body="Nothing has been lost: nothing was filed."
            actions={
              <Link
                href={`/residents/${residentId}/documents`}
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to the documents
              </Link>
            }
          />
        </Card>
      </div>
    )

  return (
    <div className={styles.page}>
      <PageHead
        title={`File a document for ${resource.data.preferredName}`}
        lines={[activeSite.name, 'senior carers file a document']}
        action={
          <Link
            href={`/residents/${residentId}/documents`}
            className={buttonClassName({ variant: 'secondary' })}
          >
            Back to the documents
          </Link>
        }
      />
      <FileDocumentForm
        resident={resource.data}
        site={activeSite}
        done={done}
        onFiled={(words) => {
          setDone(words)
          setWritten((count) => count + 1)
        }}
      />
    </div>
  )
}

/**
 * The form itself, wherever it is opened.
 *
 * **Split from the route so the resident's own Documents tab can open it in a
 * dialog**, following the care note composer: what differs between a page and
 * a dialog is the chrome around it and what happens after something is filed,
 * so those are what the route supplies. The subject travels with the form —
 * `SubjectStrip` is inside it — because a write surface names who it is about
 * wherever it is drawn (CLAUDE.md §2).
 */
export function FileDocumentForm({
  resident,
  site,
  done,
  onFiled,
}: {
  resident: Resident
  site: ReturnType<typeof useSession>['activeSite']
  done: string
  onFiled: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const id = useId()
  const [draft, setDraft] = useState<UploadDraft>(EMPTY_UPLOAD)
  const [error, setError] = useState('')

  const set = (next: Partial<UploadDraft>) =>
    setDraft((current) => ({ ...current, ...next }))

  const answer = viewer.ask('upload_document', resident.id)
  const waiting = outstanding(draft)

  const file = () => {
    const at = now().toISOString() as IsoDateTime
    const on = zonedDate(at, site.timeZone)
    const expiry = expiryFrom(draft, member.ref, on)
    if (expiry === 'not_chosen' || draft.category === 'not_chosen') return

    fileDocument({
      owner: { kind: 'resident', residentId: resident.id },
      category: draft.category,
      title: draft.title.trim(),
      format: draft.format,
      expiry,
      filedBy: member.ref,
      filedOn: on,
    })
      .then(() => {
        setDraft(EMPTY_UPLOAD)
        setError('')
        onFiled(
          `${draft.title.trim()} filed against ${resident.fullLegalName}, in your name and held in this session only. No file was stored.`,
        )
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was filed.'),
      )
  }

  return (
    <div className={styles.form}>
      <Card>
        <SubjectStrip resident={resident} site={site} />
      </Card>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-document-done>
          {done}
        </p>
      )}

      <Card>
        <CardHead
          title="What the document is"
          subtitle="Written so somebody recognises it on a list a year from now."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.section}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${id}-title`}>
              Title
            </label>
            <input
              id={`${id}-title`}
              className={styles.input}
              value={draft.title}
              onChange={(event) => set({ title: event.target.value })}
              data-document-title
            />
          </div>

          <div className={styles.twoUp}>
            <Select
              labelVisible
              label="Which part of the file it goes in"
              placeholder="Choose a category"
              value={draft.category === 'not_chosen' ? undefined : draft.category}
              onValueChange={(value) => set({ category: value as DocumentCategoryId })}
              options={DOCUMENT_CATEGORIES.map((entry) => ({
                value: entry.id,
                label: `${entry.label} — ${entry.holds}`,
              }))}
            />
            <Select
              labelVisible
              label="Format"
              placeholder="Choose a format"
              value={draft.format}
              onValueChange={(value) => set({ format: value })}
              options={FORMATS.map((entry) => ({ value: entry, label: entry }))}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Whether it expires"
          subtitle="A document has an expiry decision only if it carries a date or somebody has recorded that it does not expire. Anything else is unknown, and says so."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.section}>
          <RadioGroup
            legend="Whether it expires"
            value={draft.expiry === 'not_chosen' ? undefined : draft.expiry}
            onValueChange={(value) => set({ expiry: value as UploadDraft['expiry'] })}
            options={[
              { value: 'expires', label: 'It expires on a date' },
              {
                value: 'does_not_expire',
                label:
                  'It does not expire — recorded as your decision, with your name on it',
              },
              {
                value: 'not_recorded',
                label:
                  'Nobody knows — it is filed with its validity unknown, and shows as a gap',
              },
            ]}
          />

          {draft.expiry === 'expires' ? (
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor={`${id}-expires`}>
                The date it expires
              </label>
              <input
                id={`${id}-expires`}
                className={styles.input}
                type="date"
                value={draft.expiresOn}
                onChange={(event) => set({ expiresOn: event.target.value })}
                data-expires-on
              />
            </div>
          ) : null}

          {draft.expiry === 'not_recorded' ? (
            <Unrecorded
              label="Filed with its validity unknown"
              detail="not a milder version of an expiry date: it is the absence of the fact one is made of, and the file will say so"
            />
          ) : null}
        </div>
      </Card>

      <Card>
        <div className={styles.foot}>
          <p className={styles.footState} data-upload-waiting>
            {waiting.length === 0 ? (
              <>
                <strong>Everything needed is here.</strong> It goes on the file in your
                name.
              </>
            ) : (
              <>
                <strong>Waiting on:</strong> {waiting.join(' · ')}
              </>
            )}
          </p>

          {answer.kind === 'yes' ? (
            <Button
              size="large"
              disabled={waiting.length > 0}
              onClick={file}
              data-file-document
            >
              {`File this for ${resident.preferredName}`}
            </Button>
          ) : (
            <ActPoint
              answer={answer}
              label="File a document"
              notBuilt="Filing a document is not built."
              residentName={resident.preferredName}
            />
          )}

          {error === '' ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
