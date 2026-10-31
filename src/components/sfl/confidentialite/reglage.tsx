"use client";

// La section « Confidentialité » des Réglages : la politique en entier,
// quand le joueur l'a acceptée, et l'usage de sa carte hors de l'app, qu'il
// change quand il veut (une nouvelle ligne d'accord, lib/sfl/consentement).

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Clapperboard, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/hooks/use-session";
import { useAccord } from "@/hooks/use-accord";
import { DATE_POLITIQUE, accordValable, dateAccord } from "@/lib/sfl/confidentialite";
import { changerHorsApp } from "@/lib/sfl/consentement";

export function ReglageConfidentialite() {
  const session = useSession();
  const nom = session?.name ?? null;
  const { accord } = useAccord(nom);
  const [envoi, setEnvoi] = useState(false);
  const accepte = accordValable(accord?.version) ? accord : null;

  async function changer(horsApp: boolean) {
    if (!nom || envoi) return;
    setEnvoi(true);
    const ok = await changerHorsApp(nom, horsApp);
    setEnvoi(false);
    toast.success(horsApp ? "Ta carte peut apparaître hors de l'app" : "Ta carte reste dans l'app", {
      description: ok ? undefined : "Enregistré sur ce téléphone, envoyé dès que possible.",
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Link
        href="/confidentialite"
        className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity active:opacity-70"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
          <ShieldCheck className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lecture font-semibold">Politique de confidentialité</span>
          <span className="block text-petit text-encre-3">
            {accepte && !accepte.enAttente ? `Acceptée le ${dateAccord(accepte.le)}` : `Version du ${DATE_POLITIQUE}`}
          </span>
        </span>
        <ChevronRight className="size-4 text-encre-3" />
      </Link>
      {accepte && (
        <label className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
            <Clapperboard className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lecture font-semibold">Ma carte hors de l&apos;app</span>
            <span className="block text-petit text-encre-3">Dans les vidéos et les posts de Bola</span>
          </span>
          <Switch checked={accepte.horsApp} disabled={envoi} onCheckedChange={(v) => void changer(v)} />
        </label>
      )}
    </div>
  );
}
