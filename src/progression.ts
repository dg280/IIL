import type { Roster } from './storage'
import type { AuthoredStory } from './builder/types'
import { analyzeStory } from './builder/compile'
import { demoStory } from './data/demoStory'
import { getEndingsFound } from './storage'
import { getWardrobe } from './atelier/wardrobe'

export interface Progress {
  xp: number
  gems: number
  /** ids des quêtes accomplies */
  done: string[]
  /** ids des objets de boutique possédés */
  owned: string[]
  /** cadeau de bienvenue déjà offert ? */
  welcomed?: boolean
  /** date (AAAA-MM-JJ) du dernier cadeau quotidien réclamé */
  lastDaily?: string
  /** nombre de jours consécutifs avec cadeau réclamé */
  streak?: number
}

const KEY_PROGRESS = 'celestine.progress'

function readProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY_PROGRESS)
    if (raw) return { xp: 0, gems: 0, done: [], owned: [], ...JSON.parse(raw) }
  } catch {
    /* repli mémoire géré par storage.ts pour les données critiques ; ici défaut */
  }
  return memoryProgress
}

let memoryProgress: Progress = { xp: 0, gems: 0, done: [], owned: [] }

function writeProgress(p: Progress) {
  memoryProgress = p
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(p))
  } catch {
    /* mémoire seulement */
  }
}

export function getProgress(): Progress {
  return readProgress()
}

export function addReward(xp: number, gems: number) {
  const p = readProgress()
  writeProgress({ ...p, xp: p.xp + xp, gems: p.gems + gems })
}

export function buyItem(id: string, price: number): boolean {
  const p = readProgress()
  if (p.owned.includes(id)) return true
  if (p.gems < price) return false
  writeProgress({ ...p, gems: p.gems - price, owned: [...p.owned, id] })
  return true
}

export function ownsItem(id: string): boolean {
  return readProgress().owned.includes(id)
}

// -------------------------------------------------- cadeaux de gemmes (économie)

