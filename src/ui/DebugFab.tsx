import { useState } from 'react'
import { addReport, BUILD_ID, clearReports, getReports, setDebug } from '../debug'
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

  const checkUpdate = async () => {
    setMsg('Recherche d’une mise à jour…')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
    } catch {
      /* ignore */
    }
    setTimeout(() => window.location.reload(), 600)
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
        <p className="hint">Ça ouvre le partage (Mail, Messages…) ou un e-mail à un parent. La remontée est aussi gardée ici.</p>
        {msg && <p className="room-message">{msg}</p>}

        <div className="debug-version">
          <span>Version installée : <strong>v{APP_VERSION}</strong> <small>({BUILD_ID})</small></span>
          <button className="btn btn-ghost" onClick={checkUpdate}>🔄 Vérifier / recharger</button>
        </div>

        {reports.length > 0 && (
          <details className="debug-reports">
            <summary>{reports.length} remontée{reports.length > 1 ? 's' : ''} enregistrée{reports.length > 1 ? 's' : ''}</summary>
            <div className="debug-actions">
              <button className="btn btn-ghost" onClick={copyAll}>📋 Tout copier</button>
              <button className="btn btn-ghost" onClick={() => { clearReports(); setMsg('Historique vidé.') }}>🗑 Vider</button>
            </div>
            <ul className="debug-list">
              {reports.map((r, i) => (
                <li key={i}><small>{r.at.slice(5, 16).replace('T', ' ')} · {r.screen}</small><br />{r.text}</li>
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
