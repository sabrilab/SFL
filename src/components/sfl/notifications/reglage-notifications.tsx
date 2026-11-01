"use client";

// La ligne « Notifications » des réglages : l'état de ce téléphone, et le
// bouton pour les activer. Les désactiver passe par les réglages du
// téléphone, comme pour toute app.

import { useEffect, useState } from "react";
import { Bell, BellOff, Check } from "lucide-react";
import { toast } from "sonner";
import { activerNotifications, etatNotifications, type EtatNotifications } from "@/lib/sfl/notifications";

const LIBELLE: Record<EtatNotifications, string> = {
  indisponible: "Pas disponibles sur ce navigateur",
  bientot: "Bientôt",
  "a-installer": "Ajoute d'abord Bola à ton écran d'accueil",
  refusees: "Refusées dans les réglages du téléphone",
  actives: "Activées sur ce téléphone",
  inactives: "Désactivées",
};

export function ReglageNotifications() {
  const [etat, setEtat] = useState<EtatNotifications | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void etatNotifications().then(setEtat);
  }, []);

  async function activer() {
    setBusy(true);
    try {
      const e = await activerNotifications("reglages");
      setEtat(e);
      if (e === "actives") toast.success("Notifications activées");
      else if (e === "refusees") toast.error("Refusées : change-le dans les réglages du téléphone.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
    }
  }

  const actives = etat === "actives";
  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
      <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
        {etat === "refusees" || etat === "indisponible" || etat === "bientot" ? (
          <BellOff className="size-[18px]" />
        ) : (
          <Bell className="size-[18px]" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lecture font-semibold">Notifications</span>
        <span className="block text-petit text-encre-3">{etat ? LIBELLE[etat] : " "}</span>
      </span>
      {actives ? (
        <Check className="size-4 text-encre-2" />
      ) : etat === "inactives" ? (
        <button
          type="button"
          onClick={activer}
          disabled={busy}
          className="bouton-principal bouton--mauve shrink-0 px-4 py-2 text-corps font-bold disabled:opacity-40"
        >
          Activer
        </button>
      ) : null}
    </div>
  );
}
