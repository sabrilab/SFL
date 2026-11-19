# Bola 27 : le jeu seul (bola27.vercel.app)

Demande de Sabri du 18/11/2026 (bola-app#33) : « Est-ce que tu peux aussi publier l'adresse du jeu sur Vercel ? Bola27 ».
Une adresse publique du **jeu seul**, qu'on ouvre sans compte Vercel ni compte Bola, pour le montrer. Ce dossier en
est l'entrée : un site statique, **sans Next, sans Supabase, sans connexion, sans le reste de l'app, sans données ni photo
d'un vrai joueur**. Il s'ouvre directement sur l'écran du jeu (« Jouer », et l'écran Manettes dès qu'une manette est vue).

État au 18/11 : en ligne sur **https://bola27.vercel.app**, projet Vercel `bola27` créé par l'agent de production après
le feu vert de l'utilisateur donné dans sa session (« Ok pour bola 27 », 18/11, 21:55 UTC).

## Où vit le code

| Fichier | Rôle |
|---|---|
| `entree.tsx` | Le point d'entrée : monte **la vraie page du jeu**, `src/app/jouer/page.tsx`, sans la recopier. |
| `remplacants/` | Ce que la page emprunte à l'app, remplacé sans données : joueur connecté (nom vide), photos (aucune), admin (personne), bouton de retour vers la Map (absent), `next/link` (un lien simple). |
| `style.css` | La feuille de l'app (`src/app/globals.css`) et les polices du jeu. |
| `construire.mjs` | La construction (esbuild, Tailwind 4, postcss : déjà dans `package-lock.json`, aucune dépendance de plus). |
| `servir.mjs` | Un serveur de fichiers local, sans dépendance, aux mêmes règles que Vercel. |
| `verifier.mjs` | La vérification dans Chromium (Playwright du dépôt) : portrait 390×844 et paysage 844×390, match lancé, toutes les requêtes relevées. |
| `vercel.json` | Les réglages du futur projet Vercel `bola27` (lu seulement si sa racine est ce dossier ; **pas** de `vercel.json` à la racine du dépôt). |

Le jeu lui-même reste où il est : `src/lib/jeu/` (le moteur), `src/app/jouer/` (la page, l'écran Manettes, le schéma des
touches) et `public/jeu/` (animations `.pak` brouillées, personnages, plateau). Chaque passe sur le jeu arrive donc ici
sans rien toucher : on reconstruit.

## Construire

```bash
npm ci                                        # si node_modules manque (Node ≥ 22)
node tools/bola27/construire.mjs              # → out/bola27/ (out/ est ignoré par git et par eslint)
NODE_USE_ENV_PROXY=1 node tools/bola27/construire.mjs   # derrière un mandataire HTTPS (cloud de l'agent)
```

**Jamais `npm run build`** pour ce site : c'est la construction de l'app, et son `prebuild` applique `supabase/schema.sql`
à la base de production.

Ce que produit la construction (18/11, commit `c84cba4`) : environ **9,1 Mo** en 31 fichiers, dont 7,8 Mo de fichiers du
jeu (`public/jeu/`), 1,2 Mo de JavaScript (la page 247 ko, puis le moteur et three chargés à la demande), 72 ko de CSS
et Inter (48 ko).

- `index.html` et `jouer/index.html` (la même page), `favicon.ico`, `version.json` (le commit construit) ;
- `bola27/` : le code et la feuille de style, à empreinte dans le nom (mis en cache un an), et Inter ;
- `jeu/` : `public/jeu/` tel quel.

Ce que la construction garantit, sinon elle s'arrête (code 1) :

- **la garde** : `next/*`, `@supabase/*`, `pg`, `server-only` et tout fichier de `src/` hors de `src/app/jouer/` (sauf le
  studio), `src/lib/jeu/` et `src/lib/utils.ts` sont refusés, avec le nom du fichier qui les importe ;
- **les contrôles de sortie** : ni « supabase », ni `process.env`, ni appel `/api/`, ni `getbola.app` dans ce qui est servi.

Inter est récupérée chez Google Fonts **au moment de la construction**, comme le fait `next/font` pour l'app, et servie
par le site lui-même : aucune requête vers Google chez le visiteur. Si elle ne vient pas, la construction le dit et la
police du système la remplace. Anton (le score, « BUT ») est le fichier du jeu, `public/jeu/plateau/anton-latin.woff2`.

### Quand une passe sur le jeu change la page

Si la page se met à importer autre chose de l'app, la construction s'arrête et nomme le fichier. Deux réponses :

- le module touche un compte, des données ou une photo : lui écrire un remplaçant sans données dans `remplacants/` et
  l'ajouter à `REMPLACANTS` (`construire.mjs`) ;
- c'est un composant pur (un bouton, une icône) : l'ajouter à `PERMIS`.

## Essayer en local

```bash
node tools/bola27/servir.mjs --port 3957 &    # http://127.0.0.1:3957/ et /jouer
node tools/bola27/verifier.mjs --url http://127.0.0.1:3957 --captures /tmp/bola27
```

`verifier.mjs` ouvre la page en portrait puis en paysage, attend « Jouer », lance le match et attend que le chrono
tourne, puis prend les captures (`01-bola27-portrait.png`, `02-bola27-paysage.png`, `03-bola27-ouverture.png`). Il
échoue si une seule requête sort de l'adresse servie, vise Supabase ou `/api/`, si un fichier manque, ou si la page a une
erreur. Le relevé des requêtes est écrit à côté (`reseau-portrait.json`, `reseau-paysage.json`). Sans GPU, le rendu est
logiciel : compter quelques minutes. Si le Chromium attendu par Playwright manque, il prend celui déjà installé
(`PLAYWRIGHT_BROWSERS_PATH`) ou celui de `--chromium <chemin>` ; rien n'est téléchargé.

## Le projet Vercel « bola27 »

Créé le 18/11/2026 dans l'équipe de `sfl`, à part : **aucun réglage du projet `sfl` n'a été touché**.

| Réglage | Valeur |
|---|---|
| Nom du projet | `bola27` (`prj_W1sBpaNbUQeVnKoJIZqugxImwC3P`), d'où `bola27.vercel.app` |
| Dépôt Git | **aucun lien automatique** : le projet ne construit que quand on le lui demande (voir « Redéployer »), donc rien ne se déclenche quand on pousse une autre branche de `sabrilab/SFL` |
| Source d'un déploiement | une branche et un commit de `sabrilab/SFL`, donnés à chaque déploiement |
| Root Directory | **`tools/bola27`** |
| Fichiers hors du Root Directory | **inclus** (indispensable : la page et le moteur sont dans `src/`) |
| Framework Preset | Other |
| Node | 22.x |
| Install Command | `cd ../.. && npm ci` (aussi dans `vercel.json`) |
| Build Command | `node construire.mjs --sortie sortie` (aussi dans `vercel.json`) |
| Output Directory | `sortie` (aussi dans `vercel.json`) |
| Variables d'environnement | **aucune** (surtout pas celles de `sfl` : ni Supabase, ni base) |
| Deployment Protection | **désactivée sur ce seul projet** (Vercel Authentication et mot de passe : off), pour que le lien s'ouvre chez n'importe qui |

Pourquoi la racine du projet est `tools/bola27` et non celle du dépôt : à la racine, Vercel lirait le `vercel.json` de
l'app (ses tâches planifiées, qui viseraient `/api/…` sur bola27), et un projet « Other » sans commande lancerait
`npm run build`, donc le `prebuild` qui écrit dans la base de production. Ici, `tools/bola27/vercel.json` fixe tout,
dans le code. (Le `vercel.json` n'a pas d'`ignoreCommand` : Vercel refuse plus de 256 caractères, et sans lien Git
il ne servirait à rien.)

## Redéployer (à chaque rendu du jeu, bola-app#32 et suivants)

1. En local, sur la branche du rendu : `node tools/bola27/construire.mjs`, `servir.mjs`, `verifier.mjs` : vert.
2. Pousser la branche sur `sabrilab/SFL`.
3. Créer un déploiement de production du projet `bola27` depuis cette branche et ce commit : outil Vercel
   `create_deployment` avec `project: prj_W1sBpaNbUQeVnKoJIZqugxImwC3P`, `target: production` et
   `gitSource: { type: github, org: sabrilab, repo: SFL, ref: <branche>, sha: <commit> }`, ou, avec la CLI connectée,
   `vercel deploy --prod` depuis `tools/bola27` lié au projet `bola27`.
4. Vérifier l'adresse en ligne :
   ```bash
   curl -s https://bola27.vercel.app/version.json     # le commit attendu
   node tools/bola27/verifier.mjs --url https://bola27.vercel.app --captures /tmp/bola27-en-ligne
   ```
   puis une capture depuis une fenêtre non connectée, en 390×844 et en paysage, pour le compte rendu.

## Limites

- Le cloud de l'agent n'a pas de GPU : la fluidité, les images par seconde et le toucher réel sont à juger sur un vrai
  téléphone, sur l'adresse en ligne.
- Les manettes : le site les lit comme l'app (Gamepad API) ; non essayé avec une vraie manette dans le cloud.
- Le jeu ne garde rien et n'envoie rien : pas de score enregistré, pas de compte.
