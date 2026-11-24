"use client";

// La tête d'Analytics (refonte de l'admin, 24/11/2026, maquette v3) : trois
// blocs, un seul chiffre héros (en Anton, comme les chiffres de l'app).
//   · Aujourd'hui : les connectés du jour, chacun avec sa vraie carte ;
//   · Connectés par jour : des barres fines sur une ligne de base, sur 7 ou
//     30 jours, la moyenne des jours complets en filet, le chiffre au pic et
//     aujourd'hui ;
//   · Mails et Inscrits · 7 j : une bande, deux colonnes. Mails ouvre la
//     liste à copier ; Inscrits mène aux nouveaux arrivants (Activation).
// Les calculs sont dans lib/sfl/analytics-tete.ts.

import { useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { Feuille } from "@/components/sfl/admin/journee/ui";
import { Nom } from "@/components/sfl/nom";
import { useIdentites } from "@/hooks/use-identites";
import { SegmenteClair, SURFACE, Tete, Visages } from "@/components/sfl/admin/ui-admin";
import { plafondRond, type JourConnectes, type TeteAnalytics } from "@/lib/sfl/analytics-tete";
import { jjmm } from "@/lib/sfl/retention";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";

export type Fenetre = 7 | 30;

const JOURS_COURTS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

function libelleMaintenant(now: number) {
  const d = new Date(now);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const heure = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${jour} · ${heure}`;
}

export function CarteAujourdhui({ tete, now }: { tete: TeteAnalytics; now: number }) {
  const n = tete.aujourdhui.length;
  return (
    <section className={cn(SURFACE, "flex flex-col gap-3 p-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ligne font-semibold">Aujourd&apos;hui</span>
        <span className="text-corps text-encre-3 tabular-nums">{libelleMaintenant(now)}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[56px] leading-[0.8] tabular-nums">{n}</span>
        <span className="text-titre font-semibold">{n > 1 ? "connectés" : "connecté"}</span>
      </div>
      {n > 0 && <Visages noms={tete.aujourdhui} />}
    </section>
  );
}

/** Barres fines sur une ligne de base ; la moyenne en filet ; le chiffre au pic et aujourd'hui. */
function Barres({ jours, moyenne, haute }: { jours: JourConnectes[]; moyenne: number | null; haute: number }) {
  const max = Math.max(1, ...jours.map((j) => j.n));
  const plafond = plafondRond(max * 1.15);
  const y = (n: number) => (n / plafond) * haute;
  const dernier = jours.length - 1;
  const serre = jours.length > 10;
  // Sur 30 jours, une étiquette par semaine (et aujourd'hui).
  const etiquette = (i: number) => !serre || i === dernier || (dernier - i) % 7 === 0;
  const iMax = jours.findIndex((j) => j.n === max);
  // La moyenne s'écrit dans une marge à droite, au bout de son filet : jamais sur une barre.
  const marge = "pr-12";
  return (
    <div className="flex flex-col gap-2">
      <div className={cn("relative", marge)} style={{ height: haute + 18 }}>
        <span className="absolute inset-x-0 bottom-0 h-px bg-foreground/20" />
        {moyenne != null && moyenne > 0 && (
          <span className="absolute inset-x-0 flex items-center gap-1.5" style={{ bottom: y(moyenne) - 7, height: 14 }}>
            <span className="min-w-0 flex-1 border-t border-dashed border-foreground/25" />
            <span className="shrink-0 text-legende leading-none text-encre-3 tabular-nums">moy. {moyenne}</span>
          </span>
        )}
        <div className={cn("relative flex h-full items-end", serre ? "gap-[3px]" : "gap-0")}>
          {jours.map((j, i) => {
            const auj = i === dernier;
            const montre = auj || i === iMax;
            return (
              <div key={j.t} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                {montre && <span className={cn("text-legende font-semibold tabular-nums", auj ? "text-encre-3" : "text-foreground")}>{j.n}</span>}
                <span
                  className={cn("rounded-t-[3px]", serre ? "w-full max-w-[10px]" : "w-[18px]", auj ? "bg-foreground/20" : "bg-foreground/85")}
                  style={{ height: Math.max(j.n ? 2 : 0, y(j.n)) }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn("flex", marge, serre && "gap-[3px]")}>
        {jours.map((j, i) => (
          <span
            key={j.t}
            className={cn("min-w-0 flex-1 overflow-visible text-center text-legende whitespace-nowrap tabular-nums", i === dernier ? "font-semibold text-foreground" : "text-encre-2")}
          >
            {etiquette(i) ? (i === dernier ? "auj." : serre ? jjmm(j.t) : JOURS_COURTS[new Date(j.t).getDay()]) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CarteSemaine({
  tete,
  fenetre,
  onFenetre,
  haute,
}: {
  tete: TeteAnalytics;
  fenetre: Fenetre;
  onFenetre: (f: Fenetre) => void;
  haute: number;
}) {
  return (
    <section className={cn(SURFACE, "flex h-full flex-col gap-4 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-ligne font-semibold">Connectés par jour</span>
        <SegmenteClair
          label="Fenêtre"
          options={[
            { id: "7", libelle: "7 j" },
            { id: "30", libelle: "30 j" },
          ]}
          valeur={String(fenetre) as "7" | "30"}
          onChange={(v) => onFenetre(v === "7" ? 7 : 30)}
          className="w-[112px] shrink-0"
        />
      </div>
      <div className="mt-auto">
        <Barres jours={tete.parJour} moyenne={tete.moyenne} haute={haute} />
      </div>
    </section>
  );
}

/** Mails et inscrits : une seule bande, deux colonnes, la même construction. */
export function CarteChiffres({ tete, onMails, onInscrits }: { tete: TeteAnalytics; onMails: () => void; onInscrits: () => void }) {
  const ids = useIdentites();
  const dernier = tete.inscrits[0];
  const cases = [
    { l: "Mails", v: tete.mails.length, c: `sur ${tete.comptes} comptes`, onClick: onMails },
    {
      l: "Inscrits · 7 j",
      v: tete.inscrits.length,
      c: dernier ? `${ids.nom(dernier.name).split(" ")[0]} · ${jjmm(dernier.at)}${tete.inscrits.length > 1 ? ` +${tete.inscrits.length - 1}` : ""}` : "personne",
      tete: dernier?.name,
      onClick: onInscrits,
    },
  ];
  return (
    <section className={cn(SURFACE, "grid h-full grid-cols-2 divide-x divide-border/60 overflow-hidden")}>
      {cases.map((k) => (
        <button key={k.l} type="button" onClick={k.onClick} className="flex min-w-0 flex-col gap-2 p-4 text-left transition-colors active:bg-foreground/[0.04]">
          <span className="flex items-center justify-between text-corps text-encre-3">
            {k.l}
            <ChevronRight className="size-4 text-encre-4" />
          </span>
          <span className="font-display text-titre-m leading-none tabular-nums">{k.v}</span>
          <span className="flex h-7 min-w-0 items-center gap-2 text-corps text-encre-2">
            {k.tete && <Tete nom={k.tete} cote={28} />}
            <span className="truncate">{k.c}</span>
          </span>
        </button>
      ))}
    </section>
  );
}

/** Les mails collectés, à copier d'un geste pour écrire à la ligue. */
export function FeuilleMails({ open, onOpenChange, mails }: { open: boolean; onOpenChange: (o: boolean) => void; mails: TeteAnalytics["mails"] }) {
  const [copie, setCopie] = useState(false);
  function copier() {
    void navigator.clipboard?.writeText(mails.map((m) => m.email).join(", ")).then(
      () => {
        haptique.sceau();
        setCopie(true);
        setTimeout(() => setCopie(false), 2000);
      },
      () => {}
    );
  }
  return (
    <Feuille
      open={open}
      onOpenChange={onOpenChange}
      titre={`${mails.length} mails`}
      haute
      bas={
        <button type="button" onClick={copier} disabled={!mails.length} className="bouton-principal flex h-12 items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-40">
          {copie ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
          {copie ? "Copiés" : `Copier les ${mails.length}`}
        </button>
      }
    >
      <div className={cn(SURFACE, "liste-admin overflow-hidden")}>
        {mails.map((m) => (
          <div key={m.name} className="ligne-admin flex items-center gap-3 pl-4">
            <Tete nom={m.name} cote={32} />
            <div className="ligne-admin__corps flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 pr-4">
              <span className="truncate text-ligne font-medium">
                <Nom n={m.name} />
              </span>
              <span className="truncate text-corps text-encre-3">{m.email}</span>
            </div>
          </div>
        ))}
      </div>
    </Feuille>
  );
}
