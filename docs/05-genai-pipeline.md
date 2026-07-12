# 05 — Avatars paper-doll & pipeline GenAI

> **État d'implémentation (v0.9)** : la GenAI réelle est câblée pour les **décors de
> scène** (Gemini image) et les **clips vidéo d'ambiance** (Veo) via une clé Google AI
> Studio saisie dans l'**Espace parents** (`src/atelier/genai.ts`). Mode familial : la clé
> reste sur l'appareil, quotas journaliers fixés par le parent, coût en gemmes, style
> guide par univers injecté, prompts filtrés. Les assets vivent en IndexedDB
> (`src/atelier/assets.ts`), s'utilisent comme décors dans la Tisseuse/le player et
> s'embarquent dans l'export Ren'Py. Pour un déploiement public : déplacer ces appels
> derrière le backend décrit ci-dessous (l'interface du module ne change pas).
> Note : l'aperçu artifact de claude.ai bloque les appels externes — la GenAI fonctionne
> en local (`npm run dev`) et sur GitHub Pages.

## Le paper-doll : la fondation de la cohérence

Chaque personnage est une pile de **couches normalisées** sur un gabarit commun
(mêmes points d'ancrage tête/corps/mains pour tout le contenu, officiel ou généré) :

```
corps (teint) → visage (yeux, bouche=expression) → cheveux-arrière → tenue →
cheveux-avant → accessoires (lunettes, ruban…) 
```

- Format **SVG recolorable** (palettes de mèches/tissus swappables) ou PNG haute résolution.
- **Expressions** = jeu de couches visage (neutre, joie, gêne, colère, surprise,
  tristesse) obligatoire pour chaque personnage → le player et l'export Ren'Py
  (`show yuki gene`) fonctionnent toujours.
- **La chambre** suit le même principe : fond + emplacements (lit, bureau, mur, sol,
  fenêtre) recevant des éléments de déco.
- L'export Ren'Py **aplatit** chaque combinaison utilisée en PNG de sprite.

## L'« Atelier magique » (GenAI) : générer des éléments, jamais des personnages entiers

La GenAI ne produit pas des illustrations libres : elle produit des **couches** qui
rentrent dans le système. C'est ce qui garantit la cohérence.

### Pipeline d'une génération

1. **L'enfant décrit** : « une robe de bal bleu nuit avec des étoiles » + catégorie
   choisie (tenue / coiffure / accessoire / élément de chambre / fond de scène).
2. **Prompt contraint côté serveur** (Edge Function — la clé API ne quitte jamais le
   serveur) : description enfant (filtrée) + **style guide de l'univers** (palette,
   épaisseur de trait, niveau de détail) + gabarit de la catégorie (pose de référence
   du paper-doll, cadrage, fond transparent).
3. **Génération** avec conditionnement sur le gabarit (image de référence / ControlNet
   selon le fournisseur) pour respecter les ancres du paper-doll.
4. **Post-traitement automatique** : détourage, recadrage sur les ancres, quantification
   vers la palette de l'univers si l'écart est trop grand.
5. **Modération double** : filtre du prompt en amont (liste + classifieur adapté
   enfants) et modération de l'image en aval. En cas de doute → refus doux de Plume
   (« Oh, ma plume n'arrive pas à dessiner ça, essaie autrement ! ») — jamais de
   message d'erreur technique ni culpabilisant.
6. **Livraison** : 3 variantes proposées ; celle choisie entre dans la garde-robe
   **comme n'importe quel élément officiel** (réutilisable sur tous les personnages
   compatibles, colorable si le post-traitement a pu vectoriser les zones).

### Choix du fournisseur

Interface `ImageGenProvider` abstraite (une seule méthode `generateLayer(request)`) pour
rester agnostique. Candidats à évaluer sur : conditionnement par image de référence,
politique d'usage mineurs, coût par image, latence. La décision se prend au moment du
chantier v0.3 (roadmap), le reste du produit n'en dépend pas.

### Économie de la génération

- Chaque génération coûte des **crédits d'atelier** (achetés en gemmes virtuelles) →
  apprend à choisir ses mots, et borne le coût réel API dès la v1.
- Quota journalier dur côté serveur, par compte, quoi qu'il arrive.

## Cohérence : les trois garde-fous

1. **Le gabarit** : tout élément, généré ou non, vit sur les mêmes ancres.
2. **Le style guide par univers** : injecté dans chaque prompt, jamais modifiable par l'enfant.
3. **Le post-traitement** : ce qui ne rentre pas dans le gabarit après retraitement
   n'est pas livré (on montre 3 variantes justement pour absorber les ratés).
