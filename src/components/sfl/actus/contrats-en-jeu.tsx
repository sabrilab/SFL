"use client";

// Les Contrats en jeu, dans les Actus, sous les Missions Bola. Sabri, 23/10 :
// « montrer tous les contrats qui sont acceptés, les missions qui sont en
// jeu ». Toute la ligue, pas seulement les siennes :
//   · les contrats signés, en affiches qu'on fait défiler : la cible sous le
//     viseur, à la couleur du rang, l'objectif, et celui qui a signé. Les
//     face-à-face (deux rivaux qui ont signé l'un contre l'autre) passent
//     devant, puis du rang S au rang B ;
//   · le défi du dimanche et la ligue : la carte de chacun de ceux qui s'y
//     sont engagés, équipe par équipe quand le défi se gagne à plusieurs ;
//   · après le coup d'envoi, « En jeu » ; le verdict se pose à mesure que la
//     feuille se remplit, définitif à minuit : accompli, échec (la carte
//     s'éteint), annulé.
// La base montre à la ligue les missions acceptées, jamais un « passer »
// (missions_reponses, schema.sql). Rien ne s'affiche tant que personne n'a
// signé. Dans un aperçu, la ligue est simulée (reponsesDemo) : rien n'y
// compte.
// Sur ordinateur (course.tsx), le bloc prend toute la largeur sous la
// semaine : la rangée y prend les deux flèches et le fondu de la course, le
// défi et la ligue se posent côte à côte.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useIdentites } from "@/hooks/use-identites";
import { useMissionsDeLaLigue, type FaceAFace, type MissionsDeLaLigue } from "@/hooks/use-missions";
import { NOM_DE_CODE, phrase, prenom, rangDe, risqueDe, type Engagement, type Rang } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import { BLANCS, Carte, NOIRS, Pouls, Tampon, Viseur, type EtatViseur } from "./missions";
import "./missions.css";

type Ligue = MissionsDeLaLigue;

const RANGS: Rang[] = ["S", "A", "B"];
const meilleur = (a: Rang, b: Rang) => (RANGS.indexOf(a) <= RANGS.indexOf(b) ? a : b);
const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Plusieurs matchs ce dimanche : chaque affiche dit le sien. */
const plusieursMatchs = (lg: Ligue) => new Set([...lg.d.camps.values()].map((c) => c.terrain)).size > 1;

/** La note aux couleurs de son équipe du dimanche. */
function onglet(lg: Ligue, nom: string) {
  const c = lg.d.camps.get(nom);
  return c ? (c.equipe === "noirs" ? NOIRS : BLANCS) : undefined;
}

/** Le verdict se lit dès que la feuille le donne, jamais avant le coup d'envoi. */
const tranche = (e: Engagement, lg: Ligue) => lg.phase !== "ouvert" && e.verdict.etat !== "en-jeu";

function etatViseur(e: Engagement, lg: Ligue): EtatViseur {
  if (!tranche(e, lg)) return "verrou";
  return e.verdict.etat === "ratee" ? "rate" : e.verdict.etat === "annulee" ? "eteint" : "verrou";
}

function etatFiche(e: Engagement, lg: Ligue): string | null {
  if (!tranche(e, lg)) return null;
  return { reussie: "fiche--reussie", ratee: "fiche--ratee", annulee: "fiche--eteinte", "en-jeu": null }[e.verdict.etat];
}

/** En haut à droite : les signatures, puis le match en cours, puis le verdict. */
function Moment({ lg }: { lg: Ligue }) {
  if (lg.phase === "ouvert")
    return <span className="mono-label shrink-0 text-foreground/45">{pl(lg.total, "signature", "signatures")}</span>;
  if (lg.phase === "en-jeu" && !lg.d.joue)
    return (
      <span className="mono-label flex shrink-0 items-center gap-2 text-foreground/80">
        <Pouls bat /> En jeu
      </span>
    );
  return (
    <span className="mono-label shrink-0 text-foreground/55">{lg.phase === "en-jeu" ? "Verdict à minuit" : "Verdict"}</span>
  );
}

