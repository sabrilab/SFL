# Brancher Supabase

## Ce dont j'ai besoin de toi

Crée le projet sur [supabase.com](https://supabase.com) (plan gratuit suffisant),
puis donne-moi **deux valeurs**, prises dans *Project Settings → API* :

| Valeur | Où | Sensible ? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Non — publique par nature |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API keys → `anon` `public` | Non — protégée par les règles RLS |

**Ne me donne jamais la clé `service_role`.** Elle contourne toutes les règles de
sécurité ; elle n'a rien à faire dans une application web.

Ajoute-les aussi dans Vercel (*Settings → Environment Variables*), sur les trois
environnements, sinon la version en ligne ne verra pas la base.

## Ce que je fais ensuite

1. J'exécute `supabase/schema.sql` (tables `profiles`, `convocations`,
   `presence`, règles RLS, temps réel).
2. Je crée les 71 comptes depuis `docs/COMPTES.md` (email technique
   `identifiant@sfl.local` + mot de passe par défaut), et leur profil associé.
3. Je remplace le contenu de `src/lib/sfl/presence.ts` par les appels Supabase.
   **Aucun écran ne change** : le service expose déjà `listPresence`,
   `setPresence` et le drapeau `PRESENCE_IS_SHARED`.
4. Je remplace `signIn` / `signOut` / `getSession` de
   `src/lib/sfl/auth/session.ts` par Supabase Auth. Les mots de passe cessent
   alors d'être vérifiés sur l'appareil : c'est le serveur qui tranche.

## Ce que ça change concrètement

| Aujourd'hui | Avec Supabase |
| --- | --- |
| Chacun voit ses propres réponses | Toute la ligue voit la même liste |
| L'admin relance à la main | L'admin voit en direct qui n'a pas répondu |
| Le mot de passe est vérifié sur le téléphone | Vérifié par le serveur |
| Les données vivent dans le navigateur | Les données survivent au changement de téléphone |

## Ordre de bascule conseillé

1. **Présence** (le besoin urgent) — tables + auth, une soirée de travail.
2. Photos de profil (Supabase Storage).
3. Saison complète (journées, lignes de match) : la saisie admin y passe aussi.
4. Chat du vestiaire, votes, commentaires.
