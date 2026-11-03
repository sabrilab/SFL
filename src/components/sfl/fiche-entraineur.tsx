"use client";

// La carte d'entraîneur en grand, dans Ma carte (/profil/entraineur ; lot B2,
// 03/11/2026). Sa carte de joueur reste en tête de Ma carte : celle-ci est
// une seconde carte, comme celle d'un arbitre. De haut en bas :
//   · la carte (le Tableau) en 3D, qu'un toucher ouvre en plein écran, et
//     son équipe (equipe/equipe-du-joueur.tsx) ;
//   · sa note et ses matchs dirigés ;
//   · ses trois, chacune avec son nom entier (Résultats, Présence, Cohésion),
//     ce qu'une mise à jour lui donnerait aujourd'hui (« +1 ») et sa jauge,
//     la même que celle des cartes de joueur (ma-note.tsx) ;
//   · le journal, du plus récent au plus ancien, en mots : ses rencontres
//     (« victoire contre plus fort », « 5 contre 4 », « forfait » ; celles
//     qui ne comptent pas en rés, leur issue en gris, sans pastille ; un
//     litige le dit près du nom), les départs (« Samir est parti »), les mises
//     à jour qui ont fait monter sa carte. Jamais l'attendu en chiffres. La
//     date toujours à droite.
// Tout vient de la carte gardée par le serveur (use-carte-entraineur.ts) ;
// un entraîneur qui vient d'arriver lit sa carte de départ, 75 partout.
// Noir et blanc, comme Ma note : les chiffres en Anton, les étiquettes en
// Inter capitales.

import { ANTON } from "@/components/sfl/actus/ecran";
import { Card3DEnGrand } from "@/components/sfl/carte-en-grand";
import { CarteEntraineur } from "@/components/sfl/carte-entraineur";
import { useFaceEntraineur } from "@/components/sfl/carte-entraineur-de";
import { EquipeDuJoueur } from "@/components/sfl/equipe/equipe-du-joueur";
import { Jauge } from "@/components/sfl/ma-carte/ma-note";
import { Chiffre } from "@/components/sfl/profil-joueur";
import { useDetailEntraineur, type DetailEntraineur } from "@/hooks/use-carte-entraineur";
import { useGrandEcran } from "@/hooks/use-media-query";
import {
  CLES_ENTRAINEUR,
  LIBELLES_ENTRAINEUR,
  NOMS_ENTRAINEUR,
  noteEntraineur,
  tailleJaugeEntraineur,
  type CleEntraineur,
  type FaitEntraineur,
  type StatsEntraineur,
} from "@/lib/sfl/entraineur";
import { cn } from "@/lib/utils";

const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;
const jourCourt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
const gains = (g: Partial<StatsEntraineur>) =>
  CLES_ENTRAINEUR.filter((k) => g[k])
    .map((k) => `${LIBELLES_ENTRAINEUR[k]} +${g[k]}`)
    .join(" · ");

function Stat({ k, valeur, attente, jauge }: { k: CleEntraineur; valeur: number; attente: number; jauge: { crans: number; taille: number } }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-foreground/[0.05] p-3"
      aria-label={`${NOMS_ENTRAINEUR[k]} ${valeur}${attente ? `, +${attente} en attente` : ""}${jauge.taille ? `, jauge ${jauge.crans} sur ${jauge.taille}` : ""}`}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="mono-label text-[10px] text-foreground/70">{NOMS_ENTRAINEUR[k]}</span>
        <span className="font-mono text-[11px] text-foreground/45">{LIBELLES_ENTRAINEUR[k]}</span>
      </span>
      <span className="flex items-baseline gap-1.5">
        <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
          {valeur}
        </span>
        {attente > 0 && <span className="font-mono text-[12px] font-bold text-foreground/50 tabular-nums">+{attente}</span>}
      </span>
      <Jauge crans={jauge.crans} taille={jauge.taille} />
      {jauge.taille > 0 && (
        <span className="font-mono text-[10px] text-foreground/45 tabular-nums">
          {jauge.crans}/{jauge.taille}
        </span>
      )}
    </div>
  );
}

type Ligne =
  | { quoi: "rencontre"; le: string; cle: string; contre?: string; faits: FaitEntraineur[]; issue?: string; litige: boolean }
  | { quoi: "coh"; le: string; cle: string; fait: FaitEntraineur }
  | { quoi: "maj"; le: string; cle: string; note: number; gains: string };

/**
 * Le journal : ses rencontres (une ligne chacune), les départs, les mises à
 * jour qui ont fait monter sa carte. Une rencontre jouée qui ne compte pas en
 * rés (déjà rencontrée cette saison, une feuille ou une carte qui manque, sa
 * saisie seule) dit son issue en mots, en gris, sans pastille ; un litige
 * jamais tranché (lu avec la version de l'adversaire) le dit près du nom.
 */
