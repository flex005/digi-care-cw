import type { ResidentId } from '@/data/types'

/**
 * Every address in the phone tree, written once.
 *
 * **Under `/m`, beside the desktop's addresses rather than inside them**, so a
 * phone screen and a desktop screen can never answer the same URL. A record is
 * `/m/people/<id>`: the path does not say the subject term, because the term is
 * configurable and an address cannot follow a vocabulary chosen after it was
 * shared.
 *
 * `routes.ts` declares the same paths for the route test, which holds them
 * against the pages on disk.
 */
export const PHONE_PATHS = {
  today: '/m',
  yourList: '/m/list',
  everyone: '/m/everyone',
  search: '/m/search',
  record: (id: ResidentId) => `/m/people/${id}`,
}
