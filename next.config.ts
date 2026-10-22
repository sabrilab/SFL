import type { NextConfig } from "next";

// La version de ce déploiement : son identifiant sur Vercel, l'heure du build
// ailleurs. Gravée dans le client ET dans /api/version : c'est en les
// comparant que l'app installée sait qu'une mise à jour est sortie
// (`src/components/pwa/mise-a-jour.tsx`).
const BOLA_VERSION =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

// Où tourne ce build : « production » seulement pour la prod Vercel. Les
// aperçus et le développement montrent des données de démonstration là où
// la ligue n'en a pas encore (les villes des joueurs, lib/sfl/villes.ts).
const BOLA_ENV = process.env.VERCEL_ENV ?? "development";

// Le projet Supabase de la ligue (le même repli que lib/supabase.ts).
const SUPABASE_HOTE = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co").hostname;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BOLA_VERSION: BOLA_VERSION, NEXT_PUBLIC_BOLA_ENV: BOLA_ENV },
  // Les photos des joueurs (le bucket public « photos ») passent par
  // l'optimiseur d'images de Vercel : la Map n'en montre que des vignettes
  // de 128 px en WebP, quelques Ko au lieu de la photo de 900 px
  // (lib/sfl/photos.ts, photoMiniature). Pas de filtre sur la requête :
  // chaque photo porte sa version (`?v=`), qui change à chaque studio.
  images: {
    remotePatterns: [{ protocol: "https", hostname: SUPABASE_HOTE, pathname: "/storage/v1/object/public/photos/**" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
