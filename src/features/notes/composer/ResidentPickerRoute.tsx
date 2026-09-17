import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Resident } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { Avatar, Button, Card, CardHead, EmptyState } from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { PageHead } from '@/components/layout/PageHead'
import { Icon } from '@/components/icon/Icon'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  noListYetLine,
  scopeDenominator,
  scopeLine,
  scopeNote,
} from '@/app/session/resident-scope'
import { listName } from '@/features/residents/list-name'
import { composerIcons } from './composer.icons'
import styles from './composer.module.css'

/**
 * "Who is this note about?" CW PRD CN-02, reached from Care Notes rather than
 * from a resident's record.
 *
 * **It chooses a subject and writes nothing.** Each row is a link to that
 * resident's composer, so the subject of the note is the resident in the
 * address, never a selection held here (CLAUDE.md §2).
 *
 * Only residents at the home signed in at whom the role table lets the viewer
 * write about are listed. A care worker nobody has given a list sees that
 * stated, hatched, rather than an empty picker that reads as a home with
 * nobody in it.
 */
export function ResidentPickerRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [query, setQuery] = useState('')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])
  const atHome = useMemo(
    () => (resource.kind === 'ready' ? resource.data : []),
    [resource],
  )
  const writable = useMemo(
    () =>
      atHome
        .filter((resident) => viewer.ask('write_care_note', resident.id).kind === 'yes')
        .sort((a, b) => listName(a).localeCompare(listName(b), 'en-GB')),
    [atHome, viewer],
  )
  const visible = useMemo(() => matching(writable, query), [writable, query])

  const head = (
    <PageHead
      title="Who is this note about?"
      lines={[
        activeSite.name,
        scopeLine(
          viewer.scope,
          atHome.map((resident) => resident.id),
          activeSite.name,
        ),
      ]}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (viewer.scope.kind === 'not_decided')
    return (
      <div className={styles.page} data-resident-picker="no_list">
        {head}
        <Card>
          <CardHead
            title="Your residents"
            subtitle={scopeNote(viewer.scope, activeSite.name)}
            expand={{ kind: 'link', href: '/residents' }}
          />
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has residents. Until somebody gives you a list, there is nobody here you can write a care note about.`}
          />
        </Card>
      </div>
    )

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading residents…
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
            title="The residents could not be loaded"
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

  return (
    <div className={styles.page} data-resident-picker="ready">
      {head}
      <Card>
        <CardHead
          title="Your residents"
          subtitle="The note opens on their record, with their name above it."
          expand={{ kind: 'link', href: '/residents' }}
        />

        {writable.length === 0 ? (
          <EmptyState
            title={`Nobody at ${activeSite.name} is on your list`}
            body="This is not a search result: your list names residents at another home."
          />
        ) : (
          <>
            <label className={styles.search}>
              <span className={styles.visuallyHidden}>
                Search residents by name or room
              </span>
              <Icon name={composerIcons.search} size={16} />
              <input
                type="search"
                value={query}
                placeholder="Name or room"
                onChange={(event) => setQuery(event.target.value)}
                data-picker-search
              />
            </label>
            <p className={styles.count} data-picker-count>
              {visible.length}{' '}
              {scopeDenominator(viewer.scope, writable.length, activeSite.name)}
            </p>
            {visible.length === 0 ? (
              <EmptyState
                title={`No resident matches “${query.trim()}”`}
                body={`None of the ${writable.length} residents you can write about has that name or room.`}
                actions={
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <ul className={styles.people} aria-label="Residents you can write about">
                {visible.map((resident) => (
                  <li key={resident.id}>
                    <Link
                      href={`/residents/${resident.id}/notes/new`}
                      className={styles.person}
                      data-picker-resident={resident.id}
                    >
                      <Avatar
                        photo={resident.photo}
                        name={resident.fullLegalName}
                        size="medium"
                      />
                      <span className={styles.personWho}>
                        <span className={styles.subjectName}>{listName(resident)}</span>
                        <span className={styles.subjectLegal}>
                          {resident.fullLegalName}, known as {resident.preferredName}
                        </span>
                      </span>
                      <span className={styles.personRoom}>
                        {resident.room.kind === 'recorded' ? (
                          `Room ${resident.room.value}`
                        ) : (
                          <Unrecorded label="Room not recorded" />
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

/** By preferred name, legal name or room, ignoring case. */
function matching(residents: Resident[], query: string): Resident[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') return residents
  return residents.filter((resident) => {
    const room = resident.room.kind === 'recorded' ? resident.room.value : ''
    return [resident.preferredName, resident.fullLegalName, room].some((value) =>
      value.toLowerCase().includes(wanted),
    )
  })
}
