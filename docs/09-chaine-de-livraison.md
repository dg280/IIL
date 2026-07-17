# 09 — Chaîne de livraison & sécurité du code (M0)

Principe : **on ne livre jamais à une enfant du code généré par IA non revu par
un humain.** Le jeu de chaque joueuse est personnel par ses données et sa
configuration — le code, lui, est commun, testé et signé.

## Le flux

```
remontée in-app → issue GitHub → routine IA → branche routine/issue-<n>
   → PULL REQUEST vers claude/otome-game-builder-hqabza
   → CI bloquante (.github/workflows/ci.yml) :
       build + audit des prompts (tokens interdits) + tests unitaires + tests e2e
   → REVUE HUMAINE (mainteneur) → merge → déploiement Pages automatique
```

La routine ne pousse **jamais** directement sur la branche déployée
(`bug-reports/routine-prompt.md` mis à jour en ce sens — pense à recopier le
nouveau prompt dans la routine sur <https://claude.ai/code/routines>).

## Protection de branche — À ACTIVER UNE FOIS (admin GitHub requis)

Ces réglages ne peuvent pas être posés par la CI ; à faire dans
GitHub → `dg280/iil` → Settings → Branches → **Add branch ruleset** :

1. Cible : `claude/otome-game-builder-hqabza` (et `main`).
2. ✅ *Require a pull request before merging* — **Required approvals : 0**.
   ⚠️ Pas « 1 » : l'auteur d'une PR ne peut pas s'auto-approuver sur GitHub,
   donc à mainteneur unique, « 1 approbation » rend TOUTE PR infusionnable
   (vécu sur la PR #53). La revue humaine, c'est le clic de merge du
   mainteneur — le but de la règle (pas de push direct, CI obligatoire)
   reste pleinement atteint.
3. ✅ *Require status checks to pass* → choisir **`build-and-test`** via la
   liste déroulante (le nom RAPPORTÉ par les check runs — pas « CI /
   build-and-test » tapé à la main, qui ne matche jamais ; vécu aussi).
4. ✅ *Block force pushes*.
5. Ne pas cocher d'exception pour les admins (on se protège aussi de soi-même).

Tant que ce n'est pas activé, la règle n'est que conventionnelle : la routine
et les sessions IA ont pour consigne de passer par PR, mais rien ne l'impose
techniquement.

## Ce que la CI vérifie

- **Build** : `npm run build` (tsc + vite).
- **Audit des prompts** (`npm run check:prompts`) : aucun concept interdit
  (nudité, etc.) ne doit apparaître dans les fichiers qui construisent les
  prompts d'images — sur un modèle sans guidance négative, nier un concept
  l'injecte (cf. `src/atelier/genai.ts`).
- **Tests unitaires** (`npm test`, vitest) : compilateur d'histoires,
  interpréteur, modération texte, partage/PII, économie.
- **Tests e2e** (`npm run test:e2e`, Chromium headless, API LiberTai simulée) :
  les 48 cas du filtre d'images par zones, les scénarios du pipeline de
  sécurité (juge de vision, rhabillage, toujours-un-résultat), un parcours
  d'onboarding complet.

## Rôles

- **Routine IA** : propose des PR, ne fusionne jamais.
- **Sessions IA (Claude Code)** : travaillent sur leurs branches `claude/*`,
  livrent par PR vers la branche déployée.
- **Mainteneur humain** (aujourd'hui : le parent-dev) : seul à merger.
