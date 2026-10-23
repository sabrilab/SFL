# Supabase — état du branchement

## Fait

- **Client** : `src/lib/supabase.ts` — URL et clé publishable embarquées
  (publiques par conception, la sécurité est dans les règles RLS).
  Surclassables par `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  dans Vercel si besoin.
- **Verrou de travail** : un poste de dev ou un test de bout en bout parle
  donc à la base de la ligue. `NEXT_PUBLIC_SFL_LECTURE_SEULE=1` (dans
  `.env.local`) coupe la publication — la lecture et le temps réel restent —
  et l'admin voit le motif à la place du bouton « Publier ».
- **Connexion** : `signIn` vérifie côté serveur (`auth.signInWithPassword`),
  et seulement là. Le repli local (empreintes des mots de passe d'origine
  embarquées dans l'app) a disparu le 22/10/2026 : voir « Mots de passe ».
- **Présence** : `src/hooks/use-presence.ts` — partagée et temps réel quand une
  convocation est publiée en base, locale sinon. Le panneau affiche « En
  direct » quand la liste est commune.
- **Schéma** : `supabase/schema.sql`. Il n'est plus copié dans `public/` :
  le bouton « Copier » de la page d'installation le demande à `/api/migrate`,
  avec la session de l'admin.
- **Installation** : `/admin/setup` (Réglages → zone admin) ne fait plus que
  vérifier la base et la mettre à jour. L'installation d'origine (création
  des comptes avec leurs mots de passe d'origine, `/api/setup`) a disparu le
  22/10/2026 : la route n'avait aucun contrôle d'accès.

## Mots de passe (depuis le 22/10/2026)

- **Aucun mot de passe dans le dépôt ni dans l'app.** `docs/COMPTES.md`, la
  graine serveur et les empreintes de `accounts.ts` ont disparu : le dépôt
  était public et les contenait. Ils restent lisibles dans l'historique git :
  c'est pourquoi chaque compte né d'un mot de passe d'origine doit en
  choisir un nouveau.
- **Table `mot_de_passe_a_changer`** : une ligne = un compte qui doit choisir
  son mot de passe. L'app le retient sur l'écran « Choisis le tien » tant
  qu'elle existe ; elle disparaît d'elle-même quand le mot de passe change
  (trigger `on_auth_password_changed` sur `auth.users`). Remplie une fois par
  la migration (tous les comptes sauf les inscriptions libres), puis par les
  routes admin.
- **Mot de passe provisoire** : `/api/comptes/creer` (compte neuf) et
  `/api/comptes/reinitialiser` (mot de passe perdu) en tirent un au hasard,
  le rendent une fois à l'admin et marquent le compte « à changer ». Poser
  un mot de passe ferme les sessions ouvertes du compte.
- **Admin → Les accès** montre les identifiants et qui doit encore choisir
  son mot de passe, jamais un mot de passe.

## Sécurité

- Jamais la clé `service_role` dans l'app ni dans la conversation.
- `is_admin` ne vient jamais des métadonnées utilisateur (modifiables) :
  posé en SQL, colonne protégée par grant de colonnes.
- « Allow new users to sign up » : FERMÉ dans Supabase. Toutes les créations
  de compte passent par les routes serveur à clé secrète (`/api/inscription`,
  `/api/inscription/sociale`, `/api/comptes/creer`).

## Google / Apple (connexion sans mot de passe)

Le code est prêt (boutons sur l'écran de connexion, liaison dans Réglages,
capture d'email automatique). Pour l'activer :

1. **Rejouer le script SQL** (il ajoute `profiles.contact_email` et la table
   `activity`) — il est réexécutable sans danger.
2. Dashboard → **Authentication → Sign In / Providers** :
   - activer **Google** : il faut créer des identifiants OAuth dans la
     [console Google Cloud](https://console.cloud.google.com/apis/credentials)
     (client ID + secret) avec l'URL de redirection affichée par Supabase
     (`https://tpfusliksgxcvfrodchk.supabase.co/auth/v1/callback`) ;
   - **Apple** : nécessite un compte Apple Developer payant (99 $/an) — à
     décider plus tard, le bouton affiche un message clair en attendant.
