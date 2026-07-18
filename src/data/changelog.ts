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
    v: '0.17',
    date: 'juillet 2026',
    notes: [
      '🛡️ Recette de photos bien plus sûre, et chaque photo est vérifiée avant de t’être montrée',
      '📸 Il y a toujours une photo à la fin : si besoin, Plume recoud une jolie tenue dessus',
      '💬 La cabine raconte tout : « Plume peint… vérifie… ajuste la tenue… »',
      '👗 Sans tuile Tenue, Plume habille ton personnage selon ton monde (uniforme à Sakura ✨)',
    ],
  },
  {
    v: '0.16',
    date: 'juillet 2026',
    notes: [
      '📸 Il y a toujours une photo à la fin : si besoin, Plume recoud une jolie tenue dessus',
      '💬 La cabine raconte ce qui se passe : « Plume peint… vérifie… ajuste la tenue… »',
    ],
  },
  {
    v: '0.15',
    date: 'juillet 2026',
    notes: [
      '🛡️ Recette de photos bien plus sûre : tenues complètes décrites de la tête aux pieds',
      '🧑‍⚖️ Un juge vérifie chaque photo avant toi ; au moindre doute, Plume la refait en tenue sage',
      '📸 Jamais les mains vides : si une photo est ratée, Plume en reprend une automatiquement',
    ],
  },
  {
    v: '0.14',
    date: 'juillet 2026',
    notes: [
      '📸 Photomaton simplifié : une seule photo (fini la pellicule de 4)',
      '📱 Le photomaton défile enfin sur iPhone : réglages toujours accessibles, onglets collants',
      '🖼️ Ta photo de profil de l’onboarding est bien gardée (avant, elle disparaissait !)',
      '🔄 Chaque nouvelle photo change vraiment : pose et angle varient, tes choix restent',
      '👀 Couleur des yeux mieux respectée, et les pieds restent dans le cadre',
      '🐞 La coccinelle des bugs ne recouvre plus les boutons du bas',
    ],
  },
  {
    v: '0.13',
    date: 'juillet 2026',
    notes: [
      '🛡️ Photos de personnages doublement vérifiées : style anime tout public, garanti',
      '👗 Si une photo n’est pas correcte, la magie la refait avec une tenue plus sage',
      '🎨 Portraits IA plus fidèles : bonnes couleurs d’yeux/cheveux, plus de pieds coupés',
      '🖼️ Mise en page corrigée sur iPad/ordi : cabine et cérémonie s’affichent sans souci',
    ],
  },
  {
    v: '0.12',
    date: 'juillet 2026',
    notes: [
      '🏷️ Coccinelle : ta version, un badge 🧪 beta / ✅ « marche bien », et « quoi de neuf »',
      '🔄 Les nouvelles versions s’installent toutes seules (ou touche « l’avoir tout de suite »)',
      '↩️ Reviens à ta dernière version qui marchait (ou vide le cache pour débloquer)',
    ],
  },
  {
    v: '0.11',
    date: 'juillet 2026',
    notes: [
      '📱 Interface repensée pour iPhone : plus besoin de scroller, tout tient à l’écran',
      '🎬 Photomaton : cabine fixe en haut, réglages dans un tiroir, boutons sous le pouce',
      '✨ Look plus soigné : barres translucides, zones sûres (encoche), catégories colorées',
    ],
  },
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
