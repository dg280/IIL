import { useState } from 'react'
import type { AIConfig } from '../atelier/genai'
import { DEFAULT_CONFIG, getAIConfig, getUsage, setAIConfig, testAIKey } from '../atelier/genai'

interface Props {
  onBack: () => void
}

export function Parents({ onBack }: Props) {
  const existing = getAIConfig()
  const [unlocked, setUnlocked] = useState(false)
  const [a] = useState(() => 3 + Math.floor(Math.random() * 6))
  const [b] = useState(() => 4 + Math.floor(Math.random() * 5))
  const [answer, setAnswer] = useState('')

  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '')
  const [imageModel, setImageModel] = useState(existing?.imageModel ?? DEFAULT_CONFIG.imageModel)
  const [videoModel, setVideoModel] = useState(existing?.videoModel ?? DEFAULT_CONFIG.videoModel)
  const [maxImages, setMaxImages] = useState(existing?.maxImagesPerDay ?? DEFAULT_CONFIG.maxImagesPerDay)
  const [maxVideos, setMaxVideos] = useState(existing?.maxVideosPerDay ?? DEFAULT_CONFIG.maxVideosPerDay)
  const [status, setStatus] = useState<string | null>(null)
  const usage = getUsage()

  if (!unlocked) {
    return (
      <div className="onboarding">
        <div className="card onboarding-card">
          <h1>Espace parents</h1>
          <p className="subtitle">Réservé aux grandes personnes</p>
          <p>
            Combien font <strong>{a} × {b}</strong> ?
          </p>
          <input
            className="name-input"
            inputMode="numeric"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && Number(answer) === a * b && setUnlocked(true)}
          />
          <button className="btn btn-primary" disabled={Number(answer) !== a * b} onClick={() => setUnlocked(true)}>
            Entrer
          </button>
          <button className="btn btn-ghost" onClick={onBack}>← Retour au studio</button>
        </div>
      </div>
    )
  }

  const save = () => {
    if (apiKey.trim()) {
      setAIConfig({
        apiKey: apiKey.trim(),
        imageModel: imageModel.trim() || DEFAULT_CONFIG.imageModel,
        videoModel: videoModel.trim() || DEFAULT_CONFIG.videoModel,
        maxImagesPerDay: Math.max(0, maxImages),
        maxVideosPerDay: Math.max(0, maxVideos),
      } as AIConfig)
      setStatus('Réglages enregistrés ✓')
    } else {
      setAIConfig(null)
      setStatus('Magie IA désactivée (clé effacée).')
    }
  }

  return (
    <div className="parents">
      <header className="maker-header">
        <button className="btn btn-ghost" onClick={onBack}>← Studio</button>
        <h1>Espace parents</h1>
      </header>

      <div className="card parents-card">
        <h2>Magie IA (Google AI Studio)</h2>
        <p className="hint">
          Une clé gratuite s'obtient sur <strong>aistudio.google.com</strong> (« Get API key »). Elle
          active la génération de décors (Gemini) et de clips vidéo (Veo) dans l'Atelier magique.
        </p>
        <p className="parents-warning">
          La clé est stockée uniquement sur cet appareil et les appels partent directement chez
          Google. Pour un déploiement au-delà de la famille, placez-la derrière un serveur
          (docs/05-genai-pipeline.md).
        </p>

        <h3>Clé API</h3>
        <input
          className="tiss-input"
          type="password"
          value={apiKey}
          placeholder="AIza…"
          onChange={(e) => setApiKey(e.target.value)}
        />
        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            disabled={!apiKey.trim()}
            onClick={async () => {
              setStatus('Test en cours…')
              try {
                setStatus(await testAIKey(apiKey.trim()))
              } catch (e) {
                setStatus(e instanceof Error ? e.message : 'Test impossible.')
              }
            }}
          >
            Tester la clé
          </button>
          <button className="btn btn-primary" onClick={save}>Enregistrer</button>
        </div>
        {status && <p className="room-message">{status}</p>}

        <h3>Modèles</h3>
        <label className="parents-label">Images</label>
        <input className="tiss-input" value={imageModel} onChange={(e) => setImageModel(e.target.value)} />
        <label className="parents-label">Vidéo</label>
        <input className="tiss-input" value={videoModel} onChange={(e) => setVideoModel(e.target.value)} />

        <h3>Plafonds par jour</h3>
        <div className="parents-quotas">
          <label className="parents-label">
            Images
            <input className="tiss-input" type="number" min={0} max={100} value={maxImages} onChange={(e) => setMaxImages(Number(e.target.value))} />
          </label>
          <label className="parents-label">
            Clips vidéo
            <input className="tiss-input" type="number" min={0} max={20} value={maxVideos} onChange={(e) => setMaxVideos(Number(e.target.value))} />
          </label>
        </div>
        <p className="hint">
          Aujourd'hui : {usage.images} image{usage.images > 1 ? 's' : ''} et {usage.videos} clip{usage.videos > 1 ? 's' : ''} générés.
          Chaque génération coûte aussi des gemmes à la créatrice (20 💎 image, 40 💎 clip).
        </p>
      </div>
    </div>
  )
}
