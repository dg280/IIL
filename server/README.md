# Boucle automatique de remontée de bugs

Objectif : quand Rose écrit une remontée dans le mode debug de l'app, un **ticket
GitHub** est créé automatiquement dans `dg280/iil` — sans qu'elle ait à envoyer
quoi que ce soit. Claude voit ensuite les remontées et corrige.

L'app est un site statique (GitHub Pages) : elle ne peut pas détenir de jeton
GitHub. On passe donc par une petite **edge function** (Cloudflare Workers,
gratuit) qui garde le jeton côté serveur.

Le worker fait **deux choses** à chaque remontée :

1. il crée une **issue GitHub** (pour la visibilité humaine) ;
2. il commite aussi la remontée en tant que fichier
   `bug-reports/inbox/<id>.md` sur la branche de travail
   (`claude/otome-game-builder-hqabza`).

Ce deuxième point est important : la **routine planifiée** qui traite les bugs
n'a accès qu'à `git` (clone / commit / push), pas à l'API REST de GitHub. Elle lit
donc les remontées dans `bug-reports/inbox/`, corrige, puis déplace les fichiers
traités dans `bug-reports/done/`.

## Déploiement (une fois, par un parent/dev)

Prérequis : un compte Cloudflare (gratuit) et Node installé.

```bash
cd server
npm i -g wrangler          # ou: npx wrangler ...
wrangler login             # ouvre le navigateur pour autoriser

# 1) Jeton GitHub « fine-grained » sur le dépôt dg280/iil
#    (https://github.com/settings/tokens?type=beta) avec DEUX permissions :
#      - Issues:   Read and write   (pour créer les tickets)
#      - Contents: Read and write   (pour commiter bug-reports/inbox/*.md)
wrangler secret put GITHUB_TOKEN     # colle le PAT quand demandé

# 2) (facultatif mais recommandé) un secret partagé anti-spam
wrangler secret put APP_SECRET       # ex: une longue phrase au hasard

# 3) déploie
wrangler deploy
```

`wrangler deploy` affiche l'URL publique, du type
`https://celestine-bugs.<ton-sous-domaine>.workers.dev`.

## Brancher l'app

Dans l'app, active le **mode debug** → ouvre la bulle 🐞 → section
« ⚙️ Boucle auto (webhook GitHub) » :

1. colle l'**URL du worker** ;
2. si tu as défini `APP_SECRET`, colle le **même secret** ;
3. « Enregistrer le webhook ».

Désormais, chaque remontée crée directement une issue (label `from-app`) **et** un
fichier `bug-reports/inbox/<id>.md` sur la branche de travail, avec le contexte
(écran, version/build, univers, etc.). Si le worker est injoignable, l'app retombe
automatiquement sur le partage natif / l'e-mail au parent.

## Variables (wrangler.toml)

- `REPO`   — dépôt cible (défaut `dg280/iil`).
- `BRANCH` — branche où commiter les remontées (défaut
  `claude/otome-game-builder-hqabza`). La routine lit cette même branche.

## Sécurité / coût

- Le jeton reste dans les secrets Cloudflare, jamais dans l'app ni le dépôt.
- `APP_SECRET` limite les envois à ceux qui connaissent le secret.
- Cloudflare Workers : offre gratuite largement suffisante pour un usage familial.
- Le corps est tronqué (≤ 8000 caractères) et un seul dépôt cible est autorisé.
