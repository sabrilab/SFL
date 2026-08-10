# SFL V2 — Document de référence

> **À quoi sert ce document.** Il capture l'intégralité de la refonte V2 : la cible
> produit, les règles de calcul, les bugs vérifiés, le plan de travail et les
> décisions déjà prises. Il est écrit pour qu'on puisse le relire à froid, dans
> plusieurs semaines ou dans une nouvelle session, et reprendre le chantier sans
> rien avoir à redécouvrir.
>
> **Statut : spécification. Rien de ce document n'est encore implémenté**, à
> l'exception de ce qui est marqué ✅.
>
> Dernière mise à jour : 28 juillet 2026 — après saisie de la J6.

---

## 1. Le projet en une page

**SFL — Sunday Five League.** PWA d'une ligue amateur de foot à 5, française,
~59 joueurs au roster, un match le dimanche. Chaque joueur a une carte façon
FIFA avec 6 stats et un OVR, gagne des points Pépite (PP) au classement
« Pépite d'Or », et peut recevoir des cartes Boost (MVP / Impact / Défensive).

**L'ambition V2** : passer d'un tableau de stats à un réseau social de ligue.
L'objectif déclaré est de **remplacer Snapchat** comme lieu de vie du groupe —
donc de gagner la bataille de l'attention et de la rétention, pas seulement
d'afficher de jolies cartes.

### Stack technique

| | |
|---|---|
| Framework | Next.js **16** (App Router, Turbopack) |
| UI | Tailwind CSS v4, shadcn/ui basé sur **`@base-ui/react`** (⚠️ pas Radix) |
| 3D | `three` + `@react-three/fiber` (cartes, avatar) |
| Animation | `motion` (framer-motion), GSAP |
| PWA | `app/manifest.ts`, service worker maison (`public/sw.js`) |
| Données | **100 % `localStorage`** aujourd'hui — cible : Supabase |
| Déploiement | Vercel, projet `sfl`, branche de prod `claude/sfl-pwa-nextjs-gdmqnx` |

> ⚠️ **Next.js 16 diffère de la mémoire des modèles.** Lire
> `node_modules/next/dist/docs/` avant d'écrire du code. Exemple concret déjà
> relevé : `middleware.ts` s'appelle désormais **`proxy.ts`**.

### Architecture des données (le point fort à préserver)

Tout est **dérivé**, rien n'est stocké en double :

```
saisie/types.ts    Saison = { journees, roster, entries, convocations }   ← données brutes
saisie/store.ts    interface de stockage (localStorage aujourd'hui)
saisie/engine.ts   deriveSeason() — PURE : classements, journées, cartes boost, alertes
engine.ts          ovr(), rareStats(), rankPlayers(), EvoDay
```

`deriveSeason()` est une fonction pure sans dépendance au stockage. **C'est le
meilleur actif du repo. Toute la V2 doit préserver cette propriété.**

---

## 2. La cible : 3 sections

On passe de 5 onglets (Accueil, Stats, Arène, Collection, Ma carte) à **3
sections**.

| Section | Contenu |
|---|---|
| **Feed** | Récap de journée modulaire, ouverture de journée animée + vote, convocations, duels, vidéos, tableaux et classements |
| **Discussion** | Canaux type Discord : privé, groupe, équipe, ligue générale |
| **Profil** | Sa carte, collection/inventaire, badges, matchs, vidéos, profils publics |

**Décidé :** `/avatar` (éditeur 3D) et `/duel` (Arène) sont **conservés**.
L'avatar 3D n'affiche pas encore de visage et il n'y a pas de photos de
joueurs — gelé, à reprendre plus tard.

> ⚠️ **Attention piège identifié par le jury d'experts** : réduire la barre de
> navigation ne réduit pas l'application. Si `/duel`, `/collection`, `/avatar`,
> `/reglages` deviennent des routes orphelines et que le Profil devient un
> fourre-tout, on n'a rien simplifié. Chaque route existante doit avoir une
> place explicite dans l'une des 3 sections, ou être supprimée.

---

## 3. Le Feed modulaire — alternance des formats

Principe directeur : **au swipe, on ne doit jamais tomber deux fois de suite sur
le même type de module.** L'alternance est le mécanisme central de rétention du
feed.

Types de modules :

1. **Information** — ce qui s'est passé (résultat, fait marquant, statistique)
2. **Récompense de carte** — la carte Boost attribuée à quelqu'un, mise en scène
3. **Vote** — moment de décision, voir §4
4. **Duel** — un duel de l'Arène entre deux cartes, jouable directement dans le scroll
5. **Vidéo** — contenu publié par les joueurs, voir §5

**L'ouverture de journée** est un moment à part : une cérémonie animée qui
introduit le récap et contient le vote. C'est le seul endroit où le
scrollytelling est justifié.

