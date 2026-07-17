# 10 — Backend Supabase UE (M1)

Le backend produit décrit par les docs 02/05/07 : comptes famille, consentement
parental, quotas GenAI serveur, publications par lien. **Région UE obligatoire.**

## Ce que contient le repo

- `supabase/migrations/0001_init.sql` — schéma : `child_profiles` (pseudo, PAS
  de prénom), `parental_consents` (horodaté, versionné), `genai_usage` +
  `genai_try_consume()` (quota atomique), `published_stories` (snapshot + slug
  non devinable), `story_reactions`/`story_endings` (stickers whitelist, stats
  anonymes), RLS « le parent ne voit que sa famille », lecture publique
  uniquement par `get_published_story(slug)`.
- `supabase/functions/genai-proxy/` — la GenAI côté serveur : clé LiberTai en
  secret, prompt construit serveur à partir de champs structurés, modération
  rejouée (texte + `analyzeRgba` via imagescript + juge de vision avec
  preuve-de-vue + rhabillage), quota par profil. Le pipeline est LE MÊME que
  le client : les shims `_shared/*` ré-exportent `src/atelier/{imagecore,
  promptcore,moderation}.ts` (purs) — une seule source de vérité.

## Mise en route (une fois, ~15 min — compte Supabase requis)

```bash
npm i -g supabase                # CLI
supabase login
supabase projects create celestine --region eu-central-1   # ⚠️ UE uniquement
supabase link --project-ref <ref-du-projet>
supabase db push                 # applique les migrations
supabase secrets set LIBERTAI_API_KEY=<clé LiberTai du foyer>
supabase functions deploy genai-proxy
```

Le déploiement de la fonction typechecke le code Deno (aucun runtime Deno
n'est requis en local). Auth : activer **Email (magic link)** dans
Authentication → Providers, et désactiver les signups publics quand on sort
du cercle privé (invitations).

## Ce que ça change (et ne change pas)

- La clé IA **quitte l'appareil** : l'Espace parents configurera l'URL du
  projet + la session parent au lieu d'une clé LiberTai (M1-2, côté client).
- Les quotas deviennent **réels** (serveur, par profil, fixés par le parent).
- La modération devient **non contournable** (rejouée serveur).
- Le mode « familial » actuel (clé sur l'appareil) reste disponible tant que
  le backend n'est pas configuré — bascule douce, pas de rupture.

## Suites (jalons)

- M1-2 : provider `celestine` côté client (appel du proxy, session parent).
- M1-3 : sync/sauvegarde des créations (histoires, roster, assets).
- M2 : publication par lien (le schéma est déjà prêt) + portail parental.
