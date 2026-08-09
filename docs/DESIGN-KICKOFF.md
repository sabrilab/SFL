# Design « Kickoff » — analyse du projet Claude Design

> Source : `Football_Snap_App_Design.zip` (projet Claude Design, 9 août 2026).
> 7 pages de design : App sombre (principale), App claire, Créer sa carte,
> Les épreuves, Les cartes, Carte cristal, plus une source autonome.
> Moteurs : `card3d.js` (carte 3D three.js, photo plein cadre, typo éditoriale),
> `crystal-card.js`, `ios-frame.jsx` (cadre iPhone), `support.js` (runtime).
>
> Statut : **analyse, rien d'implémenté**. Les décisions à prendre sont en fin
> de document.

---

## 1. Ce que le design est

Ce n'est pas une retouche de l'app actuelle : c'est une **vision produit
complète**, nommée **Kickoff**, illustrée sur un club fictif (« FC Pantin »,
« Ligue du dimanche », joueurs Sofiane Drabi / Yanis Benali, admin Karim).
L'app y a **quatre sections** : Feed (« Ligue »), Discussions, Profil,
**Boutique** — plus un **paywall** d'abonnement.

Direction visuelle : noir profond (#070707), cartes mates, un seul accent,
CTA blancs, verre uniquement sur la barre d'onglets, typo éditoriale
(Anton / Archivo / JetBrains Mono, et une direction serif Bodoni / Cormorant).
Une variante claire existe (page « App · clair »).

## 2. Ce que le design confirme de la spec V2

| Spec V2 | Dans le design |
|---|---|
| Feed modulaire à formats alternés | Récap de journée, match raconté (« Pantin renverse », mené 0-2 → 3-2), duel de la journée, carte récompense (« BRAVO SOFIANE — carte or »), vote ouvert avec échéance (« FIN DANS 2 J »), convocation (« Tu es dans la compo » / « Pas dispo »), clips vidéo, équipe type, feuille de match validée par l'admin, onglet Classement |
| Vidéos dans le feed | « Les clips de la journée · Filmés par le vestiaire · 14 vidéos » |
| Usernames | `@sofdrb`, `@yanisb`, `@karimd` partout |
| Portrait généré depuis photos | Flux « Créer sa carte » : 3 prises guidées (« Regarde l'objectif », « Tourne la tête ») → « On grave ta carte » (~20 s) → carte photo plein cadre |
| Stats en 2 colonnes de 3 | Direction « D · COLONNES » — exactement la disposition déjà livrée |
| Streaks (reco du jury) | « SEMAINES DE SÉRIE » au profil |
| Échange de cartes (reco du jury) | Bouton « Échanger » dans la collection |
| Chat type Discord | « Le vestiaire », « Karim est en train d'écrire… », match « EN DIRECT » |

## 3. La grande réponse : LES ÉPREUVES

La page « Les épreuves » répond à la question ouverte « quelle forme prennent
les tests de réévaluation ? » — et va plus loin que tout ce qu'on avait
envisagé :

- **Des défis filmés au téléphone** : « Le jonglage » (« On compte tes
  touches », comptage en direct), « Le sprint sur 20 mètres ». Caméra requise,
  ~30 secondes, « Pose ton téléphone à 3 mètres », « Reste dans le cadre ».
- **Chaque épreuve nourrit des critères précis** de la carte (« CE QUE ÇA FAIT
  MONTER », « Note générale 84 → 85 »), avec comparaison sociale (« Mieux que
  78 % des joueurs du club »).
- **Cadence limitée** (« REJOUABLE DANS 7 JOURS »), récompenses en ballons
  (« +240 ⚽ »), vie privée cadrée (« Ta vidéo n'est visible que par toi et
  l'admin du club »).
- **L'onboarding s'appuie dessus** : la carte est créée avec la photo mais
  « IL MANQUE LES STATS » → « Passe ta première épreuve ».

Conséquence structurante : **les notes de base ne sont plus attribuées par
l'admin, elles sont mesurées par les épreuves** — en continu, pas une fois par
saison. Le « reset saisonnier avec tests » devient un système permanent.
Les performances de match (buts, passes, honneurs) continuent d'alimenter PP
et cartes boost. Cette séparation est cohérente et meilleure que la spec.

## 4. Ce qui est nouveau, absent de la spec V2

1. **Boutique** : merchandising réel payable en points — survêt 89 € / 4 400 PTS,
   maillot floqué, montre « série verte, 200 pièces », crampons ; « Drop de la
   semaine » ; catégories Maillots / Survêts / Montres / Crampons / Accessoires.
2. **Abonnement** : paywall « Passe en illimité » (limites du gratuit —
   « LIMITE ATTEINTE » — levées par un abonnement sans engagement).
3. **Mini-jeux** « chaque module rapporte des ballons ».
4. **Partage en story 9:16** : « Le visuel de la journée · GÉNÉRÉ AUTO »,
   « Partager en story », « Partager ma carte ». Stratégiquement malin : au
   lieu d'affronter Snapchat frontalement, on exporte *vers* Snapchat/Insta.
5. **Indices multi-clubs** : « Ailleurs dans la ligue », « City Five · Pantin »
   — l'ambition dépasse un seul club.

## 5. Réalité technique (confronté au code existant)

- **Le feed du design est une liste de modules** — pas de scrollytelling
  plein écran. Compatible avec `#app-scroll` et le verrou tactile existants.
  C'est l'arbitrage déjà retenu (« la cérémonie est un moment, pas un mode de
  navigation »).
- **`card3d.js` du design** charge three.js depuis un CDN (interdit chez nous —
  CSP et PWA hors-ligne) et repeint la carte dans un canvas 2D texturé. Notre
  moteur `card-3d.tsx` fait déjà mieux ; on portera le *style* (photo plein
  cadre, typo, teintes), pas le code.
- **Cartes photo plein cadre** : dépendent du portrait généré (décision déjà
  prise, API côté serveur). Le prototype 3 photos + recadrage MediaPipe de la
  branche avatar est un actif réutilisable pour la prise de vue guidée.
- **Le jonglage compté en direct est le morceau le plus dur du design**
  (vision par ordinateur sur mobile, suivi de balle + pose). Phasage
  raisonnable : v1 = vidéo enregistrée + validation admin ; v2 = comptage
  automatique (MediaPipe). Le sprint chronométré pose les mêmes questions.
- **Verre/backdrop-filter** généreux : à limiter à la tab bar (ce que la
  direction « MATTE » fait explicitement) pour tenir sur Android milieu de
  gamme.
- Fonts nouvelles à intégrer : Archivo, JetBrains Mono (+ Bodoni/Cormorant si
  direction serif). Anton est déjà dans l'app.
- Échelle de points incohérente avec l'existant : boutique à 4 400 PTS vs
  économie Ballons actuelle (~8/jour). À réconcilier.

## 6. Décisions à prendre (avant toute implémentation)

1. **La marque** : Kickoff est-il le nouveau nom (à la place de SFL / Golder /
   Pépite d'Or), ou un placeholder de design ? Tout le wording en dépend.
2. **La direction de cartes** : « D · COLONNES » (mat, sobre — recommandée :
   cohérente avec l'app sombre et la disposition 2 colonnes déjà en prod) ou
   « SERIF — noble » (Bodoni, ivoire/champagne — distinctive mais fragile en
   petite taille) ? Les pages « Les cartes » / « Carte cristal » montrent 10
   exemples et 6 agencements : c'est une exploration, il faut trancher.
3. **Le modèle des stats** : acter que les épreuves deviennent la source des
   notes de base (remplaçant la notation admin), et que les matchs nourrissent
   PP + boosts. Impact direct sur le moteur de cartes (lot 2).
4. **Boutique et abonnement** : dans le périmètre maintenant, ou lot final ?
   (Recommandation : lot final — dépendent de Supabase, des paiements et d'une
   base d'utilisateurs actifs.)
5. **Multi-clubs** : hors périmètre pour la SFL aujourd'hui, mais si c'est
   l'ambition, le lot 0 doit ajouter `club_id` à côté de `saison_id` — quasi
   gratuit maintenant, coûteux plus tard.

## 7. Ce qui est implémentable tôt (sans Supabase)

- La **nouvelle identité visuelle des cartes** (direction retenue) — CardShell
  est déjà thémable, les 4 dispositions de stats existent.
- Le **shell sombre** (fond #070707, tab bar verre, accent unique).
- La **structure du feed en modules** sur les données actuelles (récap,
  carte récompense, classement, convocation) — les modules vote/vidéo/duel
  attendent leurs moteurs.
- La **maquette du flux « Créer sa carte »** (prise de vue guidée) en local,
  branchée plus tard sur l'API de génération.