3. Authentication → **Settings** : activer **Allow manual linking** (c'est ce
   qui permet à un joueur déjà connecté de LIER son Google à son compte).
4. Authentication → **URL Configuration** : ajouter
   `https://sfl-eight.vercel.app` aux Redirect URLs.

Parcours joueur : il se connecte une première fois avec identifiant + mot de
passe → laisse son email (invite en tête du fil) → lie Google dans Réglages →
les fois suivantes, bouton Google direct. Les inscriptions restant fermées,
un Google inconnu de la ligue ne peut PAS créer de compte.

## Activité & rétention

Table `activity` (login / open / presence), lisible par l'admin seulement.
Tableau de bord : Réglages → Activité & rétention — actifs du jour / 7 j /
30 j, courbe 14 jours, détail par joueur (dernière venue, jours actifs),
emails collectés.

## Migrations automatiques (plus jamais de copier-coller SQL)

Le schéma s'applique tout seul, à deux moments :
- **à chaque déploiement** (scripts/prebuild.ts, avant le build Vercel) ;
- **à l'ouverture de la page /admin/setup** (route /api/migrate, admin seul).

Dans les deux cas : empreinte du script, signée par la chaîne de connexion
(HMAC-SHA-256), mémorisée dans `schema_migrations` — si le schéma n'a pas
changé, rien n'est exécuté. Le registre est fermé à l'API publique (RLS, aucun
droit pour anon ni authenticated) : personne ne peut y inscrire d'avance
l'empreinte d'une migration pour la faire sauter. La route ne peut appliquer
QUE le schéma figé au build, jamais du SQL arbitraire.

### Activer (une seule fois)

**Voie la plus simple : l'intégration Vercel × Supabase** (Vercel →
Integrations → Supabase → connecter le projet). Elle injecte
automatiquement `POSTGRES_URL` et ses déclinaisons — la migration les
reconnaît sans autre réglage. Les étapes ci-dessous ne servent que si tu
préfères poser la variable à la main.

1. Tableau de bord Supabase → bouton **Connect** (en haut) → onglet
   **Transaction pooler** → copier l'URI (elle commence par
   `postgresql://postgres.tpfusliksgxcvfrodchk:...@aws-...pooler.supabase.com:6543/postgres`)
   et remplacer `[YOUR-PASSWORD]` par le mot de passe de la base
   (Settings → Database → Reset database password si tu ne l'as plus).
2. Vercel → ton projet → **Settings → Environment Variables** → ajouter
   `SUPABASE_DB_URL` = cette URI, sur les trois environnements.
3. Redéployer (ou attendre le prochain push).

⚠️ **C'est un secret au même titre que la clé service_role** : il ne va QUE
dans Vercel. Jamais dans le code, jamais dans une conversation.

Sans cette variable, rien ne casse : la page d'installation garde le bouton
« Copier le script SQL » en repli.

## Inscription autonome (/inscription)

Un joueur crée son compte lui-même : prénom, nom, pseudo (= identifiant),
email, naissance, gabarit (taille, poids, pointure, maillot), poste, pied
fort, photo de carte, puis les quatre photos en pied imposées (face, droite,
gauche, dos) pour le futur personnage de référence des skins.

- **Création côté serveur** : `/api/inscription` utilise la clé secrète
  (`SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`, déjà dans Vercel en
  production). « Allow new users to sign up » reste donc FERMÉ dans Supabase.
  Sans la clé (préversions), la page dit que les inscriptions ne sont pas
  ouvertes.
- **Compte en attente** : `profiles.valide` naît à false. La base ne lui ouvre
  rien de la ligue (`est_membre()` dans les règles de lecture) ; l'app lui
  montre sa carte et « Tu es sur la liste. ». Les comptes existants sont
  validés d'office ; ceux que l'admin crée (`/api/comptes/creer`) aussi.
- **Validation** : Admin → Vue d'ensemble → Inscriptions → « Accepter »
  (`valider_inscription`) ; le joueur entre dans l'effectif avec son poste.
- **Données privées** : table `fiches` (joueur + admin seulement) et bucket
  privé `references` (`<uuid>/<angle>.jpg`, joueur + admin).
