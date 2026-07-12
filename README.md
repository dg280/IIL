# 🌸 Plumette — Studio d'otome games pour jeunes créatrices

> Nom de travail — autres candidats : **Lunaria**, **Storybloom**, **Mille Cœurs**, **Otome Atelier**.

**Plumette** est une webapp progressive (PWA) qui permet à une enfant de ~11 ans de
**créer, jouer et partager ses propres otome games / visual novels** :

- 🎨 **Créer son avatar et ses personnages** (cheveux, tenues, expressions, chambre) avec un
  système *paper-doll* en couches, enrichi par la **GenAI** pour inventer de nouveaux
  éléments dans un style visuel cohérent.
- 🌳 **Écrire des histoires à vrais choix** dans un builder visuel : l'arbre des
  embranchements est visible, chaque choix a un impact mesuré (affinités, drapeaux, fins multiples).
- 🕹️ **Jouer** ses histoires instantanément dans le navigateur (player web natif, hors-ligne).
- 🔗 **Partager** par simple lien : les copines jouent sans compte.
- 📦 **Exporter en Ren'Py** : chaque histoire peut être téléchargée comme vrai projet
  Ren'Py (`.rpy` + assets) jouable sur PC.
- 🏆 **Builder gamifié** : XP de créatrice, quêtes d'écriture, gemmes, boutique de
  cosmétiques — économie 100 % virtuelle pour la v1, monétisation réelle conçue mais désactivée.
- 🏘️ **Expérience sociale douce** (inspiration *Tomodachi Life*) : en v2, les avatars des
  créatrices vivent dans un village commun et réagissent aux histoires des autres —
  par stickers uniquement, jamais de chat libre.

## Documentation de conception

| Doc | Contenu |
|---|---|
| [01 – Vision & expérience](docs/01-vision.md) | Pour qui, pourquoi, les 3 boucles de jeu |
| [02 – Architecture technique](docs/02-architecture.md) | PWA, format d'histoire compatible Ren'Py, export `.rpy` |
| [03 – Univers & templates](docs/03-univers-templates.md) | 7 univers prêts à l'emploi + templates narratifs |
| [04 – Builder gamifié & vrais choix](docs/04-builder-gamification.md) | Arbre visuel, détecteur de faux choix, progression |
| [05 – Avatars & pipeline GenAI](docs/05-genai-pipeline.md) | Paper-doll, génération cohérente, modération |
| [06 – Monétisation](docs/06-monetisation.md) | Économie de gemmes, boutique, ce qu'on s'interdit |
| [07 – Sécurité & enfants](docs/07-securite-enfants.md) | RGPD-enfants, partage sûr, contrôles parentaux |
| [08 – Roadmap](docs/08-roadmap.md) | De la v0.1 au village social |

## Décisions actées

1. **Architecture** : player web natif dans la PWA + export Ren'Py (pas de Ren'Py WebAssembly embarqué).
2. **Avatars** : paper-doll en couches + GenAI pour générer de nouveaux éléments, cohérence garantie par le style maison.
3. **Monétisation** : économie virtuelle complète dès la v1, paiement réel branché plus tard avec contrôles parentaux.
4. **Scope v1** : builder + player + partage par lien. Village social type Tomodachi en v2.
