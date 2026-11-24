"use client";

// L'onglet Plus de l'admin (refonte du 24/11/2026, maquette v3) : ce qui
// n'est ni la journée, ni les joueurs, ni Analytics, en trois listes façon
// Réglages d'iOS. Journées (les saisons, les feuilles de match, l'historique),
// Ligue (arbitres, terrains, notification), Atelier (la base, le design, la
// note du Labo, le tableau complet). Chaque compteur reprend celui de l'ancien
// écran ≡ (page-ligue, retiré) : les brouillons et les journées à rattraper
// des Saisons, les alertes des feuilles.
//
// Sur téléphone, la dernière ligne ramène à l'app ; sur ordinateur, c'est le
// bas de la colonne (coquille.tsx).

import { ArrowUpRight } from "lucide-react";
import { useArbitres } from "@/hooks/use-arbitres";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { estBrouillon } from "@/lib/sfl/saisie/brouillon";
import { journeesEnSuspens } from "@/lib/sfl/saisie/suspens";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { numeroSaison } from "@/lib/sfl/saisie/types";
import { useEstAdmin } from "./coquille";
import { Entete, Ligne, Liste, PageAdmin, Reserve } from "./ui-admin";

export function PagePlus() {
  const admin = useEstAdmin();
  const { saison, isClient } = useSaisieAdmin();
  const arbitres = useArbitres();
  if (!isClient) return null;
  if (!admin) return <Reserve />;

  const derniere = saison.journees.reduce((m, x) => Math.max(m, x.j), 0);
  const brouillons = saison.journees.filter(estBrouillon).length;
  const aRattraper = journeesEnSuspens(saison).length;
  const alertes = deriveSeason(saison).alerts.length;
  const saisons = [`Saison ${numeroSaison(saison)} · J${derniere}`, brouillons ? `${brouillons} brouillon` : "", aRattraper ? `${aRattraper} à rattraper` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageAdmin etroite className="gap-6">
      <Entete titre="Plus" />
      <Liste titre="Journées">
        <Ligne titre="Saisons" droite={saisons} href="/admin/tableau" />
        <Ligne titre="Feuilles de match" droite={alertes ? `${alertes} alerte${alertes > 1 ? "s" : ""}` : undefined} href="/admin/tableau?onglet=feuille&mode=revue" />
        <Ligne titre="Historique et corbeille" href="/admin/tableau" />
      </Liste>
      <Liste titre="Ligue">
        <Ligne titre="Arbitres" droite={arbitres.arbitres.length} href="/admin/tableau?onglet=joueurs" />
        <Ligne titre="Terrains" droite={(saison.terrains ?? []).length} href="/map" />
        <Ligne titre="Envoyer une notification" href="/admin/notifications" />
      </Liste>
      <Liste titre="Atelier">
        <Ligne titre="Installation Supabase" href="/admin/setup" />
        <Ligne titre="Design" href="/admin/design" />
        <Ligne
          titre="Note · Le Labo"
          href="/note-labo.html"
          externe
          chevron={<ArrowUpRight className="size-4 shrink-0 text-encre-4" />}
        />
        <Ligne titre="Tableau complet" href="/admin/tableau" />
      </Liste>
      <Liste className="lg:hidden">
        <Ligne titre="Retour à l'app" href="/reglages" />
      </Liste>
    </PageAdmin>
  );
}