> ⚠️ **Arbitrage retenu.** Le scrollytelling ne doit **pas** être le format par
> défaut du Feed. Le Feed sera ouvert dix fois par jour : il doit être une liste
> rapide et ordinaire. Le scrollytelling, c'est la cérémonie hebdomadaire, pas
> le mode de navigation.

---

## 4. Le vote — irréversible et structurant

**Ce qui est voulu :** au moment de l'ouverture d'une journée, chaque joueur
vote **une seule fois, sans retour arrière possible**. Le dépouillement
détermine automatiquement qui reçoit les cartes MVP / Impact / Défensive.

**Ce qui existe aujourd'hui** (`src/lib/sfl/votes.ts`) :
- Stockage `localStorage`, modifiable à l'infini, local à un navigateur.
- Système à 2 phases : nomination par équipe, puis finale du jour.
- Les honneurs qui génèrent réellement les cartes sont **saisis à la main par
  l'admin** dans `MatchEntry.mvp/impact/def`. **Le vote et les cartes sont deux
  systèmes déconnectés.**

### 🔴 Bug bloquant vérifié

```ts
decided: voters.length > 0 && votedCount === voters.length && leader !== null
```

**La décision exige l'unanimité de participation.** Un seul joueur qui ne vote
pas fige la journée définitivement. Rendre le vote irréversible sans corriger ça
transforme un bug discret en blocage spectaculaire, en public, pendant la
cérémonie.

### Ce qu'il faut construire

- Table `votes` avec `UNIQUE(journee_id, match_id, category, voter_id)`.
- **Aucune policy `UPDATE` ni `DELETE`** — en RLS, l'absence de policy vaut
  interdiction. L'irréversibilité doit être une contrainte **serveur**, jamais
  une règle d'interface.
- **Quorum + date limite + départage déterministe et persisté** (PP saison, puis
  buts, puis tirage seedé stocké). Plus jamais d'unanimité requise.
- **Secret du scrutin** : aujourd'hui le décompte s'affiche en direct pendant le
  vote. Irréversible *et* public en temps réel = effet de troupeau garanti, et
  piège pour celui qui vote en premier. `SELECT` limité à ses propres votes,
  dépouillement via RPC `SECURITY DEFINER` après clôture uniquement.
- **Idempotence** : vote au bord du terrain en 4G. UUID généré côté client +
  `ON CONFLICT DO NOTHING`, sinon double soumission.
- Les honneurs `mvp/impact/def` deviennent **dérivés** d'un `vote_results` figé.

---

## 5. Vidéos — le contenu généré par les joueurs

**L'intention :** encourager les joueurs à **se filmer les uns les autres**,
uploader la vidéo et **identifier** les joueurs présents dessus. Un joueur peut
aussi publier pour lui-même. Les vidéos apparaissent **dans le feed** (diversité
du contenu) **et dans le profil** des joueurs identifiés.

Un système de **badges** récompense cette activité (voir §6) — notamment le badge
« Journaliste » pour celui qui publie beaucoup.

### Pourquoi c'est stratégique

Deux experts indépendants l'ont pointé : **c'est la seule fonctionnalité du plan
qui peut réellement prendre la place de Snapchat.** Snapchat ne se bat pas sur du
texte. Un avatar 3D sans visage ne remplace pas un snap.

### Photos de profil ✅ *(livré)*

**Décidé : un système de photo de profil façon réseau social**, en attendant de
reprendre l'avatar 3D. Chaque joueur choisit une image, recadrée en carré et
recompressée automatiquement (512 px, JPEG) ; elle alimente sa carte et la
bannière MVP.

- `lib/sfl/photos.ts` isole le stockage, comme `saisie/store.ts` : aujourd'hui
  des data URL en `localStorage`, demain des URL Supabase Storage. **Aucun
  composant ne construit plus le chemin `/players/{nom}.png` lui-même** — tout
  passe par `photoSrc()`.
- ⚠️ **Limite actuelle** : la photo reste sur l'appareil qui l'a choisie. Les
  autres joueurs ne la voient pas tant que le stockage n'est pas distant. C'est
  le lot 1 qui lève cette limite, sans toucher à l'interface.
- ⚠️ Le quota `localStorage` (~5 Mo pour tout le domaine, saison comprise) est
  la raison de la recompression. Un dépassement est intercepté et signalé.

**Le médaillon rond est une étape, pas la cible.** Sur la carte, la photo
s'affiche en médaillon de 130 px décalé à droite. C'est une solution d'attente.

### Cible — portrait stylisé généré ⏳ *(à faire)*

**L'intention :** à la création du compte, le joueur se prend en photo ; cette
photo sert d'**entrée à un modèle de génération d'image** qui produit un
portrait stylisé. C'est ce visuel — lui, mais stylisé — qui devient le fond de
sa carte, et non la photo brute.

C'est la bonne réponse au problème de fond identifié plus haut : une carte sans
visage ne peut pas fonctionner, et des photos brutes hétérogènes (cadrages,
lumières et fonds différents) donneraient un jeu de cartes incohérent. Un
traitement génératif uniformise le rendu tout en gardant l'identité de chacun.

