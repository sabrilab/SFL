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
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
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
                  <main className="flex-1 pb-32 md:pb-10">{children}</main>
                </div>
                <BottomNav />
                <InstallPrompt />
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
