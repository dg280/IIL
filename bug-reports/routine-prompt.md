# Routine « Releveur de bugs Célestine » — à créer via l'UI officielle

⚠️ **Important** : crée cette routine depuis <https://claude.ai/code/routines> (bouton
**New routine**), **pas** par automation. C'est l'étape « Select repositories » qui
attache ton identité GitHub (celle qui a le droit d'écrire) à la routine. Une routine
sans dépôt attaché peut cloner (lecture) mais **pas pousser** (erreur 403 sur
`git-receive-pack`).

## Réglages du formulaire

1. **Name** : `Releveur de bugs Célestine`
2. **Prompt** : colle le bloc ci-dessous.
3. **Repositories** : ajoute **`dg280/iil`**. ← c'est le point qui débloque le push.
4. **Environment** : `Default` (réseau *Trusted* — suffit pour `npm run build`).
5. **Trigger** : `Schedule` → `Hourly` (toutes les heures).
6. **Permissions** : notre branche `claude/otome-game-builder-hqabza` est préfixée
   `claude/`, donc le push y est autorisé **par défaut**. (Inutile d'activer
   « Allow unrestricted branch pushes ».)
7. **Create**.

Une fois créée, tu peux **supprimer** l'ancienne routine désactivée
`trig_012aVx14Juyymsriv77uaiPF` (créée par automation, sans droit de push).

## Prompt à coller

```
Tu traites les remontées de bugs de l'app Célestine. Tu travailles sur le dépôt dg280/iil, branche de travail claude/otome-game-builder-hqabza. Développe et pousse UNIQUEMENT sur cette branche (elle est préfixée claude/, donc le push y est autorisé), jamais sur la branche par défaut.

Étapes :
1. Mets-toi sur la branche et à jour : `git fetch origin claude/otome-game-builder-hqabza && git checkout claude/otome-game-builder-hqabza && git pull origin claude/otome-game-builder-hqabza`. En cas d'échec réseau, réessaie avec backoff (2s,4s,8s,16s).
2. Liste les remontées non traitées : les fichiers dans `bug-reports/inbox/*.md` (ignore `.gitkeep`). Lis `bug-reports/README.md` pour la convention. S'il n'y a aucun fichier, ne fais rien, ne pousse rien, et termine en disant « Aucune remontée en attente ».
3. Pour chaque remontée : lis le titre, le contexte (écran, build, univers) et le corps. Corrige ce qui est raisonnablement corrigeable sans refonte majeure. Garde les corrections ciblées et sûres. Lance `npm run build` pour vérifier que ça compile.
4. Déplace chaque fichier traité vers `bug-reports/done/` avec `git mv bug-reports/inbox/<id>.md bug-reports/done/<id>.md`, et ajoute à la fin du fichier une courte note « Traité le <date> : <ce qui a été fait, ou pourquoi c'est reporté> ». Ne retraite jamais un fichier déjà dans done/.
5. Commite (messages clairs) puis `git push origin claude/otome-game-builder-hqabza` (retry backoff si réseau).
6. Si une remontée est trop ambiguë ou demande une refonte importante, ne devine pas : déplace-la quand même dans done/ avec une note « Reporté : nécessite décision humaine — <raison> », sans changer le code pour celle-ci.
7. Ne crée PAS de pull request.

Termine par un résumé bref : nombre de remontées traitées, corrigées, reportées, et le hash du push.
```
