"use client";

// Le Passe Bola, sur Ma carte (Niveau XP) : la passe de la saison, dans la
// DA des fiches de contrat (actus/missions.css). Sabri, 24/10 : « ça doit
// être un même design », « comme dans Fortnite », « chaque récompense est
// une vignette qu'on peut prévisualiser ».
//   · en tête : le palier atteint sur 20, la prochaine récompense, la barre
//     de l'XP vers elle, ou l'épreuve qui la retient ;
//   · la piste : les vingt récompenses en vignettes, chacune sur la carte du
//     joueur (le skin entier, un signe cadré de près), à la couleur de sa
//     rareté (B l'argent, A le mauve, S l'or, les tons des contrats). Elle
//     s'ouvre sur le prochain palier ;
//   · les épreuves qui gardent les paliers 5, 10, 15 et 20 restent cachées
//     (Sabri, 24/10 : « cache les épreuves dans ma carte ») : ni liste ni
//     portes sur la piste. Une épreuve ne se montre que quand elle retient le
//     prochain palier, en tête à la place de la barre ; l'aperçu d'un palier
//     gardé dit seulement « + une épreuve » ;
//   · toucher une vignette ouvre son aperçu : la carte en 3D qui la porte, ce
//     que c'est, ce qu'il faut, combien de joueurs l'ont ; Porter ou Retirer
//     un skin débloqué (profiles.habillage) ; « Tes couleurs » se porte avec
//     son pays ; aux paliers 18 et 19, l'appui long sur la carte (ou le
//     bouton) joue l'aperçu de la séquence (plongee-carte.tsx).
// Un palier atteint une saison reste débloqué (usePalierMax) : « Acquis ».
// Noire dans les deux modes, comme les fiches (la classe dark).

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Check, Lock, Play, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Champ, Insigne, Tampon, Viseur } from "@/components/sfl/actus/missions";
import { Card3D } from "@/components/sfl/card-3d";
import type { Finition, HabillageCarte } from "@/components/sfl/finitions-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { Plongee, useAppuiLong } from "@/components/sfl/plongee-carte";
import { COULEURS_PAYS, PAYS_PAR_DEFAUT } from "@/components/sfl/skins-passe";
import { Poignee, Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CartesXpContext, finitionsDe, useChoixHabillage, useHabillage, usePalierMax } from "@/hooks/use-habillage";
import { useGrandEcran } from "@/hooks/use-media-query";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import type { Player } from "@/lib/sfl/engine";
import { choisirHabillage } from "@/lib/sfl/habillages-choisis";
import { isHidden } from "@/lib/sfl/hidden";
import type { BilanXp, Rang } from "@/lib/sfl/missions";
import { epreuveDu, PALIERS_PASSE, PASSE_BOLA, seuilPalier, type GenrePalier, type PalierPasse } from "@/lib/sfl/passe";
import { cn } from "@/lib/utils";
import "./passe-bola.css";

const xp = (n: number) => `${n.toLocaleString("fr-FR")} XP`;

const GENRE: Record<GenrePalier, string> = {
  skin: "Skin",
  signe: "Signe",
  sequence: "Séquence 6 s",
  vrai: "En vrai",
};

/** Le cadrage d'une vignette dans le repère de la carte (1024 × 1656) : le signe de près, sinon la carte entière. */
interface Cadrage {
  x: number;
  y: number;
  zoom: number;
}

const CADRAGES: Partial<Record<number, Cadrage>> = {
  1: { x: 150, y: 150, zoom: 2.3 }, // le liseré, au coin du portrait
  3: { x: 191, y: 831, zoom: 2.2 }, // le sceau
  6: { x: 883, y: 888, zoom: 2.8 }, // la puce
  9: { x: 330, y: 1050, zoom: 2.6 }, // le nom gravé, dans le microtexte au-dessus de la note
  13: { x: 150, y: 150, zoom: 2.3 },
  18: { x: 512, y: 430, zoom: 1.5 }, // le visage : la séquence
  19: { x: 512, y: 430, zoom: 1.5 },
};

// La carte joueur fait 254 px de large à la taille 1 (bola-card.tsx).
const PX_TAILLE_1 = 254 / 1024;

