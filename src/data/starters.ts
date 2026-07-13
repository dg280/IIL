/**
 * Les 3 premiers personnages proposés par Plume : chaque enfant part des mêmes
 * archétypes (prompts auto), mais génère des portraits uniques via l'IA — tous
 * dans le style maison cozy (voir STYLE_BASE dans genai.ts), donc cohérents
 * d'une expérience à l'autre.
 */
export interface StarterCharacter {
  emoji: string
  name: string
  /** description injectée telle quelle dans le prompt de portrait IA */
  descr: string
  hint: string
}

/** Décors que Plume propose de faire peindre à l'IA, par univers (même style maison). */
export const DECOR_SEEDS: Record<string, string[]> = {
  sakura: [
    'la cour de l’école sous les cerisiers en fleurs',
    'une salle de classe ensoleillée le matin',
    'le toit de l’école au coucher du soleil',
    'la rue commerçante décorée pour le festival',
  ],
  scene: [
    'une grande scène de concert avec des projecteurs colorés',
    'les coulisses avant le spectacle, pleines de costumes',
    'une salle de répétition cosy avec des instruments',
    'la foule qui applaudit vue depuis la scène',
  ],
  royaumes: [
    'une salle de bal de château avec des lustres dorés',
    'un jardin royal fleuri avec une fontaine',
    'une bibliothèque ancienne pleine de grimoires',
    'un balcon de château au clair de lune',
  ],
}

export const PLUME_STARTERS: StarterCharacter[] = [
  {
    emoji: '🌼',
    name: 'Camille',
    descr: 'une amie d’enfance chaleureuse, cheveux bouclés châtains, grand sourire, joues roses',
    hint: 'Ton amie d’enfance, toujours de bonne humeur',
  },
  {
    emoji: '🌙',
    name: 'Alix',
    descr: 'un·e élève mystérieux·se aux cheveux sombres et aux yeux clairs, air rêveur et calme',
    hint: 'La personne mystérieuse de l’école',
  },
  {
    emoji: '⭐',
    name: 'Robin',
    descr: 'un·e camarade drôle et pétillant·e, cheveux en bataille, taches de rousseur, air malicieux',
    hint: 'Le boute-en-train de la bande',
  },
]