À trancher au moment de l'implémentation :

- **Le modèle et le fournisseur.** Il faut une API d'image à partir d'image
  (*image-to-image*), appelée **côté serveur** : une clé d'API ne peut pas
  vivre dans le navigateur.
- **Le coût.** Chaque génération se paie. Avec ~59 joueurs et des reprises,
  prévoir une limite du nombre de régénérations par personne.
- **La latence.** Plusieurs secondes par image : il faut une file d'attente et
  un état « en cours », pas une attente bloquante à l'inscription.
- **Le consentement et la modération.** Ce sont les visages de vraies
  personnes ; il faut pouvoir refuser, régénérer et supprimer.
- **Le style.** Un seul parti pris visuel, appliqué à tous, sinon on retombe
  sur l'hétérogénéité qu'on cherchait à corriger.
- **Le repli.** Que voit-on tant que la génération n'a pas eu lieu ? Le
  médaillon actuel joue ce rôle.

### À spécifier avant de coder

- Stockage (Supabase Storage), quotas, formats, compression, durée max.
- Transcodage / poster / lecture inline dans un feed — coût réseau sur mobile.
- **Identification (tagging)** : consentement de la personne identifiée, droit de
  retrait. Ce sont des vidéos de personnes réelles.
- **Modération** : suppression, signalement, exclusion. Un groupe d'amis finit
  toujours par une embrouille.
- Lecture automatique ou non, son coupé par défaut, économie de données.

---

## 6. Badges et trophées — le système de gamification

**Forme :** mêmes composants 3D que les cartes, mêmes props, **taille légèrement
réduite**. Des mini-trophées. Ils servent aussi d'**animation dans le gameplay**.

**Fond :** récompenses liées à des accomplissements précis et mesurables.

### Familles de trophées

| Famille | Principe | Exemples |
|---|---|---|
| **Paliers** | Seuils croissants sur une même statistique | Buts : 1 → 5 → 15 → 30 |
| **Exponentiels** | Même thème, difficulté croissante | déclinaisons du palier au-delà de 30 |
| **Cartes** | Obtention de cartes remarquables | carte MVP, pack Défensive |
| **Honorables** | Distinctions de comportement | à définir |
| **Mentions spéciales** | Rôles sociaux dans la communauté | **Journaliste** (publie beaucoup sur le feed) |

### L'ancrage théorique (Nir Eyal, *Hooked*)

Les trophées doivent couvrir **les trois typologies de récompenses variables** :

- **Ego** (self) — progression personnelle, maîtrise, paliers statistiques.
- **Tribu** (tribe) — reconnaissance par les autres, vote, mentions spéciales.
- **Chasse** (hunt) — rareté, imprévisibilité, collection à compléter.

Un système qui ne couvrirait que l'ego (des paliers de buts) raterait les deux
tiers du levier.

### ⚠️ Contrainte technique majeure

Les badges reprennent les composants 3D des cartes. **Or les cartes 3D sont déjà
le principal problème de performance de l'app** (voir §8). Multiplier les objets
WebGL dans un feed infini est le risque n°1 de ce chantier. Il faudra
probablement un rendu 2D par défaut et la 3D uniquement au tap.

---

## 7. Les règles de calcul des cartes

### Ordre de dérivation

```
Base (roster)  →  Rare  →  Carte Boost  →  + performance du jour  →  plafond 99
```

### Carte Rare ✅ *(déjà implémenté correctement dans `engine.ts:rareStats`)*

**+3 sur les 2 meilleures stats, +1 sur les 4 autres.**
**Non cumulatif** : une stat du top 2 prend +3, jamais +4.

### Cartes Boost — calculées **à partir de la carte Rare**

| Carte | Formule (appliquée sur la Rare) |
|---|---|
| **Défensive** | +2 DEF, +2 PHY, **+2 VIT** (auto), +1 sur le reste |
| **Impact** | +3 sur les 2 meilleures stats, +1 partout ailleurs |
| **MVP** | +3 sur les 2 meilleures stats, +2 partout ailleurs |

**Règle VIT automatique** : chaque (+1 DEF **et** +1 PHY) simultané donne +1 VIT.
D'où le +2 VIT de la Défensive. Cette règle existe déjà dans
`engine.ts:buildTargetStats` (`autoVit = min(alloc.DEF, alloc.PHY)`).

### Performance du jour

`+1 TIR par but marqué`, `+1 PAS par passe décisive`, puis **plafond à 99**.

### ✅ Bug n°1 — corrigé : les cartes Boost partent désormais de la Rare

`saisie/engine.ts:boostStats` appliquait les bonus sur la base **standard**. La
carte Impact était donc rigoureusement identique à la carte Rare — elle
n'existait pas. Le calcul part maintenant de `rareStats()`, la même fonction que
partout ailleurs, pour éviter deux formules divergentes.

