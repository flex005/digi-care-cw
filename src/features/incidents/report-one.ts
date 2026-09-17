import type { IsoDateTime } from '@/data/types'
import { reportIncident } from '@/data/access/client'
import { staffAkinyemi } from '@/data/fixtures/organisation'

/**
 * One reported incident, for a test that needs the list to hold one.
 *
 * Kept beside the tests rather than inside one, because two of them need the
 * same record and a copy in each is two records that can drift.
 */
export function reportOne(at: IsoDateTime) {
  return reportIncident({
    siteId: 'site-rosewood-court',
    subject: { kind: 'resident', residentId: 'res-okafor' },
    type: 'fall_witnessed',
    severity: 'low_harm',
    occurredAt: at,
    location: { kind: 'communal', area: 'lounge' },
    description: 'He slipped by the window and sat down heavily.',
    injuries: { kind: 'no_injuries_found', recorded: { by: staffAkinyemi, at } },
    response: {
      immediateAction: 'Stayed with him, checked him over, told the senior.',
      witnesses: { kind: 'nobody_witnessed', recordedBy: staffAkinyemi },
      gp: { kind: 'not_yet' },
      family: { kind: 'not_yet' },
      emergencyServices: { kind: 'not_called' },
    },
    by: staffAkinyemi,
    at,
  })
}
