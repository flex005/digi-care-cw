import { ActLine, Card, CardHead } from '@/components/primitives'
import { useOpenRecord } from './ProfileContext'
import { PROFILE_TABS, type ProfileTab } from './profile-tabs'

/**
 * A tab that is drawn and built in a later phase.
 *
 * **Opened, not disabled.** The tab strip has the shape it will have when the
 * tab lands, and a reader who opens it is told in one line which phase builds
 * it, rather than finding a tab that will not respond.
 */
const PHASE_WORDS: Record<Exclude<ProfileTab['builtIn'], 'built'>, string> = {
  phase_4: 'Phase 4, medications',
  phase_7: 'Phase 7, goals and activities',
}

function LaterPhaseTab({ segment }: { segment: string }) {
  const { resident } = useOpenRecord()
  const tab = PROFILE_TABS.find((entry) => entry.segment === segment)
  if (tab === undefined || tab.builtIn === 'built')
    throw new Error(`${segment} is not a tab built in a later phase.`)
  return (
    <Card>
      <CardHead
        title={`${resident.preferredName}’s ${tab.label.toLowerCase()}`}
        expand={{ kind: 'not_built' }}
      />
      <ActLine kind="not_built">{`This tab is built in ${PHASE_WORDS[tab.builtIn]}.`}</ActLine>
    </Card>
  )
}

export const MedicationsTab = () => <LaterPhaseTab segment="medications" />
export const GoalsTab = () => <LaterPhaseTab segment="goals" />
