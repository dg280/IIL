import { useMemo, useState } from 'react'
import type { AIConfig, AIProvider } from '../atelier/genai'
import { PROVIDER_DEFAULTS, getAIConfig, getUsage, setAIConfig, suggestTextModel, testAIKey } from '../atelier/genai'
import { clearModLog, getModLog, getModSensitivity, setModSensitivity } from '../atelier/imagemod'
import { addReward, getProgress } from '../progression'
import { isDebug, setDebug } from '../debug'
import { wipeAllData } from '../storage'
import { hardReset } from '../pwa'
import {
  backendActive,
  createProfile,
  getBackendConfig,
  initBackend,
  listProfiles,
  parentEmail,
  sendMagicLink,
  setActiveProfile,
  setBackendConfig,
  signOutParent,
} from '../backend/client'
import type { ChildProfile } from '../backend/client'

/** Version de la politique de confidentialité référencée par le consentement
 *  parental (parental_consents.policy_version). À incrémenter à chaque
 *  évolution du texte présenté au parent. */
const POLICY_VERSION = '2026-07-v1'

/** « Studio familial » : connexion du backend Supabase UE (doc 10). Quand un
 *  profil est actif, la GenAI passe par le serveur (clé et modération côté
 *  serveur) et la clé locale devient inutile. */
function FamilyStudioCard() {
  const existing = getBackendConfig()
  const [url, setUrl] = useState(existing?.url ?? '')
  const [anonKey, setAnonKey] = useState(existing?.anonKey ?? '')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null)
  const [newPseudo, setNewPseudo] = useState('')
  const [consent, setConsent] = useState(false)
  const connected = parentEmail()
  const activeProfile = getBackendConfig()?.profileId

  const refreshProfiles = async () => {
    try {
      setProfiles(await listProfiles())
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Lecture des profils impossible.')
    }
  }

  return (
    <div className="card parents-card">
      <h2>🏠 Studio familial (serveur, UE)</h2>
      <p className="hint">
        Recommandé : la clé de la magie et la vérification des images vivent sur <strong>votre</strong> serveur
        (projet Supabase en Europe, voir <code>docs/10</code>) — plus rien de sensible sur l'appareil,
        quotas réels par profil. Sans cela, le mode « clé locale » ci-dessous continue de fonctionner.
      </p>
      <label className="parents-label">
        Adresse du projet (https://…supabase.co)
        <input className="tiss-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
      </label>
      <label className="parents-label">
        Clé publique (anon key)
        <input className="tiss-input" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJ…" />
      </label>
      <button
        className="btn btn-ghost"
        onClick={() => {
          if (!url.trim() || !anonKey.trim()) {
            setBackendConfig(null)
            setMsg('Studio familial déconnecté — retour au mode clé locale.')
            return
          }
          setBackendConfig({ url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim(), profileId: existing?.profileId })
          void initBackend().then(() => setMsg('Adresse enregistrée. Connecte-toi ci-dessous.'))
        }}
      >
        💾 Enregistrer l'adresse
      </button>

      {getBackendConfig() && (
        <>
          {connected ? (
            <p className="hint">
              ✅ Parent connecté : <strong>{connected}</strong>{' '}
              <button className="btn btn-ghost btn-sm" onClick={() => void signOutParent().then(() => setMsg('Déconnecté.'))}>
                Se déconnecter
              </button>
            </p>
          ) : (
            <>
              <label className="parents-label">
                Ton email de parent (lien magique)
                <input className="tiss-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parent@exemple.fr" />
              </label>
              <button
                className="btn btn-primary"
                onClick={() =>
                  void sendMagicLink(email.trim())
                    .then(() => setMsg('📧 Lien envoyé ! Ouvre l’email sur CET appareil pour te connecter.'))
                    .catch((e) => setMsg(e instanceof Error ? e.message : 'Envoi impossible.'))
                }
              >
                ✉️ Recevoir le lien magique
              </button>
            </>
          )}

          {connected && (
            <>
              <h3>Profils enfants</h3>
              {profiles === null ? (
                <button className="btn btn-ghost" onClick={() => void refreshProfiles()}>Charger les profils</button>
              ) : profiles.length === 0 ? (
                <p className="hint">Aucun profil pour l'instant — crée le premier ci-dessous.</p>
              ) : (
                <div className="gem-give-actions">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      className={activeProfile === p.id ? 'btn btn-primary' : 'btn btn-ghost'}
                      onClick={() => {
                        setActiveProfile(p.id)
                        setMsg(`Profil actif sur cet appareil : ${p.pseudo} ✓`)
                      }}
                    >
                      {activeProfile === p.id ? '✓ ' : ''}{p.pseudo}
                    </button>
                  ))}
                </div>
              )}
              <label className="parents-label">
                Nouveau profil (pseudo de la créatrice — pas son prénom)
                <input className="tiss-input" value={newPseudo} maxLength={20} onChange={(e) => setNewPseudo(e.target.value)} placeholder="ex : PlumeRose" />
              </label>
              <label className="debug-toggle">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                Je suis le parent (ou représentant légal) et je consens à ce que cet enfant utilise le
                Studio, y compris la génération d'images encadrée — consentement enregistré et révocable.
              </label>
              <button
                className="btn btn-primary"
                disabled={!newPseudo.trim() || !consent}
                onClick={() =>
                  void createProfile(newPseudo, POLICY_VERSION)
                    .then((p) => {
                      setActiveProfile(p.id)
                      setNewPseudo('')
                      setConsent(false)
                      setMsg(`Profil « ${p.pseudo} » créé et actif ✓ — la magie passe désormais par le serveur.`)
                      void refreshProfiles()
                    })
                    .catch((e) => setMsg(e instanceof Error ? e.message : 'Création impossible.'))
                }
              >
                ➕ Créer le profil (consentement horodaté)
              </button>
              {backendActive() && <p className="hint">🛡️ La magie passe par le serveur pour ce profil : clé, modération et quotas côté serveur.</p>}
            </>
          )}
        </>
      )}
      {msg && <p className="room-message">{msg}</p>}
    </div>
  )
}

