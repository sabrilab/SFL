"use client";

// Les équipes de dimanche — le composeur de l'admin.
//
// Depuis les confirmés de la convocation (la même liste que le panneau de
// présence, partagée quand Supabase est branché), l'admin génère des équipes
// équilibrées à l'OVR des cartes, regénère tant que ça ne lui plaît pas, puis
// valide. Les équipes validées voyagent AVEC la convocation : chaque joueur
// les découvre dans sa conversation à partir du vendredi 19h — l'envoi du
// vendredi soir, sans envoyer quoi que ce soit à la main.
//
// « Selon l'avis des joueurs » attend les compositions d'Arène : verrouillé.
//
// Depuis le 23/10, chaque match se joue les Noirs contre les Blancs : les
// équipes générées s'appellent « Noirs 1 », « Blancs 1 »… (saisie/equipes.ts).

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Send, Users } from "lucide-react";
import { Locked } from "@/components/sfl/locked";
import { useSeason } from "@/components/sfl/season-provider";
import { usePresence } from "@/hooks/use-presence";
import { generateBalancedTeams, type BalancedTeam } from "@/lib/sfl/saisie/mutations";
import { equipesDeConvocation } from "@/lib/sfl/saisie/equipes";
import { ovr, rareStats } from "@/lib/sfl/engine";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { cn } from "@/lib/utils";

export function EquipesDimanche() {
  const presence = usePresence();
  const { allPlayers } = useSeason();
  const [draft, setDraft] = useState<BalancedTeam[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Réservé à l'admin — le hook ne donne saveTeams qu'à lui.
  if (!presence.saveTeams) return null;

  const confirmés = presence.presents;
  // Un match jusqu'à 12 confirmés, deux au-delà.
  const nbEquipes = confirmés.length > 12 ? 4 : 2;

  const ovrOf = (name: string) => {
    const p = allPlayers.find((x) => x.name === name);
    return p ? ovr(rareStats(p.stats)) : 75;
  };

  function generer() {
    if (confirmés.length < 2) {
      toast.error("Pas assez de confirmés pour composer des équipes.");
      return;
    }
    setDraft(generateBalancedTeams(confirmés.map((name) => ({ name, ovr: ovrOf(name) })), nbEquipes));
  }

  async function valider() {
    if (!draft || !presence.saveTeams) return;
    setSaving(true);
    const ok = await presence.saveTeams(
      draft.map((t) => ({ name: t.name, players: t.players.map((p) => p.name) }))
    );
    setSaving(false);
    if (ok) {
      setDraft(null);
      toast.success("Équipes validées", {
        description: "Chaque joueur les découvrira dans sa conversation vendredi à 19h.",
      });
    } else {
      toast.error("Enregistrement impossible. Réessaie dans un instant.");
    }
  }

  async function retirer() {
    if (!presence.saveTeams) return;
    const ok = await presence.saveTeams(null);
    if (ok) toast.success("Équipes retirées — rien ne sera envoyé vendredi.");
  }

  const validées = presence.teams;
  const affichées = draft ?? null;

  return (
    <div className="rounded-3xl bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Users className="size-4 text-primary" /> Les équipes de dimanche
        </span>
        <span className="mono-label text-foreground/40">
          {confirmés.length} confirmé{confirmés.length > 1 ? "s" : ""} → {nbEquipes / 2} match{nbEquipes > 2 ? "s" : ""}
        </span>
      </div>
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        Générées depuis les « oui » de la convocation, équilibrées à l&apos;OVR des cartes.
        Validées, elles tombent dans la conversation de chaque joueur{" "}
        <strong className="text-foreground/80">vendredi à 19h</strong> — c&apos;est l&apos;envoi
        du vendredi soir.
      </p>

      {/* L'état en base : ce qui partira vendredi */}
      {validées && validées.length > 0 && !affichées && (
        <div className="mt-3 flex flex-col gap-2">
          {equipesDeConvocation(validées).map((t) => (
            <div key={t.nom} className="rounded-2xl bg-secondary/40 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  {t.camp && <PointMaillot camp={t.camp} />}
                  {t.libelle}
                </span>
                <span className="mono-label text-foreground/40">{t.joueurs.length} joueur{t.joueurs.length > 1 ? "s" : ""}</span>
              </div>
              <p className="text-[12.5px] leading-snug text-foreground/55">
                {t.joueurs.join(" · ")}
              </p>
            </div>
          ))}
          <p className="mono-label text-emerald-700 dark:text-emerald-400">
            ✓ Prêtes — {presence.equipesVisibles ? "visibles par la ligue" : "révélées vendredi 19h"}
          </p>
        </div>
      )}

      {/* Le brouillon en cours */}
      {affichées && (
        <div className="mt-3 flex flex-col gap-2">
          {equipesDeConvocation(affichées.map((t) => ({ name: t.name, players: t.players.map((p) => p.name) }))).map((t) => (
            <div key={t.nom} className="rounded-2xl bg-secondary/40 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  {t.camp && <PointMaillot camp={t.camp} />}
                  {t.libelle}
                </span>
                <span className="mono-label text-foreground/40">
                  OVR {affichées.find((x) => x.name === t.nom)?.totalOvr}
                </span>
              </div>
              <p className="text-[12.5px] leading-snug text-foreground/55">
                {t.joueurs.join(" · ")}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={generer}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold",
            affichées ? "bouton-secondaire bouton--vert" : "bouton-principal bouton--vert"
          )}
        >
          <RefreshCw className="size-3.5" /> {affichées ? "Regénérer" : "Générer les équipes"}
        </button>
        {affichées && (
          <button
            onClick={valider}
            disabled={saving}
            className="bouton-principal bouton--vert flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold disabled:opacity-50"
          >
            <Send className="size-3.5" /> Valider — envoi vendredi 19h
          </button>
        )}
        {validées && validées.length > 0 && !affichées && (
          <button
            onClick={retirer}
            className="bouton-secondaire bouton--rouge px-3.5 py-2 text-[13px] font-semibold"
          >
            Retirer
          </button>
        )}
        <Locked label="Bientôt" note="Utilisera les compositions déposées dans l'Arène.">
          <span className="glass-soft block rounded-full px-3.5 py-2 text-[13px] font-semibold text-foreground/60">
            Selon l&apos;avis des joueurs
          </span>
        </Locked>
      </div>
    </div>
  );
}
