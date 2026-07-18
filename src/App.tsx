import { useEffect, useState } from 'react'
import { initAssets } from './atelier/assets'
import { Onboarding } from './screens/Onboarding'
import { Ceremony } from './screens/Ceremony'
import { Studio } from './screens/Studio'
import { AvatarMaker } from './screens/AvatarMaker'
import { NewStory } from './screens/NewStory'
import { Tisseuse } from './screens/Tisseuse'
import { Room } from './screens/Room'
import { Atelier } from './screens/Atelier'
import { Parents } from './screens/Parents'
import { Boutique } from './screens/Boutique'
import { Player } from './player/Player'
import { buildDemoStory } from './data/demoStory'
import type { Story } from './engine/types'
import { createStory } from './builder/types'
import { compileStory } from './builder/compile'
import { defaultAvatar } from './avatar/types'
import {
  createSelf,
  getPlayerName,
  getPreferredUniverse,
  getRoster,
  getSelf,
  getStories,
  newCharacterId,
  newStoryId,
  removeRosterEntry,
  resetOnboarding,
  saveRosterEntry,
  saveStory,
  setPreferredUniverse,
} from './storage'
import { claimWelcome, resetGifts } from './progression'
import { hasAI } from './atelier/genai'
import type { UniverseId } from './universes'
import { checkNewBuild, isDebug } from './debug'
import { APP_VERSION } from './data/changelog'
import { DebugFab } from './ui/DebugFab'

type Screen =
  | { id: 'studio' }
  | { id: 'play'; story: Story; startLabel?: string; backTo: Screen; debug?: boolean; invite?: boolean }
  | { id: 'edit'; target: string; isNew?: boolean; prefillName?: string; prefillDescr?: string; prefillConfig?: import('./avatar/types').AvatarConfig }
  | { id: 'newstory' }
  | { id: 'tisseuse'; storyId: string }
  | { id: 'room' }
  | { id: 'atelier'; cat?: 'tenue' | 'poster' | 'decor' | 'clip' }
  | { id: 'parents' }
  | { id: 'boutique' }
  | { id: 'ceremony'; universe: UniverseId }

