import type { Story } from '../engine/types'
import { PLUME_STARTERS } from './starters'

// L'histoire témoin met en scène les personnages créés à la FTUE : Camille
// (perso1) et Alix (perso2). En jeu, ce sont donc leurs portraits IA qui
// s'affichent (et les décors IA de la FTUE). Le paper-doll des starters ne sert
// que de secours si la magie n'a jamais été utilisée.
const camille = PLUME_STARTERS[0].config // Camille — fille chaleureuse
const alix = PLUME_STARTERS[1].config // Alix — garçon mystérieux

/**
 * Histoire de démonstration — template « Le Secret » (doc 03).
 * 4 fins, 2 routes de personnage, 1 drapeau, des choix qui divergent vraiment.
 */
export const demoStory: Story = {
  meta: {
    id: 'secret-cerisier',
    title: 'Le Secret du cerisier',
    universe: 'sakura',
    description:
      "C'est le printemps à l'Académie Sakura. Le festival approche… et un mystérieux mot plié vient de tomber de ton casier.",
  },
  characters: {
    mc: { name: 'Toi', isPlayer: true, color: '#e35d7c' },
    perso2: { name: 'Alix', color: '#5a77c9', defaultAvatar: alix },
    perso1: { name: 'Camille', color: '#d2568f', defaultAvatar: camille },
  },
  variables: {
    coeur_perso2: 0,
    coeur_perso1: 0,
    a_lu_le_mot: false,
    promesse_duo: false,
  },
  endings: [
    { id: 'duo', title: 'Duo sous les cerisiers', emoji: '⭐' },
    { id: 'etoile_camille', title: "L'étoile inattendue", emoji: '🌟' },
    { id: 'nouvelle_amie', title: 'Une nouvelle amitié', emoji: '🌸' },
    { id: 'chemins', title: 'Chacun son chemin', emoji: '🍃' },
  ],
  labels: {
    start: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: "Printemps à l'Académie Sakura. Les pétales volent jusque dans les couloirs." },
      { op: 'say', text: 'La professeure vient de l’annoncer : le festival de l’école aura lieu dans deux semaines !' },
      { op: 'show', who: 'perso1', expr: 'joie', at: 'right' },
      { op: 'say', who: 'perso1', text: 'Cette année, je monte un spectacle sur la grande scène. Il sera IN-OU-BLIABLE !' },
      { op: 'show', who: 'perso2', expr: 'neutre', at: 'left' },
      { op: 'say', text: 'À côté de toi, ton nouveau voisin de table, Alix, baisse les yeux sans rien dire.' },
      { op: 'say', who: 'perso2', text: '{mc}… tu as déjà une idée pour le festival, toi ?' },
      { op: 'say', text: "La sonnerie retentit. En ouvrant ton casier, un petit mot plié s'en échappe et glisse au sol…" },
      {
        op: 'menu',
        choices: [
          {
            text: 'Le lire tout de suite',
            impact: '🚩 a_lu_le_mot',
            effects: [{ set: 'a_lu_le_mot', to: true }],
            jump: 'mot_lu',
          },
          {
            text: 'Le ranger sans le lire — c’est peut-être privé',
            jump: 'mot_range',
          },
        ],
      },
    ],

    mot_lu: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: 'Tu déplies le mot en cachette. Une écriture fine, appliquée :' },
      { op: 'say', text: '« Retrouve-moi sous le grand cerisier après les cours. J’ai un secret à te confier. — A »' },
      { op: 'say', text: 'A… comme Alix ? Ton cœur bat un peu plus vite.' },
      { op: 'jump', label: 'cerisier' },
    ],

    mot_range: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: 'Tu glisses le mot dans ta poche sans le lire. Chacun ses secrets.' },
      { op: 'show', who: 'perso1', expr: 'joie', at: 'right' },
      { op: 'say', who: 'perso1', text: 'Oh oh ! Un mot mystère ! Fais voir, fais voir !' },
      { op: 'say', text: "Avant que tu réagisses, Camille te le chipe des mains, l'agite en l'air en riant." },
      { op: 'show', who: 'perso2', expr: 'triste', at: 'left' },
      { op: 'say', text: 'Du coin de l’œil, tu vois Alix devenir tout pâle.' },
      {
        op: 'menu',
        choices: [
          {
            text: 'Reprendre le mot et le rendre à Alix',
            impact: '💙 Alix +1',
            effects: [{ add: 'coeur_perso2', n: 1 }],
            jump: 'defendre',
          },
          {
            text: 'Rire avec Camille — elle est trop drôle',
            impact: '💗 Camille +1',
            effects: [{ add: 'coeur_perso1', n: 1 }],
            jump: 'avec_camille',
          },
        ],
      },
    ],

    defendre: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'show', who: 'perso1', expr: 'surprise', at: 'right' },
      { op: 'say', who: 'mc', text: 'Rends-le, Camille. Ce mot ne nous appartient pas.' },
      { op: 'say', who: 'perso1', text: 'Pff… vous n’êtes pas drôles. Tiens, le voilà, ton bout de papier.' },
      { op: 'show', who: 'perso2', expr: 'gene', at: 'left' },
      { op: 'say', who: 'perso2', text: 'Merci, {mc}… Est-ce que… tu voudrais bien venir sous le grand cerisier, après les cours ?' },
      { op: 'jump', label: 'cerisier' },
    ],

    avec_camille: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: 'Tu pouffes malgré toi. Camille a un vrai talent pour transformer tout en spectacle.' },
      { op: 'show', who: 'perso2', expr: 'triste', at: 'left' },
      { op: 'say', text: 'Alix récupère son mot en silence et quitte la salle sans un regard.' },
      { op: 'show', who: 'perso1', expr: 'gene', at: 'right' },
      { op: 'say', who: 'perso1', text: 'Oups… j’y suis peut-être allée un peu fort. Bon ! Viens, j’ai un spectacle à préparer, et il me faut une assistante de choc !' },
      { op: 'jump', label: 'repet_camille' },
    ],

    cerisier: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'say', text: 'Après les cours, le grand cerisier fait pleuvoir ses pétales sur la cour déserte.' },
      { op: 'show', who: 'perso2', expr: 'gene', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Tu es venue… Je ne savais pas si tu viendrais.' },
      { op: 'say', who: 'perso2', text: 'Voilà… personne ne le sait, mais… je chante. Tout le temps, partout, mais seulement quand je suis seul.' },
      { op: 'show', who: 'perso2', expr: 'triste', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Je rêve de m’inscrire au festival. Mais tout seul sur scène… j’en suis incapable. Mes jambes tremblent rien que d’y penser.' },
      {
        op: 'menu',
        choices: [
          {
            text: '« Et si on chantait ensemble ? En duo ! »',
            impact: '💙 Alix +2 · 🚩 promesse_duo',
            effects: [
              { add: 'coeur_perso2', n: 2 },
              { set: 'promesse_duo', to: true },
            ],
            jump: 'duo_promesse',
          },
          {
            text: '« Tu n’as pas besoin de moi : ta voix mérite un solo. »',
            impact: '💙 Alix +1',
            effects: [{ add: 'coeur_perso2', n: 1 }],
            jump: 'solo',
          },
          {
            text: 'Avouer : « Alix… j’ai lu ton mot avant de venir. »',
            impact: '💙 Alix +1 (honnêteté)',
            cond: { var: 'a_lu_le_mot', eq: true },
            effects: [{ add: 'coeur_perso2', n: 1 }],
            jump: 'aveu',
          },
        ],
      },
    ],

    aveu: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'perso2', expr: 'surprise', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Tu… tu l’avais lu ?!' },
      { op: 'say', who: 'mc', text: 'Oui. Je suis désolée. Mais je suis venue parce que ton secret mérite d’être entendu.' },
      { op: 'show', who: 'perso2', expr: 'joie', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Tu es venue quand même… Alors, dis-moi : je fais quoi, pour le festival ?' },
      {
        op: 'menu',
        choices: [
          {
            text: '« On monte un duo, toi et moi. »',
            impact: '💙 Alix +1 · 🚩 promesse_duo',
            effects: [
              { add: 'coeur_perso2', n: 1 },
              { set: 'promesse_duo', to: true },
            ],
            jump: 'duo_promesse',
          },
          {
            text: '« Lance-toi en solo, je serai au premier rang. »',
            jump: 'solo',
          },
        ],
      },
    ],

    duo_promesse: [
      { op: 'scene', bg: 'toit' },
      { op: 'say', text: 'Les jours suivants, vous répétez en secret sur le toit de l’école, face au soleil couchant.' },
      { op: 'show', who: 'perso2', expr: 'joie', at: 'left' },
      { op: 'say', who: 'perso2', text: 'Quand nos voix se croisent sur le refrain… on dirait que je n’ai plus peur de rien.' },
      { op: 'say', text: 'Un soir, Camille vous surprend en pleine répétition.' },
      { op: 'show', who: 'perso1', expr: 'surprise', at: 'right' },
      { op: 'say', who: 'perso1', text: 'ALORS C’ÉTAIT ÇA, vos cachotteries ! …Bon. D’accord. C’était magnifique. Mais mon spectacle sera mieux !' },
      { op: 'jump', label: 'festival' },
    ],

    solo: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'perso2', expr: 'surprise', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Un solo ? Moi ? Tu crois vraiment que j’en suis capable…?' },
      { op: 'say', who: 'mc', text: 'J’en suis sûre. Et je t’aiderai à répéter, promis.' },
      { op: 'show', who: 'perso2', expr: 'neutre', at: 'center' },
      { op: 'say', who: 'perso2', text: 'Alors… je vais essayer. Mais si mes jambes tremblent, ce sera ta faute !' },
      { op: 'jump', label: 'festival' },
    ],

    repet_camille: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'say', text: 'Camille t’embarque dans les préparatifs de son spectacle : lumières, chorégraphie, paillettes. Beaucoup de paillettes.' },
      { op: 'show', who: 'perso1', expr: 'colere', at: 'center' },
      { op: 'say', who: 'perso1', text: 'Non non NON ! Le projecteur rose doit s’allumer SUR le refrain, pas après !' },
      { op: 'say', text: 'Elle est épuisante… mais quand elle répète, impossible de la quitter des yeux.' },
      {
        op: 'menu',
        choices: [
          {
            text: 'Suivre son rythme à fond — ce spectacle sera le sien',
            impact: '💗 Camille +1',
            effects: [{ add: 'coeur_perso1', n: 1 }],
            jump: 'camille_fond',
          },
          {
            text: '« Et si on invitait Alix ? Il paraît qu’il chante bien… »',
            impact: '💙 Alix +1 · 💗 Camille −1',
            effects: [
              { add: 'coeur_perso2', n: 1 },
              { add: 'coeur_perso1', n: -1 },
            ],
            jump: 'invite_alix',
          },
        ],
      },
    ],

    camille_fond: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'perso1', expr: 'joie', at: 'center' },
      { op: 'say', who: 'perso1', text: 'Tu sais quoi, {mc} ? T’es la seule à me suivre sans te plaindre. Ce spectacle, il est à nous deux maintenant.' },
      { op: 'say', text: 'Pour la première fois, Camille te sourit sans jouer un rôle.' },
      { op: 'jump', label: 'festival' },
    ],

    invite_alix: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'perso1', expr: 'colere', at: 'right' },
      { op: 'say', who: 'perso1', text: 'Alix ?! Le garçon qui n’ose même pas lever la main en classe ?' },
      { op: 'say', who: 'mc', text: 'Justement. Sur scène, tout le monde mérite sa chance. Même ceux qui tremblent.' },
      { op: 'show', who: 'perso1', expr: 'neutre', at: 'right' },
      { op: 'say', who: 'perso1', text: '…Très bien. Qu’il vienne aux auditions. Mais je te préviens : chez moi, on ne triche pas avec le talent.' },
      { op: 'show', who: 'perso2', expr: 'gene', at: 'left' },
      { op: 'say', who: 'perso2', text: 'Tu… tu as parlé de moi à Camille ? Personne n’avait jamais fait ça pour moi.' },
      { op: 'jump', label: 'festival' },
    ],

    festival: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'say', text: 'Le soir du festival. La grande scène s’illumine, la cour entière retient son souffle.' },
      { op: 'if', cond: { var: 'promesse_duo', eq: true }, then: 'fin_duo_check', else: 'festival_suite' },
    ],

    fin_duo_check: [
      { op: 'if', cond: { var: 'coeur_perso2', gte: 2 }, then: 'fin_duo', else: 'festival_suite' },
    ],

    festival_suite: [
      { op: 'if', cond: { var: 'coeur_perso1', gte: 2 }, then: 'fin_camille', else: 'festival_suite2' },
    ],

    festival_suite2: [
      { op: 'if', cond: { var: 'coeur_perso2', gte: 1 }, then: 'fin_amie', else: 'fin_chemins' },
    ],

    fin_duo: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'perso2', expr: 'joie', at: 'left' },
      { op: 'show', who: 'mc', expr: 'joie', at: 'right' },
      { op: 'say', text: 'Vos deux voix s’élèvent ensemble sous les projecteurs. Alix ne tremble plus : il rayonne.' },
      { op: 'say', who: 'perso2', text: 'Merci, {mc}. Ce secret-là… c’était le plus beau des cadeaux.' },
      { op: 'say', text: 'Dans le public, Camille applaudit plus fort que tout le monde — en faisant semblant de bouder.' },
      { op: 'end', ending: { id: 'duo', title: 'Duo sous les cerisiers', emoji: '⭐' } },
    ],

    fin_camille: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'perso1', expr: 'joie', at: 'center' },
      { op: 'say', text: 'Le spectacle de Camille éblouit tout le festival. Au moment des saluts, elle t’attrape la main et te tire sur scène.' },
      { op: 'say', who: 'perso1', text: 'Mesdames et messieurs… ma coéquipière ! Sans elle, rien de tout ça n’existerait !' },
      { op: 'say', text: 'Sous les projecteurs, tu découvres que l’amitié aussi peut briller comme une étoile.' },
      { op: 'end', ending: { id: 'etoile_camille', title: "L'étoile inattendue", emoji: '🌟' } },
    ],

    fin_amie: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'perso2', expr: 'joie', at: 'center' },
      { op: 'say', text: 'Alix n’est pas monté sur scène cette année. Mais sous le cerisier, il chante pour toi seule, et sa voix est le plus joli secret de l’école.' },
      { op: 'say', who: 'perso2', text: 'L’année prochaine, promis… je m’inscris. Si tu es là.' },
      { op: 'end', ending: { id: 'nouvelle_amie', title: 'Une nouvelle amitié', emoji: '🌸' } },
    ],

    fin_chemins: [
      { op: 'scene', bg: 'toit' },
      { op: 'say', text: 'Le festival scintille au loin. Tu le regardes depuis le toit, un peu à l’écart de tout.' },
      { op: 'say', text: 'Alix chante peut-être quelque part. Camille brille sûrement sur scène. Et toi… tu te promets de ne plus rester spectatrice la prochaine fois.' },
      { op: 'say', text: 'Certaines histoires demandent plusieurs essais pour trouver leur plus belle fin…' },
      { op: 'end', ending: { id: 'chemins', title: 'Chacun son chemin', emoji: '🍃' } },
    ],
  },
}