/** Gemmes offertes à la toute première ouverture, pour ne jamais bloquer la création. */
export const WELCOME_GEMS = 60
/** Base du cadeau quotidien ; +5 par jour de série, plafonné. */
const DAILY_BASE = 15
const DAILY_STEP = 5
const DAILY_CAP = 40

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Décale une date AAAA-MM-JJ de n jours (UTC), renvoie AAAA-MM-JJ. */
function shiftDay(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Offre le cadeau de bienvenue une seule fois. Renvoie les gemmes créditées (0 sinon). */
export function claimWelcome(): number {
  const p = readProgress()
  if (p.welcomed) return 0
  writeProgress({ ...p, welcomed: true, gems: p.gems + WELCOME_GEMS })
  return WELCOME_GEMS
}

export interface DailyStatus {
  canClaim: boolean
  /** montant qui serait offert aujourd'hui */
  amount: number
  /** série en cours (jours consécutifs) */
  streak: number
}

function dailyAmount(streak: number): number {
  return Math.min(DAILY_CAP, DAILY_BASE + Math.max(0, streak) * DAILY_STEP)
}

/** État du cadeau quotidien sans le réclamer. */
export function dailyStatus(): DailyStatus {
  const p = readProgress()
  const today = todayStr()
  if (p.lastDaily === today) return { canClaim: false, amount: 0, streak: p.streak ?? 1 }
  // série : +1 si le dernier cadeau date d'hier, sinon on repart à 1
  const nextStreak = p.lastDaily === shiftDay(today, -1) ? (p.streak ?? 0) + 1 : 1
  return { canClaim: true, amount: dailyAmount(nextStreak), streak: nextStreak }
}

/** Réclame le cadeau quotidien. Renvoie le montant offert (0 si déjà pris aujourd'hui). */
export function claimDaily(): DailyStatus & { claimed: number } {
  const status = dailyStatus()
  if (!status.canClaim) return { ...status, claimed: 0 }
  const p = readProgress()
  writeProgress({ ...p, gems: p.gems + status.amount, lastDaily: todayStr(), streak: status.streak })
  return { canClaim: false, amount: 0, streak: status.streak, claimed: status.amount }
}

// ------------------------------------------------------------------- titres

export const LEVELS: { xp: number; title: string; emoji: string }[] = [
  { xp: 0, title: 'Apprentie Conteuse', emoji: '🌱' },
  { xp: 50, title: 'Plumière', emoji: '🪶' },
  { xp: 120, title: "Tisseuse d'Histoires", emoji: '🕸️' },
  { xp: 200, title: 'Grande Autrice', emoji: '📖' },
  { xp: 280, title: 'Légende de la Plume', emoji: '👑' },
]

export function levelFor(xp: number) {
  let current = LEVELS[0]
  let next: (typeof LEVELS)[0] | null = null
  for (const l of LEVELS) {
    if (xp >= l.xp) current = l
    else {
      next = l
      break
    }
  }
  return { current, next }
}

// ------------------------------------------------------------------- quêtes

export interface QuestContext {
  roster: Roster
  stories: AuthoredStory[]
}

export interface Quest {
  id: string
  emoji: string
  title: string
  desc: string
  xp: number
  gems: number
  check: (ctx: QuestContext) => boolean
}

export const QUESTS: Quest[] = [
  {
    id: 'premier_pas',
    emoji: '🌸',
    title: 'Première héroïne',
    desc: 'Crée ton avatar',
    xp: 10,
    gems: 10,
    check: (ctx) => Boolean(ctx.roster.self),
  },
  {
    id: 'premiere_fin',
    emoji: '🏁',
    title: 'Le mot de la fin',
    desc: 'Termine une histoire (n’importe laquelle)',
    xp: 15,
    gems: 10,
    check: (ctx) =>
      getEndingsFound(demoStory.meta.id).length > 0 ||
      ctx.stories.some((s) => getEndingsFound(s.id).length > 0),
  },
  {
    id: 'deux_fins_demo',
    emoji: '🔀',
    title: 'Et si… ?',
    desc: 'Découvre 2 fins du « Secret du cerisier »',
    xp: 20,
    gems: 15,
    check: () => getEndingsFound(demoStory.meta.id).length >= 2,
  },
  {
    id: 'toutes_fins_demo',
    emoji: '🌟',
    title: 'Exploratrice de destins',
    desc: 'Découvre les 4 fins du « Secret du cerisier »',
    xp: 40,
    gems: 30,
    check: () => getEndingsFound(demoStory.meta.id).length >= 4,
  },
  {
    id: 'nouveau_perso',
    emoji: '🎭',
    title: 'Casting élargi',
    desc: 'Invente un nouveau personnage',
    xp: 15,
    gems: 10,
    check: (ctx) => Object.keys(ctx.roster).some((id) => id.startsWith('perso')),
  },
  {
    id: 'premiere_histoire',
    emoji: '🕸️',
    title: 'Première toile',
    desc: 'Crée une histoire dans la Tisseuse',
    xp: 20,
    gems: 15,
    check: (ctx) => ctx.stories.length > 0,
  },
  {
    id: 'vrai_choix',
    emoji: '💗',
    title: 'Un choix qui compte',
    desc: 'Crée un choix à 3 cœurs (branches différentes + effets)',
    xp: 25,
    gems: 20,
    check: (ctx) =>
      ctx.stories.some((s) =>
        Object.values(analyzeStory(s).scenes).some((a) => a.choiceScore === 3),
      ),
  },
  {
    id: 'deux_destins',
    emoji: '🎬',
    title: 'Deux destins',
    desc: 'Écris une histoire avec au moins 2 fins',
    xp: 25,
    gems: 20,
    check: (ctx) => ctx.stories.some((s) => analyzeStory(s).endingCount >= 2),
  },
  {
    id: 'souvenir',
    emoji: '🚩',
    title: 'La mémoire de l’histoire',
    desc: 'Utilise un souvenir pour débloquer une option secrète',
    xp: 30,
    gems: 20,
    check: (ctx) =>
      ctx.stories.some((s) =>
        Object.values(s.scenes).some(
          (sc) => sc.outcome.kind === 'choix' && sc.outcome.options.some((o) => o.needFlag),
        ),
      ),
  },
  {
    id: 'atelier',
    emoji: '🪄',
    title: 'Styliste magique',
    desc: 'Crée une tenue à l’Atelier magique',
    xp: 20,
    gems: 15,
    check: () => getWardrobe().length > 0,
  },
  {
    id: 'plume_zero',
    emoji: '🪶',
    title: 'Plume approuve',
    desc: 'Une histoire d’au moins 5 scènes sans aucun conseil de Plume',
    xp: 35,
    gems: 25,
    check: (ctx) =>
      ctx.stories.some(
        (s) => Object.keys(s.scenes).length >= 5 && analyzeStory(s).tips.length === 0,
      ),
  },
]

/** Vérifie les quêtes et crédite les nouvelles ; renvoie celles qui viennent d'être accomplies. */
export function evaluateQuests(ctx: QuestContext): Quest[] {
  const p = readProgress()
  const fresh = QUESTS.filter((q) => !p.done.includes(q.id) && q.check(ctx))
  if (fresh.length) {
    writeProgress({
      ...p,
      done: [...p.done, ...fresh.map((q) => q.id)],
      xp: p.xp + fresh.reduce((n, q) => n + q.xp, 0),
      gems: p.gems + fresh.reduce((n, q) => n + q.gems, 0),
    })
  }
  return fresh
}
