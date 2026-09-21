# Passation vers Swift — ce qu'il faut réinterpréter, et comment

Ce document s'adresse à l'agent (ou la personne) qui réécrit Golder en Swift.
L'app de référence est dans ce dossier `mobile/` : Expo / React Native, TypeScript.
Elle a été construite écran par écran avec le propriétaire du produit ; les
décisions ci-dessous sont les siennes, pas des choix techniques à rediscuter.

**Lire d'abord** : `README.md` (architecture), `docs/carte/SPEC.md` (la carte
joueur, valeurs à porter telles quelles), puis les fichiers cités ici.

---

## 1. Ce que l'app est

Une app de football à cinq. **Trois onglets, pas plus** : Jouer, Ma carte, Ligue.

- **Jouer** est l'entrée principale, toujours. Les matchs ouverts autour de soi,
  qu'on soit de la ligue ou pas. Rejoindre un match ne demande rien d'autre
  qu'un toucher.
- **Ma carte** : le badge social du joueur (une carte 2:3, en volume), son
  équipe, ses amis, la ligue, et un test de réflexes.
- **Ligue** : quatre rubriques côte à côte — Journée, Classement, Matchs
  (le journal), Équipes.

Le public visé en premier est **un inconnu qui découvre l'app par une vidéo**
et doit pouvoir jouer dimanche sans connaître personne. Toute l'interface est
pensée pour lui.

## 2. La direction artistique (à respecter, pas à réinterpréter)

`src/da/theme.ts` est la source. Résumé :

- Noir profond `#08090B`, neutres purs, **un seul accent chaud** `#FF8A4C`
  (la braise), réservé au manque (« il manque 3 ») et aux rappels.
- **Les photos portent l'écran** : chaque match est une tuile photo 16:11 avec le
  jour posé dessus en typographie géante translucide (blanc à 74 %).
- **Capsules de verre sombre** sur les photos ; **cartes claires** `#EFEFEC` sur
  le noir pour tout ce qui se lit vraiment (fiches, formulaires, feuille de match).
- Typographie : titres **Archivo 700/800**, libellés **DM Mono** en capitales
  espacées, texte courant = police système. La carte joueur a la sienne :
  **Anton** + **JetBrains Mono** (voir SPEC).
- Un seul monde, sombre. Pas de mode clair.

Équivalents SwiftUI : `TabView` (barre native, Liquid Glass automatique sur
iOS 26), `.sheet` avec `presentationDetents` pour toutes les feuilles,
`.glassEffect()` pour les capsules, SF Symbols déjà choisis :
`soccerball`, `person.text.rectangle`, `trophy`.

## 3. Les écrans, un par un

### Jouer — `src/app/(tabs)/index.tsx`
- Titre « Près de toi », compteur « N MATCHS OUVERTS · SAINT-DENIS ».
- **Rappel persistant** en tête si une feuille de match hébergée est en cours
  ou à valider (voir §5). Il ne disparaît qu'à la validation. Une pastille
  sur l'onglet Jouer porte le nombre.
- Filtres : Tous / Aujourd'hui / Ce week-end / Places libres / Débutant ok.
- Tuiles de matchs (`src/composants/Tuile.tsx`) : jour en géant, lieu, heure,
  prix, distance, et l'état : « Il manque N » (braise) / « Complet » / « Tu y es ».
