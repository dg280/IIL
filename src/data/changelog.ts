/**
 * Journal des nouveautés, affiché sur le splash (et dans le mode debug).
 * La première entrée est la version courante. À compléter à chaque lot.
 */
export interface ChangeEntry {
  v: string
  date: string
  notes: string[]
}

export const CHANGELOG: ChangeEntry[] = [
  {
    v: '0.10',
    date: 'juillet 2026',
    notes: [
      '📸 Photomaton magique : flash, tabouret réglable et développement Polaroïd',
      '🎞️ 4 pellicules : garde tes essais et choisis ta photo préférée',
      '🔧 Boucle auto : tes remontées de bugs sont traitées toutes les heures',
    ],
  },
  {
    v: '0.9',
    date: 'juillet 2026',
    notes: [
      '✋ Place les personnages où tu veux dans la scène (au doigt) + choix de la taille',
      '✂️ Personnages détourés : ils s’intègrent proprement sur les décors',
      '🐞 Mode debug : bulle pour remonter les bugs et voir la version',
    ],
  },
  {
    v: '0.8',
    date: 'juillet 2026',
    notes: [
      '🌍 L’histoire d’exemple s’adapte à ton univers (Sakura / Scène / Royaumes)',
      '🎛️ Tuiles à activer + choix fille/garçon et couleur de peau pour l’IA',
      '✨ Retouche « garde la base » et générations de la cérémonie offertes',
    ],
  },
  {
    v: '0.7',
    date: 'juillet 2026',
    notes: [
      '🪶 Grande cérémonie de bienvenue : Plume peint tes persos & décors',
      '🖼️ Portraits IA en plein écran avec zoom',
      '🔉 Voix des personnages adoucie',
    ],
  },
]

export const APP_VERSION = CHANGELOG[0].v
