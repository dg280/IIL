import { useState } from 'react'
import { addReport, attachIssueToLatest, BUILD_ID, clearReports, getBugEndpoint, getBugSecret, getReports, setBugEndpoint, setBugSecret, setDebug } from '../debug'
import { APP_VERSION } from '../data/changelog'
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
  const [updateReady, setUpdateReady] = useState<boolean | null>(null)
  const reports = getReports()

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

  // « Est-ce que mes changements sont là ? » : on demande au service worker s'il y a
  // une nouvelle version déployée (Claude a poussé + un parent a publié).
  const lookForChanges = async () => {
    setMsg('Je regarde si Claude a poussé tes changements…')
    setUpdateReady(null)
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) {
        await reg.update()
        await new Promise((r) => setTimeout(r, 1600))
        const fresh = await navigator.serviceWorker?.getRegistration()
        if (fresh?.waiting || fresh?.installing) {
          setUpdateReady(true)
          setMsg('✅ Une nouvelle version est prête ! Touche « Recharger pour voir » ⬇️')
          return
        }
      }
      setUpdateReady(false)
      setMsg('Rien de nouveau pour l’instant. Claude corrige puis pousse, et un parent publie la nouvelle version — reviens dans quelques minutes et re-vérifie 🕒')
    } catch {
      setUpdateReady(false)
      setMsg('Impossible de vérifier ici. Recharge la page pour tenter d’avoir la dernière version.')
    }
  }

  const reloadNow = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      /* ignore */
    }
    setTimeout(() => window.location.reload(), 300)
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
          <strong>📡 Où en sont tes remontées ?</strong>
          <ol className="debug-steps">
            <li>🎫 Tu envoies → un ticket est créé</li>
            <li>🛠️ Claude corrige et pousse ton changement (souvent en quelques minutes)</li>
            <li>🔄 Une nouvelle version arrive → recharge l’appli pour la voir</li>
          </ol>
          <div className="debug-version">
            <span>Version installée : <strong>v{APP_VERSION}</strong> <small>({BUILD_ID})</small></span>
          </div>
          <div className="debug-actions">
            <button className="btn btn-primary" onClick={lookForChanges}>🔎 Mes changements sont-ils là ?</button>
            {updateReady && <button className="btn btn-primary" onClick={reloadNow}>🔄 Recharger pour voir</button>}
          </div>
          {updateReady === false && (
            <p className="hint">Astuce : Claude corrige tout seul et pousse sur la branche ; il faut qu’un parent publie la nouvelle version pour que tu la voies ici.</p>
          )}
        </div>

        <details className="debug-webhook">
          <summary>⚙️ Boucle auto (webhook GitHub) — avancé, un parent</summary>
          <p className="hint">Colle l’URL de l’edge function (voir server/README.md). Vide = envoi par partage/e-mail.</p>
          <input className="tiss-input" value={ep} placeholder="https://…workers.dev" onChange={(e) => setEp(e.target.value)} />
          <input className="tiss-input" value={sec} placeholder="Secret partagé (facultatif)" onChange={(e) => setSec(e.target.value)} />
          <button className="btn btn-ghost" onClick={() => { setBugEndpoint(ep); setBugSecret(sec); setMsg(ep.trim() ? 'Webhook enregistré : les remontées créeront un ticket automatiquement.' : 'Webhook effacé.') }}>Enregistrer le webhook</button>
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