interface Props {
  onBack: () => void
  onReplayFTUE: () => void
}

export function Parents({ onBack, onReplayFTUE }: Props) {
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
  const [textModel, setTextModel] = useState(existing?.textModel ?? d.textModel)
  const [maxImages, setMaxImages] = useState(existing?.maxImagesPerDay ?? d.maxImagesPerDay)
  const [maxVideos, setMaxVideos] = useState(existing?.maxVideosPerDay ?? d.maxVideosPerDay)
  const [status, setStatus] = useState<string | null>(null)
  const [textModels, setTextModels] = useState<string[]>([])
  const [gemAmount, setGemAmount] = useState(50)
  const [gemMsg, setGemMsg] = useState<string | null>(null)
  const usage = getUsage()
  // sécurité des images : sensibilité réglable + journal des analyses (vignettes)
  const [sens, setSens] = useState(getModSensitivity())
  const [logTick, setLogTick] = useState(0)
  const modLog = useMemo(() => getModLog(), [logTick])

  // à chaque changement de fournisseur, réappliquer ses défauts (URL/modèles/quotas)
  const switchProvider = (p: AIProvider) => {
    setProvider(p)
    const pd = PROVIDER_DEFAULTS[p]
    setBaseUrl(pd.baseUrl)
    setImageModel(pd.imageModel)
    setVideoModel(pd.videoModel)
    setTextModel(pd.textModel)
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
        textModel: textModel.trim() || d.textModel,
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
        <h2>Diamants</h2>
        <p className="hint">
          Solde de la créatrice : <strong>{getProgress().gems} 💎</strong>. Les diamants s'obtiennent
          en jouant et en créant ; en tant que parent, tu peux en offrir ici (par exemple en récompense).
        </p>
        <div className="parents-quotas">
          <label className="parents-label">
            Nombre à ajouter
            <input className="tiss-input" type="number" min={0} max={1000} value={gemAmount} onChange={(e) => setGemAmount(Number(e.target.value))} />
          </label>
          <div className="gem-give-actions">
            {[25, 50, 100].map((n) => (
              <button key={n} className="btn btn-ghost" onClick={() => setGemAmount(n)}>+{n}</button>
            ))}
            <button
              className="btn btn-primary"
              onClick={() => {
                const n = Math.max(0, Math.min(1000, gemAmount))
                addReward(0, n)
                setGemMsg(`✨ ${n} 💎 offerts ! Nouveau solde : ${getProgress().gems} 💎`)
              }}
            >
              Offrir les diamants
            </button>
          </div>
        </div>
        {gemMsg && <p className="room-message">{gemMsg}</p>}
      </div>

      <FamilyStudioCard />

      <div className="card parents-card">
        <h2>Magie IA</h2>

        <h3>Fournisseur</h3>
        <div className="tabs">
          <button className={provider === 'libertai' ? 'tab active' : 'tab'} onClick={() => switchProvider('libertai')}>LiberTai</button>
          <button className={provider === 'google' ? 'tab active' : 'tab'} onClick={() => switchProvider('google')}>Google AI</button>
        </div>
        {provider === 'libertai' ? (
          <p className="hint">
            LiberTai (IA décentralisée). Images (décors & portraits, défaut
            <strong> z-image-turbo</strong>) <em>et</em> texte (idées de Plume & scènes). Clé et
            modèles sur <strong>console.libertai.io</strong>. Si le modèle de texte n’est pas
            reconnu, Plume en choisit un valide automatiquement (ou utilise « Détecter »).
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
        <label className="parents-label">Texte (idées de Plume & scènes)</label>
        {provider === 'libertai' && textModels.length > 0 ? (
          <select className="tiss-input" value={textModels.includes(textModel) ? textModel : ''} onChange={(e) => setTextModel(e.target.value)}>
            <option value="" disabled>— choisis un modèle —</option>
            {textModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input className="tiss-input" value={textModel} onChange={(e) => setTextModel(e.target.value)} />
        )}
        {provider === 'libertai' && (
          <button
            className="btn btn-ghost"
            disabled={!apiKey.trim()}
            onClick={async () => {
              setStatus('Recherche des modèles de texte…')
              try {
                const { picked, models } = await suggestTextModel(baseUrl.trim() || d.baseUrl, apiKey.trim())
                setTextModels(models)
                if (picked) setTextModel(picked)
                if (models.length) {
                  setStatus(`${models.length} modèle${models.length > 1 ? 's' : ''} trouvé${models.length > 1 ? 's' : ''} — choisis-en un dans la liste ci-dessus, puis Enregistre.`)
                } else {
                  setStatus('Liste des modèles indisponible ici — Plume choisira automatiquement un modèle valide à la première utilisation.')
                }
              } catch (e) {
                setStatus(e instanceof Error ? e.message : 'Détection impossible.')
              }
            }}
          >
            {textModels.length ? '🔄 Rafraîchir la liste' : '🔍 Détecter les modèles de texte'}
          </button>
        )}
        {provider === 'google' && (
          <>
            <label className="parents-label">Vidéo</label>
            <input className="tiss-input" value={videoModel} onChange={(e) => setVideoModel(e.target.value)} />
          </>
        )}

        {provider === 'google' && (
          <>
            <h3>Plafond vidéo par jour</h3>
            <div className="parents-quotas">
              <label className="parents-label">
                Clips vidéo
                <input className="tiss-input" type="number" min={0} max={20} value={maxVideos} onChange={(e) => setMaxVideos(Number(e.target.value))} />
              </label>
            </div>
          </>
        )}
        <p className="hint">
          Aujourd'hui : {usage.images} image{usage.images > 1 ? 's' : ''} générée{usage.images > 1 ? 's' : ''}
          {provider === 'google' ? ` et ${usage.videos} clip${usage.videos > 1 ? 's' : ''}` : ''}.
          Les images ne sont pas plafonnées : c'est le coût en gemmes (20 💎) qui régule la création,
          et les créations de la cérémonie de bienvenue sont offertes.
        </p>
      </div>

      <div className="card parents-card">
        <h2>Sécurité des images</h2>
        <p className="hint">
          Chaque portrait est vérifié avant d'être montré (analyse de pixels par zones du corps +
          juge de vision IA si dispo). S'il est jugé dénudé ou suggestif, il est <strong>bloqué puis
          régénéré</strong>. Voici les dernières analyses (accepté ✅ / recalé 🚫).
        </p>
        <label className="parents-label">
          Sévérité du filtre {sens > 0 ? `(+${Math.round(sens * 100)} · plus strict)` : sens < 0 ? `(${Math.round(sens * 100)} · plus permissif)` : '(par défaut)'}
        </label>
        <input
          className="mod-range"
          type="range"
          min={-15}
          max={15}
          step={5}
          value={Math.round(sens * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100
            setSens(v)
            setModSensitivity(v)
          }}
        />
        <p className="hint">Vers la droite = bloque plus facilement ; vers la gauche = laisse passer plus. Défaut au centre.</p>
        {modLog.length === 0 ? (
          <p className="hint">Aucune image analysée pour l'instant. Génère un portrait dans l'atelier, puis reviens ici.</p>
        ) : (
          <div className="mod-log">
            {modLog.map((e, i) => (
              <figure key={i} className={e.safe ? 'mod-item ok' : 'mod-item bad'} title={e.reason ?? (e.safe ? 'accepté' : 'recalé')}>
                {e.thumb ? <img src={e.thumb} alt="" loading="lazy" /> : <div className="mod-noimg">?</div>}
                <figcaption>{e.safe ? '✅' : '🚫'} {e.reason ? e.reason.replace(/«|»/g, '').slice(0, 22) : e.safe ? 'ok' : 'recalé'}</figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setLogTick((t) => t + 1)}>🔄 Rafraîchir</button>
          <button className="btn btn-ghost" onClick={() => { clearModLog(); setLogTick((t) => t + 1) }}>🗑️ Vider le journal</button>
        </div>
      </div>

      <div className="card parents-card">
        <h2>Tester la FTUE</h2>
        <p className="hint">
          Rejoue l'expérience de première ouverture : écran de bienvenue, choix du prénom et de
          l'univers, création de l'avatar, puis la grande cérémonie (si la magie est active).
          Tes histoires et personnages déjà créés sont <strong>conservés</strong> ; le cadeau de
          bienvenue est ré-offert.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm('Rejouer l\'intro (FTUE) ? Tes créations sont gardées.')) onReplayFTUE()
          }}
        >
          🧪 Rejouer l'intro (FTUE)
        </button>
        <label className="debug-toggle">
          <input type="checkbox" defaultChecked={isDebug()} onChange={(e) => setDebug(e.target.checked)} />
          🐞 Mode debug (bulle de remontées, crédits illimités)
        </label>

        <h3>🗑 Effacement total (droit à l'effacement)</h3>
        <p className="hint">
          Supprime <strong>tout</strong> de cet appareil : prénom, histoires, personnages,
          images générées, réglages, clé IA et caches. Irréversible — exporte d'abord les
          histoires à garder (bouton Partager → Fichier).
        </p>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (!window.confirm('Tout supprimer définitivement de cet appareil ?')) return
            if (!window.confirm('Vraiment tout ? Histoires, personnages et images seront perdus.')) return
            wipeAllData()
            await hardReset() // purge service worker + caches puis recharge
          }}
        >
          🗑 Tout supprimer de cet appareil
        </button>
      </div>
    </div>
  )
}