/** Le bas d'une affiche : prime et risque, puis « En jeu », puis le tampon du verdict. */
function Resultat({ e, lg, court }: { e: Engagement; lg: Ligue; court?: boolean }) {
  const e_ = e.m.creneau === "contrat" ? "" : "e";
  if (tranche(e, lg)) {
    const v = e.verdict.etat;
    const xp = v === "reussie" ? `+${e.m.xp}` : v === "ratee" ? `−${risqueDe(e.m)}` : null;
    const tampon =
      v === "reussie" ? (
        <Tampon petit>Accompli{e_}{!court && ` · ${xp}`}</Tampon>
      ) : v === "ratee" ? (
        <Tampon petit ton="rouge">
          Échec{!court && ` · ${xp}`}
        </Tampon>
      ) : (
        <Tampon petit ton="gris">
          Annulé{e_}
        </Tampon>
      );
    if (!court || !xp) return tampon;
    return (
      <span className="flex flex-col items-center gap-2">
        {tampon}
        <span className={cn("mono-label", v === "ratee" ? "text-[#ff9b9d]" : "fiche__ton")}>{xp} XP</span>
      </span>
    );
  }
  return (
    <span className="flex w-full items-baseline justify-between gap-2">
      <span className="fiche__ton flex items-baseline gap-1">
        <span className="text-[21px] leading-none" style={{ fontFamily: ANTON }}>
          +{e.m.xp}
        </span>
        <span className="mono-label">XP</span>
      </span>
      {lg.phase === "ouvert" ? (
        !court && <span className="mono-label text-[#ff9b9d]">−{risqueDe(e.m)}</span>
      ) : (
        <span className="fiche__ton flex items-center gap-1.5">
          <Pouls bat={lg.phase === "en-jeu"} />
          {!court && <span className="mono-label">{lg.phase === "fini" ? "En attente" : "En jeu"}</span>}
        </span>
      )}
    </span>
  );
}

/** Un contrat signé : la cible sous le viseur, l'objectif, celui qui a signé, ce qu'il rapporte. Aussi sur la Map (map/contrats-sur.tsx). */
/** `vise` : la cible à mettre sous le viseur quand le contrat en vise plusieurs (la Map, map/contrats-sur.tsx). */
export function Affiche({ e, lg, vise }: { e: Engagement; lg: Ligue; vise?: string }) {
  const identite = useIdentites();
  const rang = rangDe(e.m);
  const code = NOM_DE_CODE[e.m.genre];
  const tete = e.m.genre === "reste-en-tete";
  const cible = tete ? e.joueur : vise && e.m.cibles.includes(vise) ? vise : (e.m.cibles[0] ?? e.joueur);
  const autres = tete ? 0 : e.m.cibles.length - 1;
  // Le coin d'une affiche est étroit : seulement « Sur toi ». Le sien se lit à « Signé par Toi ».
  const coin = lg.moi && e.joueur !== lg.moi && e.m.cibles.includes(lg.moi) ? "Sur toi" : null;
  return (
    <article
      aria-label={`Contrat ${code}, rang ${rang}, signé par ${identite.nom(e.joueur)}`}
      className={cn("fiche fiche--affiche dark", `fiche--${rang}`, etatFiche(e, lg))}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Rang {rang}</span>
        {coin && <span className="fiche__type mono-label truncate text-white/75">{coin}</span>}
      </div>
      <div className="flex flex-1 flex-col items-center gap-3 px-3 pt-4 pb-3.5">
        <div className="relative">
          <div className={cn(etatViseur(e, lg) === "rate" && "fiche__carte--ratee")}>
            <Carte nom={cible} size={FORMAT_CARTE.moyenne} onglet={onglet(lg, cible)} />
          </div>
          <Viseur etat={etatViseur(e, lg)} petit />
          {autres > 0 && <span className="affiche__plus mono-label">+{autres}</span>}
        </div>
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="mono-label fiche__ton">{code}</span>
          <p className="line-clamp-3 text-[14px] leading-[1.18] font-bold break-words">{phrase(e.m, identite.nom)}</p>
        </div>
        <div className="flex w-full items-center gap-2 border-t border-white/10 pt-3">
          {tete ? (
            <span className="mono-label text-white/55">Défend la 1re place</span>
          ) : (
            <>
              <Carte nom={e.joueur} size={FORMAT_CARTE.petite} onglet={onglet(lg, e.joueur)} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="mono-label text-white/45">Signé par</span>
                <span className="truncate text-[13px] leading-tight font-bold">
                  {e.joueur === lg.moi ? "Toi" : prenom(identite.nom(e.joueur))}
                </span>
              </span>
            </>
          )}
        </div>
        <div className="mt-auto flex w-full justify-center pt-0.5">
          <Resultat e={e} lg={lg} />
        </div>
      </div>
    </article>
  );
}

