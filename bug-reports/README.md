# File d'attente des remontées de bugs (git-only)

Ce dossier est la **boîte aux lettres** entre l'app et la routine de correction.

Pourquoi des fichiers et pas seulement des issues GitHub ? La routine planifiée
qui traite les bugs n'a accès qu'à `git` (clone / commit / push), **pas** à l'API
REST de GitHub. Elle ne peut donc ni lister ni fermer des issues. On fait donc
transiter les remontées par de simples fichiers versionnés.

## Cycle de vie

1. **`inbox/`** — le worker Cloudflare (`server/bug-worker.js`) commite ici un
   fichier `<id>.md` à chaque remontée depuis le mode debug de l'app. Chaque
   fichier contient le titre, le lien vers l'issue GitHub associée (si créée) et
   le corps (contexte : écran, build, univers…).
2. La routine lit tous les `inbox/*.md`, analyse et corrige ce qui est
   raisonnablement corrigeable sur la branche de travail.
3. **`done/`** — une fois traité, le fichier est déplacé ici (`git mv`) avec, en
   fin de fichier, une courte note de ce qui a été fait (ou pourquoi c'est
   reporté). Ainsi la routine ne retraite jamais deux fois la même remontée.

Les `.gitkeep` gardent les deux dossiers présents même vides.
