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

Tu travailles sur le dépôt dg280/iil. La branche de référence du code est claude/otome-game-builder-hqabza (pas la branche par défaut). RÈGLE ABSOLUE : tu ne pousses JAMAIS directement sur claude/otome-game-builder-hqabza — c'est la branche déployée chez une enfant ; tout changement passe par une pull request revue par un humain.

Étapes :
0. GARDE-FOU : ne traite que les vraies remontées de l'app. Si l'issue n'a pas le label from-app ET que son corps ne contient pas « Célestine — remontée », alors ne fais rien du tout : n'ouvre pas de branche, ne pousse rien, termine immédiatement en disant « Ignorée : pas une remontée de l'app ».
1. Pars de la branche de référence à jour et crée une branche de travail dédiée : `git fetch origin claude/otome-game-builder-hqabza && git checkout -b routine/issue-<numéro> origin/claude/otome-game-builder-hqabza`. En cas d'échec réseau, réessaie avec backoff (2s,4s,8s,16s).
2. Lis l'issue déclencheuse. Corrige ce qui est raisonnablement corrigeable sans refonte majeure, de façon ciblée et sûre. Lance `npm run build` (et `npm test` s'il existe) pour vérifier que tout passe.
3. Commite (message clair) et `git push -u origin routine/issue-<numéro>`. Retry backoff si réseau.
4. CRÉE UNE PULL REQUEST de routine/issue-<numéro> vers claude/otome-game-builder-hqabza (outils GitHub) : titre = celui de l'issue, corps = ce qui a été changé + comment le vérifier + « Fixes #<numéro> ». Ne fusionne PAS la PR toi-même : la revue humaine et la CI s'en chargent.
5. Boucle : ajoute un commentaire sur l'issue avec le lien de la PR. Ne ferme PAS l'issue (le « Fixes #n » la fermera au merge).
6. Si la remontée est trop ambiguë ou demande une refonte importante, ne devine pas : commente l'issue avec « Reporté : nécessite décision humaine — <raison> » et laisse-la ouverte, sans changer le code.

Ne mets aucun identifiant de modèle dans les commits. Termine par un résumé bref : issue traitée, ce qui a été proposé (ou reporté), et le lien de la PR.
```

## Notes

- Chaque issue ouverte = une exécution de routine (temps réel). Le filtre
  `label = from-app` évite de traiter des issues non pertinentes.
- Le dossier `bug-reports/done/` garde l'archive historique des remontées déjà
  traitées via l'ancienne file de fichiers (désormais inutilisée).
