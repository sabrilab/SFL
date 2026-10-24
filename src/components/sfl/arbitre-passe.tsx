"use client";

// Le passe d'arbitre, sur sa carte (Sabri, 24/10 : « que ça leur ramène,
// dans les trophées à avoir dans les passes […] des skins de cartes, mais
// d'arbitres, et des choses pour l'arbitre »). Les paliers sont dans
// lib/sfl/passe-arbitre.ts, l'XP vient de ses missions (arbitre-missions.tsx).
//
// Sur Ma carte, une seule ligne discrète : le palier sur 20 et l'XP de la
// saison, comme la ligne du passe des joueurs. La toucher ouvre le passe,
// dans la DA des fiches (passe-bola.css) :
//   · en tête, le palier, la prochaine récompense, la barre de l'XP vers
//     elle, ou l'épreuve qui la retient ;
//   · la piste des vingt récompenses, chacune sur sa propre carte d'arbitre
//     (le skin entier, un signe ou le grade cadré de près) ;
//   · toucher une vignette ouvre son aperçu, dans la même fenêtre (Retour) :
//     la carte en 3D qui la porte, ce que c'est, ce qu'il faut, et Porter ou
//     Retirer ce qui est gagné. Rien n'est imposé : il porte ce qu'il choisit.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Champ, Insigne, Tampon, Viseur } from "@/components/sfl/actus/missions";
import { Card3D } from "@/components/sfl/card-3d";
import { CarteArbitre } from "@/components/sfl/carte-arbitre";
import { Poignee, Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useArbitres, useMissionsArbitre } from "@/hooks/use-arbitres";
import { choisirHabillageArbitre } from "@/lib/sfl/arbitres";
import { epreuveDu, PALIERS_PASSE, seuilPalier } from "@/lib/sfl/passe";
import {
  debloquesArbitre,
  ecrireChoixArbitre,
  EPREUVES_ARBITRE,
  PASSE_ARBITRE,
  porteArbitre,
  type ChoixArbitre,
  type GenrePalierArbitre,
  type PalierArbitre,
} from "@/lib/sfl/passe-arbitre";
import { cn } from "@/lib/utils";
import "./actus/missions.css";
import "./passe-bola.css";

const xp = (n: number) => `${n.toLocaleString("fr-FR")} XP`;

const GENRE: Record<GenrePalierArbitre, string> = { skin: "Skin", signe: "Signe", grade: "Grade", vrai: "En vrai" };

interface Cadrage {
  x: number;
  y: number;
  zoom: number;
}

const LISERE: Cadrage = { x: 150, y: 150, zoom: 2.3 };
const GRADE: Cadrage = { x: 380, y: 130, zoom: 2.1 };
const CADRAGES: Partial<Record<number, Cadrage>> = {
  1: LISERE,
  3: { x: 850, y: 150, zoom: 2.4 }, // le sifflet
  5: GRADE,
  8: { x: 191, y: 831, zoom: 2.2 }, // les cartons
  10: GRADE,
  15: GRADE,
  18: GRADE,
};

// La carte fait 254 px de large à la taille 1 (bola-card.tsx).
const PX_TAILLE_1 = 254 / 1024;

