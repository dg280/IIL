import { useState } from 'react'
import type { AIConfig, AIProvider } from '../atelier/genai'
import { PROVIDER_DEFAULTS, getAIConfig, getUsage, setAIConfig, testAIKey } from '../atelier/genai'

interface Props {
  onBack: () => void
}

export function Parents({ onBack }: Props) {
  const existing = getAIConfig()
  const [unlocked, setUnlocked] = useState(false)
  const [a] = useState(() => 3 + Math.floor(Math.random() * 6))
  const [b] = useState(() => 4 + Math.floor(Math.random() * 5))
  const [answer, setAnswer] = useState('')

  const [provider, setProvider] = useState<AIProvider>(existing?.provider ?? 'libertai')
  const d = PROVIDER_DEFAULTS[provider]
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? d.baseUrl)
  const [imageModel, setImageModel] = useState(existing?.imageModel ?? d.imageModel)
  const [videoModel, setVideoModel] = useState(existing?.videoModel ?? d.videoModel)
  const [maxImages, setMaxImages] = useState(existing?.maxImagesPerDay ?? d.maxImagesPerDay)
  const [maxVideos, setMaxVideos] = useState(existing?.maxVideosPerDay ?? d.maxVideosPerDay)
  const [status, setStatus] = useState<string | null>(null)
  const usage = getUsage()

  // à chaque changement de fournisseur, réappliquer ses défauts (URL/modèles/quotas)
  const switchProvider = (p: AIProvider) => {
    setProvider(p)
    const pd = PROVIDER_DEFAULTS[p]
    setBaseUrl(pd.baseUrl)
    setImageModel(pd.imageModel)
    setVideoModel(pd.videoModel)
    setMaxImages(pd.maxImagesPerDay)
    setMaxVideos(pd.maxVideosPerDay)
    setStatus(null)
  }

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
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || d.baseUrl,
        imageModel: imageModel.trim() || d.imageModel,
        videoModel: videoModel.trim(),
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
        <h2>Magie IA</h2>

        <h3>Fournisseur</h3>
        <div className="tabs">
          <button className={provider === 'libertai' ? 'tab active' : 'tab'} onClick={() => switchProvider('libertai')}>LiberTai</button>
          <button className={provider === 'google' ? 'tab active' : 'tab'} onClick={() => switchProvider('google')}>Google AI</button>
        </div>
        {provider === 'libertai' ? (
          <p className="hint">
            LiberTai (IA décentralisée). Récupère ta clé et le nom exact des modèles image sur
            <strong> console.libertai.io/images</strong>. Décors images seulement pour l'instant.
          </p>
        ) : (
          <p className="hint">
            Google AI Studio (<strong>aistudio.google.com</strong>). Décors (Gemini) + clips vidéo (Veo).
            La génération demande la facturation activée sur le projet.
          </p>
        )}
        <p className="parents-warning">
          La clé est stockée uniquement sur cet appareil et les appels partent directement chez le
          fournisseur. Pour un déploiement au-delà de la famille, placez-la derrière un serveur
          (docs/05-genai-pipeline.md).
        </p>

        <h3>Clé API</h3>
        <input className="tiss-input" type="password" value={apiKey} placeholder="colle ta clé…" onChange={(e) => setApiKey(e.target.value)} />

        {provider === 'libertai' && (
          <>
            <label className="parents-label">Adresse de l'API (base URL)</label>
            <input className="tiss-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            disabled={!apiKey.trim()}
            onClick={async () => {
              setStatus('Test en cours…')
              try {
                setStatus(await testAIKey(provider, apiKey.trim(), baseUrl.trim() || d.baseUrl, imageModel.trim() || d.imageModel, videoModel.trim()))
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
        {provider === 'google' && (
          <>
            <label className="parents-label">Vidéo</label>
            <input className="tiss-input" value={videoModel} onChange={(e) => setVideoModel(e.target.value)} />
          </>
        )}

        <h3>Plafonds par jour</h3>
        <div className="parents-quotas">
          <label className="parents-label">
            Images
            <input className="tiss-input" type="number" min={0} max={100} value={maxImages} onChange={(e) => setMaxImages(Number(e.target.value))} />
          </label>
          {provider === 'google' && (
            <label className="parents-label">
              Clips vidéo
              <input className="tiss-input" type="number" min={0} max={20} value={maxVideos} onChange={(e) => setMaxVideos(Number(e.target.value))} />
            </label>
          )}
        </div>
        <p className="hint">
          Aujourd'hui : {usage.images} image{usage.images > 1 ? 's' : ''} et {usage.videos} clip{usage.videos > 1 ? 's' : ''} générés.
          Chaque génération coûte aussi des gemmes à la créatrice (20 💎 image, 40 💎 clip).
        </p>
      </div>
    </div>
  )
}
