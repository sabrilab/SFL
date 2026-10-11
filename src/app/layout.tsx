import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Anton, Barlow_Condensed } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ViewportLock } from "@/components/pwa/viewport-lock";
import { PlayerProvider } from "@/components/sfl/player-provider";
import { AuthGate } from "@/components/sfl/auth/auth-gate";
import { SeasonProvider } from "@/components/sfl/season-provider";
import { CardViewerProvider } from "@/components/sfl/card-viewer";
import { AppSplash } from "@/components/sfl/app-splash";
import { ActivityTracker } from "@/components/sfl/activity-tracker";
import { NouvellesCartes } from "@/components/sfl/nouvelle-carte";
import { ConnexionLocale } from "@/components/sfl/auth/connexion-locale";

// Typographie de l'app BOLA : une sans neutre pour tout ce qui se lit (Inter,
// celle du site), et une monospace pour les étiquettes en capitales — SF Mono
// sur iPhone, JetBrains Mono partout ailleurs.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  weight: ["400", "600", "700"],
  variable: "--font-jbmono",
  subsets: ["latin"],
});

// Chiffres de l'arène de duel, seul usage restant d'une typo d'affiche.
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
        {/* Version sombre uniquement pour l'instant (décision admin) : le
            thème clair du design existe mais n'est pas encore porté partout,
            on force le sombre plutôt que d'exposer un clair à moitié fait. */}
        <ThemeProvider attribute="class" forcedTheme="dark" disableTransitionOnChange>
          <SeasonProvider>
            <PlayerProvider>
            <CardViewerProvider>
              <TooltipProvider delay={200}>
                <AuthGate>
                <AppSplash />
                <ActivityTracker />
                <NouvellesCartes />
                <ConnexionLocale />
                {/* Orbes lumineux du design de référence, derrière tout le contenu */}
                <div className="orbs" aria-hidden>
                  <i /><i /><i />
                </div>
                <ViewportLock />
                <ServiceWorkerRegister />
                {/* En PWA installée, `viewportFit: cover` + barre d'état
                    translucide font commencer le contenu SOUS l'encoche et la
                    Dynamic Island. Sans ce décalage, le header (et donc le
                    sélecteur de profil et le bouton de thème) se retrouve
                    derrière la barre d'état, difficile voire impossible à
                    toucher. La tab bar, elle, gère déjà son inset bas. */}
                <div
                  id="app-scroll"
                  className="flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
                  style={{
                    WebkitOverflowScrolling: "touch",
                    paddingTop: "env(safe-area-inset-top)",
                  }}
                >
                  <SiteHeader />
                  <main className="flex-1 pb-32 lg:pb-10">{children}</main>
                </div>
                <BottomNav />
                <InstallPrompt />
                </AuthGate>
                <Toaster position="top-center" />
              </TooltipProvider>
            </CardViewerProvider>
            </PlayerProvider>
          </SeasonProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
