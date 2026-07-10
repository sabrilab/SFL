# SFL — Sunday Five League

Progressive Web App de la Sunday Five League : classement Pépite d'Or,
matchs et feuilles de match, cartes joueurs évolutives (EvoDay) et
convocations. Construite avec Next.js (App Router), Tailwind CSS et
shadcn/ui, pensée **mobile-first** (~80% des décisions d'interface partent du
mobile, puis s'adaptent aux écrans plus larges).

## Écrans (interface joueur)

- **Accueil** (`/`) — convocation du prochain match à confirmer, dernier
  résultat, top 3 Pépite d'Or, aperçu de sa carte.
- **Stats** (`/stats`) — classement complet + journées jouées avec faits
  marquants et feuille de match.
- **Ma carte** (`/carte`) — carte joueur (Standard/Rare), cartes Boost
  (MVP / Impact / Défensive), simulateur EvoDay de répartition de points,
  barème Points Pépite.
- **Admin** (`/admin`) — placeholder de la future interface administrateur
  (convocations, feuilles de match, localisation, joueurs, EvoDay).

Thème clair / sombre / système via le menu en haut à droite. Le profil
joueur actif se choisit dans le sélecteur du header (persisté en local).
Les données de démo viennent du classeur `SFL_Statistiques_Base_Propre.xlsx`
(`src/lib/sfl/data.ts`) ; le moteur de règles est dans `src/lib/sfl/engine.ts`.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Tailwind CSS v4**
- **shadcn/ui** pour les modules d'interface (composants installés à la demande)
- **next-themes** pour le mode clair/sombre
- PWA native Next.js : `app/manifest.ts`, icônes générées (`icon.tsx`,
  `apple-icon.tsx`, `icon-192.png`, `icon-512.png`) et service worker
  (`public/sw.js`) pour l'installation et le support hors-ligne.

## Démarrer en local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Pour tester l'installation PWA et le hors-ligne, lancer un build de
production (le service worker n'est actif qu'en production) :

```bash
npm run build
npm run start
```

## Ajouter des modules d'interface (shadcn/ui)

Chaque nouvelle fonctionnalité peut s'appuyer sur un composant shadcn/ui.
Pour en ajouter un nouveau :

```bash
npx shadcn@latest add <composant>
```

Les composants déjà installés sont visibles sur `/composants` et dans
`src/components/ui/`. La configuration shadcn est dans `components.json`.

## Déploiement sur Vercel

1. Pousser ce dépôt sur GitHub (déjà fait si tu lis ceci depuis la branche).
2. Sur [vercel.com/new](https://vercel.com/new), importer le dépôt.
3. Nommer le projet **`sfl`** (nom affiché : SFL).
4. Aucune configuration supplémentaire n'est nécessaire (zero-config Next.js).
   Le domaine par défaut sera `sfl.vercel.app` (ou `sfl-<team>.vercel.app`
   selon la disponibilité).
5. Une fois déployé, mettre à jour `metadataBase` dans
   `src/app/layout.tsx` avec l'URL de production si elle diffère de
   `https://sfl.vercel.app`.

Chaque push sur la branche connectée déclenche un nouveau déploiement.

## Structure

```
src/
  app/            routes (App Router), manifest, icônes PWA
  components/
    ui/           modules shadcn/ui
    layout/       en-tête + navigation basse (mobile-first)
    pwa/          service worker + invite d'installation
  lib/            utilitaires (cn, navigation)
public/
  sw.js           service worker (cache hors-ligne)
```
