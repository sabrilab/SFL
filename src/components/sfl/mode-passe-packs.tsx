"use client";

// L'onglet « Packs » du mode Passe : le PACK AFRIQUE 2027 (lib/sfl/
// pack-afrique.ts). Ilyes, 01/11/2026 : « ces packs achetables en XP, c'est
// très cool » ; « design-moi quelque chose de magnifique […] inspiré de chaque
// culture, de chaque pays africain ». Un pack qui ne s'achète qu'en XP, jamais
// gagné par les missions ni par le Passe ; dépenser ne fait jamais baisser le
// Niveau XP. Le nom du tournoi, son trophée, sa mascotte et ses logos
// appartiennent à la CAF : rien ne s'en écrit ni ne s'en dessine ici.
//   · la fiche : l'étui, dessiné en code (noir guilloché, coins de repère,
//     microtexte, la frise des motifs des nations), le compte « 4/12 », les
//     nations en vignettes (la carte du joueur dans la nation s'il l'a,
//     scellée sinon), et le bouton « Ouvrir · 1 200 XP » (« 860 / 1 200 »,
//     éteint, s'il manque de l'XP ; « 12/12 » une fois complet) ;
//   · la confirmation : la piste scellée, dans un seul sens ; la clé de
//     l'ouverture est tirée là et gardée jusqu'au résultat (boutique-xp.ts) ;
//   · la cérémonie (pack-opening.tsx, CeremoniePack) : l'étui respire, on le
//     touche, il se déchire ; la carte DU JOUEUR arrive dans la nation tirée,
//     se retourne une fois pour montrer son dos (le motif, le numéro de
//     série, « pays hôte »), puis se pose en 3D, à tourner ; « Porter » ou
//     « Plus tard » ;
//   · toucher une nation obtenue : la carte en grand, en 3D, le nom du skin,
//     sa phrase, son numéro, et l'inspiration (les sources).
// Le tirage se fait sur le serveur, parmi les nations validées qui manquent :
// jamais de doublon, aucune rareté par nation. Le compte vitrine (Sabri) voit
// le pack plein et rejoue la cérémonie en aperçu, sans rien écrire.
// Aucun texte d'aide : les chiffres, les états et le geste suffisent.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Lock, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { ApercuNation, habillageNation } from "@/components/sfl/afrique/apercu";
import { SKINS_AFRIQUE } from "@/components/sfl/afrique/registre";
import { Card3D } from "@/components/sfl/card-3d";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, MATIERES, type Finition, type HabillageCarte } from "@/components/sfl/finitions-carte";
import { RosaceBola } from "@/components/sfl/motif-carte";
import { CeremoniePack, type Revelation } from "@/components/sfl/pack-opening";
import { Mini } from "@/components/sfl/passe-bola";
import { PlayerCard } from "@/components/sfl/player-card";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import { poserAchat, rafraichirAchatsXp, useSoldeXp } from "@/hooks/use-achats-xp";
import { rafraichirBilanServeur } from "@/hooks/use-bilan-serveur";
import { useAfriqueCarte, useChoixHabillage, useHabillage } from "@/hooks/use-habillage";
import { useMediaQuery } from "@/hooks/use-media-query";
import { logActivity } from "@/lib/sfl/activity";
import { cleOuverture, oublierOuverture, ouvertureEnSuspens, ouvrirPackAfrique } from "@/lib/sfl/boutique-xp";
import { nombreFr } from "@/lib/sfl/compteur-xp";
import type { Player } from "@/lib/sfl/engine";
import { choisirHabillage } from "@/lib/sfl/habillages-choisis";
import { etatOuverture, nationsMontrees, NATIONS, numeroSerieNation, PACK_AFRIQUE, type CodeNation } from "@/lib/sfl/pack-afrique";
import { cn } from "@/lib/utils";
import "./mode-passe-packs.css";

const nationDe = (n: CodeNation) => NATIONS.find((x) => x.id === n)!;
const hote = (n: CodeNation) => !!(nationDe(n) as { hote?: true }).hote;

/* ------------------------------ L'étui ------------------------------ */

/** L'éclat pris dans le dos de chaque nation (repère 1024 × 1656). */
const ECLAT = { x: 30, y: 30, c: 380 } as const;

/**
 * Un éclat du motif d'une nation, pris dans le haut de son dos (là où chaque
 * skin pose son cadre et sa trame), sur son papier : la frise de l'étui et
 * les nations scellées.
 */