Effet mesuré sur les cartes réellement attribuées en J6 :

| Joueur | Type | OVR avant | OVR après |
|---|---|:--:|:--:|
| Ilyes | Impact | 83 | **84** |
| Jouneid | Défensive | 89 | **90** |
| Sosso Coach | MVP | 87 | **89** |
| Sosso Coach | Impact | 86 | **88** |
| Adil Maimouni | Impact | 81 | **83** |
| Souley | Défensive | 88 | **89** |
| Selim laouadi | MVP | 83 | **85** |
| Selim laouadi | Impact | 83 | **84** |

### 🔴 Bug n°2 — toujours ouvert : les 3 cartes rendent le même OVR

La correction ne règle pas la collision. Recalcul **après correction**, sans
performance du jour (le cas d'un joueur primé qui n'a ni marqué ni passé) :

| Joueur | MVP | Impact | Défensive |
|---|:--:|:--:|:--:|
| Ilyes | **84** | **84** | **84** |
| Ilies | 87 | **86** | **86** |
| Anis | **80** | **80** | 79 |
| Smail | **84** | **84** | **84** |
| Yanis | 81 | **80** | **80** |
| Jouneid | 90 | **89** | **89** |
| Souley | 89 | **88** | **88** |
| Non évalué (75) | **79** | **79** | **79** |

**8 collisions sur 8.** Cause : `ovr = ceil(somme / 6)` exige 6 points de stats
pour bouger d'un point, or les trois types n'écartent que de 14, 10 et 9 points
au total. Dès qu'un joueur marque, les cartes se séparent — mais un joueur primé
sans statistique reçoit trois cartes d'apparence identique.

**Ce n'est pas un bug technique, c'est une règle de jeu à trancher.** Trois
pistes, à décider :

1. **Différencier par nature plutôt que par quantité** — MVP = polyvalence
   (bonus uniforme), Impact = pointe offensive (bonus concentré sur TIR/PAS/DRI),
   Défensive = DEF/PHY/VIT. Les cartes prennent des *formes* distinctes, pas
   seulement des totaux distincts.
2. **Écarter davantage les totaux** — par exemple MVP +18, Impact +12,
   Défensive +9, pour dépasser le seuil de 6 points par point d'OVR.
3. **Affiner l'OVR** — pondération par poste, ou une décimale affichée.

Les options 1 et 3 se combinent bien. L'option 2 seule relance l'inflation.

### 🔴 Bug vérifié n°3 — `tierBonus` affiché mais jamais appliqué

L'interface annonce « +3 OVR » (`carte/page.tsx`) mais la valeur n'est jamais
injectée dans l'allocation. Les joueurs voient un bonus qu'ils ne reçoivent pas.

### ⚠️ Inflation — projection chiffrée

Un joueur régulier qui prend MVP + Impact chaque mois via EvoDay
(`freePool` = 6 + 3, plus `fixedBonuses`) :

| | VIT | TIR | PAS | DRI | DEF | PHY | OVR |
|---|---|---|---|---|---|---|---|
| Mois 0 | 81 | 85 | 86 | 90 | 72 | 66 | 80 |
| Mois 2 | 81 | 91 | **99** | 98 | 72 | 68 | 85 |
| Mois 6 | 81 | **99** | **99** | **99** | 72 | 72 | 87 |

**3 stats sur 6 au plafond dès le 6ᵉ mois**, puis l'OVR se fige à 87 pendant que
le système continue de verser des points dans le vide. L'écart de gains
mensuels entre un régulier et un occasionnel atteint **16 contre 1**.

### Le contre-poids retenu : reset saisonnier + tests ✅

**Décision : à chaque fin de saison, les cartes sont remises à plat et les
joueurs sont réévalués par des tests.** La note de base ne se traîne pas d'une
saison à l'autre ; elle est re-mesurée.

C'est le bon choix, et pour une raison qui dépasse l'équilibrage : il transforme
une contrainte technique en **événement de ligue**. La journée de tests devient
un rendez-vous, un contenu pour le feed, une source de vidéos et de badges. On
récupère de l'engagement là où un simple « decay » automatique n'aurait produit
que de la frustration.

Points à spécifier :

- **Forme des tests** : épreuves physiques et techniques ? vote entre joueurs ?
  notation par l'admin ? mixte ? *(question ouverte)*
- **Ce qui est remis à zéro** : les stats de base seulement, ou aussi les PP, la
  collection, les badges ? Recommandation : les stats et les PP repartent, la
  **collection et les badges se conservent** — c'est le capital qui donne envie
  de rester d'une saison à l'autre.
- **Archivage** : chaque saison passée doit rester consultable (palmarès,
  anciennes cartes). D'où le besoin de `saison_id` dès le lot 0.
- **Nouveaux arrivants** : ils entrent par les mêmes tests, ce qui règle
  élégamment le problème du « nouveau à 75 » sans rattrapage.

