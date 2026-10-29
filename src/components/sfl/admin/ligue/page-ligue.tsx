"use client";

// Ligue (≡) : tout ce qui n'est pas la journée, rangé comme les Réglages
// d'iOS — une ligne par sujet, son compteur en mono à droite. Chaque fonction
// d'avant le 30/10/2026 a ici sa maison ; le tableau complet (Vue, Saisie,
// Feuille, Joueurs) reste ouvert derrière, onglet par onglet.

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useArbitres } from "@/hooks/use-arbitres";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { isAdmin } from "@/lib/sfl/admin";
import { neJouePas } from "@/lib/sfl/hidden";
import { estBrouillon } from "@/lib/sfl/saisie/brouillon";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { numeroSaison } from "@/lib/sfl/saisie/types";

type Ligne = { titre: string; href: string; compteur?: string };

function Groupe({ lignes }: { lignes: Ligne[] }) {
  return (
    <div className="glass overflow-hidden rounded-[22px]">
      {lignes.map((l, i) => (
        <Link
          key={l.titre}
          href={l.href}
          className={`flex min-h-[54px] items-center gap-3 px-4 transition-colors active:bg-secondary ${i ? "border-t border-border/50" : ""}`}
        >
          <span className="flex-1 text-[15.5px] font-semibold">{l.titre}</span>
          {l.compteur && <span className="mono-label text-foreground/55">{l.compteur}</span>}
          <ChevronRight className="size-4 shrink-0 text-foreground/35" />
        </Link>
      ))}
    </div>
  );
}

export function PageLigue() {
  const { me } = useMyPlayer();
  const { saison, isClient } = useSaisieAdmin();
  const arbitres = useArbitres();
  if (!isClient) return null;
  if (!isAdmin(me))
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
        <Lock className="size-6 text-muted-foreground" />
      </div>
    );
  const nonJoueurs = saison.roster.filter((r) => neJouePas(r.name)).length;
  const brouillons = saison.journees.filter(estBrouillon).length;
  const alertes = deriveSeason(saison).alerts.length;
  return (
    <div className="shell flex flex-col gap-5 py-4 sm:max-w-[600px]">
      <header className="flex items-center gap-2">
        <BoutonRetour parent="/admin" titre="la journée" />
        <h1 className="titre-lettrage flex-1 text-[22px]">Ligue</h1>
      </header>

      <Groupe
        lignes={[
          { titre: "Effectif", href: "/admin/ligue/effectif", compteur: `${saison.roster.length}${nonJoueurs ? ` · ${nonJoueurs} ne joue pas` : ""}` },
          { titre: "Inscriptions", href: "/admin/tableau" },
          { titre: "Accès", href: "/admin/comptes" },
          { titre: "Arbitres", href: "/admin/tableau?onglet=joueurs", compteur: String(arbitres.arbitres.length) },
        ]}
      />
      <Groupe
        lignes={[
          { titre: "Saisons", href: "/admin/tableau", compteur: `Saison ${numeroSaison(saison)} · J${saison.journees.reduce((m, x) => Math.max(m, x.j), 0)}${brouillons ? ` · ${brouillons} brouillon` : ""}` },
          { titre: "Feuilles de match", href: "/admin/tableau?onglet=feuille&mode=revue", compteur: alertes ? `${alertes} alerte${alertes > 1 ? "s" : ""}` : undefined },
          { titre: "Votes", href: "/admin/tableau?onglet=feuille&mode=votes" },
          { titre: "Grille", href: "/admin/tableau?onglet=grille", compteur: "Ordinateur" },
          { titre: "Historique et corbeille", href: "/admin/tableau" },
        ]}
      />
      <Groupe
        lignes={[
          { titre: "Terrains", href: "/map", compteur: String((saison.terrains ?? []).length) },
          { titre: "Notifications", href: "/admin/notifications" },
          { titre: "Activité", href: "/admin/activite" },
          { titre: "Installation", href: "/admin/setup" },
          { titre: "Tableau complet", href: "/admin/tableau" },
        ]}
      />
    </div>
  );
}