function Tesselle({ nation, className }: { nation: CodeNation; className?: string }) {
  const skin = SKINS_AFRIQUE[nation];
  const id = `tesselle${nation}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { Motif } = skin;
  return (
    <span aria-hidden className={cn("pk-tesselle", className)} style={{ background: skin.matiere.papier }}>
      <svg viewBox={`${ECLAT.x} ${ECLAT.y} ${ECLAT.c} ${ECLAT.c}`} preserveAspectRatio="xMidYMid slice">
        <Motif cote="dos" m={skin.matiere.motif} graine={7} id={id} />
      </svg>
    </span>
  );
}

/** L'étui du pack, dessiné en code : le noir guilloché, les coins de repère, le microtexte, la frise des nations. */
export function EtuiAfrique({ largeur = 188, respire = false }: { largeur?: number; respire?: boolean }) {
  const nations = nationsMontrees();
  const h = Math.round(largeur * 1.5);
  const micro = Array.from({ length: 8 }, () => "AFRIQUE 2027").join(" · ");
  return (
    <motion.span
      className="pk-etui"
      style={
        {
          width: largeur,
          height: h,
          "--pk-l": `${largeur}px`,
        } as React.CSSProperties
      }
      animate={respire ? { y: [0, -6, 0], rotate: [0, -0.6, 0] } : undefined}
      transition={respire ? { repeat: Infinity, duration: 2.8, ease: "easeInOut" } : undefined}
    >
      <svg aria-hidden className="pk-etui__guilloche" viewBox="0 0 200 300" preserveAspectRatio="none">
        <RosaceBola cx={100} cy={118} r1={34} r2={62} couleur="rgba(255,255,255,0.13)" epaisseur={0.45} />
        <rect x="7" y="7" width="186" height="286" rx="10" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
        <rect x="11" y="11" width="178" height="278" rx="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Les coins de repère. */}
        {[
          [16, 16, 1, 1],
          [184, 16, -1, 1],
          [16, 284, 1, -1],
          [184, 284, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <path key={i} d={`M${x} ${y + 9 * sy}V${y}H${x + 9 * sx}`} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.9" />
        ))}
        {/* La ligne de déchirure. */}
        <path d="M14 40H186" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" strokeDasharray="1.6 2.4" />
        <text x="100" y="31" textAnchor="middle" className="pk-etui__micro">
          {micro}
        </text>
        <text x="100" y="279" textAnchor="middle" className="pk-etui__micro">
          {micro}
        </text>
      </svg>
      <span className="pk-etui__titre">
        <span className="mono-label text-white/55">Pack</span>
        <span className="pk-etui__nom titre-lettrage">Afrique</span>
        <span className="pk-etui__annee tabular-nums" style={{ fontFamily: ANTON }}>
          2027
        </span>
      </span>
      <span className="pk-etui__frise">
        {nations.map((n) => (
          <Tesselle key={n} nation={n} />
        ))}
      </span>
    </motion.span>
  );
}

/* --------------------------- La révélation --------------------------- */

/**
 * La carte du joueur arrive dans la nation tirée, se retourne une fois pour
 * montrer son dos (le motif, le numéro de série), puis se pose en 3D.
 * « Réduire les animations » : posée tout de suite.
 */
function RevelationNation({ nation, player, autour, reduit }: { nation: CodeNation; player: Player; autour: HabillageCarte; reduit: boolean }) {
  // face → (demi-tour) → dos → (demi-tour) → face → la 3D, posée.
  const [etape, setEtape] = useState<"face" | "vers-dos" | "dos" | "vers-face" | "retour" | "pose">(reduit ? "pose" : "face");
  const habillage = {
    ...habillageNation(nation, autour),
    serieNation: autour.serieNation,
  };
  useEffect(() => {
    if (etape === "pose") return;
    const suite = { face: "vers-dos", "vers-dos": "dos", dos: "vers-face", "vers-face": "retour", retour: "pose" } as const;
    const duree = { face: 1300, "vers-dos": 260, dos: 1700, "vers-face": 260, retour: 900 }[etape];
    const id = window.setTimeout(() => setEtape(suite[etape]), duree);
    return () => window.clearTimeout(id);
  }, [etape]);
  if (etape === "pose") return <ApercuNation nation={nation} player={player} vue="3d" taille={0.95} autour={habillage} />;
  // La carte à plat, à la taille où la 3D la pose (Card3D réduit un peu sa carte).
  const taille = TAILLE_PLATE;
  const dos = etape === "dos" || etape === "vers-face";
  const tourne = etape === "vers-dos" || etape === "vers-face";
  const w = 254 * taille;
  return (
    <span className="pk-retourne" style={{ width: w, height: (w * 1656) / 1024 }}>
      <motion.span
        className="pk-retourne__carte"
        animate={{ rotateY: tourne ? 90 : 0, scale: etape === "retour" ? 1.04 : 1 }}
        transition={{ duration: tourne ? 0.26 : 0.32, ease: tourne ? [0.55, 0, 1, 0.45] : [0, 0.55, 0.45, 1] }}
      >
        {dos ? (
          <DosCarte matiere={matiereDe("base", habillage)} nom={player.name} size={taille} habillage={habillage} />
        ) : (
          <PlayerCard player={player} size={taille} habillage={habillage} />
        )}
      </motion.span>
    </span>
  );
}

/** La carte à plat de la cérémonie : la largeur que Card3D donne à sa carte à la taille 0,95. */
const TAILLE_PLATE = 0.68;

/** Le halo d'une nation : sa couleur vive, à faible opacité (jamais d'or ni de couleur de rareté). */
function haloDe(nation: CodeNation): string {
  const vive = MATIERES[`afrique-${nation}` as Finition]?.vive ?? "#ecece8";
  const m = /^#([0-9a-f]{6})$/i.exec(vive);
  if (!m) return "rgba(236,236,232,.28)";
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},.34)`;
}