/** Un côté d'un face-à-face : le joueur, son contrat, ce qu'il en tire. */
function Cote({ e, lg, couleurs }: { e: Engagement; lg: Ligue; couleurs: { fond: string; encre: string } }) {
  const identite = useIdentites();
  const rang = rangDe(e.m);
  return (
    <div className={cn("flex w-[100px] min-w-0 flex-col items-center gap-3", `fiche--${rang}`)}>
      <div className={cn(etatViseur(e, lg) === "rate" && "fiche__carte--ratee")}>
        <Carte nom={e.joueur} size={FORMAT_CARTE.moyenne} onglet={couleurs} />
      </div>
      <div className="flex w-full min-w-0 flex-col items-center gap-1.5 text-center">
        <span className="w-full truncate text-[14px] leading-tight font-bold">
          {e.joueur === lg.moi ? "Toi" : prenom(identite.nom(e.joueur))}
        </span>
        <span className="mono-label fiche__ton">
          {NOM_DE_CODE[e.m.genre]} · {rang}
        </span>
        <p className="line-clamp-3 text-[13px] leading-[1.18] font-bold break-words text-white/75">
          {phrase(e.m, identite.nom)}
        </p>
      </div>
      <div className="mt-auto flex w-full justify-center">
        <Resultat e={e} lg={lg} court />
      </div>
    </div>
  );
}

/** Deux rivaux qui ont signé l'un contre l'autre. */
export function AfficheDuel({ f, lg }: { f: FaceAFace; lg: Ligue }) {
  const identite = useIdentites();
  const rang = meilleur(rangDe(f.noirs.m), rangDe(f.blancs.m));
  const lui = lg.moi === f.duel.noirs || lg.moi === f.duel.blancs;
  const coin = lui ? "Ton duel" : plusieursMatchs(lg) ? f.duel.label : null;
  return (
    <article
      aria-label={`Face-à-face : ${identite.nom(f.duel.noirs)} contre ${identite.nom(f.duel.blancs)}`}
      className={cn("fiche fiche--affiche fiche--affiche-duel dark", `fiche--${rang}`)}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Face-à-face</span>
        {coin && <span className="fiche__type mono-label truncate text-white/75">{coin}</span>}
      </div>
      <div className="flex flex-1 items-stretch justify-center gap-1.5 px-3 pt-4 pb-3.5">
        <Cote e={f.noirs} lg={lg} couleurs={NOIRS} />
        <span className="shrink-0 pt-[52px] text-[17px] leading-none text-white/40" style={{ fontFamily: ANTON }}>
          VS
        </span>
        <Cote e={f.blancs} lg={lg} couleurs={BLANCS} />
      </div>
    </article>
  );
}

function etatEngage(e: Engagement, lg: Ligue): string | null {
  if (!tranche(e, lg)) return null;
  return { reussie: "engage--reussie", ratee: "engage--ratee", annulee: "engage--annulee", "en-jeu": null }[e.verdict.etat];
}

