import { useState } from 'react'
import { Onboarding } from './screens/Onboarding'
import { Studio } from './screens/Studio'
import { AvatarMaker } from './screens/AvatarMaker'
import { Player } from './player/Player'
import { demoStory } from './data/demoStory'
import { createSelf, getPlayerName, getRoster, getSelf, saveRosterEntry } from './storage'

type Screen = { id: 'studio' } | { id: 'play' } | { id: 'edit'; target: string }

export default function App() {
  const [ready, setReady] = useState(() => getSelf() !== null && getPlayerName() !== null)
  const [screen, setScreen] = useState<Screen>({ id: 'studio' })
  const [roster, setRoster] = useState(() => getRoster())

  if (!ready) {
    return (
      <Onboarding
        onDone={(name, config) => {
          createSelf(name, config)
          setRoster(getRoster())
          setReady(true)
        }}
      />
    )
  }

  const playerName = getPlayerName() ?? 'Toi'

  if (screen.id === 'play') {
    return <Player story={demoStory} roster={roster} playerName={playerName} onQuit={() => setScreen({ id: 'studio' })} />
  }

  if (screen.id === 'edit') {
    const entry = roster[screen.target]
    if (!entry) {
      setScreen({ id: 'studio' })
      return null
    }
    const isSelf = screen.target === 'self'
    return (
      <AvatarMaker
        title={isSelf ? 'Ton avatar' : `Personnalise ${entry.name}`}
        initialName={entry.name}
        initialConfig={entry.config}
        nameEditable={!isSelf}
        onSave={(name, config) => {
          saveRosterEntry(screen.target, { name, config })
          setRoster(getRoster())
          setScreen({ id: 'studio' })
        }}
        onCancel={() => setScreen({ id: 'studio' })}
      />
    )
  }

  return (
    <Studio
      playerName={playerName}
      roster={roster}
      onPlay={() => setScreen({ id: 'play' })}
      onEditCharacter={(id) => setScreen({ id: 'edit', target: id })}
    />
  )
}
