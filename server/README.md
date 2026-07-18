# Boucle automatique de remontée de bugs

Objectif : quand Rose écrit une remontée dans le mode debug de l'app, un **ticket
GitHub** est créé automatiquement dans `dg280/iil` — sans qu'elle ait à envoyer
quoi que ce soit. Claude voit ensuite les remontées et corrige.

L'app est un site statique (GitHub Pages) : elle ne peut pas détenir de jeton
GitHub. On passe donc par une petite **edge function** (Cloudflare Workers,
gratuit) qui garde le jeton côté serveur.

Le worker fait **une seule chose** : il crée une **issue GitHub** (label
`from-app`). C'est cette issue qui **déclenche la routine de correction** — la
routine est configurée avec le déclencheur GitHub « **Issue ouverte** » sur
`dg280/iil`. Quand une issue arrive, la routine lit son contenu, corrige le code
sur la branche de travail et pousse ; l'issue joue donc le rôle de file d'attente.
Voir `bug-reports/routine-prompt.md` pour le réglage de la routine.

## Déploiement (une fois, par un parent/dev)

Prérequis : un compte Cloudflare (gratuit) et Node installé.

```bash
cd server
npm i -g wrangler          # ou: npx wrangler ...
wrangler login             # ouvre le navigateur pour autoriser

# 1) Jeton GitHub « fine-grained » sur le dépôt dg280/iil
#    (https://github.com/settings/tokens?type=beta) avec la permission :
#      - Issues: Read and write   (pour créer les tickets)
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

Désormais, chaque remontée crée directement une issue (label `from-app`) avec le
contexte (écran, version/build, univers, etc.), et la routine « Issue ouverte »
prend le relais. Si le worker est injoignable, l'app retombe automatiquement sur le
partage natif / l'e-mail au parent.

## Sonde d'état LibertAI (`GET ?status=libertai`)

Le worker expose aussi une route **publique en lecture** qui relaie l'état de
`status.libertai.io` (Uptime Kuma) — cette page n'ayant pas d'en-tête CORS, le
navigateur ne peut pas la lire directement. La route renvoie une synthèse JSON
(état global + service par service : image « Z-Image Turbo », texte « Hermes 3
8B », sites). L'**Espace parents → « État de l'infra LibertAI »** l'utilise via
l'URL du worker déjà configurée (aucun réglage supplémentaire).

⚠️ Cette route est nouvelle : **redéploie le worker** (`wrangler deploy`) pour
l'activer. Tant que ce n'est pas fait, l'app affiche seulement la **sonde
directe** de l'API (réachabilité + validité de la clé), qui, elle, ne nécessite
aucun serveur. Aucun secret n'est requis pour cette route (lecture seule).

## Variables (wrangler.toml)

- `REPO` — dépôt cible (défaut `dg280/iil`).

## Sécurité / coût

- Le jeton reste dans les secrets Cloudflare, jamais dans l'app ni le dépôt.
- `APP_SECRET` limite les envois à ceux qui connaissent le secret.
- Cloudflare Workers : offre gratuite largement suffisante pour un usage familial.
- Le corps est tronqué (≤ 8000 caractères) et un seul dépôt cible est autorisé.
