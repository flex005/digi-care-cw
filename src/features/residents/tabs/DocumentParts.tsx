import type { DocumentReference, FileFacts, IsoDate, StaffRef } from '@/data/types'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { staffLabel } from '@/data/access/team-store'
import { assertNever } from '@/lib/assert-never'
import { formatDate, formatDuration } from '@/lib/format'
import type { ExpiryFinding } from './documents/expiry'

/**
 * What the file is, as text.
 *
 * **No format icon.** A PDF glyph tells a reader nothing they can act on: not
 * whether it opens, not how big it is, not whether it is the current version.
 * "PDF · 1.2 MB" says two of those, and the third is the row's job.
 */
export function FileFactsText({ file }: { file: FileFacts }) {
  if (file.kind === 'not_retrievable') {
    return <span data-file="not_retrievable">{file.format} · not retrievable</span>
  }

  const megabytes = file.bytes / (1024 * 1024)
  const size =
    megabytes >= 1
      ? `${megabytes.toFixed(1)} MB`
      : `${Math.round(file.bytes / 1024)} KB`

  return (
    <span data-file="described">
      {file.format} · {size}
    </span>
  )
}

/**
 * Who filed a document and when.
 *
 * **A filing date is a date, not an instant.** `filedOn` widened to midnight
 * UTC and rendered through the site's zone came out as "02/10/2025 01:00 BST",
 * an hour nobody recorded on a record whose whole content is a day. So it is
 * formatted as the date it is.
 */
export function FiledBy({ staff, on }: { staff: StaffRef; on: IsoDate }) {
  return (
    <>
      Filed by {staffLabel(staff)}, {formatDate(on)}
    </>
  )
}

/**
 * What a document's expiry decision means today.
 *
 * Five renderings for five states, and the shapes are the argument:
 *
 * - **expired** and **expiring** are findings, and take critical and caution.
 * - **in date** is recorded and unremarkable, so it renders quietly.
 * - **does not expire** renders quietly *and names who decided it*. Without the
 *   name it would be indistinguishable from an assumption somebody made while
 *   filing.
 * - **not recorded** takes the hatch. It is not a milder expiry: it is the
 *   absence of the fact the other four are made of.
 */
export function ExpiryChip({ finding }: { finding: ExpiryFinding }) {
  switch (finding.kind) {
    case 'expired':
      return (
        <span data-expiry="expired">
          <StatusPill
            tone="critical"
            label={`Expired ${formatDate(finding.on)}`}
            detail={`${formatDuration(finding.daysAgo)} ago`}
          />
        </span>
      )
    case 'expiring':
      return (
        <span data-expiry="expiring">
          <StatusPill
            tone="caution"
            label={`Expires ${formatDate(finding.on)}`}
            detail={`in ${formatDuration(finding.inDays)}`}
          />
        </span>
      )
    case 'in_date':
      return (
        <span data-expiry="in_date">
          <Settled
            label={`Expires ${formatDate(finding.on)}`}
            detail={`in ${formatDuration(finding.inDays)}`}
          />
        </span>
      )
    case 'does_not_expire':
      return (
        <span data-expiry="does_not_expire" data-decided-by>
          <Settled
            label="Does not expire"
            detail={`recorded by ${staffLabel(finding.decidedBy)}, ${formatDate(finding.on)}`}
          />
        </span>
      )
    case 'not_recorded':
      return (
        <span data-expiry="not_recorded">
          <Unrecorded
            variant="chip"
            label="No expiry recorded"
            detail="nobody has said whether it expires"
          />
        </span>
      )
    default:
      return assertNever(finding)
  }
}

/**
 * A document another part of the record says exists and this library cannot
 * produce.
 *
 * Hatched, naming the id, the part of the record holding it and what that part
 * says. Never silence.
 */
export function BrokenReference({ reference }: { reference: DocumentReference }) {
  return (
    <span data-broken-reference={reference.id}>
      <Unrecorded
        variant="chip"
        label="Referenced, not on file"
        detail={`${reference.origin} holds ${reference.id}, ${reference.detail}. Nobody has uploaded it.`}
      />
    </span>
  )
}