- Dernière tuile : **Ouvrir un match** (proposer une partie coûte le même geste
  qu'en rejoindre une).

### Fiche d'un match — `src/app/match/[id].tsx` (feuille native)
Répond dans l'ordre aux questions d'un inconnu : où et quand · qui organise
(nom, note, nombre de matchs) · combien ça coûte · format (5 contre 5 · 2 × 25 min)
· effectif (N sur 10, places libres) · **les cartes des joueurs présents**, à
faire défiler · « N personnes viennent seules elles aussi » (la ligne qui fait
basculer) · bouton Rejoindre / Se retirer / Me prévenir si une place se libère.

Si l'utilisateur **héberge** ce match, cette fiche est remplacée par la feuille
de match (§5).

### Ouvrir un match — `src/app/ouvrir.tsx` (feuille native)
Quatre champs : où, quand (Ce soir / Demain / Samedi / Dimanche), heure, niveau.
Sous le bouton, **en second plan** : « Tu joues avec une équipe ? » → Ligue →
Équipes ; ou, si on en a une, une case « Inscrire [équipe] » qui met ses joueurs
sur la feuille côté A. Le créateur devient l'hôte et est inscrit d'office.

### Ma carte — `src/app/(tabs)/carte.tsx`
1. **La carte du joueur, en volume** (§4), 236 pt de large.
2. Si pas de photo : appel « Créer ma photo » (pipeline à venir, §7).
3. **Mon équipe** (écusson, nom, « Gérer », rangée de cartes des coéquipiers).
4. **Mes amis** (rangée de cartes ; état vide : « Ouvre la carte de quelqu'un et
   touche Ajouter en ami »).
5. **La ligue** (rangée de cartes).
6. Six critères en lignes (VIT TIR PAS DRI DEF PHY) avec jauge fine.
7. **Test de réflexes** (`src/composants/TestReaction.tsx`) : trois essais, délai
   aléatoire 1,4–4 s, « Trop tôt » si on touche avant, médiane, percentile
   (< 200 ms → 92 ; < 240 → 74 ; < 290 → 51 ; < 350 → 28 ; sinon 12). Au-dessus
   de 70, **+1 en VIT sur la carte, une seule fois**.

### Carte d'un autre joueur — `src/app/joueur/[id].tsx` (feuille native)
La carte en volume, « Dans ton équipe » si c'est le cas, bouton « Ajouter en
ami » / « ✓ Ami ».

### Ligue — `src/app/(tabs)/ligue.tsx`
Contrôle segmenté à quatre rubriques.
- **Journée** : tuile photo de la prochaine journée (« Journée 10 · Dimanche
  14h00 · City stade Jean-Moulin »), **convocation** (« Tu viens dimanche ? »
  Je viens / Je ne peux pas — retoucher annule ; compteurs présents / absents /
  sans réponse ; têtes), puis « Ta dernière journée » (+pp, buts, passes, MVP).
- **Classement** : cinq tableaux d'affilée, sans sous-menu — Points PP, Buteurs,
  Passeurs, Homme du match, Assiduité. La ligne de l'utilisateur surlignée
  (rang en braise, pastille TOI).
- **Matchs** = **le journal** : chaque journée en rubrique dépliable — manchette
  déduite des chiffres (`src/donnees/journal.ts`, fonction `manchette`, règles
  exactes : record → « N BUTS, ET UN RECORD » ; ≥ 5 buts → « X EN FEU » ;
  passes > buts → « X DISTRIBUE » ; sinon « X FAIT LA LOI »), score, meilleur
  buteur / passeur / homme du match, top 3 au barème Pépite, faits du jour.
- **Équipes** : sa carte d'équipe (ou l'invitation à la monter), puis le
  **classement des équipes** (§6).

## 4. La carte joueur — `src/composants/carte/`

**Suivre `docs/carte/SPEC.md` à la valeur près.** Grille 1024 × 1536, ordre des
calques, typographie, physique. Points qui ne se voient pas dans la spec :

- La face est une seule image composée. Deux effets sont **non négociables** :
  le numéro géant en fusion **screen** à 30 % (il se dépose dans la photo) et le
  **grain** en fusion overlay à 16 %. En SwiftUI, `Canvas` avec
  `.blendMode(.screen)` / `.overlay` ; ou Core Graphics.
- La mention (« Meilleur buteur ») se pose **au-dessus du sommet réel du nom**
  (hauteur des capitales ≈ 0,72 × corps), pas à une valeur fixe.
- Le nom se réduit par pas de 4 jusqu'à ne pas heurter la note.
- Sans photo : fond dégradé, halo à la couleur d'accent, hachures à 45°, texte
  « PHOTO JOUEUR ». C'est un état normal (tout nouvel inscrit), pas une erreur.
- **Volume** (`volume.tsx`) : perspective + rotations, pas de moteur 3D.
  Glisser horizontal = rotation Y (0,008 rad/pt) ; **l'inclinaison X vient du
  gyroscope** (CoreMotion, beta − 35°, × 0,35, borné ± 14°) ; inertie au
  lâcher puis ressort mou vers l'angle de repos −0,30 rad ; double-toucher =
  retournement ; **une tranche** : quatre flancs dont la largeur = épaisseur ×
  |sin(angle)|, épaisseur 3,2 % de la largeur bornée 5–9 pt, dégradé de
  matière et filet clair au bord. Ombre : deux ellipses.
- Le geste horizontal ne doit **jamais** se disputer avec le défilement vertical.

Données : `src/donnees/joueurs.ts` (`CarteJoueur` : nom, pseudo, club, poste,
note, numéro, mention, accent, photo|null, six stats).

