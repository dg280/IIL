# 08 — Roadmap

## v0.1 — « Elle joue » ✅ livré
## v0.2 — « Elle crée » (la Tisseuse) ✅ livré

---

## v0.1 — « Elle joue » (fondations + première magie)
- PWA installable (manifest, service worker, IndexedDB).
- Player d'histoires : Story AST → scènes, dialogues, choix, variables, fins.
- Atelier Personnages : paper-doll avec la bibliothèque d'assets de base
  (1 univers : Académie Sakura), expressions, chambre simple.
- 1 histoire de démonstration fournie (template « Le Secret ») pour jouer tout de suite.
- ✅ Critère : sa fille crée son avatar et finit une histoire jouée dans le player.

## v0.2 — « Elle crée » (la Tisseuse)
- Builder d'arbre (graphe de nœuds), éditeur de scène WYSIWYG, playtest depuis un nœud.
- Badges d'impact, score de vrai choix, détecteur de faux choix (Plume), panneau des fins.
- Templates narratifs : Premier jour, Le Secret, La Grande Décision.
- Sauvegarde locale multi-histoires.
- ✅ Critère : elle crée une histoire à 2 fins sans aide, et le builder lui a signalé
  au moins un faux choix qu'elle a corrigé.

## v0.3 — « L'atelier magique » (GenAI) + gamification
- Backend (Supabase) : comptes pseudo + consentement parental, Edge Function GenAI.
- Génération de couches (tenues, coiffures, déco) avec modération, 3 variantes, crédits.
- XP, titres, quêtes créatives, gemmes, boutique (économie virtuelle), Studio/chambre.
- Choix du fournisseur d'images (bench sur le gabarit paper-doll).
- ✅ Critère : « une robe de bal bleu nuit avec des étoiles » sort en < 1 min, cohérente,
  et se porte sur deux personnages différents.

## v0.4 — « Elle partage »
- Publication : snapshot immuable, lien non listé, player invité sans compte.
- Réactions stickers, tableau des fins atteintes, dépublication.
- Portail parental v1 (liens, interrupteurs partage/GenAI, quotas, suppression).
- ✅ Critère : une copine finit l'histoire sur son téléphone via le lien et envoie un sticker.

## v1.0 — « Le studio complet »
- Export Ren'Py (.zip : script.rpy, sprites aplatis, gui) — testé dans le SDK Ren'Py.
- 3 univers (Sakura, Étoiles, Café des Merveilles), 6 templates narratifs.
- Passe Créatrice (gratuite), polish, onboarding par quêtes.

## v2 — « Le village » (l'âme Tomodachi Life)
- Place du village : les avatars des créatrices s'y promènent, humeurs, animations.
- Bibliothèque du village : les histoires publiées entre amies y apparaissent en « livres ».
- Visites de chambres, événements de village légers, cadeaux de stickers.
- Co-écriture à deux (chacune écrit une branche).

## v2+ — pistes
- Activation du paiement réel derrière le portail parental (doc 06).
- Doublage texte-parole des personnages, musiques génératives.
- Mode « classe » (ateliers d'écriture scolaires).