function lignesDuJournal(d: DetailEntraineur): Ligne[] {
  const out: Ligne[] = [];
  const parRencontre = new Map<string, Extract<Ligne, { quoi: "rencontre" }>>();
  d.journal.forEach((f, i) => {
    if (f.source === "maj") {
      out.push({ quoi: "coh", le: f.le, cle: `coh-${i}`, fait: f });
      return;
    }
    let l = parRencontre.get(f.source);
    if (!l) {
      l = { quoi: "rencontre", le: f.le, cle: `r-${f.source}`, contre: f.adversaireNom, faits: [], litige: false };
      parRencontre.set(f.source, l);
      out.push(l);
    }
    if (f.litige) l.litige = true;
    if (f.compte === false) l.issue = f.texte;
    // « venue » est le cas ordinaire : rien à en dire.
    else if (!(f.cle === "PRES" && f.texte === "venue")) l.faits.push(f);
  });
  for (const m of d.majs) {
    const g = gains(m.gains);
    if (g) out.push({ quoi: "maj", le: m.apres, cle: `maj-${m.apres}`, note: noteEntraineur(m.stats), gains: g });
  }
  // Du plus récent au plus ancien ; le même jour, la mise à jour avant la rencontre qui l'a faite.
  const rang = { maj: 0, coh: 1, rencontre: 2 } as const;
  return out.sort((a, b) => b.le.localeCompare(a.le) || rang[a.quoi] - rang[b.quoi]);
}

function Journal({ d }: { d: DetailEntraineur }) {
  const lignes = lignesDuJournal(d);
  if (lignes.length === 0) return null;
  return (
    <section aria-label="Journal" className="flex flex-col">
      <ul className="flex flex-col">
        {lignes.map((l) =>
          l.quoi === "maj" ? (
            <li key={l.cle} className="my-1.5 flex items-center justify-between gap-3 rounded-2xl bg-foreground py-3 pr-4 pl-4 text-background">
              <span className="flex flex-col gap-0.5">
                <span className="mono-label text-[10px] opacity-60">Mise à jour · {jourCourt(l.le)}</span>
                <span className="text-[13px] font-semibold">{l.gains}</span>
              </span>
              <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
                {l.note}
              </span>
            </li>
          ) : l.quoi === "coh" ? (
            <li key={l.cle} className="flex items-baseline justify-between gap-3 border-b border-foreground/10 py-3 last:border-0">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-[11px] text-foreground/45">{LIBELLES_ENTRAINEUR.COH}</span>
                <span className="text-[14px] font-semibold">{l.fait.texte}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] text-foreground/45">{jourCourt(l.le)}</span>
            </li>
          ) : (
            <li key={l.cle} className="flex flex-col gap-1.5 border-b border-foreground/10 py-3 last:border-0">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-[14px] font-semibold">{l.contre ?? "Rencontre"}</span>
                  {l.litige && <span className="mono-label shrink-0 text-[10px] text-foreground/45">Litige</span>}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-foreground/45">{jourCourt(l.le)}</span>
              </span>
              {(l.faits.length > 0 || l.issue) && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {l.faits.map((f) => (
                    <span
                      key={f.cle}
                      className={cn(
                        "flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold",
                        f.sens > 0 ? "bg-foreground text-background" : "bg-foreground/10 text-foreground/75"
                      )}
                    >
                      <span className="font-mono text-[10px] font-normal opacity-60">{LIBELLES_ENTRAINEUR[f.cle]}</span>
                      {f.texte}
                    </span>
                  ))}
                  {l.issue && <span className="text-[12px] font-semibold text-foreground/45">{l.issue}</span>}
                </span>
              )}
            </li>
          )
        )}
      </ul>
    </section>
  );
}

export function FicheEntraineur({ nom }: { nom: string }) {
  const f = useFaceEntraineur(nom);
  const detail = useDetailEntraineur(nom);
  const grand = useGrandEcran();
  const { RES, PRES, COH } = f.stats;
  const jauge = (k: CleEntraineur) => detail?.jauges[k] ?? { crans: 0, taille: tailleJaugeEntraineur(f.stats[k]) };
  return (
    <div className="flex flex-col gap-[var(--fib-21)]">
      <div className="flex flex-col items-center gap-[var(--fib-13)]">
        <div className="-mb-[var(--fib-13)]">
          <Card3DEnGrand
            cacheKey={`entraineur-${nom}-${RES}-${PRES}-${COH}-${f.equipe?.id ?? "x"}`}
            mode="simple"
            size={grand ? 1.05 : 0.9}
            render={(s) => <CarteEntraineur {...f.props} size={s} />}
            titre={f.props.affiche}
            sousTitre={f.equipe ? `Entraîneur · ${f.equipe.nom}` : "Entraîneur"}
          />
        </div>
        <EquipeDuJoueur nom={nom} />
      </div>
      <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
        <Chiffre valeur={f.note} quoi="Note" />
        <Chiffre valeur={f.rencontres} quoi={f.rencontres > 1 ? "Matchs dirigés" : "Match dirigé"} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CLES_ENTRAINEUR.map((k) => (
          <Stat key={k} k={k} valeur={f.stats[k]} attente={detail?.enAttente[k] ?? 0} jauge={jauge(k)} />
        ))}
      </div>
      {detail && <Journal d={detail} />}
    </div>
  );
}
