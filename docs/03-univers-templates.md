# 03 — Univers & templates

Un **univers** = un pack cohérent : palette, décors, garde-robe de base, musiques,
archétypes de personnages, et « graines d'histoires ». La GenAI est contrainte par le
style guide de l'univers choisi (voir doc 05), ce qui préserve la cohérence.

Chaque univers définit aussi **une stat narrative signature** en plus des affinités —
c'est elle qui donne sa saveur aux choix.

## Les 7 univers de lancement proposés

### 🌸 1. Académie Sakura *(slice-of-life collège — l'otome classique)*
- **Ambiance** : rentrée, clubs, festival culturel, toits au coucher de soleil.
- **Palette** : rose sakura, blanc cassé, bleu uniforme.
- **Décors** : salle de classe, cour aux cerisiers, toit, salle du club, rue commerçante, chambre.
- **Archétypes** : l'ami·e d'enfance, le/la mystérieuse transférée, le président du
  conseil des élèves trop sérieux, la rivale pas si méchante.
- **Stat signature** : `courage` (oser dire les choses).
- **Graines** : « Le mot glissé dans le casier », « Sauver le festival », « Le secret du club abandonné ».

### ✨ 2. Académie des Étoiles *(école de magie)*
- **Ambiance** : dortoirs enchantés, familiers, examens de sortilèges, bibliothèque interdite.
- **Palette** : violet nuit, or constellation, turquoise.
- **Archétypes** : le familier bavard, la meilleure élève épuisée, le garçon qui rate
  tous ses sorts, la directrice énigmatique.
- **Stat signature** : `magie` (débloquer des solutions impossibles autrement).
- **Graines** : « Mon familier a disparu », « L'examen des quatre lunes », « La porte de la bibliothèque ».

### 🎤 3. Lumière de Scène *(groupe de musique / idols)*
- **Ambiance** : salle de répète, concours régional, coulisses, trac et paillettes.
- **Palette** : fuchsia néon, bleu électrique, blanc projecteur.
- **Archétypes** : la leader perfectionniste, le compositeur timide, la rivale d'un autre
  groupe, le manageur débordé.
- **Stat signature** : `harmonie` (l'entente du groupe change les performances… et les fins).
- **Graines** : « Une place se libère dans le groupe », « La chanson volée », « Duo ou solo ? ».

### 👑 4. Bal des Royaumes *(fantasy de cour)*
- **Ambiance** : châteaux, bals masqués, intrigues gentilles, dragons diplomates.
- **Palette** : bordeaux, or, vert forêt.
- **Archétypes** : l'héritière qui rêve d'aventure, le garde du corps loyal, le prince du
  royaume rival, la couturière qui sait tout.
- **Stat signature** : `etiquette` vs `audace` (deux jauges opposées — jouer la cour ou la briser).
- **Graines** : « L'invitation au bal masqué », « Le traité des deux royaumes », « La robe qui change tout ».

### 🕵️ 5. Mystère au Manoir *(club d'enquêtes)*
- **Ambiance** : vieux manoir, passages secrets, carnet d'indices, orage opportun.
- **Palette** : sépia, bleu nuit, rouge indice.
- **Archétypes** : le duo de détectives en herbe, la gardienne du manoir, l'héritier
  soupçonné, le chat qui en sait trop.
- **Stat signature** : `indices` (collection — certains choix n'apparaissent qu'avec assez d'indices).
- **Graines** : « Le portrait qui a changé de place », « La lettre de l'aïeule », « Trois suspects, un gâteau disparu ».

### 🚀 6. Station Nova *(internat spatial pastel)*
- **Ambiance** : serre orbitale, robots de compagnie, Terre vue du hublot, bal en apesanteur.
- **Palette** : lavande, corail, argent.
- **Archétypes** : la pilote casse-cou, le botaniste rêveur, le robot qui apprend les
  émotions, la capitaine stricte au grand cœur.
- **Stat signature** : `confiance_equipage` (les fins d'urgence dépendent de qui te fait confiance).
- **Graines** : « Alerte dans la serre », « Le message venu de Terre », « Premier bal en apesanteur ».

### 🧁 7. Café des Merveilles *(cozy — gérer un café magique)*
- **Ambiance** : pâtisseries enchantées, clients-créatures, recettes secrètes, pluie derrière la vitre.
- **Palette** : crème, caramel, menthe.
- **Archétypes** : la patronne fée, le livreur loup-garou timide, la cliente dragonne
  difficile, l'apprentie maladroite (toi ?).
- **Stat signature** : `reputation_cafe` (les habitués reviennent… ou pas).
- **Graines** : « La recette perdue de la patronne », « Un client impossible à satisfaire », « Le concours du meilleur salon de thé ».

> **v1 — décision actée : 🌸 Académie Sakura, 🎤 Lumière de Scène, 👑 Bal des Royaumes.**
> Les autres deviennent des sorties d'univers régulières — c'est aussi le rythme de la
> monétisation future (doc 06).

## Templates narratifs (structures à remixer)

Indépendants de l'univers, ce sont des **arbres pré-construits à trous** : la structure
des choix existe, l'enfant remplace personnages, lieux et dialogues. Chaque template
enseigne un mécanisme narratif :

| Template | Structure | Mécanisme enseigné |
|---|---|---|
| **Premier jour** | Linéaire + 3 petits choix d'affinité, 1 fin | `say`, `menu`, affinités |
| **Le Secret** | 2 branches (garder/révéler) qui divergent vraiment, 3 fins | vrais embranchements |
| **La Grande Décision** | Tronc commun, 1 choix pivot à mi-histoire, 2 actes finaux distincts | choix pivot, `jump` |
| **Les Trois Cœurs** | 3 routes de personnage à la Ren'Py, fins par affinité dominante | routes, conditions sur stats |
| **L'Enquête** | Collecte de drapeaux, la confrontation finale liste les preuves trouvées | flags, choix conditionnels |
| **La Boucle** | Une journée qui recommence tant qu'on n'a pas trouvé la bonne combinaison | variables, retour de labels |

Chaque template affiche dans le builder son **squelette d'arbre** avec les trous à
remplir en surbrillance — on voit la forme de l'histoire avant d'écrire un mot.
