"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsClient } from "@/hooks/use-is-client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "sfl-install-dismissed";

export function InstallPrompt() {
  const isClient = useIsClient();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!isClient) return null;

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const storedDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isStandalone || dismissed || storedDismissed) return null;
  if (!isIOS && !deferredPrompt) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl bg-card p-4 text-card-foreground shadow-xl shadow-black/20 md:bottom-4">
      <Download className="size-5 shrink-0 text-primary" />
      <div className="flex-1 text-sm">
        {isIOS ? (
          <p>
            Installe SFL : appuie sur <span className="font-medium">Partager</span> puis{" "}
            <span className="font-medium">Sur l&apos;écran d&apos;accueil</span>.
          </p>
        ) : (
          <p>Installe SFL sur ton appareil pour un accès rapide, même hors-ligne.</p>
        )}
      </div>
      {!isIOS && (
        <Button size="sm" onClick={install}>
          Installer
        </Button>
      )}
      <button
        onClick={dismiss}
        aria-label="Fermer"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