function Mini({ nom, porte, cadrage, l, h }: { nom: string; porte: ChoixArbitre; cadrage?: Cadrage; l: number; h: number }) {
  const s = cadrage ? Math.max(l / 1024, h / 1656) * cadrage.zoom : Math.min(l / 1024, h / 1656);
  const tx = cadrage ? Math.min(0, Math.max(l - 1024 * s, l / 2 - cadrage.x * s)) : (l - 1024 * s) / 2;
  const ty = cadrage ? Math.min(0, Math.max(h - 1656 * s, h / 2 - cadrage.y * s)) : (h - 1656 * s) / 2;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      style={{ transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s / PX_TAILLE_1})` }}
    >
      <CarteArbitre nom={nom} size={1} porte={porte} />
    </span>
  );
}

/** Sa carte avec la récompense du palier, en plus de ce qu'il porte. */
function essai(porte: ChoixArbitre, p: PalierArbitre): ChoixArbitre {
  const h = p.habille;
  if (h?.finition) return { ...porte, finition: h.finition };
  if (h?.signe) return { ...porte, signes: [...new Set([...porte.signes, h.signe])] };
  if (h?.grade) return { ...porte, grade: h.grade };
  return porte;
}

/** Porte-t-il déjà cette récompense ? */
function porteDeja(porte: ChoixArbitre, p: PalierArbitre): boolean {
  const h = p.habille;
  return h?.finition ? porte.finition === h.finition : h?.signe ? porte.signes.includes(h.signe) : h?.grade ? porte.grade === h.grade : false;
}

/** La porter, ou la retirer. */
function bascule(porte: ChoixArbitre, p: PalierArbitre): ChoixArbitre {
  const h = p.habille;
  const oui = !porteDeja(porte, p);
  if (h?.finition) return { ...porte, finition: oui ? h.finition : null };
  if (h?.signe) return { ...porte, signes: oui ? [...porte.signes, h.signe] : porte.signes.filter((s) => s !== h.signe) };
  if (h?.grade) return { ...porte, grade: oui ? h.grade : null };
  return porte;
}

type EtatPalier = "gagne" | "prochain" | "verrou";
const etatDe = (n: number, palier: number): EtatPalier => (n <= palier ? "gagne" : n === palier + 1 ? "prochain" : "verrou");

function Apercu({ nom, p, palier, porte, bloquee, onRetour }: { nom: string; p: PalierArbitre; palier: number; porte: ChoixArbitre; bloquee: string | null; onRetour: () => void }) {
  const etat = etatDe(p.n, palier);
  const ouvert = etat === "gagne";
  const choix = essai(porte, p);
  const e = epreuveDu(p.n, EPREUVES_ARBITRE);
  const [attente, setAttente] = useState(false);
  const deja = porteDeja(porte, p);
  const basculer = async () => {
    setAttente(true);
    await choisirHabillageArbitre(nom, ecrireChoixArbitre(bascule(porte, p)));
    setAttente(false);
  };
  return (
    <>
      <header className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-5 pt-[22px]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <button type="button" onClick={onRetour} className="mono-label -ml-1 flex items-center gap-0.5 text-white/60">
            <ChevronLeft className="size-3.5" strokeWidth={2.6} /> Passe d&apos;arbitre
          </button>
          <SheetDescription className="mono-label text-white/50">
            Palier {p.n} · {GENRE[p.genre]}
          </SheetDescription>
          <SheetTitle className="titre-lettrage text-[30px] leading-[0.95] break-words text-white">{p.nom}</SheetTitle>
        </div>
        <Insigne rang={p.rang} />
      </header>
      <div className="-mt-[var(--fib-13)] -mb-[var(--fib-21)] flex shrink-0 justify-center">
        <Card3D
          cacheKey={`passe-arbitre-${p.n}-${nom}-${ecrireChoixArbitre(choix)}`}
          size={0.92}
          apercu
          render={(s) => <CarteArbitre nom={nom} size={s} porte={choix} />}
        />
      </div>
      <div className="relative flex flex-col gap-4 px-5">
        <p className="text-[17px] leading-[1.25] font-bold tracking-[-0.2px]">{p.quoi}</p>
        <dl className="fiche__champs">
          <Champ label="Palier">
            <span className="tabular-nums">
              {p.n} / {PALIERS_PASSE}
            </span>
          </Champ>
          <Champ label="Il faut">
            <span className="tabular-nums">{xp(seuilPalier(p.n))}</span>
            {e && <span className="fiche__ton block text-[12px]">+ une épreuve</span>}
          </Champ>
        </dl>
      </div>
      <footer className="relative flex min-h-12 items-center gap-3 px-5 pt-4">
        {ouvert && p.genre !== "vrai" ? (
          <button
            type="button"
            disabled={attente}
            onClick={() => void basculer()}
            className={cn("h-12 flex-1 text-[15px] font-bold", deja ? "bouton-secondaire" : "bouton-principal bouton--vert")}
          >
            {deja ? "Retirer" : "Porter"}
          </button>
        ) : ouvert ? (
          <Tampon>
            <Check className="size-3.5" strokeWidth={3} /> Gagnée
          </Tampon>
        ) : (
          <Tampon ton="gris">
            <Lock className="size-3.5" strokeWidth={2.6} /> {etat === "prochain" && bloquee ? bloquee : xp(seuilPalier(p.n))}
          </Tampon>
        )}
      </footer>
    </>
  );
}

/** La ligne de Ma carte, puis le passe dans sa fenêtre. */
export function PasseArbitre({ nom, saison }: { nom: string; saison: number }) {
  const mm = useMissionsArbitre(nom);
  const a = useArbitres();
  const { passe } = mm;
  const porte = porteArbitre(a.choix(nom), passe.palier);
  const [ouvert, setOuvert] = useState(false);
  const [vu, setVu] = useState<number | null>(null);
  const piste = useRef<HTMLDivElement>(null);
  const fini = passe.palier >= PALIERS_PASSE;
  const prochain = PASSE_ARBITRE[Math.min(PALIERS_PASSE, passe.palier + 1) - 1];
  const p = PASSE_ARBITRE.find((x) => x.n === vu);
  const gagnes = debloquesArbitre(passe.palier);
  const nbGagnes = gagnes.finitions.length + gagnes.signes.length + gagnes.grades.length;

  // La piste s'ouvre sur le prochain palier.
  useEffect(() => {
    if (!ouvert || vu != null) return;
    const id = window.requestAnimationFrame(() => {
      const r = piste.current;
      const el = r?.querySelector<HTMLElement>(`[data-n="${prochain.n}"]`);
      if (r && el) r.scrollLeft += el.getBoundingClientRect().left - r.getBoundingClientRect().left - 70;
    });
    return () => window.cancelAnimationFrame(id);
  }, [ouvert, vu, prochain.n]);

  const sous = (n: number, etat: EtatPalier) =>
    etat === "gagne" ? "Gagné" : etat === "prochain" ? (passe.bloquee ? `Épreuve ${passe.bloquee.romain}` : `Dans ${xp(passe.manque)}`) : xp(seuilPalier(n));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setVu(null);
          setOuvert(true);
        }}
        className="flex w-full items-center gap-3 border-y border-foreground/10 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Passe d&apos;arbitre</span>
          <span className="block font-mono text-[11px] text-foreground/45 tabular-nums">
            Palier {passe.palier} / {PALIERS_PASSE} · {xp(mm.xp)}
            {nbGagnes > 0 ? ` · ${nbGagnes} récompense${nbGagnes > 1 ? "s" : ""}` : ""}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-foreground/35" strokeWidth={2.4} />
      </button>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            "passe__apercu dark mx-auto max-h-[calc(100dvh-24px)] w-full gap-0 overflow-y-auto rounded-t-[28px] border-0 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] sm:max-w-md",
            `fiche--${p?.rang ?? prochain.rang}`
          )}
        >
          <Poignee barre="bg-white/25" />
          {p ? (
            <Apercu
              key={p.n}
              nom={nom}
              p={p}
              palier={passe.palier}
              porte={porte}
              bloquee={passe.bloquee ? `Épreuve ${passe.bloquee.romain}` : null}
              onRetour={() => setVu(null)}
            />
          ) : (
            <div className="flex flex-col">
              <header className="flex items-start justify-between gap-3 px-5 pt-[22px]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <SheetDescription className="mono-label text-white/50">Saison {saison}</SheetDescription>
                  <SheetTitle className="titre-lettrage text-[30px] leading-[0.95] text-white">Passe d&apos;arbitre</SheetTitle>
                </div>
                <SheetClose aria-label="Fermer" className="bouton-givre grid size-10 shrink-0 place-items-center">
                  <X className="size-4" strokeWidth={2.4} />
                </SheetClose>
              </header>
              <div className="flex flex-col gap-3.5 px-5 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <p className="flex items-baseline gap-1.5">
                    <span className="sr-only">Palier</span>
                    <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 58, lineHeight: 0.85 }}>
                      {passe.palier}
                    </span>
                    <span className="font-mono text-[13px] font-bold text-white/45">/ {PALIERS_PASSE}</span>
                  </p>
                  <div className={cn("flex min-w-0 flex-col items-end gap-1 pb-0.5 text-right", `fiche--${prochain.rang}`)}>
                    <span className="mono-label text-white/45">{fini ? "Passe terminé" : `Palier ${prochain.n}`}</span>
                    <span className="fiche__ton max-w-full truncate text-[16px] font-bold">{fini ? "Tout est à toi" : prochain.nom}</span>
                  </div>
                </div>
                {passe.bloquee ? (
                  <div className={cn("passe__bloque", `fiche--${prochain.rang}`)}>
                    <span className="passe__porte-case">
                      <span>{passe.bloquee.romain}</span>
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="mono-label fiche__ton">
                        Épreuve {passe.bloquee.romain} · {passe.bloquee.nom}
                      </span>
                      <span className="text-[14px] leading-[1.25] font-bold">{passe.bloquee.phrase}</span>
                    </div>
                  </div>
                ) : (
                  !fini && (
                    <div className={cn("flex flex-col gap-2", `fiche--${prochain.rang}`)}>
                      <div className="passe__barre">
                        <span style={{ width: `${(passe.versPalier / Math.max(1, passe.coutPalier)) * 100}%` }} />
                      </div>
                      <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-white/55 tabular-nums">
                        <span>
                          {passe.versPalier} / {xp(passe.coutPalier)}
                        </span>
                        <span>{xp(passe.xp)} cette saison</span>
                      </div>
                    </div>
                  )
                )}
              </div>
              <div ref={piste} role="group" className="passe__piste" aria-label="Les vingt paliers">
                {PASSE_ARBITRE.map((x) => {
                  const etat = etatDe(x.n, passe.palier);
                  const etui = x.genre === "vrai";
                  return (
                    <button
                      key={x.n}
                      type="button"
                      data-n={x.n}
                      onClick={() => setVu(x.n)}
                      aria-label={`Palier ${x.n}, ${x.nom}, rang ${x.rang} : ${sous(x.n, etat)}`}
                      className={cn("passe__vignette", `fiche--${x.rang}`, `passe__vignette--${etat}`)}
                    >
                      <span className="passe__tete">
                        <span className="passe__numero tabular-nums">{x.n}</span>
                        <span className="passe__rang">{x.rang}</span>
                      </span>
                      <span className={cn("passe__fenetre", etui && "passe__fenetre--etui")}>
                        <span className="passe__mini">
                          <Mini nom={nom} porte={essai(porte, x)} cadrage={CADRAGES[x.n]} l={etui ? 70 : 84} h={etui ? 120 : 136} />
                        </span>
                        {etat === "prochain" && <Viseur etat="verrou" petit />}
                        {etat === "verrou" && (
                          <span className="passe__cadenas">
                            <Lock className="size-3" strokeWidth={2.6} />
                          </span>
                        )}
                      </span>
                      <span className="passe__nom">{x.nom}</span>
                      <span className="passe__etat mono-label flex items-center gap-1">
                        {etat === "gagne" && <Check className="size-3" strokeWidth={3} />}
                        {sous(x.n, etat)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {mm.journal.length > 0 && (
                <ul className="mx-5 flex flex-col divide-y divide-white/10 border-y border-white/10">
                  {mm.journal.slice(0, 8).map((l, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-[14px] font-semibold">
                        {l.quoi} <span className="font-mono text-[11px] font-normal text-white/45">· J{l.j}</span>
                      </span>
                      <span className={cn("shrink-0 font-mono text-[12px] tabular-nums", l.xp < 0 ? "text-[#ff9b9d]" : "text-white/70")}>
                        {l.xp < 0 ? `−${-l.xp}` : `+${l.xp}`} XP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
