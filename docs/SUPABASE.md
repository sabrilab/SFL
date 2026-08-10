# Supabase — état du branchement

## Fait

- **Client** : `src/lib/supabase.ts` — URL et clé publishable embarquées
  (publiques par conception, la sécurité est dans les règles RLS).
  Surclassables par `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  dans Vercel si besoin.
- **Connexion** : `signIn` vérifie d'abord côté serveur
  (`auth.signInWithPassword`), et retombe sur la vérification locale tant que
  les comptes serveur n'existent pas (`ENFORCE_SERVER_AUTH = false` dans
  `src/lib/sfl/auth/session.ts` — à passer à true une fois l'installation
  terminée).
- **Présence** : `src/hooks/use-presence.ts` — partagée et temps réel quand une
  convocation est publiée en base, locale sinon. Le panneau affiche « En
  direct » quand la liste est commune.
- **Schéma** : `supabase/schema.sql` (copié dans `public/supabase-schema.sql`
  au build pour le bouton « Copier » de la page d'installation).
- **Installation guidée** : `/admin/setup` (lien dans Réglages → zone admin).

## Ce que l'admin fait, une seule fois (page /admin/setup)

1. Restore project + désactiver « Confirm email »
2. Coller le script SQL dans l'éditeur → Run
3. Coller le tableau de docs/COMPTES.md → « Créer les comptes »
4. Rejouer la dernière ligne SQL (rôle admin)
5. Se reconnecter, publier la convocation depuis le panneau Ma présence
6. Désactiver « Allow new users to sign up »

## Ensuite (moi)

- Passer `ENFORCE_SERVER_AUTH` à true (le serveur devient l'unique juge).
- Étapes suivantes : photos de profil (Storage), saison complète, chat.

## Sécurité

- Jamais la clé `service_role` dans l'app ni dans la conversation.
- `is_admin` ne vient jamais des métadonnées utilisateur (modifiables) :
  posé en SQL, colonne protégée par grant de colonnes.
- Inscriptions ouvertes UNIQUEMENT le temps de l'étape 3, refermées en 6.
