# 07 — Sécurité & enfants

Public cible mineur (~11 ans) : la sécurité est une contrainte de conception, pas une
couche ajoutée.

## Communication : jamais de texte libre entre utilisateurs

- Les joueuses réagissent aux histoires **uniquement par stickers prédéfinis**
  (💖 😂 😱 🌟 « J'ai eu la fin secrète ! »). Pas de commentaires, pas de chat, pas de DM.
- Les pseudos passent un filtre (pas de noms réels suggérés, pas d'insultes).
- Le village social v2 gardera cette règle : les avatars interagissent par animations et
  stickers, pas par texte libre.

## Partage sûr par défaut

- Lien **non listé et non devinable** ; aucune galerie publique en v1.
- Avant publication, rappel illustré par Plume : « Pas de vrai nom de famille, d'école,
  d'adresse ou de numéro dans ton histoire ! » + scan simple du texte (motifs de
  téléphone, adresse, email) qui bloque avec explication douce.
- Révocation en un clic : dépublier tue le lien immédiatement.
- Les histoires jouées par les invitées ne collectent que des stats anonymes (fins atteintes).

## GenAI

- Modération amont (prompt) et aval (image), calibrée « adapté aux enfants » (doc 05).
- Aucune photo personnelle en entrée de génération (pas d'upload d'images en v1 — les
  avatars « à la Tomodachi » se font au paper-doll, pas par photo).
- Quotas serveur stricts.

## Données & conformité (RGPD-enfants / COPPA-like)

- **Minimisation** : pseudo + code parental ; pas d'email d'enfant, pas de date de
  naissance précise, pas de téléphone.
- **Consentement parental vérifiable** à la création du compte (email du parent —
  ici `dg@xinus.net` pour le premier compte 😉) ; le parent peut exporter/supprimer
  toutes les données depuis le portail parental.
- Données hébergées en UE (région Supabase UE).
- Pas de trackers tiers, analytics minimalistes et anonymes (self-hosted ou agrégés).

## Portail parental

- Voir les histoires publiées et leurs liens ; dépublier.
- Activer/désactiver : partage, GenAI, (plus tard) achats.
- Fixer le quota GenAI journalier.
- Supprimer le compte et toutes les données.

## Bien-être

- Pas de notifications pressantes ; la streak « se rendort » sans punition.
- Contenu des univers : romance douce et amitié, adapté 10-14 ans ; les templates ne
  proposent jamais de situations inappropriées, la modération GenAI verrouille le reste.