/** Les engagés d'une même mission (« Gagnez. », le Jury) : leurs cartes, équipe par équipe quand elle se gagne à plusieurs. */
function Engages({ titre, liste, lg }: { titre: string; liste: Engagement[]; lg: Ligue }) {
  const m = liste[0].m;
  const rang = rangDe(m);
  const objectif = m.genre === "record" ? "Bats ton record." : phrase(m);
  let groupes: { cle: string; label: string | null; liste: Engagement[] }[] = [{ cle: "tous", label: null, liste }];
  if (m.genre === "gagnez") {
    const par = new Map<string, { cle: string; label: string | null; liste: Engagement[]; ordre: number }>();
    for (const e of liste) {
      const c = lg.d.camps.get(e.joueur);
      if (!c) continue;
      const cle = `${c.terrain}-${c.equipe}`;
      const equipe = c.equipe === "noirs" ? "Noirs" : "Blancs";
      const g = par.get(cle) ?? { cle, label: plusieursMatchs(lg) ? `${c.label} · ${equipe}` : equipe, liste: [], ordre: c.terrain * 2 + (c.equipe === "noirs" ? 0 : 1) };
      g.liste.push(e);
      par.set(cle, g);
    }
    groupes = [...par.values()].sort((a, b) => a.ordre - b.ordre);
  }
  const tranches = liste.filter((e) => tranche(e, lg));
  const reussies = tranches.filter((e) => e.verdict.etat === "reussie").length;
  const ratees = tranches.filter((e) => e.verdict.etat === "ratee").length;
  return (
    <article aria-label={`${titre} : ${NOM_DE_CODE[m.genre]}`} className={cn("fiche fiche--engages dark mx-4 md:mx-0", `fiche--${rang}`)}>
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">{titre}</span>
        <span className="fiche__type mono-label text-white/75">{pl(liste.length, "engagé", "engagés")}</span>
      </div>
      <div className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h3 className="titre-lettrage text-[26px] leading-[0.9] break-words">{NOM_DE_CODE[m.genre]}</h3>
            <span className="mono-label fiche__ton">Rang {rang}</span>
          </div>
          <span className="flex shrink-0 items-baseline gap-2">
            <span className="fiche__ton flex items-baseline gap-1">
              <span className="text-[21px] leading-none" style={{ fontFamily: ANTON }}>
                +{m.xp}
              </span>
              <span className="mono-label">XP</span>
            </span>
            <span className="mono-label text-[#ff9b9d]">−{risqueDe(m)}</span>
          </span>
        </div>
        <p className="text-[17px] leading-[1.15] font-bold tracking-[-0.2px]">{objectif}</p>
        {groupes.map((g) => {
          const juge = g.label ? g.liste.find((e) => tranche(e, lg) && e.verdict.etat !== "annulee") : undefined;
          return (
            <div key={g.cle} className="flex flex-col gap-2.5">
              {g.label && (
                <div className="flex min-h-6 items-center justify-between gap-3">
                  <span className="mono-label text-white/45">{g.label}</span>
                  {juge ? (
                    <Resultat e={juge} lg={lg} />
                  ) : lg.phase !== "ouvert" ? (
                    <span className="fiche__ton flex items-center gap-1.5">
                      <Pouls bat={lg.phase === "en-jeu"} />
                    </span>
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {g.liste.map((e) => (
                  <span key={e.joueur} className={cn("engage", etatEngage(e, lg))}>
                    <Carte nom={e.joueur} size={FORMAT_CARTE.petite} onglet={onglet(lg, e.joueur)} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {m.genre !== "gagnez" && tranches.length > 0 && (
          <span className="mono-label text-white/55">
            {pl(reussies, "accomplie", "accomplies")} · {pl(ratees, "ratée", "ratées")}
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * La rangée des affiches. Elle s'ouvre sur la première : quand la liste se
 * réordonne (des signatures arrivent, un face-à-face passe devant), le
 * navigateur garderait l'affiche qu'il avait accrochée, au milieu de la
 * rangée. Dès qu'on l'a touchée, elle reste où on l'a mise. À la souris, deux
 * flèches la font défiler, chacune effacée quand ce côté est au bout, comme
 * la course (course.tsx).
 */
function Rangee({ cles, children }: { cles: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const touchee = useRef(false);
  useLayoutEffect(() => {
    if (!touchee.current && ref.current) ref.current.scrollLeft = 0;
  }, [cles]);
  const [bouts, setBouts] = useState({ debut: true, fin: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Un nouvel état seulement quand un bout change : pas de rendu à chaque pas du défilement.
    const mesurer = () => {
      const debut = el.scrollLeft <= 4;
      const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      setBouts((b) => (b.debut === debut && b.fin === fin ? b : { debut, fin }));
    };
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    el.addEventListener("scroll", mesurer, { passive: true });
    return () => {
      o.disconnect();
      el.removeEventListener("scroll", mesurer);
    };
    // Remesuré à chaque nouvelle liste : la rangée change de longueur sans changer de taille.
  }, [cles]);
  const defiler = (sens: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    touchee.current = true;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sens * el.clientWidth * 0.8, behavior: calme ? "auto" : "smooth" });
  };
  return (
    <div className="md:relative">
      {(["debut", "fin"] as const).map((bout) => (
        <button
          key={bout}
          type="button"
          aria-label={bout === "debut" ? "Défiler vers la gauche" : "Défiler vers la droite"}
          onClick={() => defiler(bout === "debut" ? -1 : 1)}
          className={cn(
            "glass absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full transition-opacity duration-300 pointer-fine:md:grid",
            bout === "debut" ? "left-0" : "right-0",
            bouts[bout] && "pointer-events-none opacity-0",
          )}
        >
          {bout === "debut" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
        </button>
      ))}
      <div
        ref={ref}
        aria-label="Les contrats signés"
        onPointerDown={() => (touchee.current = true)}
        onWheel={() => (touchee.current = true)}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pt-2 pb-5 [scrollbar-width:none] md:scroll-px-14 md:px-14 md:[mask-image:linear-gradient(90deg,transparent,#000_56px,#000_calc(100%-56px),transparent)] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  );
}

export function ContratsEnJeu({ className }: { className?: string }) {
  const lg = useMissionsDeLaLigue();
  if (!lg || lg.total === 0) return null;
  const { d, faceAFace, contrats, defis, ligue } = lg;
  const signes = faceAFace.length * 2 + contrats.length;
  return (
    <section aria-labelledby="titre-contrats-en-jeu" className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label truncate text-foreground/45">J{d.j} · Toute la ligue</span>
          <Moment lg={lg} />
        </div>
        <h2 id="titre-contrats-en-jeu" className="titre-lettrage text-[30px] leading-[0.95]">
          Contrats en jeu
        </h2>
      </div>

      {signes > 0 && (
        <div className="flex flex-col gap-1">
          <span className="mono-label px-5 text-foreground/45 md:px-0">
            {faceAFace.length > 0 && `${faceAFace.length} face-à-face · `}
            {pl(signes, "contrat signé", "contrats signés")}
          </span>
          <Rangee cles={[...faceAFace.map((f) => `${f.duel.noirs}-${f.duel.blancs}`), ...contrats.map((e) => e.joueur)].join("|")}>
            {faceAFace.map((f) => (
              <AfficheDuel key={`${f.duel.noirs}-${f.duel.blancs}`} f={f} lg={lg} />
            ))}
            {contrats.map((e) => (
              <Affiche key={e.joueur} e={e} lg={lg} />
            ))}
          </Rangee>
        </div>
      )}

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start md:gap-[var(--fib-21)] xl:grid-cols-3">
        {[...new Set(defis.map((e) => e.m.genre))].map((g) => (
          <Engages key={g} titre="Défi du dimanche" liste={defis.filter((e) => e.m.genre === g)} lg={lg} />
        ))}
        {ligue.length > 0 && <Engages titre="La ligue" liste={ligue} lg={lg} />}
      </div>
    </section>
  );
}
