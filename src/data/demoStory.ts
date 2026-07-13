import type { Story } from '../engine/types'
import type { UniverseId } from '../universes'
import { PLUME_STARTERS } from './starters'

// L'histoire témoin met en scène les personnages créés à la FTUE : Camille
// (perso1) et Alix (perso2). En jeu, ce sont leurs portraits IA qui s'affichent,
// et les DÉCORS IA de la FTUE (résolus par rôle, voir DEMO_DECOR + le Player).
// Le paper-doll des starters ne sert que de secours hors-ligne.
const camille = PLUME_STARTERS[0].config
const alix = PLUME_STARTERS[1].config

/**
 * Décors de l'histoire témoin par rôle et par univers : mots-clés pour retrouver
 * le décor IA généré à la FTUE, + un décor SVG de secours. Utilisé par le Player.
 */
export const DEMO_DECOR: Record<UniverseId, Record<'everyday' | 'meeting' | 'stage', { keywords: string[]; fallbackBg: string }>> = {
  sakura: {
    everyday: { keywords: ['salle de classe', 'classe'], fallbackBg: 'salle_classe' },
    meeting: { keywords: ['cour', 'cerisier'], fallbackBg: 'cour_sakura' },
    stage: { keywords: ['toit'], fallbackBg: 'toit' },
  },
  scene: {
    everyday: { keywords: ['répétition', 'repetition', 'coulisses'], fallbackBg: 'scene_concert' },
    meeting: { keywords: ['coulisses', 'loge'], fallbackBg: 'scene_concert' },
    stage: { keywords: ['scène', 'scene', 'concert', 'projecteur'], fallbackBg: 'scene_concert' },
  },
  royaumes: {
    everyday: { keywords: ['bibliothèque', 'bibliotheque', 'grimoire'], fallbackBg: 'salle_bal' },
    meeting: { keywords: ['jardin', 'fontaine', 'balcon'], fallbackBg: 'salle_bal' },
    stage: { keywords: ['bal', 'château', 'chateau', 'lustre'], fallbackBg: 'salle_bal' },
  },
}

interface Theme {
  title: string
  description: string
  intro: string
  announce: string
  spectacle: string // réplique de Camille (l'extravertie)
  neighbor: string
  eventQ: string // réplique d'Alix
  noteFall: string
  noteText: string
  meetShort: string // « le grand cerisier » / « les coulisses » / « le jardin royal »
  meetIntro: string
  rehearse: string
  prep: string // préparatifs de Camille
  eventNight: string
  stageLights: string
  duoFinal: string
  camilleFinal: string
  amieFinal: string
  cheminsPlace: string // décor de la fin « chacun son chemin »
  cheminsText: string
}

