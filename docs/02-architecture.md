# 02 — Architecture technique

## Décision clé : player web natif + export Ren'Py

Ren'Py est un moteur Python desktop ; l'embarquer en WebAssembly dans une PWA est lourd
(~60 Mo) et incompatible avec un builder temps réel. On adopte donc :

- **Format d'histoire pivot** : un JSON (« Story AST ») dont les concepts sont
  **isomorphes à Ren'Py** — labels, `menu` (choix), variables, conditions, `jump`,
  personnages, expressions, scènes, musique.
- **Player web natif** : petit moteur de visual novel en TypeScript qui interprète le
  Story AST dans le navigateur. Léger, instantané, mobile.
- **Transpileur Ren'Py** : convertit le Story AST en projet Ren'Py complet
  (`script.rpy`, `characters.rpy`, sprites PNG aplatis depuis le paper-doll, `gui/`).
  Téléchargeable en `.zip`, jouable dans le SDK Ren'Py sur PC.

Ce pivot garantit qu'on ne construit **jamais** une histoire inexprimable en Ren'Py.

## Story AST (esquisse)

```jsonc
{
  "meta": { "title": "Le secret du festival", "universe": "sakura-academy", "author": "…" },
  "characters": {
    "mc":   { "name": "?", "isPlayer": true, "avatarRef": "avatar:self" },
    "yuki": { "name": "Yuki", "avatarRef": "npc:af1c…", "color": "#7c9cf5" }
  },
  "variables": { "affinity_yuki": 0, "a_vu_le_mot": false },
  "labels": {
    "start": [
      { "op": "scene", "bg": "cour_ecole", "music": "matin_doux" },
      { "op": "show", "who": "yuki", "expr": "timide", "at": "center" },
      { "op": "say", "who": "yuki", "text": "Tu… tu as trouvé mon mot ?" },
      { "op": "menu", "choices": [
        { "text": "Oui, et je l'ai lu.", "effects": [{ "set": "a_vu_le_mot", "to": true },
                                                     { "add": "affinity_yuki", "n": -1 }],
          "jump": "gene" },
        { "text": "Un mot ? Quel mot ?", "effects": [{ "add": "affinity_yuki", "n": 1 }],
          "jump": "soulagee" }
      ]}
    ],
    "gene": [ { "op": "if", "cond": "affinity_yuki >= 2", "then": "pardon", "else": "froid" } ]
  }
}
```

Correspondance Ren'Py directe : `labels` → `label`, `menu.choices` → `menu:` avec
`$ affinity_yuki += 1` et `jump`, `if` → `if/else`, `say` → `yuki timide "…"`.

## Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Front | **React + TypeScript + Vite** | Écosystème, vitesse d'itération |
| Rendu scènes/avatars | **DOM/CSS + SVG en couches** (PixiJS seulement si besoin) | Le paper-doll en SVG = recolorable, léger, net à toute taille |
| Arbre du builder | **React Flow** (ou équivalent) | Graphe de nœuds éprouvé, pan/zoom, minimap |
| PWA | Service worker (Workbox), manifest, **IndexedDB** (Dexie) | Installable, hors-ligne complet en création et en jeu |
| Backend (partage) | **Supabase** (Postgres + Storage + Edge Functions) | Auth simple, liens signés, rapide à monter ; remplaçable |
| GenAI | Edge Function proxy → API d'images (voir doc 05) | Jamais de clé API côté client ; modération centralisée |
| Export Ren'Py | Transpileur TS pur (tourne dans le navigateur) | Zip généré côté client, aucun serveur requis |

## Modèle de données de partage (v1)

- Une histoire publiée = **snapshot immuable** (Story AST + assets référencés) stocké
  côté serveur, adressé par un **ID non devinable** (lien non listé).
- Le player public charge le snapshot en lecture seule ; il enregistre uniquement des
  **statistiques anonymes de fins atteintes** et des **réactions stickers**.
- Pas de compte requis pour jouer ; compte (pseudo + code parent) requis pour publier.

## Hors-ligne

Création et jeu 100 % hors-ligne (IndexedDB). La publication, les réactions et la GenAI
nécessitent le réseau ; l'UI le dit gentiment (« L'atelier magique a besoin d'internet »).
