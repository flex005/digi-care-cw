import { useRouter } from 'next/navigation'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { Icon } from '@/components/icon/Icon'
import { Logo } from '@/components/brand/Logo'
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  VisuallyHidden,
} from '@/components/primitives'
import { useSession, useSignedIn } from '@/app/session/use-session'
import { NavPill } from './NavPill'
import { shellIcons } from './nav.icons'
import styles from './TopBar.module.css'

/**
 * The top bar: a white pill holding the product, the shift's navigation, which
 * home, and who is signed in.
 *
 * **The home is always visible**, including for somebody who works at only
 * one and gets no switcher. A record saved against the wrong home is the
 * second-worst failure available, so the home is never inferred and never
 * hidden, on either layout.
 */
export function TopBar() {
  const { sites, activeSite, setActiveSite } = useSession()
  const router = useRouter()
  const { member } = useSignedIn()

  return (
    <header className={styles.topbar}>
      <span className={styles.lockup}>
        <Logo variant="lockup" height={32} title="Radiant digicare" />
      </span>
      <span className={styles.mark}>
        <Logo variant="mark" height={32} title="Radiant digicare" />
      </span>

      <div className={styles.nav}>
        <NavPill />
      </div>

      <div className={styles.right}>
        {sites.length > 1 ? (
          <DropdownMenu>
            {/* "Site" stays in the accessible name: a button whose whole name is
                a place does not say what it does. */}
            <DropdownMenuTrigger
              className={styles.site}
              aria-label={`Site: ${activeSite.name}. Change site.`}
              data-site-switcher
            >
              <span className={styles.siteName}>{activeSite.name}</span>
              <Icon name={shellIcons.siteSwitcher} size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Switch site</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sites.map((site) => (
                <DropdownMenuItem key={site.id} onSelect={() => setActiveSite(site)}>
                  {site.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className={styles.site} data-site-label>
            <VisuallyHidden>Site: </VisuallyHidden>
            <span className={styles.siteName}>{activeSite.name}</span>
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            className={styles.user}
            aria-label={`Account menu for ${member.ref.displayName}`}
          >
            <Avatar
              photo={{ kind: 'not_on_file' }}
              name={member.ref.fullName}
              size="medium"
              tone="brand"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {member.ref.fullName} · {STAFF_ROLE_NAMES[member.role]}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* PROF-01's own way in on the web, beside the rail's. */}
            <DropdownMenuItem onSelect={() => router.push('/profile')}>
              <Icon name={shellIcons.profile} size={16} />
              Profile and settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push('/sign-out')}>
              <Icon name={shellIcons.signOut} size={16} />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
