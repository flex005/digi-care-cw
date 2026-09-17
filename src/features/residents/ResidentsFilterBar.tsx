import { Select, SelectedMark } from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import type {
  RecordsFilter,
  ReviewFilter,
  RiskFilter,
  useResidentFilters,
} from './use-resident-filters'
import { residentListIcons } from './residents.icons'
import styles from './residents.module.css'

/**
 * The residents list's filters. RES-01: the three record views, search by name
 * or room, falls risk and review status.
 *
 * **The views are pills, because they filter.** One shape, one meaning
 * (CLAUDE.md §6): a thumb on a track is a different presentation of the same
 * data, and these narrow which residents are shown. The chosen pill carries a
 * mark as well as a fill.
 *
 * **No period control.** The PRD's "Last 30 days" does not say thirty days of
 * what: nothing in the list or its figures is counted over a period once the
 * month-on-month changes are refused. It is recorded as undefined in the PRD
 * (docs/DEPARTURES.md), not as a feature waiting to be built.
 */
const RECORD_VIEWS: { value: RecordsFilter; label: string }[] = [
  { value: 'all', label: 'All residents' },
  { value: 'any_incomplete', label: 'Any incomplete record' },
  { value: 'critical', label: 'Critical gaps' },
]

export function ResidentsFilterBar({
  listing,
}: {
  listing: ReturnType<typeof useResidentFilters>
}) {
  const { filters } = listing
  return (
    <div className={styles.filterBar}>
      <div className={styles.pills} role="group" aria-label="Show residents">
        {RECORD_VIEWS.map((view) => {
          const chosen = filters.records === view.value
          return (
            <button
              key={view.value}
              type="button"
              className={chosen ? styles.pillChosen : styles.pill}
              aria-pressed={chosen}
              onClick={() => listing.setRecords(view.value)}
              data-records-view={view.value}
            >
              <SelectedMark selected={chosen} />
              {view.label}
            </button>
          )
        })}
      </div>

      <div className={styles.narrowing}>
        <label className={styles.search}>
          <span className={styles.searchLabel}>Search residents by name or room</span>
          <Icon name={residentListIcons.search} size={16} />
          <input
            type="search"
            value={filters.query}
            placeholder="Name or room"
            onChange={(event) => listing.setQuery(event.target.value)}
            data-resident-search
          />
        </label>
        <Select
          label="Falls risk"
          placeholder="Any falls risk"
          value={filters.risk}
          onValueChange={(value) => listing.setRisk(value as RiskFilter)}
          options={[
            { value: 'all', label: 'Any falls risk' },
            { value: 'high', label: 'Falls risk: high' },
            { value: 'moderate', label: 'Falls risk: moderate' },
            { value: 'low', label: 'Falls risk: low' },
            { value: 'not_assessed', label: 'Falls risk: not assessed' },
          ]}
        />
        <Select
          label="Review status"
          placeholder="Any review status"
          value={filters.review}
          onValueChange={(value) => listing.setReview(value as ReviewFilter)}
          options={[
            { value: 'all', label: 'Any review status' },
            { value: 'not_up_to_date', label: 'Overdue or never scheduled' },
            { value: 'overdue', label: 'Review overdue' },
            { value: 'due', label: 'Review due' },
            { value: 'never_scheduled', label: 'Review never scheduled' },
          ]}
        />
      </div>
    </div>
  )
}