/* ------------------------------- La vue ------------------------------- */

type Tirage = { nation: CodeNation; serie: number; apercu?: boolean };

export function VuePacks({ player, vitrine }: { player: Player; vitrine: boolean }) {
  const nom = player.name;
  const reduit = useMediaQuery("(prefers-reduced-motion: reduce)");
  const large = useMediaQuery("(min-width: 900px)");
  const afrique = useAfriqueCarte(nom);
  const solde = useSoldeXp(nom);
  const porte = useHabillage(nom);
  const choix = useChoixHabillage(nom);
  const nations = nationsMontrees();
  const obtenus = useMemo(() => afrique.map(([n]) => n), [afrique]);
  const etat = vitrine ? ({ t: "apercu" } as const) : etatOuverture(solde ?? 0, obtenus);
  const [confirmer, setConfirmer] = useState(false);
  const [tirage, setTirage] = useState<Tirage | null>(null);
  const [ceremonie, setCeremonie] = useState(false);
  const [detail, setDetail] = useState<CodeNation | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const cle = useRef<string | null>(null);
  const autour: HabillageCarte = {
    cran: porte.cran,
    rang: porte.rang,
    signes: porte.signes,
  };

  // Une ouverture partie et pas vue (l'app fermée en plein geste) : on la rejoue, même clé, même tirage.
  useEffect(() => {
    if (vitrine) return;
    const enSuspens = ouvertureEnSuspens(nom);
    if (!enSuspens) return;
    let fini = false;
    void ouvrirPackAfrique(nom, enSuspens).then((r) => {
      if (fini || !r.ok) return;
      poserAchat(nom, {
        article: PACK_AFRIQUE.article,
        obtenu: r.obtenu,
        xp: r.xp,
        serie: r.serie,
        le: new Date().toISOString(),
      });
      setTirage({ nation: r.obtenu as CodeNation, serie: r.serie });
      setCeremonie(true);
    });
    return () => {
      fini = true;
    };
  }, [nom, vitrine]);

  const ouvrirConfirmation = () => {
    setRefus(null);
    if (vitrine) {
      // L'aperçu de la vitrine : une nation au hasard, sans appel au serveur.
      const n = nations[Math.floor(Math.random() * nations.length)];
      setTirage({ nation: n, serie: 0, apercu: true });
      setCeremonie(true);
      return;
    }
    cle.current = cleOuverture(nom);
    navigator.vibrate?.(8);
    setConfirmer(true);
  };

  const fermerConfirmation = () => {
    setConfirmer(false);
    oublierOuverture();
  };

  const payer = async () => {
    const c = cle.current ?? cleOuverture(nom);
    const r = await ouvrirPackAfrique(nom, c);
    if (!r.ok) {
      setRefus(r.code === 402 && r.solde != null ? `${nombreFr(r.solde)} / ${nombreFr(PACK_AFRIQUE.prix)}` : r.raison);
      void rafraichirBilanServeur(true);
      return "dite" as const;
    }
    poserAchat(nom, {
      article: PACK_AFRIQUE.article,
      obtenu: r.obtenu,
      xp: r.xp,
      serie: r.serie,
      le: new Date().toISOString(),
    });
    logActivity("pack", {
      meta: { article: PACK_AFRIQUE.article, obtenu: r.obtenu },
    });
    setTirage({ nation: r.obtenu as CodeNation, serie: r.serie });
    return "ok" as const;
  };

  const finir = (porter: boolean) => {
    const t = tirage;
    setCeremonie(false);
    setConfirmer(false);
    setTirage(null);
    oublierOuverture();
    if (t && !t.apercu) {
      void rafraichirAchatsXp(nom);
      if (porter)
        void choisirHabillage(nom, {
          ...choix,
          finition: `afrique-${t.nation}` as Finition,
        });
    }
  };

  const bouton =
    etat.t === "apercu" ? (
      <button type="button" className="mp-bouton" onClick={ouvrirConfirmation}>
        Aperçu de l&apos;ouverture
      </button>
    ) : etat.t === "ouvrir" ? (
      <button type="button" className="mp-bouton" onClick={ouvrirConfirmation}>
        Ouvrir · {nombreFr(etat.prix)} XP
      </button>
    ) : etat.t === "manque" ? (
      <button type="button" className="mp-bouton mp-bouton--creux" disabled aria-label={`Il te faut ${nombreFr(etat.prix)} XP`}>
        <span className="tabular-nums">
          {nombreFr(etat.solde)} / {nombreFr(etat.prix)} XP
        </span>
      </button>
    ) : null;

  const mienne = (n: CodeNation) => afrique.find(([x]) => x === n);

  return (
    <div className="pk">
      <section className="pk-fiche" aria-label={PACK_AFRIQUE.nom}>
        <EtuiAfrique largeur={large ? 210 : 168} />
        <div className="pk-fiche__dit">
          <span className="mono-label text-white/50">{vitrine ? "Vitrine" : "Payé en XP"}</span>
          <h2 className="pk-fiche__nom titre-lettrage">{PACK_AFRIQUE.nom}</h2>
          <span className="pk-fiche__compte">
            <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 40, lineHeight: 0.9 }}>
              {afrique.length}
            </span>
            <span className="font-mono text-[13px] font-bold text-white/45 tabular-nums">/ {nations.length}</span>
          </span>
          {solde != null && !vitrine && <span className="mono-label tabular-nums text-white/55">{nombreFr(solde)} XP à dépenser</span>}
          {etat.t === "complet" ? null : <div className="pk-fiche__action">{bouton}</div>}
        </div>
      </section>

      <ul className="pk-nations" aria-label="Les nations">
        {nations.map((n) => {
          const m = mienne(n);
          const skin = SKINS_AFRIQUE[n];
          return (
            <li key={n}>
              <button
                type="button"
                className={cn("pk-nation", m ? "pk-nation--a-toi" : "pk-nation--scellee")}
                disabled={!m}
                onClick={() => m && setDetail(n)}
                aria-label={m ? `${nationDe(n).nom}, ${skin.nom}` : `${nationDe(n).nom}, scellée`}
              >
                <span className="pk-nation__carte">
                  {m ? (
                    <Mini
                      player={player}
                      habillage={{
                        ...autour,
                        ...habillageNation(n),
                        serieNation: m[1] || undefined,
                      }}
                      l={64}
                      h={103}
                    />
                  ) : (
                    <>
                      <Tesselle nation={n} className="pk-tesselle--scellee" />
                      <span className="pk-nation__cadenas">
                        <Lock className="size-3" strokeWidth={2.6} />
                      </span>
                    </>
                  )}
                </span>
                <span className="pk-nation__nom">{nationDe(n).nom}</span>
                {m && <span className="pk-nation__skin">{skin.nom}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Posés sur tout l'écran (hors du défilement du mode, qui les couperait). */}
      {createPortal(
        <>
          {/* La confirmation : la piste scellée, dans un seul sens. */}
          <AnimatePresence>
            {confirmer && !ceremonie && (
              <motion.div
                className="pk-voile"
                role="dialog"
                aria-modal
                aria-label={`Ouvrir le ${PACK_AFRIQUE.nom}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="pk-confirmer">
                  <button type="button" onClick={fermerConfirmation} aria-label="Fermer" className="mp-rond pk-confirmer__fermer">
                    <X className="size-4" strokeWidth={2.4} />
                  </button>
                  <EtuiAfrique largeur={132} respire={!reduit} />
                  <span className="pk-confirmer__nom titre-lettrage">{PACK_AFRIQUE.nom}</span>
                  <span className="mono-label tabular-nums text-white/60">
                    {nombreFr(PACK_AFRIQUE.prix)} XP
                    {solde != null ? ` · ${nombreFr(solde)} à dépenser` : ""}
                  </span>
                  <ReponseScellee
                    mine={null}
                    seul={{ r: "present", libelle: "Glisser pour ouvrir" }}
                    scelles={{ present: "Ouvert" }}
                    tonSeul="blanc"
                    onRepondre={payer}
                    onScellee={() => setCeremonie(true)}
                    className="w-full max-w-[20rem]"
                  />
                  {refus && (
                    <span className="mono-label tabular-nums text-white/70" role="status">
                      {refus}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* La cérémonie. */}
          <AnimatePresence>
            {ceremonie && tirage && (
              <CeremoniePack
                key={`${tirage.nation}-${tirage.serie}`}
                reduit={reduit}
                etui={<EtuiAfrique largeur={196} respire={!reduit} />}
                appel={null}
                suite={null}
                revelations={[
                  {
                    cle: tirage.nation,
                    halo: haloDe(tirage.nation),
                    son: "def",
                    rendu: (
                      <RevelationNation
                        nation={tirage.nation}
                        player={player}
                        autour={{
                          ...autour,
                          serieNation: tirage.serie || undefined,
                        }}
                        reduit={reduit}
                      />
                    ),
                    legende: (
                      <span className="flex flex-col items-center gap-1">
                        <span>
                          {nationDe(tirage.nation).nom} · {SKINS_AFRIQUE[tirage.nation].nom}
                          {tirage.serie ? ` · ${numeroSerieNation(tirage.serie)}` : " · aperçu"}
                        </span>
                        <span className="flex gap-2 pt-3">
                          <button type="button" className="mp-bouton pk-apres" onClick={() => finir(true)}>
                            {tirage.apercu ? "Fermer" : "Porter"}
                          </button>
                          {!tirage.apercu && (
                            <button type="button" className="mp-bouton mp-bouton--creux pk-apres" onClick={() => finir(false)}>
                              Plus tard
                            </button>
                          )}
                        </span>
                      </span>
                    ),
                  } satisfies Revelation,
                ]}
              />
            )}
          </AnimatePresence>

          {/* Une nation obtenue, en grand. */}
          <AnimatePresence>
            {detail && (
              <motion.div
                className="pk-voile"
                role="dialog"
                aria-modal
                aria-label={`${nationDe(detail).nom}, ${SKINS_AFRIQUE[detail].nom}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DetailNation
                  nation={detail}
                  player={player}
                  autour={{
                    ...autour,
                    serieNation: mienne(detail)?.[1] || undefined,
                  }}
                  portee={porte.finition === `afrique-${detail}`}
                  onPorter={(oui) =>
                    void choisirHabillage(nom, {
                      ...choix,
                      finition: oui ? (`afrique-${detail}` as Finition) : "-",
                    })
                  }
                  onFermer={() => setDetail(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body,
      )}
    </div>
  );
}

function DetailNation({
  nation,
  player,
  autour,
  portee,
  onPorter,
  onFermer,
}: {
  nation: CodeNation;
  player: Player;
  autour: HabillageCarte;
  portee: boolean;
  onPorter: (oui: boolean) => void;
  onFermer: () => void;
}) {
  const skin = SKINS_AFRIQUE[nation];
  const n = nationDe(nation);
  return (
    <div className="pk-detail">
      <button type="button" onClick={onFermer} aria-label="Fermer" className="mp-rond pk-confirmer__fermer">
        <X className="size-4" strokeWidth={2.4} />
      </button>
      <span className="pk-detail__carte">
        <Card3D
          cacheKey={`pk-detail-${nation}-${player.name}-${autour.serieNation ?? 0}`}
          size={0.92}
          apercu
          render={(s) => <PlayerCard player={player} size={s} habillage={{ ...autour, ...habillageNation(nation) }} />}
        />
      </span>
      <span className="mono-label text-white/50">
        {n.nom}
        {hote(nation) ? " · pays hôte" : ""}
        {autour.serieNation ? ` · ${numeroSerieNation(autour.serieNation)}` : ""}
      </span>
      <h3 className="pk-detail__nom titre-lettrage">{skin.nom}</h3>
      <p className="pk-detail__quoi">{skin.quoi}</p>
      <div className="pk-detail__sources">
        <span className="mono-label text-white/40">Inspiration</span>
        <ul>
          {skin.sources.map((s) => (
            <li key={s.titre}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.titre}
                </a>
              ) : (
                s.titre
              )}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={cn("mp-bouton", portee && "mp-bouton--creux")} onClick={() => onPorter(!portee)}>
        {portee ? "Retirer" : "Porter"}
      </button>
    </div>
  );
}