### Points Pépite discrétionnaires (nouveau)

L'admin doit pouvoir **attribuer des points Pépite à sa main**, comptant au
classement Pépite d'Or. Objectif : récompenser ce que les stats ne voient pas —
celui qui ramène les chasubles, arbitre, accueille le nouveau.

> ⚠️ **Deux experts sur cinq ont désigné ce point comme le principal risque du
> projet.** L'admin est en dur (`ADMIN_PLAYERS = ["Ilyes"]`) et se trouve être
> le n°1 du classement. Le Pépite d'Or est aujourd'hui le seul classement
> objectif et auditable. **Décision : on le fait, avec trois garde-fous non
> négociables :**
>
> 1. **Motif obligatoire et public** sur le feed (« +2 — a ramené les chasubles »).
> 2. **Plafond dur** par journée.
> 3. **Ligne distincte** au classement (« dont X pts bonus »).
>
> Techniquement : le champ `pepiteBonus` existe déjà mais il est attaché à une
> `MatchEntry` — impossible de créditer un joueur absent. Il faut une table
> dédiée `pepite_adjustments(player_id, journee_id?, delta, reason, granted_by)`.

---

## 8. État technique vérifié — ce qui bloque

Tous les points ci-dessous ont été **vérifiés dans le code**, pas supposés.

### 🔴 Identité — le nom est la clé primaire

`MatchEntry.player`, `RosterEntry.name`, `Convocation.reponses`, les clés
`localStorage` de `votes.ts` : tout est indexé sur une **chaîne de caractères**.

- **Les usernames sont bloqués par ça.** Le premier changement de pseudo détruit
  l'historique du joueur.
- Le problème est déjà réel : le roster contient **`"Selim"` et `"Selim laouadi"`**
  comme deux joueurs actifs distincts. Et le classeur JOUEURS contient
  **`"Sofiane"` et `"Soffiane"`**, deux attaquants aux notes différentes.
- **Il faut passer aux UUID (`player_id`) + `display_name` + `username` unique
  AVANT toute autre chose.**

### 🔴 Notifications push — inexistantes

`public/sw.js` ne contient **aucun** listener `push` ni `notificationclick`. Le
chantier notifications est à 0 %.

**Contrainte iOS** : les notifications web ne fonctionnent **que si la PWA est
installée sur l'écran d'accueil**. Dans un onglet Safari, jamais. *(Vérifié :
Apple avait annoncé retirer les web apps de l'écran d'accueil dans l'UE, puis a
fait marche arrière dans la version finale d'iOS 17.4 — le canal est disponible
en France.)*

**Conséquence stratégique : le taux d'installation de la PWA est la métrique de
survie du projet.** Sans notification, pas de remplacement de Snapchat.

### 🔴 Sécurité — deux trous qui deviennent critiques avec des comptes

- Mot de passe admin **en clair dans le code** : `PROFILE_PASSWORDS = { Ilyes: "azy" }`.
- Admin en dur (`ADMIN_PLAYERS`) et rechargement automatique de son portefeuille
  à **12 000 Ballons** (`BALANCE_FLOORS`).
- L'économie de Ballons est entièrement côté client : **falsifiable** dès que la
  base est partagée. `claimDailyLogin` et consorts doivent passer en RPC serveur.

### 🔴 PWA iOS — le header passe sous la Dynamic Island

`layout.tsx` déclare `viewportFit: "cover"` et
`appleWebApp.statusBarStyle: "black-translucent"` : en PWA installée, le contenu
web s'étend **derrière la barre d'état**.

Or le header est en `sticky top-3` — soit **12 px du haut réel du viewport**,
alors que la zone sûre fait ~47 à 59 px sur les iPhone à encoche.
**`env(safe-area-inset-top)` n'est utilisé nulle part dans le projet.**

→ Le sélecteur de profil et le bouton de thème sont partiellement ou totalement
sous la barre d'état, difficiles voire impossibles à toucher.

*(La tab bar, elle, est correcte : `bottom-nav.tsx` gère bien
`env(safe-area-inset-bottom)`.)*

### ⚠️ Scroll — le scrollytelling ne fonctionnera pas naïvement

`layout.tsx` fige `body` en `h-dvh overflow-hidden` ; le scroll réel vit dans
`#app-scroll`. Or `useScroll` (motion) et `ScrollTrigger` (GSAP) écoutent
`window`/`document` par défaut. **Tout scrollytelling naïf sera inerte.** Il faut
passer `container` / `scroller: "#app-scroll"` partout.

`viewport-lock.tsx` fait par ailleurs un `preventDefault()` sur tout `touchmove`
hors de `#app-scroll, .overflow-x-auto, .overflow-y-auto, canvas`. **La liste des
messages du chat et les modules à défilement horizontal devront être ajoutés à
cette liste**, sinon geste mort.

### ⚠️ Performance 3D — le point de rupture

