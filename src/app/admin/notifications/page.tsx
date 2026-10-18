"use client";

// Envoyer une notification — l'admin écrit un titre, un texte, choisit la
// page qui s'ouvre au toucher, et voit combien de téléphones la recevront.
// « M'envoyer un essai » ne vise que ses propres téléphones ; l'envoi à toute
// la ligue demande une confirmation, car il ne se rattrape pas.
//
// Le compte d'abonnés se lit avec les droits de l'admin (RLS de
// push_abonnements) ; l'envoi passe par /api/push/envoyer.

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";
import { TEXTE_MAX, TITRE_MAX, type Notif } from "@/lib/sfl/push";
import { ReglageNotifications } from "@/components/sfl/notifications/reglage-notifications";

const PAGES = [
  { url: "/profil", label: "Ma carte" },
  { url: "/map", label: "Map" },
  { url: "/ligue", label: "Ligue" },
] as const;

const BROUILLON: Notif = {
  titre: "Ta carte officielle t'attend",
  texte: "Ton visage, le maillot Bola : crée ta carte officielle en une minute.",
  url: "/profil",
};

async function jeton(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export default function NotificationsAdmin() {
  const session = useSession();
  const [notif, setNotif] = useState<Notif>(BROUILLON);
  const [abonnes, setAbonnes] = useState<{ telephones: number; joueurs: number } | null>(null);
  const [busy, setBusy] = useState<"essai" | "tous" | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const [tour, setTour] = useState(0);
  const compter = useCallback(() => setTour((t) => t + 1), []);

  useEffect(() => {
    if (!session?.server || !session.admin) return;
    void Promise.resolve(supabase().from("push_abonnements").select("user_id")).then(({ data }) => {
      if (data) setAbonnes({ telephones: data.length, joueurs: new Set(data.map((r) => r.user_id)).size });
    });
  }, [session?.server, session?.admin, tour]);

  if (!session?.admin) {
    return <p className="px-5 py-10 text-center text-foreground/50">Réservé à l&apos;admin.</p>;
  }

  const valide = notif.titre.trim().length > 0 && notif.texte.trim().length > 0;

  async function envoyer(essai: boolean) {
    const accessToken = await jeton();
    if (!accessToken) {
      toast.error("Reconnecte-toi pour envoyer.");
      return;
    }
    setBusy(essai ? "essai" : "tous");
    try {
      const r = await fetch("/api/push/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, notif, essai }),
      });
      const j = (await r.json().catch(() => ({}))) as { envoyes?: number; echecs?: number; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Envoi impossible.");
      const n = j.envoyes ?? 0;
      toast.success(n === 1 ? "Envoyée à 1 téléphone" : `Envoyée à ${n} téléphones`, {
        description: j.echecs ? `${j.echecs} n'ont pas répondu.` : undefined,
      });
      setConfirmer(false);
      compter();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div className="flex items-center gap-2.5">
        <span className="glass flex size-11 items-center justify-center rounded-2xl">
          <Bell className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-foreground/45">Admin</p>
          <h1 className="text-[28px] font-bold tracking-tight">Notification</h1>
        </div>
      </div>

      <ReglageNotifications />

      <section className="flex flex-col gap-2.5">
        <input
          value={notif.titre}
          maxLength={TITRE_MAX}
          onChange={(e) => setNotif({ ...notif, titre: e.target.value })}
          placeholder="Titre"
          className="glass-soft rounded-2xl px-4 py-3.5 text-[15px] font-semibold outline-none placeholder:text-foreground/30"
        />
        <textarea
          value={notif.texte}
          maxLength={TEXTE_MAX}
          rows={3}
          onChange={(e) => setNotif({ ...notif, texte: e.target.value })}
          placeholder="Texte"
          className="glass-soft resize-none rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:text-foreground/30"
        />
        <div className="glass flex rounded-2xl p-1">
          {PAGES.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setNotif({ ...notif, url: p.url })}
              className={
                "flex-1 rounded-xl py-2.5 text-[13px] font-semibold " +
                (notif.url === p.url ? "bg-foreground/10 text-foreground" : "text-foreground/45")
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* L'aperçu, comme sur un écran verrouillé. */}
      <div className="flex items-start gap-3 rounded-[22px] bg-foreground/[0.08] p-3.5 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-[38px] rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-semibold">{notif.titre || "Titre"}</span>
            <span className="shrink-0 text-[12px] text-foreground/40">maintenant</span>
          </div>
          <p className="text-[14px] leading-snug text-foreground/75">{notif.texte || "Texte"}</p>
        </div>
      </div>

      <p className="px-1 text-[13px] text-foreground/50">
        {abonnes === null
          ? " "
          : abonnes.joueurs === 0
            ? "Aucun joueur n'a encore activé les notifications."
            : `${abonnes.joueurs} joueur${abonnes.joueurs > 1 ? "s" : ""} · ${abonnes.telephones} téléphone${abonnes.telephones > 1 ? "s" : ""}`}
      </p>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          disabled={!valide || busy !== null}
          onClick={() => envoyer(true)}
          className="glass flex items-center justify-center gap-2 rounded-full py-[14px] text-[15px] font-bold disabled:opacity-40"
        >
          {busy === "essai" && <Loader2 className="size-4 animate-spin" />}
          M&apos;envoyer un essai
        </button>
        {!confirmer ? (
          <button
            type="button"
            disabled={!valide || busy !== null || !abonnes?.telephones}
            onClick={() => setConfirmer(true)}
            className="rounded-full bg-foreground py-[15px] text-[15px] font-bold text-background disabled:opacity-40"
          >
            Envoyer à toute la ligue
          </button>
        ) : (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => envoyer(false)}
            className="flex items-center justify-center gap-2 rounded-full bg-[#FF8A4C] py-[15px] text-[15px] font-bold text-black disabled:opacity-40"
          >
            {busy === "tous" && <Loader2 className="size-4 animate-spin" />}
            Confirmer l&apos;envoi à {abonnes?.telephones} téléphone{(abonnes?.telephones ?? 0) > 1 ? "s" : ""}
          </button>
        )}
      </div>
    </div>
  );
}
