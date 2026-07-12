import { useCallback, useState } from 'react'
import type { Quest, QuestContext } from '../progression'
import { evaluateQuests } from '../progression'

/**
 * Célébration in-situ (audit UX) : vérifie les quêtes au moment de l'action
 * et fait surgir Plume avec confettis, où qu'on soit dans l'app.
 */
export function useQuestToast() {
  const [quests, setQuests] = useState<Quest[]>([])

  const check = useCallback((ctx: QuestContext) => {
    const fresh = evaluateQuests(ctx)
    if (fresh.length) {
      setQuests(fresh)
      window.setTimeout(() => setQuests([]), 5000)
    }
  }, [])

  const toast =
    quests.length === 0 ? null : (
      <div className="quest-toast" role="status">
        <span className="quest-toast-confetti" aria-hidden>🎊</span>
        <div>
          <strong>🪶 Plume applaudit !</strong>
          {quests.map((q) => (
            <div key={q.id}>
              {q.emoji} {q.title} <b>+{q.gems} 💎</b>
            </div>
          ))}
        </div>
      </div>
    )

  return { toast, check }
}
