import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/icon/Icon'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { PHONE_PATHS } from './phone-paths'
import { phoneIcons } from './phone.icons'
import styles from './phone.module.css'

/**
 * The head of the people tab: its title, the line beneath it, the way into
 * search, and the strip between Your list and Everyone.
 *
 * **Search is a field-shaped link on the two lists**, not a field: typing
 * searches everybody at the home, never only the list it was typed above, so
 * it opens its own screen that says so rather than filtering the list in view
 * and leaving the reader to guess which set it searched.
 */
export function PeopleNav({ subtitle }: { subtitle: string }) {
  const pathname = usePathname()
  const strip = [
    { label: 'Your list', path: PHONE_PATHS.yourList },
    { label: 'Everyone', path: PHONE_PATHS.everyone },
  ]
  return (
    <div className={styles.head}>
      <h1 className={styles.title}>{VOCABULARY.subject.Many}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      {pathname === PHONE_PATHS.search ? null : (
        <Link href={PHONE_PATHS.search} className={styles.searchLink}>
          <Icon name={phoneIcons.search} size={20} />
          <span>Search everyone by name or room</span>
        </Link>
      )}
      <nav aria-label={`${VOCABULARY.subject.Many} lists`} className={styles.strip}>
        {strip.map((entry) => (
          <Link
            key={entry.path}
            href={entry.path}
            className={[
              styles.stripLink,
              pathname === entry.path ? styles.stripActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={pathname === entry.path ? 'page' : undefined}
          >
            {entry.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
