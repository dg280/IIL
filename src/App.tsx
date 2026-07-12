import { useState } from 'react'
import { Onboarding } from './screens/Onboarding'
import { Studio } from './screens/Studio'
import { AvatarMaker } from './screens/AvatarMaker'
import { NewStory } from './screens/NewStory'
import { Tisseuse } from './screens/Tisseuse'
import { Room } from './screens/Room'
import { Atelier } from './screens/Atelier'
import { Player } from './player/Player'
import { demoStory } from './data/demoStory'
import type { Story } from './engine/types'
import { createStory } from './builder/types'
import { compileStory } from './builder/compile'
import { defaultAvatar } from './avatar/types'
import {
  createSelf,
  getPlayerName,
  getRoster,
  getSelf,
  getStories,
  newCharacterId,
  newStoryId,
  saveRosterEntry,
  saveStory,
} from './storage'

type Screen =
  | { id: 'studio' }
  | { id: 'play'; story: Story; startLabel?: string; backTo: Screen; debug?: boolean }
  | { id: 'edit'; target: string; isNew?: boolean }
  | { id: 'newstory' }
  | { id: 'tisseuse'; storyId: string }
  | { id: 'room' }
  | { id: 'atelier' }

export default function App() {
  const [ready, setReady] = useState(() => getSelf() !== null && getPlayerName() !== null)
  const [screen, setScreen] = useState<Screen>({ id: 'studio' })
  const [roster, setRoster] = useState(() => getRoster())
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

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
    return (
      <Player
        story={screen.story}
        startLabel={screen.startLabel}
        debug={screen.debug}
        roster={roster}
        playerName={playerName}
        onQuit={() => setScreen(screen.backTo)}
      />
    )
  }

  if (screen.id === 'edit') {
    const entry = screen.isNew
      ? { name: '', config: defaultAvatar() }
      : roster[screen.target]
    if (!entry) {
      setScreen({ id: 'studio' })
      return null
    }
    const isSelf = screen.target === 'self'
    return (
      <AvatarMaker
        title={isSelf ? 'Ton avatar' : screen.isNew ? 'Invente un personnage !' : `Personnalise ${entry.name}`}
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

  if (screen.id === 'room') {
    return <Room roster={roster} onBack={() => setScreen({ id: 'studio' })} />
  }

  if (screen.id === 'atelier') {
    return <Atelier roster={roster} onBack={() => setScreen({ id: 'studio' })} />
  }

  if (screen.id === 'newstory') {
    return (
      <NewStory
        roster={roster}
        onCancel={() => setScreen({ id: 'studio' })}
        onCreate={(title, universe, template, characters) => {
          const story = createStory(newStoryId(), title, universe, template, characters)
          saveStory(story)
          setScreen({ id: 'tisseuse', storyId: story.id })
        }}
      />
    )
  }

  if (screen.id === 'tisseuse') {
    const story = getStories()[screen.storyId]
    if (!story) {
      setScreen({ id: 'studio' })
      return null
    }
    return (
      <Tisseuse
        key={screen.storyId}
        story={story}
        roster={roster}
        onBack={() => setScreen({ id: 'studio' })}
        onPlaytest={(authored, startId) =>
          setScreen({
            id: 'play',
            story: compileStory(authored, roster),
            startLabel: startId,
            debug: true,
            backTo: { id: 'tisseuse', storyId: authored.id },
          })
        }
      />
    )
  }

  return (
    <Studio
      playerName={playerName}
      roster={roster}
      onPlayDemo={() => setScreen({ id: 'play', story: demoStory, backTo: { id: 'studio' } })}
      onPlayStory={(s) => setScreen({ id: 'play', story: compileStory(s, roster), backTo: { id: 'studio' } })}
      onWeave={(s) => setScreen({ id: 'tisseuse', storyId: s.id })}
      onNewStory={() => setScreen({ id: 'newstory' })}
      onEditCharacter={(id) => setScreen({ id: 'edit', target: id })}
      onNewCharacter={() => setScreen({ id: 'edit', target: newCharacterId(), isNew: true })}
      onOpenRoom={() => setScreen({ id: 'room' })}
      onOpenAtelier={() => setScreen({ id: 'atelier' })}
      onRefresh={refresh}
    />
  )
}