- `app-splash.tsx` bloque le premier rendu sur les polices, le chunk three.js, la
  **compilation des shaders** et **10 photos joueurs** — alors que
  `public/players/` n'en contient **qu'une** (`Yacine.png`, 1,1 Mo) : 9 requêtes
  en 404 à chaque démarrage.
- La page d'accueil monte **6 cartes 3D**, chacune faisant 3 rasterisations
  `toPng` à `pixelRatio: 2` sur le thread principal, et `useInView` est acquis
  **définitivement** : rien n'est démonté au scroll-out. Dans un feed infini, les
  contextes WebGL s'accumulent jusqu'à la limite navigateur (~8-16 sur mobile).
- `avatar-base.glb` fait **3,1 Mo** non compressé (ni DRACO ni meshopt), et
  `avatar-viewer.tsx` n'a pas de `frameloop="demand"` : rAF continu à 60 fps.

**Simplification la plus rentable : sortir three.js du chemin critique.** Retirer
le préchauffage des shaders du splash, n'afficher la 3D qu'au tap (poster 2D par
défaut), rendre `useInView` réversible. Cela débloque mécaniquement le Feed, les
badges et le Profil.

### ⚠️ Autres manques relevés

- Aucun `loading.tsx` / `error.tsx` / `not-found.tsx`.
- **Zéro `prefers-reduced-motion`** dans tout le projet, alors qu'on ajoute du
  scrollytelling.
- Clavier mobile : avec `h-dvh` + `overflow-hidden` et sans `visualViewport`, le
  champ de saisie du chat **passera sous le clavier iOS**.
- Pas de `saison_id` : impossible d'ouvrir une saison 2 sans casser les classements.
- Dates non typées (`"22 juin"`, `"Dim. 6 juil."`) : chaînes non triables.
- Double source de vérité : `data.ts` (en dur) coexiste avec `saisie/seed.ts` +
  moteur, et `collection.ts` importe encore `PLAYERS` depuis `data.ts`.
- Barème non versionné : changer une règle en cours de saison **réécrit
  rétroactivement le passé**. Il faut un `ruleset_id` par saison.
- `store.ts` est synchrone et à grain « saison entière » : chaque écriture est un
  read-modify-write global → **last-write-wins garanti en multi-utilisateur**.
  `mutations.ts` identifie les lignes par **index de tableau**.

---

## 9. Authentification et revendication de profil ✅ *(spécifié)*

Les joueurs **existent déjà** avec 6 journées d'historique et 59 fiches. On ne
crée donc pas des comptes vierges : chacun **revendique** le profil qui lui
correspond.

### Le parcours de première connexion

1. Le joueur se connecte (Google/Apple OAuth, lien magique e-mail en secours —
   **pas de SMS**, coût par envoi sans bénéfice à cette échelle).
2. **Écran « Qui es-tu ? »** — la liste de **tous les joueurs du roster** encore
   disponibles. Recherche indispensable : 59 entrées, ce n'est pas une liste
   qu'on parcourt au doigt.
3. Il choisit sa fiche. **Elle disparaît immédiatement de la liste des autres.**
4. Il récupère tout son historique : PP, matchs, buts, passes, cartes, badges.
5. **« Je ne suis pas dans la liste »** → création d'une fiche neuve, sans note,
   évaluée aux prochains tests (voir §7).

C'est ce parcours qui remplace l'actuel sélecteur de profil du header — lequel
laisse aujourd'hui n'importe qui incarner n'importe quel joueur, avec un mot de
passe en clair dans le code pour le seul profil admin.

> **Calendrier — tranché ✅ : cet écran arrive avec le lot 1, pas avant.**
> L'exclusivité (« une fois pris, plus disponible ») exige un état partagé entre
> appareils : elle est **impossible à honorer sans serveur**. En construire une
> version locale donnerait une fausse impression de fonctionnement, deux
> téléphones pouvant choisir la même fiche. Le sélecteur de profil actuel reste
> donc en place jusqu'à l'arrivée de Supabase.

### Les pièges à traiter

- **🔴 L'exclusivité doit être atomique côté serveur.** Deux joueurs qui
  choisissent la même fiche à la même seconde, c'est une contrainte
  `UNIQUE(player_id)` sur la table des revendications, pas une vérification en
  JavaScript. Une revendication est un `INSERT` qui échoue proprement.
- **Usurpation — tranché ✅ : code d'invitation.** Sans garde-fou, le premier
  connecté peut se déclarer « Ilyes » et récupérer les PP du leader. La
  revendication exigera donc un **code distribué par l'admin**. C'est la seule
  option qui bloque *avant* que le mal soit fait, et elle protège en prime
  contre les inconnus qui tomberaient sur l'app.
  À préciser au moment de l'implémentation : un code unique pour la ligue, ou
  un code par joueur (plus sûr, plus lourd à distribuer). Prévoir dans tous les
  cas une **limitation du nombre d'essais** — un code court se devine.
