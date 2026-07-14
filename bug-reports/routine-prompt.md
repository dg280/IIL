# Routine « Releveur de bugs Célestine » — déclencheur « Issue ouverte »

Crée cette routine depuis <https://claude.ai/code/routines> (**New routine**).

## Réglages du formulaire

1. **Name** : `Releveur de bugs Célestine`
2. **Repositories** : ajoute **`dg280/iil`**. ← indispensable (attache ton identité
   GitHub qui a le droit de pousser).
3. **Environment** : `Default` (réseau *Trusted* — suffit pour `npm run build`).
4. **Trigger** : onglet **« Issue ouverte »** (Issue opened), dépôt `dg280/iil`.
   - Prérequis : l'**App GitHub Claude** doit être installée sur `dg280/iil` (le
     formulaire te le propose si ce n'est pas fait).
   - **Pas de filtre** : le filtre « Labels » n'est pas accepté pour les événements
     issue (erreur à l'enregistrement). On laisse le déclencheur nu et c'est le
     prompt qui écarte les issues non pertinentes (voir l'étape 0 ci-dessous).
5. **Prompt** : colle le bloc ci-dessous.
6. **Create**.

## Prompt à coller

```
Cette session est déclenchée par une issue GitHub qui vient d'être ouverte sur dg280/iil (une remontée de bug de l'app Célestine, label from-app). Ton but : lire cette issue et la corriger.

Contexte : l'issue déclencheuse t'est fournie. Repère son numéro, son titre et son corps (le corps contient l'écran concerné, la version/build, l'univers et la description). Au besoin, utilise les outils GitHub pour relire l'issue.

Tu travailles sur le dépôt dg280/iil, branche de travail claude/otome-game-builder-hqabza. Tout le code de l'app vit sur cette branche (pas sur la branche par défaut).

Étapes :
0. GARDE-FOU : ne traite que les vraies remontées de l'app. Si l'issue n'a pas le label from-app ET que son corps ne contient pas « Célestine — remontée », alors ne fais rien du tout : n'ouvre pas la branche, ne pousse rien, termine immédiatement en disant « Ignorée : pas une remontée de l'app ».
1. Mets-toi sur la branche de travail et à jour : `git fetch origin claude/otome-game-builder-hqabza && git checkout claude/otome-game-builder-hqabza && git pull origin claude/otome-game-builder-hqabza`. En cas d'échec réseau, réessaie avec backoff (2s,4s,8s,16s).
2. Lis l'issue déclencheuse. Corrige ce qui est raisonnablement corrigeable sans refonte majeure, de façon ciblée et sûre. Lance `npm run build` pour vérifier que ça compile.
3. Commite (message clair) et `git push origin claude/otome-game-builder-hqabza` (la branche est préfixée claude/, donc le push y est autorisé). Retry backoff si réseau. Ne crée PAS de pull request.
4. Boucle : si les outils GitHub sont disponibles, ajoute un commentaire sur l'issue résumant ce qui a été fait (avec le hash du commit) puis ferme l'issue. Sinon, laisse l'issue ouverte.
5. Si la remontée est trop ambiguë ou demande une refonte importante, ne devine pas : commente l'issue avec « Reporté : nécessite décision humaine — <raison> » et laisse-la ouverte, sans changer le code.

Ne mets aucun identifiant de modèle dans les commits. Termine par un résumé bref : issue traitée, ce qui a été corrigé (ou reporté), et le hash du push.
```

## Notes

- Chaque issue ouverte = une exécution de routine (temps réel). Le filtre
  `label = from-app` évite de traiter des issues non pertinentes.
- Le dossier `bug-reports/done/` garde l'archive historique des remontées déjà
  traitées via l'ancienne file de fichiers (désormais inutilisée).