export default function App() {
  const [ready, setReady] = useState(() => getSelf() !== null && getPlayerName() !== null)
  const [screen, setScreen] = useState<Screen>({ id: 'studio' })
  const [roster, setRoster] = useState(() => getRoster())
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)
  const [assetsReady, setAssetsReady] = useState(false)
  const [newBuild, setNewBuild] = useState(false)
  useEffect(() => {
    initAssets().then(() => setAssetsReady(true))
    if (checkNewBuild()) setNewBuild(true)
  }, [])
  if (!assetsReady) return null

  const content = renderContent()
  return (
    <>
      {content}
      {isDebug() && <DebugFab context={ready ? describeScreen(screen) : 'onboarding (avatar/univers/prénom)'} onClose={refresh} />}
      {newBuild && (
        <button className="build-toast" onClick={() => setNewBuild(false)}>
          ✨ Nouvelle version (v{APP_VERSION}) — touche pour fermer
        </button>
      )}
    </>
  )

  function describeScreen(s: Screen): string {
    switch (s.id) {
      case 'play': return `play:${s.story.meta.id}${s.debug ? ' (test)' : ''}`
      case 'edit': return `edit:${s.target}`
      case 'tisseuse': return `tisseuse:${s.storyId}`
      case 'atelier': return `atelier:${s.cat ?? ''}`
      case 'ceremony': return 'ceremony'
      default: return s.id
    }
  }

  function renderContent() {
  if (!ready) {
    return (
      <Onboarding
        onDone={(name, config, universe, portrait) => {
          createSelf(name, config, portrait)
          setPreferredUniverse(universe)
          claimWelcome() // cadeau de bienvenue : la création n'est jamais bloquée
          setRoster(getRoster())
          setReady(true)
          // si la magie est prête, on ouvre par la cérémonie (Plume peint le monde) ;
          // sinon, premier quart d'heure guidé : la démo se lance directement
          if (hasAI()) setScreen({ id: 'ceremony', universe })
          else setScreen({ id: 'play', story: buildDemoStory(universe), backTo: { id: 'studio' }, invite: true })
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
        onWeaveInvite={
          screen.invite
            ? () => {
                const story = createStory(newStoryId(), 'Ma première histoire', getPreferredUniverse() as UniverseId, 'secret', [])
                saveStory(story)
                setScreen({ id: 'tisseuse', storyId: story.id })
              }
            : undefined
        }
      />
    )
  }

  if (screen.id === 'edit') {
    const entry = screen.isNew
      ? { name: screen.prefillName ?? '', config: screen.prefillConfig ?? defaultAvatar() }
      : roster[screen.target]
    if (!entry) {
      setScreen({ id: 'studio' })
      return null
    }
    const isSelf = screen.target === 'self'
    return (
      <AvatarMaker
        key={screen.target}
        title={isSelf ? 'Ton avatar' : screen.isNew ? 'Invente un personnage !' : `Personnalise ${entry.name}`}
        initialName={entry.name}
        initialConfig={entry.config}
        initialPortrait={roster[screen.target]?.portraitAsset}
        initialPortraitDescr={screen.prefillDescr}
        nameEditable={!isSelf}
        onSave={(name, config, portrait) => {
          saveRosterEntry(screen.target, { name, config, portraitAsset: portrait })
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
    return (
      <Atelier
        roster={roster}
        initialCategory={screen.cat}
        onBack={() => setScreen({ id: 'studio' })}
        onNewCharacter={() => setScreen({ id: 'edit', target: newCharacterId(), isNew: true })}
      />
    )
  }

  if (screen.id === 'parents') {
    return (
      <Parents
        onBack={() => setScreen({ id: 'studio' })}
        onReplayFTUE={() => {
          resetOnboarding()
          resetGifts()
          setScreen({ id: 'studio' })
          setReady(false)
        }}
      />
    )
  }

  if (screen.id === 'boutique') {
    return <Boutique onBack={() => setScreen({ id: 'studio' })} />
  }

  if (screen.id === 'ceremony') {
    return (
      <Ceremony
        universe={screen.universe}
        onDone={() => {
          setRoster(getRoster())
          setScreen({ id: 'studio' })
        }}
      />
    )
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
        onOpenAtelier={(cat) => setScreen({ id: 'atelier', cat })}
        onNewCharacter={() => setScreen({ id: 'edit', target: newCharacterId(), isNew: true })}
      />
    )
  }

  return (
    <Studio
      playerName={playerName}
      roster={roster}
      onPlayDemo={() => setScreen({ id: 'play', story: buildDemoStory(getPreferredUniverse() as UniverseId), backTo: { id: 'studio' } })}
      onPlayStory={(s) => setScreen({ id: 'play', story: compileStory(s, roster), backTo: { id: 'studio' } })}
      onWeave={(s) => setScreen({ id: 'tisseuse', storyId: s.id })}
      onNewStory={() => setScreen({ id: 'newstory' })}
      onEditCharacter={(id) => setScreen({ id: 'edit', target: id })}
      onNewCharacter={() => setScreen({ id: 'edit', target: newCharacterId(), isNew: true })}
      onRemoveCharacter={(id) => { removeRosterEntry(id); setRoster(getRoster()) }}
      onCreateStarter={(s) => setScreen({ id: 'edit', target: newCharacterId(), isNew: true, prefillName: s.name, prefillDescr: s.descr, prefillConfig: s.config })}
      onOpenRoom={() => setScreen({ id: 'room' })}
      onOpenAtelier={(cat) => setScreen({ id: 'atelier', cat })}
      onOpenParents={() => setScreen({ id: 'parents' })}
      onOpenBoutique={() => setScreen({ id: 'boutique' })}
      onOpenCeremony={() => setScreen({ id: 'ceremony', universe: getPreferredUniverse() as UniverseId })}
      onRefresh={refresh}
    />
  )
  }
}