## 5. La feuille de match — `src/donnees/feuille.ts`, `src/composants/feuille/FeuilleHote.tsx`

C'est **l'acte capital** : sans validation, rien ne remonte (buts, passes,
classements). Machine à états, jamais de retour en arrière après validation :

```
ouvert ──démarrer──▶ en_cours ──terminer──▶ a_valider ──valider──▶ validee
```

- **ouvert** : l'hôte compose — toucher une carte ajoute le joueur (équilibrage
  automatique vers l'équipe la moins nombreuse), toucher l'équipe sous la carte
  la change. Démarrer exige ≥ 2 joueurs.
- **en_cours** : score en grand, **déduit des buts** (jamais stocké à part) ;
  un bouton « + But » par joueur ; après un but, bandeau « passe de : »
  proposant les coéquipiers ou « Sans passe » ; liste des buts avec le score
  courant ; « Annuler le dernier ».
- **a_valider** : on peut encore corriger, désigner **un seul** homme du match ;
  le bouton **« Valider la feuille de match » est collé en bas de l'écran**
  quoi qu'on fasse défiler, avec « Sans validation, rien ne remonte aux
  classements ». Confirmation avant validation.
- **validee** : figée, date affichée.

**Persistance à chaque geste** (`src/etat/persistance.native.ts`) : feuilles,
matchs créés, équipe, amis. En Swift : SwiftData ou un fichier JSON dans
Application Support — l'important est l'écriture synchrone à chaque action.
Un but marqué survit à la fermeture de l'app.

## 6. Les équipes — `src/donnees/equipes.ts`

- **Cinq à sept joueurs, bornes tenues par le modèle** (`probleme()`), pas par
  l'écran : pas de création sous 5, pas de 8e, pas de retrait sous 5. Le
  créateur est capitaine et ne peut pas partir.
- **Écusson composé, pas généré** : forme (écu / rond / pointe), motif (uni /
  bandes / diagonale / moitié), deux couleurs parmi huit, monogramme (1–3
  lettres, déduit du nom : « Les Renards du Nord » → RN, « FC » et « AS » comptent).
  Tracés SVG dans `src/composants/Ecusson.skia.tsx`. Doit rester lisible à 22 pt.
- **Classement des équipes** : 3 pts la victoire, 1 le nul ; départage
  différence de buts puis buts marqués (`classementEquipes`).
- Créer une équipe est **secondaire** ; proposée à l'ouverture d'un match,
  gérée dans Ligue → Équipes.

## 7. Ce qui est de la démonstration, et ce qui est réel

**Réel** : la structure, les règles, les états, la DA, la carte, le barème
Pépite (présence 1, victoire 2 / 3 en SFL Time, nul 1, but 1, passe 1, MVP 2,
impact 1, défensive 1, clean sheet 3, retard −1, absence injustifiée −2, une
paire d'arrêts ou d'interceptions = 1).

**Démonstration, à remplacer par des données serveur** :
- les quatre matchs de Jouer (`src/donnees/matchs.ts`) et leurs photos
  (`assets/terrains/`, sous licence CC BY-SA, voir `CREDITS.md`) ;
- les classements (`src/donnees/ligue.ts`) — seuls les totaux d'Ilyes sont ceux
  de la vraie saison (77 pp, 3e, 30 buts, 13 passes) ;
- le journal (`src/donnees/journal.ts`), cohérent avec ces classements ;
- les équipes et rencontres de démonstration ;
- le seul portrait présent est celui de Yacine, membre réel de la ligue.

**À venir, non construit** : la création du portrait à l'inscription (photos de
l'utilisateur en entrée, prompt système, modèle de génération **côté serveur**,
jamais de clé dans l'app) ; le branchement des feuilles validées sur les
classements ; l'attache d'une équipe à chaque côté d'un match ; la carte
géographique des matchs ; Supabase pour tout ce qui est persistant aujourd'hui
en local.

## 8. Ce que le propriétaire a demandé, dans ses mots

- « La fonctionnalité Jouer est celle qu'on doit avoir toujours en principal. »
- « Ça doit rester toujours visible pour l'utilisateur : c'est une action
  capitale à faire » (la validation de la feuille).
- « Elle ne peut excéder 7 joueurs et elle doit être créée uniquement quand il
  y a 5 joueurs. »
- Sur la carte : « trop grosse », « il n'y a pas d'épaisseur », « 1 ou 2 mm »,
  « pas très bien malléable » — corrigés dans la version de référence ; à
  vérifier en main sur la version Swift.
