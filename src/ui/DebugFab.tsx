import { useState } from 'react'
import { addReport, attachIssueToLatest, BUILD_AT, BUILD_ID, clearReports, fetchDeployedBuild, getBugEndpoint, getBugSecret, getGoodVersion, getReports, getStableUrl, setBugEndpoint, setBugSecret, setDebug, setGoodVersion, setStableUrl } from '../debug'
import { applyUpdate, hardReset, pingUpdate, updateReadySW } from '../pwa'
import { APP_VERSION, CHANGELOG } from '../data/changelog'
import { getPlayerName, getPreferredUniverse, getRoster } from '../storage'
import { getProgress } from '../progression'

/**
 * Bulle 🐞 toujours visible en mode debug : la testeuse décrit un bug / une
 * demande, on capture le contexte du moment, on copie un rapport prêt à coller
 * (pour Claude) et on le garde en mémoire. Affiche aussi la version installée
 * et permet de vérifier une mise à jour.
 */
export function DebugFab({ context, onClose }: { context: string; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [ep, setEp] = useState(getBugEndpoint())
  const [sec, setSec] = useState(getBugSecret())
  const [stable, setStable] = useState(getStableUrl())
  const [updateReady, setUpdateReady] = useState<boolean | null>(null)
  const [good, setGood] = useState(getGoodVersion())
  const reports = getReports()
  const isCurrentGood = good?.build === BUILD_ID
  const fmtDate = (iso: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '?')

  const snapshot = () => {
    const roster = getRoster()
    const names = Object.entries(roster)
      .filter(([id]) => id !== 'self')
      .map(([, e]) => e.name)
      .join(', ')
    return {
      screen: context,
      ctx:
        `joueuse=${getPlayerName() ?? '?'} · univers=${getPreferredUniverse()} · gems=${getProgress().gems}` +
        ` · persos=[${names}] · ${navigator.userAgent.slice(0, 60)}`,
      at: new Date().toISOString(),
      build: BUILD_ID,
    }
  }

  const formatReport = (r: { text: string; screen: string; ctx: string; at: string; build: string }) =>
    `[Célestine — remontée]\nVersion: v${APP_VERSION} (${r.build})\nÉcran: ${r.screen}\nQuand: ${r.at}\nContexte: ${r.ctx}\n—\n${r.text}`

  // adresse du parent (remontée par e-mail si le partage natif n'est pas dispo)
  const PARENT_EMAIL = 'dg@xinus.net'

  const submit = async () => {
    if (!text.trim()) return
    const snap = snapshot()
    const report = { text: text.trim(), ...snap }
    addReport(report) // toujours gardé dans l'historique local
    const block = formatReport(report)

    // 0) boucle automatique : POST vers l'edge function → crée une issue GitHub
    const endpoint = getBugEndpoint()
    if (endpoint) {
      try {
        setMsg('Envoi du ticket…')
        const secret = getBugSecret()
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(secret ? { 'X-App-Secret': secret } : {}) },
          body: JSON.stringify({ title: `[Bug] ${snap.screen} — ${report.text.slice(0, 60)}`, body: block }),
        })
        if (res.ok) {
          const j = (await res.json().catch(() => ({}))) as { url?: string; number?: number }
          if (j.number) attachIssueToLatest(j.number, j.url)
          setMsg(
            j.number
              ? `✓ Ticket #${j.number} créé ! Claude va le corriger et le pousser. Reviens plus tard ici et touche « Mes changements sont-ils là ? ».`
              : '✓ Remontée envoyée ! Claude va la corriger.',
          )
          setText('')
          return
        }
      } catch {
        /* webhook indisponible → on retombe sur partage/e-mail */
      }
    }

    // 1) partage natif (mobile) → Mail, Messages, etc.
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> }
      if (nav.share) {
        await nav.share({ title: 'Bug Célestine', text: block })
        setMsg('✓ Envoyé ! Merci — Claude va corriger.')
        setText('')
        return
      }
    } catch {
      /* partage annulé → on continue */
    }
    // 2) e-mail au parent
    try {
      window.location.href = `mailto:${PARENT_EMAIL}?subject=${encodeURIComponent('Bug Célestine')}&body=${encodeURIComponent(block)}`
      setMsg('✓ E-mail préparé pour un parent.')
      setText('')
      return
    } catch {
      /* dernier recours */
    }
    // 3) presse-papier
    try {
      await navigator.clipboard.writeText(block)
      setMsg('✓ Copié ! Colle-le à Claude pour qu’il corrige.')
    } catch {
      window.prompt('Copie ce rapport et envoie-le à Claude :', block)
    }
    setText('')
  }

  const copyAll = async () => {
    const block = reports.map(formatReport).join('\n\n')
    try {
      await navigator.clipboard.writeText(block)
      setMsg('✓ Tous les rapports copiés.')
    } catch {
      window.prompt('Copie tous les rapports :', block)
    }
  }

  // « Y a-t-il une nouvelle version ? » : on compare le build DÉPLOYÉ (version.json,
  // lu frais) à celui qui tourne (BUILD_ID). Fiable, sans deviner via le SW.
  const lookForChanges = async () => {
    setMsg('Je regarde s’il y a une nouvelle version…')
    setUpdateReady(null)
    await pingUpdate() // pousse le SW à vérifier en parallèle
    const dep = await fetchDeployedBuild()
    const isNew = (dep != null && dep.build !== BUILD_ID) || updateReadySW()
    setUpdateReady(isNew)
    setMsg(
      isNew
        ? '🆕 Une nouvelle version est prête ! Elle s’installe toute seule au prochain lancement — ou touche « L’avoir tout de suite » ⬇️'
        : 'Rien de nouveau : tu as déjà la dernière version publiée. (Claude a peut-être corrigé mais un parent n’a pas encore publié — réessaie plus tard 🕒)',
    )
  }

  // récupère la nouvelle version tout de suite (au lieu d'attendre le prochain lancement)
  const installNew = async () => {
    setMsg('Récupération de la nouvelle version…')
    if (updateReadySW()) await applyUpdate()
    else await hardReset()
  }

  // Rose confirme que la version actuelle marche → on la retient (pour le retour arrière)
  const markGood = () => {
    const v = { build: BUILD_ID, version: APP_VERSION, at: new Date().toISOString() }
    setGoodVersion(v)
    setGood(v)
    setMsg('👍 Super ! Cette version est notée comme « qui marche ». Tu pourras y revenir.')
  }

  // retour arrière : si un parent a publié une « version stable », on y va ;
  // sinon on explique (le code d'une version passée ne peut pas être restauré tout seul).
  const rollback = () => {
    const url = getStableUrl()
    if (url) {
      window.location.href = url
      return
    }
    if (good) setMsg(`↩️ Ta dernière version sûre était v${good.version} (${good.build}) du ${fmtDate(good.at)}. Demande à un parent de la republier, ou renseigne une « URL de secours » ci-dessous.`)
    else setMsg('Aucune version sûre notée pour l’instant. Touche « 👍 Cette version marche bien » quand tout va bien, pour pouvoir y revenir plus tard.')
  }

  if (!open) {
    return (
      <button className="debug-fab" onClick={() => setOpen(true)} title="Signaler un bug / une idée" aria-label="Debug">
        🐞
      </button>
    )
  }

  return (
    <div className="debug-overlay" onClick={() => setOpen(false)}>
      <div className="debug-panel card" onClick={(e) => e.stopPropagation()}>
        <div className="debug-head">
          <strong>🐞 Remontée &amp; debug</strong>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>✕</button>
        </div>

        <p className="hint">Décris le bug ou ce que tu veux changer. Le contexte est ajouté tout seul.</p>
        <textarea
          className="tiss-input"
          rows={4}
          value={text}
          placeholder="Ex : le portrait d’Alix n’a pas les bonnes couleurs…"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="debug-actions">
          <button className="btn btn-primary" disabled={!text.trim()} onClick={submit}>📤 Envoyer la remontée</button>
        </div>
        <p className="hint">Ça crée un ticket pour Claude (ou, sans réseau, ouvre le partage / un e-mail à un parent). La remontée est aussi gardée ici.</p>
        {msg && <p className="room-message">{msg}</p>}

        <div className="debug-track">
          <strong>🏷️ Ta version</strong>
          <div className="version-badge">
            <span className="version-num">v{APP_VERSION}</span>
            <span className={isCurrentGood ? 'version-tag good' : 'version-tag beta'}>{isCurrentGood ? '✅ marche bien' : '🧪 beta (à tester)'}</span>
            <small className="version-build">{BUILD_ID} · {fmtDate(BUILD_AT)}</small>
          </div>
          <div className="debug-actions">
            {!isCurrentGood && <button className="btn btn-primary" onClick={markGood}>👍 Cette version marche bien</button>}
            <button className="btn btn-ghost" onClick={lookForChanges}>🔎 Y a-t-il du nouveau ?</button>
          </div>
          {updateReady && (
            <div className="debug-actions">
              <button className="btn btn-primary" onClick={installNew}>🔄 L’avoir tout de suite</button>
            </div>
          )}
          <p className="hint">Les nouvelles versions s’installent toutes seules au lancement. Ce bouton sert juste à l’avoir plus vite.</p>

          <details className="debug-rollback">
            <summary>↩️ Ça ne marche plus ? Revenir en arrière</summary>
            <p className="hint">
              {good
                ? `Ta dernière version sûre : v${good.version} (${good.build}) du ${fmtDate(good.at)}.`
                : 'Astuce : touche « 👍 Cette version marche bien » quand tout va bien, pour pouvoir y revenir plus tard.'}
            </p>
            <div className="debug-actions">
              <button className="btn btn-ghost" disabled={!good || isCurrentGood} onClick={rollback}>↩️ Revenir à ma version sûre</button>
              <button className="btn btn-ghost" onClick={hardReset}>🧹 Vider le cache &amp; recharger</button>
            </div>
            <p className="hint">« Vider le cache » récupère proprement la version publiée (utile si l’appli est coincée). Le vrai retour arrière a besoin qu’un parent ait publié une « version stable » ci-dessous.</p>
          </details>

          <details className="debug-changelog">
            <summary>✨ Quoi de neuf ? (v{CHANGELOG[0].v})</summary>
            <ul className="debug-steps">
              {CHANGELOG[0].notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        </div>

        <details className="debug-webhook">
          <summary>⚙️ Boucle auto (webhook GitHub) — avancé, un parent</summary>
          <p className="hint">Colle l’URL de l’edge function (voir server/README.md). Vide = envoi par partage/e-mail.</p>
          <input className="tiss-input" value={ep} placeholder="https://…workers.dev" onChange={(e) => setEp(e.target.value)} />
          <input className="tiss-input" value={sec} placeholder="Secret partagé (facultatif)" onChange={(e) => setSec(e.target.value)} />
          <button className="btn btn-ghost" onClick={() => { setBugEndpoint(ep); setBugSecret(sec); setMsg(ep.trim() ? 'Webhook enregistré : les remontées créeront un ticket automatiquement.' : 'Webhook effacé.') }}>Enregistrer le webhook</button>
        </details>

        <details className="debug-webhook">
          <summary>🛟 URL de secours (version stable) — avancé, un parent</summary>
          <p className="hint">Publie une copie « qui marche » de l’appli à une adresse fixe et colle-la ici. Le bouton « ↩️ Revenir à ma version sûre » y emmènera Rose si une beta est cassée.</p>
          <input className="tiss-input" value={stable} placeholder="https://…/stable/" onChange={(e) => setStable(e.target.value)} />
          <button className="btn btn-ghost" onClick={() => { setStableUrl(stable); setMsg(stable.trim() ? 'URL de secours enregistrée.' : 'URL de secours effacée.') }}>Enregistrer l’URL de secours</button>
        </details>

        {reports.length > 0 && (
          <details className="debug-reports">
            <summary>{reports.length} remontée{reports.length > 1 ? 's' : ''} enregistrée{reports.length > 1 ? 's' : ''}</summary>
            <div className="debug-actions">
              <button className="btn btn-ghost" onClick={copyAll}>📋 Tout copier</button>
              <button className="btn btn-ghost" onClick={() => { clearReports(); setMsg('Historique vidé.') }}>🗑 Vider</button>
            </div>
            <ul className="debug-list">
              {reports.map((r, i) => (
                <li key={i}>
                  <small>
                    {r.at.slice(5, 16).replace('T', ' ')} · {r.screen} ·{' '}
                    {r.issue ? <span className="report-ok">🎫 ticket #{r.issue} envoyé à Claude</span> : <span className="report-pending">gardé ici (pas de ticket)</span>}
                  </small>
                  <br />
                  {r.text}
                </li>
              ))}
            </ul>
          </details>
        )}

        <button
          className="btn btn-ghost debug-off"
          onClick={() => { setDebug(false); onClose?.(); }}
        >
          Désactiver le mode debug
        </button>
      </div>
    </div>
  )
}
