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
import { PlayerProvider } from "@/components/sfl/player-provider";

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
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PlayerProvider>
            <TooltipProvider delay={200}>
              <ServiceWorkerRegister />
              <SiteHeader />
              <main className="flex-1 pb-28 md:pb-10">{children}</main>
              <BottomNav />
              <InstallPrompt />
              <Toaster position="top-center" />
            </TooltipProvider>
          </PlayerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
