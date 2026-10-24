import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Anton, Barlow_Condensed } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { BottomNav, VoileEtat } from "@/components/layout/bottom-nav";
import { MemoireNavigation } from "@/components/layout/memoire-navigation";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { MiseAJour } from "@/components/pwa/mise-a-jour";
import { CouleurTheme } from "@/components/pwa/couleur-theme";
import { GuideInstallation } from "@/components/pwa/guide-installation";
import { ViewportLock } from "@/components/pwa/viewport-lock";
import { PlayerProvider } from "@/components/sfl/player-provider";
import { AuthGate } from "@/components/sfl/auth/auth-gate";
import { SeasonProvider } from "@/components/sfl/season-provider";
import { XpLigueProvider } from "@/components/sfl/xp-ligue";
import { CardViewerProvider } from "@/components/sfl/card-viewer";
import { AppSplash } from "@/components/sfl/app-splash";
import { ActivityTracker } from "@/components/sfl/activity-tracker";
import { NouvellesCartes } from "@/components/sfl/nouvelle-carte";
import { ConnexionLocale } from "@/components/sfl/auth/connexion-locale";
import { PhotosSync } from "@/components/sfl/photos-sync";
import { MissionsAnnonce } from "@/components/sfl/missions-annonce";
import { NouveauxBadges } from "@/components/sfl/vitrine";
import { InvitationCarte } from "@/components/sfl/invitation-carte";
import { Accueil, ApresAccueil } from "@/components/sfl/accueil/accueil";

// Typographie de l'app BOLA, celle de la Map (Sabri, 22/10 : « uniformise le
// tout ») : Inter pour tout ce qui se lit (celle du site), au plus gras pour
// les titres en capitales, et JetBrains Mono pour les étiquettes en
// capitales, sur tous les appareils (globals.css, .titre-lettrage et
// .mono-label).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  weight: ["400", "600", "700"],
  variable: "--font-jbmono",
  subsets: ["latin"],
});

// Les chiffres : rangs, scores, notes. Les titres l'ont quittée le 22/10
// pour le lettrage de la Map ; les cartes et les écussons gardent leurs lettres.
const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

// La typo des cartes joueurs (card-shell.tsx) : on ne retouche pas les cartes.
const barlow = Barlow_Condensed({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sfl-eight.vercel.app"),
  title: {
    default: "Bola — Sunday Five League",
    template: "%s · Bola",
  },
  description:
    "Bola, l'app de la Sunday Five League — la Map des matchs, le classement Pépite d'Or, les cartes joueurs et les convocations. Chaque dimanche compte.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bola",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#08090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${jbMono.variable} ${anton.variable} ${barlow.variable} h-full antialiased`}
    >
      {/* body ne défile jamais lui-même (overflow hidden, hauteur figée à
          celle de l'écran) : c'est le conteneur interne juste en dessous
          qui porte tout le scroll. Sans ça, le rebond élastique iOS/PWA
          s'applique au document entier et fait visuellement "sortir du
          cadre" toute l'appli (header, tab bar) au lieu de rester contenu
          dans une simple liste qui rebondit sur elle-même. */}
      <body className="h-dvh overflow-hidden overscroll-none touch-manipulation">
        {/* Clair, sombre ou Auto (qui suit le téléphone), au choix de chaque
            joueur : le rond en haut de Ma carte, ou les réglages. Le sombre
            reste le thème de qui n'a rien choisi. Le choix est gardé sur le
            téléphone (bola-theme). */}
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem storageKey="bola-theme" disableTransitionOnChange>
          <CouleurTheme />
          <SeasonProvider>
            <PlayerProvider>
            <XpLigueProvider>
            <CardViewerProvider>
              <TooltipProvider delay={200}>
                <AuthGate>
                <AppSplash />
                <ActivityTracker />
                <ConnexionLocale />
                <PhotosSync />
                <MissionsAnnonce />
                {/* L'accueil de l'app passe avant tout ce qui s'ouvre de
                    soi-même (cérémonies, badges, invitations) : à la première
                    ouverture, tout ce qui manque au joueur, puis la visite.
                    Hors de lui, la case de confidentialité garde la porte. */}
                <Accueil />
                <ApresAccueil>
                  <NouvellesCartes />
                  <NouveauxBadges />
                  <InvitationCarte />
                </ApresAccueil>
                {/* Orbes lumineux du design de référence, derrière tout le contenu */}
                <div className="orbs" aria-hidden>
                  <i /><i /><i />
                </div>
                <ViewportLock />
                <ServiceWorkerRegister />
                {/* En PWA installée, `viewportFit: cover` + barre d'état
                    translucide font commencer le contenu SOUS l'encoche et la
                    Dynamic Island : le conteneur se décale de l'inset haut.
                    Rien n'est collé en haut (ni logo ni en-tête, comme dans
                    une app iOS) : toute la navigation est dans la barre
                    d'onglets en bas, qui gère son inset bas. */}
                <div
                  id="app-scroll"
                  className="flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    paddingTop: "env(safe-area-inset-top)",
                  }}
                >
                  <main className="flex-1 pt-3 pb-32">{children}</main>
                </div>
                {/* Après les pages : la place d'une page se pose après le
                    défilement de Next vers le haut. */}
                <Suspense fallback={null}>
                  <MemoireNavigation />
                </Suspense>
                <VoileEtat />
                <BottomNav />
                </AuthGate>
                {/* Hors de la porte de connexion : le guide passe avant le
                    compte, pour ne pas se connecter dans Snapchat. */}
                <GuideInstallation />
                {/* Hors de la porte aussi : l'écran de connexion se met à jour. */}
                <MiseAJour />
                <Toaster position="top-center" />
              </TooltipProvider>
            </CardViewerProvider>
            </XpLigueProvider>
            </PlayerProvider>
          </SeasonProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
