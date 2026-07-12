import type { Story } from '../engine/types'

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
    yuki: { name: 'Yuki', color: '#5a77c9' },
    hana: { name: 'Hana', color: '#d2568f' },
  },
  variables: {
    coeur_yuki: 0,
    coeur_hana: 0,
    a_lu_le_mot: false,
    promesse_duo: false,
  },
  endings: [
    { id: 'duo', title: 'Duo sous les cerisiers', emoji: '⭐' },
    { id: 'etoile_hana', title: "L'étoile inattendue", emoji: '🌟' },
    { id: 'nouvelle_amie', title: 'Une nouvelle amie', emoji: '🌸' },
    { id: 'chemins', title: 'Chacune son chemin', emoji: '🍃' },
  ],
  labels: {
    start: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: "Printemps à l'Académie Sakura. Les pétales volent jusque dans les couloirs." },
      { op: 'say', text: 'La professeure vient de l’annoncer : le festival de l’école aura lieu dans deux semaines !' },
      { op: 'show', who: 'hana', expr: 'joie', at: 'right' },
      { op: 'say', who: 'hana', text: 'Cette année, je monte un spectacle sur la grande scène. Il sera IN-OU-BLIABLE !' },
      { op: 'show', who: 'yuki', expr: 'neutre', at: 'left' },
      { op: 'say', text: 'À côté de toi, ta nouvelle voisine de table, Yuki, baisse les yeux sans rien dire.' },
      { op: 'say', who: 'yuki', text: '{mc}… tu as déjà une idée pour le festival, toi ?' },
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
      { op: 'say', text: '« Retrouve-moi sous le grand cerisier après les cours. J’ai un secret à te confier. — Y »' },
      { op: 'say', text: 'Y… comme Yuki ? Ton cœur bat un peu plus vite.' },
      { op: 'jump', label: 'cerisier' },
    ],

    mot_range: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: 'Tu glisses le mot dans ta poche sans le lire. Chacun ses secrets.' },
      { op: 'show', who: 'hana', expr: 'joie', at: 'right' },
      { op: 'say', who: 'hana', text: 'Oh oh ! Un mot mystère ! Fais voir, fais voir !' },
      { op: 'say', text: "Avant que tu réagisses, Hana te le chipe des mains, l'agite en l'air en riant." },
      { op: 'show', who: 'yuki', expr: 'triste', at: 'left' },
      { op: 'say', text: 'Du coin de l’œil, tu vois Yuki devenir toute pâle.' },
      {
        op: 'menu',
        choices: [
          {
            text: 'Reprendre le mot et le rendre à Yuki',
            impact: '💙 Yuki +1',
            effects: [{ add: 'coeur_yuki', n: 1 }],
            jump: 'defendre',
          },
          {
            text: 'Rire avec Hana — elle est trop drôle',
            impact: '💗 Hana +1',
            effects: [{ add: 'coeur_hana', n: 1 }],
            jump: 'avec_hana',
          },
        ],
      },
    ],

    defendre: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'show', who: 'hana', expr: 'surprise', at: 'right' },
      { op: 'say', who: 'mc', text: 'Rends-le, Hana. Ce mot ne nous appartient pas.' },
      { op: 'say', who: 'hana', text: 'Pff… vous n’êtes pas drôles. Tiens, le voilà, ton bout de papier.' },
      { op: 'show', who: 'yuki', expr: 'gene', at: 'left' },
      { op: 'say', who: 'yuki', text: 'Merci, {mc}… Est-ce que… tu voudrais bien venir sous le grand cerisier, après les cours ?' },
      { op: 'jump', label: 'cerisier' },
    ],

    avec_hana: [
      { op: 'scene', bg: 'salle_classe' },
      { op: 'say', text: 'Tu pouffes malgré toi. Hana a un vrai talent pour transformer tout en spectacle.' },
      { op: 'show', who: 'yuki', expr: 'triste', at: 'left' },
      { op: 'say', text: 'Yuki récupère son mot en silence et quitte la salle sans un regard.' },
      { op: 'show', who: 'hana', expr: 'gene', at: 'right' },
      { op: 'say', who: 'hana', text: 'Oups… j’y suis peut-être allée un peu fort. Bon ! Viens, j’ai un spectacle à préparer, et il me faut une assistante de choc !' },
      { op: 'jump', label: 'repet_hana' },
    ],

    cerisier: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'say', text: 'Après les cours, le grand cerisier fait pleuvoir ses pétales sur la cour déserte.' },
      { op: 'show', who: 'yuki', expr: 'gene', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Tu es venue… Je ne savais pas si tu viendrais.' },
      { op: 'say', who: 'yuki', text: 'Voilà… personne ne le sait, mais… je chante. Tout le temps, partout, mais seulement quand je suis seule.' },
      { op: 'show', who: 'yuki', expr: 'triste', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Je rêve de m’inscrire au festival. Mais toute seule sur scène… j’en suis incapable. Mes jambes tremblent rien que d’y penser.' },
      {
        op: 'menu',
        choices: [
          {
            text: '« Et si on chantait ensemble ? En duo ! »',
            impact: '💙 Yuki +2 · 🚩 promesse_duo',
            effects: [
              { add: 'coeur_yuki', n: 2 },
              { set: 'promesse_duo', to: true },
            ],
            jump: 'duo_promesse',
          },
          {
            text: '« Tu n’as pas besoin de moi : ta voix mérite un solo. »',
            impact: '💙 Yuki +1',
            effects: [{ add: 'coeur_yuki', n: 1 }],
            jump: 'solo',
          },
          {
            text: 'Avouer : « Yuki… j’ai lu ton mot avant de venir. »',
            impact: '💙 Yuki +1 (honnêteté)',
            cond: { var: 'a_lu_le_mot', eq: true },
            effects: [{ add: 'coeur_yuki', n: 1 }],
            jump: 'aveu',
          },
        ],
      },
    ],

    aveu: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'yuki', expr: 'surprise', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Tu… tu l’avais lu ?!' },
      { op: 'say', who: 'mc', text: 'Oui. Je suis désolée. Mais je suis venue parce que ton secret mérite d’être entendu.' },
      { op: 'show', who: 'yuki', expr: 'joie', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Tu es venue quand même… Alors, dis-moi : je fais quoi, pour le festival ?' },
      {
        op: 'menu',
        choices: [
          {
            text: '« On monte un duo, toi et moi. »',
            impact: '💙 Yuki +1 · 🚩 promesse_duo',
            effects: [
              { add: 'coeur_yuki', n: 1 },
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
      { op: 'show', who: 'yuki', expr: 'joie', at: 'left' },
      { op: 'say', who: 'yuki', text: 'Quand nos voix se croisent sur le refrain… on dirait que je n’ai plus peur de rien.' },
      { op: 'say', text: 'Un soir, Hana vous surprend en pleine répétition.' },
      { op: 'show', who: 'hana', expr: 'surprise', at: 'right' },
      { op: 'say', who: 'hana', text: 'ALORS C’ÉTAIT ÇA, vos cachotteries ! …Bon. D’accord. C’était magnifique. Mais mon spectacle sera mieux !' },
      { op: 'jump', label: 'festival' },
    ],

    solo: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'yuki', expr: 'surprise', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Un solo ? Moi ? Tu crois vraiment que j’en suis capable…?' },
      { op: 'say', who: 'mc', text: 'J’en suis sûre. Et je t’aiderai à répéter, promis.' },
      { op: 'show', who: 'yuki', expr: 'neutre', at: 'center' },
      { op: 'say', who: 'yuki', text: 'Alors… je vais essayer. Mais si mes jambes tremblent, ce sera ta faute !' },
      { op: 'jump', label: 'festival' },
    ],

    repet_hana: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'say', text: 'Hana t’embarque dans les préparatifs de son spectacle : lumières, chorégraphie, paillettes. Beaucoup de paillettes.' },
      { op: 'show', who: 'hana', expr: 'colere', at: 'center' },
      { op: 'say', who: 'hana', text: 'Non non NON ! Le projecteur rose doit s’allumer SUR le refrain, pas après !' },
      { op: 'say', text: 'Elle est épuisante… mais quand elle répète, impossible de la quitter des yeux.' },
      {
        op: 'menu',
        choices: [
          {
            text: 'Suivre son rythme à fond — ce spectacle sera le sien',
            impact: '💗 Hana +1',
            effects: [{ add: 'coeur_hana', n: 1 }],
            jump: 'hana_fond',
          },
          {
            text: '« Et si on invitait Yuki ? Il paraît qu’elle chante bien… »',
            impact: '💙 Yuki +1 · 💗 Hana −1',
            effects: [
              { add: 'coeur_yuki', n: 1 },
              { add: 'coeur_hana', n: -1 },
            ],
            jump: 'invite_yuki',
          },
        ],
      },
    ],

    hana_fond: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'hana', expr: 'joie', at: 'center' },
      { op: 'say', who: 'hana', text: 'Tu sais quoi, {mc} ? T’es la seule à me suivre sans te plaindre. Ce spectacle, il est à nous deux maintenant.' },
      { op: 'say', text: 'Pour la première fois, Hana te sourit sans jouer un rôle.' },
      { op: 'jump', label: 'festival' },
    ],

    invite_yuki: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'hana', expr: 'colere', at: 'right' },
      { op: 'say', who: 'hana', text: 'Yuki ?! La fille qui n’ose même pas lever la main en classe ?' },
      { op: 'say', who: 'mc', text: 'Justement. Sur scène, tout le monde mérite sa chance. Même celles qui tremblent.' },
      { op: 'show', who: 'hana', expr: 'neutre', at: 'right' },
      { op: 'say', who: 'hana', text: '…Très bien. Qu’elle vienne aux auditions. Mais je te préviens : chez moi, on ne triche pas avec le talent.' },
      { op: 'show', who: 'yuki', expr: 'gene', at: 'left' },
      { op: 'say', who: 'yuki', text: 'Tu… tu as parlé de moi à Hana ? Personne n’avait jamais fait ça pour moi.' },
      { op: 'jump', label: 'festival' },
    ],

    festival: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'say', text: 'Le soir du festival. La grande scène s’illumine, la cour entière retient son souffle.' },
      { op: 'if', cond: { var: 'promesse_duo', eq: true }, then: 'fin_duo_check', else: 'festival_suite' },
    ],

    fin_duo_check: [
      { op: 'if', cond: { var: 'coeur_yuki', gte: 2 }, then: 'fin_duo', else: 'festival_suite' },
    ],

    festival_suite: [
      { op: 'if', cond: { var: 'coeur_hana', gte: 2 }, then: 'fin_hana', else: 'festival_suite2' },
    ],

    festival_suite2: [
      { op: 'if', cond: { var: 'coeur_yuki', gte: 1 }, then: 'fin_amie', else: 'fin_chemins' },
    ],

    fin_duo: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'yuki', expr: 'joie', at: 'left' },
      { op: 'show', who: 'mc', expr: 'joie', at: 'right' },
      { op: 'say', text: 'Vos deux voix s’élèvent ensemble sous les projecteurs. Yuki ne tremble plus : elle rayonne.' },
      { op: 'say', who: 'yuki', text: 'Merci, {mc}. Ce secret-là… c’était le plus beau des cadeaux.' },
      { op: 'say', text: 'Dans le public, Hana applaudit plus fort que tout le monde — en faisant semblant de bouder.' },
      { op: 'end', ending: { id: 'duo', title: 'Duo sous les cerisiers', emoji: '⭐' } },
    ],

    fin_hana: [
      { op: 'scene', bg: 'scene_concert' },
      { op: 'show', who: 'hana', expr: 'joie', at: 'center' },
      { op: 'say', text: 'Le spectacle de Hana éblouit tout le festival. Au moment des saluts, elle t’attrape la main et te tire sur scène.' },
      { op: 'say', who: 'hana', text: 'Mesdames et messieurs… ma coéquipière ! Sans elle, rien de tout ça n’existerait !' },
      { op: 'say', text: 'Sous les projecteurs, tu découvres que l’amitié aussi peut briller comme une étoile.' },
      { op: 'end', ending: { id: 'etoile_hana', title: "L'étoile inattendue", emoji: '🌟' } },
    ],

    fin_amie: [
      { op: 'scene', bg: 'cour_sakura' },
      { op: 'show', who: 'yuki', expr: 'joie', at: 'center' },
      { op: 'say', text: 'Yuki n’est pas montée sur scène cette année. Mais sous le cerisier, elle chante pour toi seule, et sa voix est le plus joli secret de l’école.' },
      { op: 'say', who: 'yuki', text: 'L’année prochaine, promis… je m’inscris. Si tu es là.' },
      { op: 'end', ending: { id: 'nouvelle_amie', title: 'Une nouvelle amie', emoji: '🌸' } },
    ],

    fin_chemins: [
      { op: 'scene', bg: 'toit' },
      { op: 'say', text: 'Le festival scintille au loin. Tu le regardes depuis le toit, un peu à l’écart de tout.' },
      { op: 'say', text: 'Yuki chante peut-être quelque part. Hana brille sûrement sur scène. Et toi… tu te promets de ne plus rester spectatrice la prochaine fois.' },
      { op: 'say', text: 'Certaines histoires demandent plusieurs essais pour trouver leur plus belle fin…' },
      { op: 'end', ending: { id: 'chemins', title: 'Chacune son chemin', emoji: '🍃' } },
    ],
  },
}