const THEMES: Record<UniverseId, Theme> = {
  sakura: {
    title: 'Le Secret du cerisier',
    description:
      "C'est le printemps à l'Académie Sakura. Le festival approche… et un mystérieux mot plié vient de tomber de ton casier.",
    intro: "Printemps à l'Académie Sakura. Les pétales volent jusque dans les couloirs.",
    announce: 'La professeure vient de l’annoncer : le festival de l’école aura lieu dans deux semaines !',
    spectacle: 'Cette année, je monte un spectacle sur la grande scène. Il sera IN-OU-BLIABLE !',
    neighbor: 'À côté de toi, ton nouveau voisin de table, Alix, baisse les yeux sans rien dire.',
    eventQ: '{mc}… tu as déjà une idée pour le festival, toi ?',
    noteFall: "La sonnerie retentit. En ouvrant ton casier, un petit mot plié s'en échappe et glisse au sol…",
    noteText: '« Retrouve-moi sous le grand cerisier après les cours. J’ai un secret à te confier. — A »',
    meetShort: 'le grand cerisier',
    meetIntro: 'Après les cours, le grand cerisier fait pleuvoir ses pétales sur la cour déserte.',
    rehearse: 'Les jours suivants, vous répétez en secret sur le toit de l’école, face au soleil couchant.',
    prep: 'Camille t’embarque dans les préparatifs de son spectacle : lumières, chorégraphie, paillettes. Beaucoup de paillettes.',
    eventNight: 'Le soir du festival. La grande scène s’illumine, la cour entière retient son souffle.',
    stageLights: 'Vos deux voix s’élèvent ensemble sous les projecteurs. Alix ne tremble plus : il rayonne.',
    duoFinal: 'Dans le public, Camille applaudit plus fort que tout le monde — en faisant semblant de bouder.',
    camilleFinal: 'Le spectacle de Camille éblouit tout le festival. Au moment des saluts, elle t’attrape la main et te tire sur scène.',
    amieFinal: 'Alix n’est pas monté sur scène cette année. Mais sous le cerisier, il chante pour toi seule, et sa voix est le plus joli secret de l’école.',
    cheminsPlace: 'toit',
    cheminsText: 'Le festival scintille au loin. Tu le regardes depuis le toit, un peu à l’écart de tout.',
  },
  scene: {
    title: 'Le Secret des coulisses',
    description:
      "Les néons s'allument sur Lumière de Scène. Le grand concert approche… et un mystérieux mot plié vient de tomber de ton étui.",
    intro: 'Les néons s’allument sur la scène de Lumière de Scène. Ça sent la répétition et le trac.',
    announce: 'Le manager vient de l’annoncer : le grand concert aura lieu dans deux semaines !',
    spectacle: 'Cette année, je veux LE show du siècle, avec des lumières partout. Il sera IN-OU-BLIABLE !',
    neighbor: 'À côté de toi, le nouveau de la troupe, Alix, accorde sa guitare sans rien dire.',
    eventQ: '{mc}… tu as déjà une idée pour le concert, toi ?',
    noteFall: "La pause arrive. En ouvrant l'étui de ton micro, un petit mot plié s'en échappe et glisse au sol…",
    noteText: '« Retrouve-moi dans les coulisses après la répétition. J’ai un secret à te confier. — A »',
    meetShort: 'les coulisses',
    meetIntro: 'Après la répétition, les coulisses sont plongées dans une pénombre tranquille, entre les portants de costumes.',
    rehearse: 'Les jours suivants, vous répétez en secret dans la petite salle du fond, face aux grands miroirs.',
    prep: 'Camille t’embarque dans les préparatifs de son show : lumières, chorégraphie, fumigènes. Beaucoup de fumigènes.',
    eventNight: 'Le soir du concert. La grande scène s’illumine, la salle entière retient son souffle.',
    stageLights: 'Vos deux voix s’élèvent ensemble sous les projecteurs. Alix ne tremble plus : il rayonne.',
    duoFinal: 'Dans la fosse, Camille applaudit plus fort que tout le monde — en faisant semblant de bouder.',
    camilleFinal: 'Le show de Camille électrise toute la salle. Au moment des saluts, elle t’attrape la main et te tire sur scène.',
    amieFinal: 'Alix n’est pas monté sur scène ce soir. Mais dans les coulisses, il chante pour toi seule, et sa voix est le plus joli secret de la troupe.',
    cheminsPlace: 'scene_concert',
    cheminsText: 'Le concert gronde au loin. Tu l’écoutes depuis les coulisses, un peu à l’écart de tout.',
  },
  royaumes: {
    title: 'Le Secret du jardin',
    description:
      "Les lustres du château scintillent. Le grand bal approche… et un mystérieux mot plié vient de glisser d'un vieux grimoire.",
    intro: 'Les lustres du château des Royaumes scintillent. La saison des bals commence.',
    announce: 'Le chambellan vient de l’annoncer : le grand bal aura lieu dans deux semaines !',
    spectacle: 'Cette année, je veux ouvrir le bal avec une danse dont tout le royaume parlera. Elle sera IN-OU-BLIABLE !',
    neighbor: 'À côté de toi, le nouveau page de la cour, Alix, garde les yeux baissés sans rien dire.',
    eventQ: '{mc}… tu as déjà une idée pour le bal, toi ?',
    noteFall: "Le silence retombe. En ouvrant un vieux grimoire, un petit mot plié s'en échappe et glisse au sol…",
    noteText: '« Retrouve-moi dans le jardin royal à la tombée du soir. J’ai un secret à te confier. — A »',
    meetShort: 'le jardin royal',
    meetIntro: 'À la tombée du soir, le jardin royal embaume et la fontaine murmure sous la lune.',
    rehearse: 'Les jours suivants, vous répétez en secret sur un balcon du château, face au soleil couchant.',
    prep: 'Camille t’embarque dans les préparatifs de sa danse : robes, chorégraphie, dorures. Beaucoup de dorures.',
    eventNight: 'Le soir du bal. La salle s’illumine sous les lustres, toute la cour retient son souffle.',
    stageLights: 'Vos deux voix s’élèvent ensemble sous les lustres. Alix ne tremble plus : il rayonne.',
    duoFinal: 'Au bord de la piste, Camille applaudit plus fort que tout le monde — en faisant semblant de bouder.',
    camilleFinal: 'La danse de Camille émerveille toute la cour. Au moment des révérences, elle t’attrape la main et t’entraîne au centre.',
    amieFinal: 'Alix n’a pas ouvert le bal cette fois. Mais dans le jardin, il chante pour toi seule, et sa voix est le plus joli secret du royaume.',
    cheminsPlace: 'salle_bal',
    cheminsText: 'Le bal scintille au loin. Tu le regardes depuis un balcon, un peu à l’écart de tout.',
  },
}

