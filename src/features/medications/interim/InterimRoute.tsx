import { Card, CardHead } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import styles from '../medications.module.css'

/**
 * Add interim. **Drawn, and refused**, for both roles that sign in here
 * (docs/DEPARTURES.md, "Add interim stays visible on Medications and
 * refuses"): the tab says the act exists and whose it is, rather than vanishing.
 *
 * The line is the role table's reason and nothing else, so a row that moves on
 * review moves here without an edit.
 */
export function InterimRoute() {
  const viewer = useViewer()
  return (
    <Card>
      <CardHead
        title="Add interim"
        subtitle="A medication prescribed between pharmacy cycles."
        expand={{ kind: 'whole' }}
      />
      <div className={styles.refusedBody} data-interim>
        <ActPoint
          answer={viewer.ask('add_interim_medication')}
          label="Add interim medication"
          notBuilt="Adding an interim medication is not built."
        />
      </div>
    </Card>
  )
}
