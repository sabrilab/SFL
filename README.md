# SFL

Progressive Web App construite avec Next.js (App Router), Tailwind CSS et
shadcn/ui, pensée **mobile-first** (~80% des décisions d'interface partent du
mobile, puis s'adaptent aux écrans plus larges).

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
