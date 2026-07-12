# 04 — Builder gamifié & vrais choix

## Principe : l'arbre est le héros

L'écran principal du builder est un **graphe de nœuds** (pan/zoom, minimap) :

- **Nœud scène** : décor + personnages présents + suite de dialogues.
- **Nœud choix** : ses branches partent physiquement dans des directions différentes.
- **Nœud condition** : losange « si… alors » (introduit en douceur, via quêtes).
- **Nœud fin** : étoile colorée, avec titre de fin (« Fin : Amies pour la vie ⭐ »).

Le playtest se lance **depuis n'importe quel nœud** (bouton ▶ sur le nœud), avec un
panneau montrant l'état des variables en direct.

## Rendre les impacts VISIBLES (l'exigence n°1 du projet)

1. **Badges d'impact sur chaque branche de choix** : une branche qui modifie une
   affinité affiche `💗 Yuki +1`, une branche qui pose un drapeau affiche `🚩 a_vu_le_mot`.
   Une branche sans aucun effet ni divergence est visuellement « pâle ».
2. **Coloration par personnage** : chaque personnage a une couleur ; les branches et
   nœuds dominés par un personnage prennent sa teinte → on voit les « routes » émerger,
   comme dans un vrai otome.
3. **Score de vrai choix** : pour chaque nœud choix, le builder calcule la divergence
   réelle en aval (les branches mènent-elles à des scènes/fins différentes, ou
   reconvergent-elles immédiatement sans effet ?). Jauge de 1 à 3 cœurs sur le nœud.
4. **Le détecteur de faux choix** : si toutes les branches d'un choix reconvergent sans
   aucun effet, la mascotte **Plume** (un petit oiseau-stylo) le signale gentiment :
   *« Ce choix ne change rien pour l'instant… et si une des réponses vexait Yuki ? »*
   — avec un bouton « m'aider » qui propose un effet ou une mini-branche.
5. **Panneau des fins** : liste des fins atteignables, et pour chacune le **chemin de
   conditions** qui y mène (« Fin secrète : nécessite affinity_yuki ≥ 3 ET 🚩 a_vu_le_mot »).
   Les fins orphelines (inatteignables) sont marquées ⚠️.

## Progression de créatrice

- **XP & titres** : Apprentie Conteuse → Plumière → Tisseuse d'Histoires → Grande
  Autrice → Légende de la Plume. L'XP vient de la *création* (scènes écrites, choix à
  3 cœurs, fins multiples, playtests) et de la *réception* (joueuses ayant fini l'histoire).
- **Quêtes créatives** (le vrai tutoriel, déguisé) :
  - « Premier battement » — écris un choix qui change une affinité.
  - « Deux destins » — crée une histoire avec 2 fins vraiment différentes.
  - « La mémoire de l'histoire » — utilise un drapeau posé au chapitre 1 dans le chapitre 2.
  - « Fin secrète » — crée une fin qui exige une condition combinée.
  - « Metteuse en scène » — utilise 3 expressions différentes du même personnage dans une scène.
- **Gemmes 💎** : gagnées par quêtes, niveaux, et réactions reçues. Dépensées en boutique
  (tenues, décors, musiques, packs de stickers, crédits d'atelier magique GenAI).
- **Streak douce** : « ton jardin d'histoires fleurit » les jours de création — il ne
  fane jamais brutalement, il se rendort (pas de punition, cf. anti-objectifs doc 01).

## Écrans du builder

1. **Mon Studio** (hub) : mes histoires, mes personnages, ma chambre d'avatar (déco
   achetée avec les gemmes — la touche Tomodachi), quêtes en cours.
2. **Atelier Personnages** : paper-doll (doc 05), traits de caractère (2 qualités +
   1 défaut → suggèrent des réactions de dialogue), lien vers l'atelier magique GenAI.
3. **Tisseuse** (l'éditeur d'arbre) : le graphe, la palette de nœuds, Plume.
4. **Scène** (éditeur d'un nœud) : aperçu WYSIWYG exact du player (décor, sprites,
   boîte de dialogue), saisie des répliques, choix des expressions.
5. **Publication** : choix de la vignette, avertissement « pas de vrais noms/infos
   perso », génération du lien, tableau des fins atteintes par les joueuses.
