import Link from 'next/link'
import { EmptyState, buttonClassName } from '@/components/primitives'
import { useSession } from '@/app/session/use-session'
import styles from './home.module.css'

/**
 * Where signing in lands while no module is built.
 *
 * It says what is true today and names the one thing that is reachable, rather
 * than a greeting over nothing.
 */
export function HomeRoute() {
  const { activeSite } = useSession()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{activeSite.name}</h1>
      <EmptyState
        title="No module is built yet"
        body="Every module in the navigation opens once its screen exists. The tokens, primitives and status states are under Specimens."
        actions={
          <Link href="/specimens" className={buttonClassName({ variant: 'secondary' })}>
            Open specimens
          </Link>
        }
      />
    </div>
  )
}