/** Construit l'histoire témoin adaptée à l'univers choisi. */
export function buildDemoStory(universe: UniverseId): Story {
  const t = THEMES[universe] ?? THEMES.sakura
  return {
    meta: { id: 'secret-cerisier', title: t.title, universe, description: t.description },
    characters: {
      mc: { name: 'Toi', isPlayer: true, color: '#e35d7c' },
      perso2: { name: 'Alix', color: '#5a77c9', defaultAvatar: alix },
      perso1: { name: 'Camille', color: '#d2568f', defaultAvatar: camille },
    },
    variables: { coeur_perso2: 0, coeur_perso1: 0, a_lu_le_mot: false, promesse_duo: false },
    endings: [
      { id: 'duo', title: 'Duo inoubliable', emoji: '⭐' },
      { id: 'etoile_camille', title: "L'étoile inattendue", emoji: '🌟' },
      { id: 'nouvelle_amie', title: 'Une nouvelle amitié', emoji: '🌸' },
      { id: 'chemins', title: 'Chacun son chemin', emoji: '🍃' },
    ],
    labels: {
      start: [
        { op: 'scene', bg: 'demo:everyday' },
        { op: 'say', text: t.intro },
        { op: 'say', text: t.announce },
        { op: 'show', who: 'perso1', expr: 'joie', at: 'right' },
        { op: 'say', who: 'perso1', text: t.spectacle },
        { op: 'show', who: 'perso2', expr: 'neutre', at: 'left' },
        { op: 'say', text: t.neighbor },
        { op: 'say', who: 'perso2', text: t.eventQ },
        { op: 'say', text: t.noteFall },
        {
          op: 'menu',
          choices: [
            { text: 'Le lire tout de suite', impact: '🚩 a_lu_le_mot', effects: [{ set: 'a_lu_le_mot', to: true }], jump: 'mot_lu' },
            { text: 'Le ranger sans le lire — c’est peut-être privé', jump: 'mot_range' },
          ],
        },
      ],

      mot_lu: [
        { op: 'scene', bg: 'demo:everyday' },
        { op: 'say', text: 'Tu déplies le mot en cachette. Une écriture fine, appliquée :' },
        { op: 'say', text: t.noteText },
        { op: 'say', text: 'A… comme Alix ? Ton cœur bat un peu plus vite.' },
        { op: 'jump', label: 'cerisier' },
      ],

      mot_range: [
        { op: 'scene', bg: 'demo:everyday' },
        { op: 'say', text: 'Tu glisses le mot dans ta poche sans le lire. Chacun ses secrets.' },
        { op: 'show', who: 'perso1', expr: 'joie', at: 'right' },
        { op: 'say', who: 'perso1', text: 'Oh oh ! Un mot mystère ! Fais voir, fais voir !' },
        { op: 'say', text: "Avant que tu réagisses, Camille te le chipe des mains, l'agite en l'air en riant." },
        { op: 'show', who: 'perso2', expr: 'triste', at: 'left' },
        { op: 'say', text: 'Du coin de l’œil, tu vois Alix devenir tout pâle.' },
        {
          op: 'menu',
          choices: [
            { text: 'Reprendre le mot et le rendre à Alix', impact: '💙 Alix +1', effects: [{ add: 'coeur_perso2', n: 1 }], jump: 'defendre' },
            { text: 'Rire avec Camille — elle est trop drôle', impact: '💗 Camille +1', effects: [{ add: 'coeur_perso1', n: 1 }], jump: 'avec_camille' },
          ],
        },
      ],

      defendre: [
        { op: 'scene', bg: 'demo:everyday' },
        { op: 'show', who: 'perso1', expr: 'surprise', at: 'right' },
        { op: 'say', who: 'mc', text: 'Rends-le, Camille. Ce mot ne nous appartient pas.' },
        { op: 'say', who: 'perso1', text: 'Pff… vous n’êtes pas drôles. Tiens, le voilà, ton bout de papier.' },
        { op: 'show', who: 'perso2', expr: 'gene', at: 'left' },
        { op: 'say', who: 'perso2', text: `Merci, {mc}… Est-ce que… tu voudrais bien venir à ${t.meetShort}, après ?` },
        { op: 'jump', label: 'cerisier' },
      ],

      avec_camille: [
        { op: 'scene', bg: 'demo:everyday' },
        { op: 'say', text: 'Tu pouffes malgré toi. Camille a un vrai talent pour transformer tout en spectacle.' },
        { op: 'show', who: 'perso2', expr: 'triste', at: 'left' },
        { op: 'say', text: 'Alix récupère son mot en silence et s’éclipse sans un regard.' },
        { op: 'show', who: 'perso1', expr: 'gene', at: 'right' },
        { op: 'say', who: 'perso1', text: 'Oups… j’y suis peut-être allée un peu fort. Bon ! Viens, j’ai besoin d’une assistante de choc !' },
        { op: 'jump', label: 'repet_camille' },
      ],

      cerisier: [
        { op: 'scene', bg: 'demo:meeting' },
        { op: 'say', text: t.meetIntro },
        { op: 'show', who: 'perso2', expr: 'gene', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Tu es venue… Je ne savais pas si tu viendrais.' },
        { op: 'say', who: 'perso2', text: 'Voilà… personne ne le sait, mais… je chante. Tout le temps, partout, mais seulement quand je suis seul.' },
        { op: 'show', who: 'perso2', expr: 'triste', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Je rêve de me lancer. Mais tout seul devant tout le monde… j’en suis incapable. Mes jambes tremblent rien que d’y penser.' },
        {
          op: 'menu',
          choices: [
            {
              text: '« Et si on chantait ensemble ? En duo ! »',
              impact: '💙 Alix +2 · 🚩 promesse_duo',
              effects: [{ add: 'coeur_perso2', n: 2 }, { set: 'promesse_duo', to: true }],
              jump: 'duo_promesse',
            },
            { text: '« Tu n’as pas besoin de moi : ta voix mérite un solo. »', impact: '💙 Alix +1', effects: [{ add: 'coeur_perso2', n: 1 }], jump: 'solo' },
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
        { op: 'scene', bg: 'demo:meeting' },
        { op: 'show', who: 'perso2', expr: 'surprise', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Tu… tu l’avais lu ?!' },
        { op: 'say', who: 'mc', text: 'Oui. Je suis désolée. Mais je suis venue parce que ton secret mérite d’être entendu.' },
        { op: 'show', who: 'perso2', expr: 'joie', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Tu es venue quand même… Alors, dis-moi : je fais quoi ?' },
        {
          op: 'menu',
          choices: [
            {
              text: '« On monte un duo, toi et moi. »',
              impact: '💙 Alix +1 · 🚩 promesse_duo',
              effects: [{ add: 'coeur_perso2', n: 1 }, { set: 'promesse_duo', to: true }],
              jump: 'duo_promesse',
            },
            { text: '« Lance-toi en solo, je serai au premier rang. »', jump: 'solo' },
          ],
        },
      ],

      duo_promesse: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'say', text: t.rehearse },
        { op: 'show', who: 'perso2', expr: 'joie', at: 'left' },
        { op: 'say', who: 'perso2', text: 'Quand nos voix se croisent sur le refrain… on dirait que je n’ai plus peur de rien.' },
        { op: 'say', text: 'Un soir, Camille vous surprend en pleine répétition.' },
        { op: 'show', who: 'perso1', expr: 'surprise', at: 'right' },
        { op: 'say', who: 'perso1', text: 'ALORS C’ÉTAIT ÇA, vos cachotteries ! …Bon. D’accord. C’était magnifique. Mais mon numéro sera mieux !' },
        { op: 'jump', label: 'festival' },
      ],

      solo: [
        { op: 'scene', bg: 'demo:meeting' },
        { op: 'show', who: 'perso2', expr: 'surprise', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Un solo ? Moi ? Tu crois vraiment que j’en suis capable…?' },
        { op: 'say', who: 'mc', text: 'J’en suis sûre. Et je t’aiderai à répéter, promis.' },
        { op: 'show', who: 'perso2', expr: 'neutre', at: 'center' },
        { op: 'say', who: 'perso2', text: 'Alors… je vais essayer. Mais si mes jambes tremblent, ce sera ta faute !' },
        { op: 'jump', label: 'festival' },
      ],

      repet_camille: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'say', text: t.prep },
        { op: 'show', who: 'perso1', expr: 'colere', at: 'center' },
        { op: 'say', who: 'perso1', text: 'Non non NON ! La lumière rose doit s’allumer SUR le refrain, pas après !' },
        { op: 'say', text: 'Elle est épuisante… mais quand elle répète, impossible de la quitter des yeux.' },
        {
          op: 'menu',
          choices: [
            { text: 'Suivre son rythme à fond — ce numéro sera le sien', impact: '💗 Camille +1', effects: [{ add: 'coeur_perso1', n: 1 }], jump: 'camille_fond' },
            {
              text: '« Et si on invitait Alix ? Il paraît qu’il chante bien… »',
              impact: '💙 Alix +1 · 💗 Camille −1',
              effects: [{ add: 'coeur_perso2', n: 1 }, { add: 'coeur_perso1', n: -1 }],
              jump: 'invite_alix',
            },
          ],
        },
      ],

      camille_fond: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'show', who: 'perso1', expr: 'joie', at: 'center' },
        { op: 'say', who: 'perso1', text: 'Tu sais quoi, {mc} ? T’es la seule à me suivre sans te plaindre. Ce numéro, il est à nous deux maintenant.' },
        { op: 'say', text: 'Pour la première fois, Camille te sourit sans jouer un rôle.' },
        { op: 'jump', label: 'festival' },
      ],

      invite_alix: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'show', who: 'perso1', expr: 'colere', at: 'right' },
        { op: 'say', who: 'perso1', text: 'Alix ?! Le garçon qui n’ose même pas lever les yeux ?' },
        { op: 'say', who: 'mc', text: 'Justement. Sur scène, tout le monde mérite sa chance. Même ceux qui tremblent.' },
        { op: 'show', who: 'perso1', expr: 'neutre', at: 'right' },
        { op: 'say', who: 'perso1', text: '…Très bien. Qu’il vienne aux auditions. Mais je te préviens : chez moi, on ne triche pas avec le talent.' },
        { op: 'show', who: 'perso2', expr: 'gene', at: 'left' },
        { op: 'say', who: 'perso2', text: 'Tu… tu as parlé de moi à Camille ? Personne n’avait jamais fait ça pour moi.' },
        { op: 'jump', label: 'festival' },
      ],

      festival: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'say', text: t.eventNight },
        { op: 'if', cond: { var: 'promesse_duo', eq: true }, then: 'fin_duo_check', else: 'festival_suite' },
      ],

      fin_duo_check: [{ op: 'if', cond: { var: 'coeur_perso2', gte: 2 }, then: 'fin_duo', else: 'festival_suite' }],
      festival_suite: [{ op: 'if', cond: { var: 'coeur_perso1', gte: 2 }, then: 'fin_camille', else: 'festival_suite2' }],
      festival_suite2: [{ op: 'if', cond: { var: 'coeur_perso2', gte: 1 }, then: 'fin_amie', else: 'fin_chemins' }],

      fin_duo: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'show', who: 'perso2', expr: 'joie', at: 'left' },
        { op: 'show', who: 'mc', expr: 'joie', at: 'right' },
        { op: 'say', text: t.stageLights },
        { op: 'say', who: 'perso2', text: 'Merci, {mc}. Ce secret-là… c’était le plus beau des cadeaux.' },
        { op: 'say', text: t.duoFinal },
        { op: 'end', ending: { id: 'duo', title: 'Duo inoubliable', emoji: '⭐' } },
      ],

      fin_camille: [
        { op: 'scene', bg: 'demo:stage' },
        { op: 'show', who: 'perso1', expr: 'joie', at: 'center' },
        { op: 'say', text: t.camilleFinal },
        { op: 'say', who: 'perso1', text: 'Mesdames et messieurs… ma coéquipière ! Sans elle, rien de tout ça n’existerait !' },
        { op: 'say', text: 'Sous les lumières, tu découvres que l’amitié aussi peut briller comme une étoile.' },
        { op: 'end', ending: { id: 'etoile_camille', title: "L'étoile inattendue", emoji: '🌟' } },
      ],

      fin_amie: [
        { op: 'scene', bg: 'demo:meeting' },
        { op: 'show', who: 'perso2', expr: 'joie', at: 'center' },
        { op: 'say', text: t.amieFinal },
        { op: 'say', who: 'perso2', text: 'La prochaine fois, promis… je me lance. Si tu es là.' },
        { op: 'end', ending: { id: 'nouvelle_amie', title: 'Une nouvelle amitié', emoji: '🌸' } },
      ],

      fin_chemins: [
        { op: 'scene', bg: t.cheminsPlace },
        { op: 'say', text: t.cheminsText },
        { op: 'say', text: 'Alix chante peut-être quelque part. Camille brille sûrement. Et toi… tu te promets de ne plus rester spectatrice la prochaine fois.' },
        { op: 'say', text: 'Certaines histoires demandent plusieurs essais pour trouver leur plus belle fin…' },
        { op: 'end', ending: { id: 'chemins', title: 'Chacun son chemin', emoji: '🍃' } },
      ],
    },
  }
}

/** Version par défaut (univers sakura) — pour l'id/les fins, invariants d'univers. */
export const demoStory: Story = buildDemoStory('sakura')