/** Une carte réduite dans une fenêtre de l × h px : cadrée sur un signe, ou entière et centrée. */
export function Mini({ player, habillage, cadrage, l, h }: { player: Player; habillage: HabillageCarte; cadrage?: Cadrage; l: number; h: number }) {
  const s = cadrage ? Math.max(l / 1024, h / 1656) * cadrage.zoom : Math.min(l / 1024, h / 1656);
  const cl = 1024 * s;
  const ch = 1656 * s;
  const tx = cadrage ? Math.min(0, Math.max(l - cl, l / 2 - cadrage.x * s)) : (l - cl) / 2;
  const ty = cadrage ? Math.min(0, Math.max(h - ch, h / 2 - cadrage.y * s)) : (h - ch) / 2;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 left-0"
      style={{ transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s / PX_TAILLE_1})` }}
    >
      <PlayerCard player={player} size={1} habillage={habillage} />
    </span>
  );
}

/** Ma carte telle qu'elle serait avec la récompense du palier, en plus de ce que je porte. */
function essai(porte: HabillageCarte, p: PalierPasse, pays?: string): HabillageCarte {
  const h = p.habille;
  if (h?.finition) return { ...porte, finition: h.finition as Finition, pays: h.finition === "couleurs" ? pays : undefined };
  if (h?.signe) return { ...porte, signes: [...new Set([...(porte.signes ?? []), h.signe])] };
  return porte;
}

type EtatPalier = "gagne" | "acquis" | "prochain" | "verrou";

function etatDe(n: number, palier: number, palierMax: number): EtatPalier {
  if (n <= palier) return "gagne";
  if (n <= palierMax) return "acquis";
  return n === palier + 1 ? "prochain" : "verrou";
}

/** Combien de joueurs ont débloqué chaque palier (toutes saisons), sans les joueurs masqués. */
function useOntLePalier(): (n: number) => number {
  const cartes = useContext(CartesXpContext);
  return useMemo(() => {
    const paliers = [...(cartes?.parJoueur ?? new Map()).entries()].filter(([nom]) => !isHidden(nom)).map(([, x]) => x.palier);
    return (n: number) => paliers.filter((p) => p >= n).length;
  }, [cartes]);
}

function Vignette({
  p,
  etat,
  player,
  porte,
  sous,
  onOuvrir,
}: {
  p: PalierPasse;
  etat: EtatPalier;
  player: Player;
  porte: HabillageCarte;
  sous: string;
  onOuvrir: () => void;
}) {
  const etui = p.genre === "vrai";
  return (
    <button
      type="button"
      data-n={p.n}
      onClick={onOuvrir}
      aria-label={`Palier ${p.n}, ${p.nom}, rang ${p.rang} : ${sous}`}
      className={cn("passe__vignette", `fiche--${p.rang}`, `passe__vignette--${etat}`)}
    >
      <span className="passe__tete">
        <span className="passe__numero tabular-nums">{p.n}</span>
        <span className="passe__rang">{p.rang}</span>
      </span>
      <span className={cn("passe__fenetre", etui && "passe__fenetre--etui")}>
        <span className="passe__mini">
          <Mini player={player} habillage={essai(porte, p)} cadrage={CADRAGES[p.n]} l={etui ? 70 : 84} h={etui ? 120 : 136} />
        </span>
        {etat === "prochain" && <Viseur etat="verrou" petit />}
        {p.genre === "sequence" && (
          <span className="passe__lecture">
            <Play className="size-2.5 fill-current" strokeWidth={0} /> 6 s
          </span>
        )}
        {etat === "verrou" && (
          <span className="passe__cadenas">
            <Lock className="size-3" strokeWidth={2.6} />
          </span>
        )}
      </span>
      <span className="passe__nom">{p.nom}</span>
      <span className="passe__etat mono-label flex items-center gap-1">
        {(etat === "gagne" || etat === "acquis") && <Check className="size-3" strokeWidth={3} />}
        {sous}
      </span>
    </button>
  );
}

/** Le pays de « Tes couleurs » : une rangée de drapeaux. */
export function ChoixPays({ pays, onChoisir }: { pays: string; onChoisir: (p: string) => void }) {
  const rangee = useRef<HTMLDivElement>(null);
  // Le pays choisi se montre à l'ouverture.
  useEffect(() => {
    const r = rangee.current;
    const el = r?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (r && el) r.scrollLeft += el.getBoundingClientRect().left - r.getBoundingClientRect().left - 20;
  }, []);
  return (
    <div ref={rangee} className="passe__pays" role="group" aria-label="Ton pays">
      {Object.entries(COULEURS_PAYS).map(([id, c]) => (
        <button key={id} type="button" aria-pressed={id === pays} onClick={() => onChoisir(id)}>
          <span
            aria-hidden
            className="h-3 w-[18px] shrink-0 rounded-[2px] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.25)]"
            style={{ background: `linear-gradient(90deg, ${c.bandes.map((b, i, t) => `${b} ${(i / t.length) * 100}% ${((i + 1) / t.length) * 100}%`).join(", ")})` }}
          />
          {c.nom}
        </button>
      ))}
    </div>
  );
}

/** L'aperçu d'un palier : sa carte en 3D, ce que c'est, ce qu'il faut, et le porter. */
function ApercuPalier({ p, player, b, palierMax }: { p: PalierPasse; player: Player; b: BilanXp; palierMax: number }) {
  const nom = player.name;
  const grand = useGrandEcran();
  const porte = useHabillage(nom);
  const choix = useChoixHabillage(nom);
  const photo = usePlayerPhoto(nom);
  const ontLe = useOntLePalier();
  const [pays, setPays] = useState(choix.pays ?? PAYS_PAR_DEFAUT);
  const [plonge, setPlonge] = useState(false);
  const sequence = p.genre === "sequence";
  const appui = useAppuiLong(() => setPlonge(true));
  const etat = etatDe(p.n, b.palier, palierMax);
  const ouvert = etat === "gagne" || etat === "acquis";
  const finition = p.habille?.finition as Finition | undefined;
  // Un skin offert (l'onyx de Sabri) se porte aussi sans le palier.
  const aLeSkin = !!finition && (ouvert || finitionsDe(nom, palierMax).includes(finition));
  const portee = !!finition && porte.finition === finition && (finition !== "couleurs" || porte.pays === pays);
  const habillage = essai(porte, p, pays);
  const e = epreuveDu(p.n);
  const taille = grand ? 1 : 0.92;

  return (
    <>
      <Poignee barre="bg-white/25" />
      <header className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-5 pt-[22px]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <SheetDescription className="mono-label text-white/50">
            Palier {p.n} · {GENRE[p.genre]}
          </SheetDescription>
          <SheetTitle className="titre-lettrage text-[30px] leading-[0.95] break-words text-white">{p.nom}</SheetTitle>
        </div>
        <div className="flex shrink-0 items-start gap-2.5">
          <Insigne rang={p.rang} />
          <SheetClose aria-label="Fermer" className="bouton-givre grid size-10 shrink-0 place-items-center">
            <X className="size-4" strokeWidth={2.4} />
          </SheetClose>
        </div>
      </header>

      <div {...(sequence ? appui : {})} className="-mt-[var(--fib-13)] -mb-[var(--fib-21)] flex shrink-0 justify-center">
        <Card3D
          cacheKey={`passe-${p.n}-${nom}-${finition === "couleurs" ? pays : ""}`}
          size={taille}
          apercu
          render={(s) => <PlayerCard player={player} size={s} habillage={habillage} />}
        />
      </div>

      <div className="relative flex flex-col gap-4 px-5">
        <p className="text-[17px] leading-[1.25] font-bold tracking-[-0.2px]">{p.quoi}</p>
        {finition === "couleurs" && <ChoixPays pays={pays} onChoisir={setPays} />}
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
          <Champ label="Ils l'ont">
            <span className="tabular-nums">{ontLe(p.n)}</span>
          </Champ>
        </dl>
      </div>

      <footer className="relative flex min-h-12 items-center gap-3 px-5 pt-4">
        {finition && aLeSkin ? (
          portee ? (
            <button
              type="button"
              onClick={() => void choisirHabillage(nom, { ...choix, finition: "-" })}
              className="bouton-secondaire bouton--rouge h-12 flex-1 text-[15px] font-bold"
            >
              Retirer
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                void choisirHabillage(nom, { ...choix, finition, pays: finition === "couleurs" ? pays : choix.pays })
              }
              className="bouton-principal bouton--or h-12 flex-1 text-[15px] font-bold"
            >
              Porter{finition === "couleurs" ? ` · ${COULEURS_PAYS[pays]?.nom ?? ""}` : ""}
            </button>
          )
        ) : sequence ? (
          <>
            {!ouvert && (
              <Tampon ton="gris" petit>
                <Lock className="size-3" strokeWidth={2.6} /> {xp(seuilPalier(p.n))}
              </Tampon>
            )}
            <button
              type="button"
              onClick={() => setPlonge(true)}
              className={cn(
                "h-12 flex-1 text-[15px] font-bold",
                ouvert ? "bouton-principal bouton--or" : "bouton-secondaire"
              )}
            >
              {ouvert ? "Plonger dans ta carte" : "Aperçu"}
            </button>
          </>
        ) : ouvert ? (
          <Tampon>
            <Check className="size-3.5" strokeWidth={3} /> {p.genre === "signe" ? "Sur ta carte" : "Gagnée"}
          </Tampon>
        ) : (
          <Tampon ton="gris">
            <Lock className="size-3.5" strokeWidth={2.6} /> {etat === "prochain" && b.passe.bloquee ? `Épreuve ${b.passe.bloquee.romain}` : xp(seuilPalier(p.n))}
          </Tampon>
        )}
      </footer>

      {plonge && (
        <Plongee
          carte={<PlayerCard player={player} size={taille} habillage={porte} />}
          photo={photo}
          theme={p.n === 19 ? "ombre" : "transformation"}
          onFin={() => setPlonge(false)}
        />
      )}
    </>
  );
}

export function PasseBola({ player, saison, b, rang }: { player: Player; saison: number; b: BilanXp; rang: Rang }) {
  const palierMax = Math.max(usePalierMax(player.name), b.palier);
  const porte = useHabillage(player.name);
  const piste = useRef<HTMLDivElement>(null);
  const [vu, setVu] = useState<number | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const { passe } = b;
  const fini = passe.palier >= PALIERS_PASSE;
  const prochain = PASSE_BOLA[Math.min(PALIERS_PASSE, passe.palier + 1) - 1];
  const p = PASSE_BOLA.find((x) => x.n === vu);

  // La piste s'ouvre sur le prochain palier, le précédent encore en vue.
  useEffect(() => {
    const r = piste.current;
    const el = r?.querySelector<HTMLElement>(`[data-n="${prochain.n}"]`);
    if (r && el) r.scrollLeft += el.getBoundingClientRect().left - r.getBoundingClientRect().left - 70;
  }, [prochain.n]);

  const sous = (n: number, etat: EtatPalier) =>
    etat === "gagne"
      ? "Gagné"
      : etat === "acquis"
        ? "Acquis"
        : etat === "prochain"
          ? passe.bloquee
            ? `Épreuve ${passe.bloquee.romain}`
            : `Dans ${xp(passe.manque)}`
          : xp(seuilPalier(n));

  return (
    <article aria-labelledby="titre-passe" className={cn("fiche passe dark", `fiche--${rang}`)}>
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Passe Bola</span>
        <span className="fiche__type mono-label text-white/75">Saison {saison}</span>
      </div>

      <div className="flex flex-col gap-3.5 px-[18px] pt-4">
        <div className="flex items-end justify-between gap-4">
          <h3 id="titre-passe" className="flex items-baseline gap-1.5">
            <span className="sr-only">Palier</span>
            <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 58, lineHeight: 0.85 }}>
              {passe.palier}
            </span>
            <span className="font-mono text-[13px] font-bold text-white/45">/ {PALIERS_PASSE}</span>
          </h3>
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
        {PASSE_BOLA.map((x) => {
          const etat = etatDe(x.n, passe.palier, palierMax);
          return (
            <Vignette
              key={x.n}
              p={x}
              etat={etat}
              player={player}
              porte={porte}
              sous={sous(x.n, etat)}
              onOuvrir={() => {
                setVu(x.n);
                setOuvert(true);
              }}
            />
          );
        })}
      </div>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className={cn(
            "passe__apercu dark mx-auto max-h-[calc(100dvh-24px)] w-full gap-0 overflow-y-auto rounded-t-[28px] border-0 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] sm:max-w-md",
            p && `fiche--${p.rang}`
          )}
        >
          {p && <ApercuPalier key={p.n} p={p} player={player} b={b} palierMax={palierMax} />}
        </SheetContent>
      </Sheet>
    </article>
  );
}