- **Se tromper de fiche est inévitable.** L'admin doit pouvoir **libérer** une
  fiche revendiquée par erreur. Prévoir l'opération inverse dès le départ.
- **Traçabilité** : qui a revendiqué quoi et quand. C'est une opération
  sensible, elle doit être journalisée.
- **Fiches jamais revendiquées** : les joueurs qui ne s'inscrivent pas restent
  au classement avec leur historique. Une fiche non revendiquée n'est pas une
  fiche morte, juste une fiche sans compte associé.

### Visibilité — tranché ✅ : ligue publique

Classements, cartes et récaps de journée sont consultables **sans compte**.
C'est le levier de partage et de croissance : une carte partageable par lien,
c'est le réflexe qu'on veut capter.

Tout ce qui **écrit** (voter, discuter, répondre à une convocation, publier une
vidéo) exige un compte.

> 🔴 **« Public » ne peut pas s'appliquer à tout le feed.** Le feed contiendra
> des vidéos de personnes réelles, identifiées nommément. Une ligue publique ne
> veut pas dire des vidéos publiques : diffuser sans compte des vidéos de
> joueurs identifiés, c'est un problème de vie privée, pas un choix de produit.
>
> **Découpage à appliquer :**
>
> | Contenu | Sans compte |
> |---|:--:|
> | Classements, statistiques, cartes joueurs | ✅ |
> | Récap de journée (résultats, faits marquants) | ✅ |
> | Profils publics (carte, badges, palmarès) | ✅ |
> | **Vidéos** | ❌ réservé aux membres |
> | **Discussions** | ❌ réservé aux membres |
> | **Votes et convocations** | ❌ réservé aux membres |
>
> Concrètement : le feed est public, mais **filtré** — un visiteur sans compte
> voit les modules d'information, de récompense et de classement, jamais les
> vidéos ni les discussions. À confirmer, mais c'est le défaut que je poserai
> faute d'instruction contraire.

---

## 10. Plan de travail

### Lot 0 — Assainissement (⚠️ point de non-retour, purement local)

1. UUID `player_id` + `display_name` + `username` unique ; `id` sur chaque ligne de match.
2. ~~Fusionner les doublons~~ — **sans objet** : tous les homonymes sont des joueurs distincts (§11).
3. Dates en ISO, ajout de `saison_id`, versionnement du barème (`ruleset_id`).
4. Supprimer `data.ts` (double source de vérité).
5. **Test golden** : `deriveSeason(seed)` doit reproduire les PP actuels au point près.

> **Ce lot passe avant tout backend.** Dès qu'un vote irréversible référencera
> ces identifiants, aucun retour arrière ne sera possible.

### Lot 1 — Fondations serveur
6. Schéma Postgres + RLS + rôle admin serveur.
7. `SaisieStore` asynchrone et à grain fin.
8. **Auth + écran de revendication de profil** (§9) + usernames.
9. Libération d'une fiche par l'admin + journal des revendications.
10. Migration des 6 journées historiques.

### Lot 2 — Moteur de jeu
10. Cartes Boost à partir de la Rare **et différenciation réelle des 3 cartes**.
11. Affiner l'OVR (pondération par poste ou décimale).
12. Corriger `tierBonus`.
13. Table `pepite_adjustments` + garde-fous (motif public, plafond, ligne distincte).
14. Contre-poids à l'inflation (reset saisonnier ou décroissance).

### Lot 3 — Vote
15. Vote serveur insert-only, quorum, deadline, départage, secret du scrutin.
16. Branchement vote → honneurs → cartes Boost.
17. Cérémonie d'ouverture de journée animée.

### Lot 4 — Feed
18. Navigation 3 sections.
19. Moteur de feed modulaire avec **alternance des formats**.
20. Modules : information, récompense de carte, vote, **duel**.
21. Convocations effectives multi-utilisateurs.
22. Tableaux, classements, storytelling des Pépites.

### Lot 5 — Vidéos
23. Upload, stockage, compression, lecture inline.
24. Identification des joueurs + consentement + droit de retrait.
25. Modération (suppression, signalement).
26. Intégration feed + profil.

### Lot 6 — Badges
27. Moteur de règles de trophées (paliers, exponentiels, cartes, honorables, mentions).
28. Rendu 3D réduit, réutilisant les props des cartes.
29. Animations d'obtention.

### Lot 7 — Discussion
30. Canaux (privé, groupe, équipe, ligue) + RLS par canal.
31. Temps réel (Supabase Realtime + bloc « Realtime Chat » de la Supabase UI Library, compatible registre shadcn).
32. Modération, quitter un canal, exclusion.
33. **Notifications push** + onboarding d'installation PWA.

### Lot 8 — Social et finition
34. Profils publics cliquables, mécaniques ego / tribu / chasse.
35. Performance : three.js hors chemin critique, virtualisation, `prefers-reduced-motion`.
36. **Correction PWA iOS** : `env(safe-area-inset-top)` sur le header.
37. Clavier mobile, états de chargement, accessibilité, hors-ligne.

