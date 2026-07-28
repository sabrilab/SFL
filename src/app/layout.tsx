import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Anton, Barlow_Condensed } from "next/font/google";
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
import { SeasonProvider } from "@/components/sfl/season-provider";
import { CardViewerProvider } from "@/components/sfl/card-viewer";
import { AppSplash } from "@/components/sfl/app-splash";
import { DeployTestDialog } from "@/components/sfl/deploy-test-dialog";

// TEMPORAIRE — repères du build pour la pop-up de test de déploiement.
// Évalués ici, dans un composant serveur, donc figés au `next build` :
// la même valeur part dans le HTML prérendu et dans l'hydratation.
// Vercel expose le SHA du commit déployé ; en local on affiche "local".
const BUILD_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
const BUILD_AT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
}).format(new Date());

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sfl-eight.vercel.app"),
  title: {
    default: "SFL — Sunday Five League",
    template: "%s · SFL",
  },
  description:
    "Sunday Five League — classement Pépite d'Or, matchs, cartes joueurs et convocations. Chaque dimanche compte.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SFL",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
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
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${barlow.variable} h-full antialiased`}
    >
      {/* body ne défile jamais lui-même (overflow hidden, hauteur figée à
          celle de l'écran) : c'est le conteneur interne juste en dessous
          qui porte tout le scroll. Sans ça, le rebond élastique iOS/PWA
          s'applique au document entier et fait visuellement "sortir du
          cadre" toute l'appli (header, tab bar) au lieu de rester contenu
          dans une simple liste qui rebondit sur elle-même. */}
      <body className="h-dvh overflow-hidden overscroll-none touch-manipulation">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SeasonProvider>
            <PlayerProvider>
            <CardViewerProvider>
              <TooltipProvider delay={200}>
                <AppSplash />
                <ViewportLock />
                <ServiceWorkerRegister />
                <div
                  id="app-scroll"
                  className="flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <SiteHeader />
                  <main className="flex-1 pb-32 md:pb-10">{children}</main>
                </div>
                <BottomNav />
                <InstallPrompt />
                <DeployTestDialog commit={BUILD_COMMIT} builtAt={BUILD_AT} />
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
