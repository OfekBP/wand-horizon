import { NavProvider } from './state/nav'
import { useNav } from './state/navContext'
import { AppProvider } from './state/store'
import { AppShell } from './ui/shell/AppShell'
import { Governance } from './ui/screens/Governance/Governance'
import { Overview } from './ui/screens/Overview/Overview'
import { WorkQueue } from './ui/screens/WorkQueue/WorkQueue'
import { Workforce } from './ui/screens/Workforce/Workforce'

function Screen() {
  const { screen } = useNav()
  switch (screen) {
    case 'overview':
      return <Overview />
    case 'queue':
      return <WorkQueue />
    case 'workforce':
      return <Workforce />
    case 'governance':
      return <Governance />
  }
}

export default function App() {
  return (
    <AppProvider>
      <NavProvider>
        <AppShell>
          <Screen />
        </AppShell>
      </NavProvider>
    </AppProvider>
  )
}