---

## 11. Questions ouvertes

**Tranché ✅ — Homonymes.** `Yacine` / `Yacine Ben`, `Sofiane` / `Soffiane`,
`Selim` / `Selim laouadi` sont **tous des joueurs différents**. Aucune fusion à
faire. Le roster à 59 entrées est correct en l'état.

> ⚠️ Cela ne supprime pas le besoin d'UUID : dès qu'on introduit les usernames,
> un joueur qui change de pseudo casserait son historique tant que le nom sert
> de clé primaire. Le lot 0 reste obligatoire, seule l'étape « fusion des
> doublons » disparaît.

**Tranché ✅ — Contre-poids à l'inflation.** Ce sera un **reset saisonnier avec
réévaluation des joueurs par des tests**. Voir §7.

**Tranché ✅ — Ligue publique.** Classements, cartes et récaps consultables sans
compte ; vidéos, discussions et votes réservés aux membres. Voir §9.

**Reporté ⏸️ — Honneurs de la J6.** La répartition Impact / Défensive reste celle
déduite de la position des colonnes (§13). Sera revue plus tard, à l'occasion de
la reprise de la saisie.

**Encore ouvert :**

1. **Le nœud « Contenu »** de la mind map d'origine était coupé sur l'image.
2. **Les tests de réévaluation** : quelle forme prennent-ils concrètement (voir §7) ?

---

## 12 bis. Méthode de validation

**Pas de suite de tests automatisés pour l'instant.** La validation se fait
manuellement sur le déploiement Vercel : chaque commit part en production, et le
rendu est vérifié à l'œil sur l'app en ligne.

Conséquence à assumer : les seuls filets automatiques sont `tsc`, `eslint` et
`next build`, qui sont systématiquement passés avant chaque push. Ils attrapent
les erreurs de type et de compilation, **jamais une régression visuelle ou de
comportement**. Toute régression d'affichage sera découverte par un humain, sur
le site.

C'est un choix raisonnable au stade actuel. Il le sera beaucoup moins quand le
moteur de cartes, le vote irréversible et les paiements de points Pépite seront
en place : à ce moment-là, un test de non-régression sur `deriveSeason()` (le
« test golden » du lot 0) devient indispensable, parce qu'une erreur y réécrit
silencieusement l'historique de toute la ligue.

---

## 13. Journée 6 — saisie ✅

**26/07/2026**, 22 joueurs, 2 matchs (Orange vs Bleu, Vert vs Jaune).

**Contrôle effectué** : les 22 lignes ont été recalculées avec le barème du code
(`presence 1, victoire 2, but 1, passe 1, mvp 2, impact 1, def 1…`) et
**correspondent toutes exactement** à la colonne « PP du match » du classeur.
Buts, passes et résultats sont donc certains.

**Point à confirmer** — la colonne PP valide le *total* des honneurs mais ne
distingue pas Impact (+1) de Défensive (+1). Répartition retenue d'après la
position des colonnes :

| Joueur | MVP | Impact | Défensive | PP |
|---|:--:|:--:|:--:|:--:|
| Ilyes | | ✔ | | +6 |
| Jouneid | | | ✔ | +12 |
| Sosso Coach | ✔ | ✔ | | +8 |
| Adil Maimouni | | ✔ | | +7 |
| Souley | | | ✔ | +13 |
| Selim laouadi | ✔ | ✔ | | +10 |

**Roster** : mis à jour depuis le classeur JOUEURS (59 joueurs). 20 notes
renseignées ou corrigées. ⚠️ Le classeur ordonne les stats
**VIT TIR PAS DRI PHY DEF** alors que le code utilise **VIT TIR PAS DRI DEF PHY**
— PHY et DEF sont inversés. Toute réimportation doit en tenir compte.

**Encore non évalués** (base à 75) : Houssyne, Hassan Abdel, Selim, Ziad,
Chouaib, Khadim, Guillaume, Lyes Korogli.

## Buts minutés — ce qu'il faut ajouter au classeur

Deux modules du récap attendent les minutes des buts : **la minute par minute**
et **le tournant du match**. Ils restent masqués tant que la donnée n'existe
pas ; le reste du récap est inchangé.

Pour les activer, ajouter au classeur un onglet `MINUTES` avec une ligne par
but :

| Colonne | Exemple | Rôle |
|---|---|---|
| Journée | 8 | numéro de journée |
| Minute | 34 | minute du but |
| Équipe | Orange | couleur qui marque |
| Buteur | Anas | nom exactement comme dans le roster |
| Passeur | Ilyes | facultatif |

L'import remplit `saison.events` (type `MatchEvent`, voir
`src/lib/sfl/saisie/types.ts`). Le champ `matchId` est facultatif : sans lui,
les buts sont rattachés au match principal de la journée.
