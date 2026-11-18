"use client";

// Le studio des avatars du jeu (Sabri, 02/11/2026 : « un studio dans lequel je
// peux voir les avatars et à quoi ils ressemblent »). Réservé aux admins : il
// montre les joueurs de la ligue avec leur visage. Dans le jeu, un joueur ne
// voit que le sien tant que l'accord « Apparaître dans le jeu » n'existe pas.
//
// Les joueurs qui ont une photo du studio, par rangs de cinq ; Noirs ou Blancs ;
// une pose ; et pour le joueur choisi, sa photo avec le cadrage trouvé par le
// code et trois réglages pour le corriger (gardés sur cet appareil).

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { isAdmin } from "@/lib/sfl/admin";
import { photosParJoueur, rafraichirPhotos, PHOTO_EVENT } from "@/lib/sfl/photos";
import { cn } from "@/lib/utils";

type Studio = {
  montrer: (l: unknown[], i?: number) => Promise<Record<string, Analyse | null>>;
  choisir: (i: number) => void;
  poser: (p: string) => void;
  detruire: () => void;
};
type Analyse = { boite: { x: number; y: number; taille: number }; visage: { x0: number; y0: number; x1: number; y1: number } };
type Decalage = { x: number; y: number; taille: number };

const PAR_RANG = 5;
const POSES: [string, string][] = [
  ["idle", "Repos"],
  ["jog", "Course"],
  ["shoot", "Frappe"],
  ["victory", "Victoire"],
  ["fist_pump", "Poing"],
  ["samba", "Samba"],
];
const CLE = "bola-jeu-cadrages";

const rien = () => () => {};
const trier = (l: [string, string][]) => [...l].sort((a, b) => a[0].localeCompare(b[0], "fr"));

function lireCadrages(): Record<string, Decalage> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CLE) || "{}");
  } catch {
    return {};
  }
}

export default function StudioJeuPage() {
  const { me } = useMyPlayer();
  const admin = isAdmin(me);
  const monte = useSyncExternalStore(rien, () => true, () => false);
  const [liste, setListe] = useState<[string, string][]>(() => trier(photosParJoueur()));
  const [rang, setRang] = useState(0);
  const [choisiNom, setChoisiNom] = useState<string | null>(null);
  const [pret, setPret] = useState(0);
  const [tenue, setTenue] = useState<"noirs" | "blancs">("noirs");
  const [pose, setPose] = useState("idle");
  const [joueuses, setJoueuses] = useState<Record<string, boolean>>({});
  const [cadrages, setCadrages] = useState<Record<string, Decalage>>(lireCadrages);
  const [analyses, setAnalyses] = useState<Record<string, Analyse | null>>({});
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const boite = useRef<HTMLDivElement>(null);
  const studio = useRef<Studio | null>(null);

  useEffect(() => {
    const lire = () => setListe(trier(photosParJoueur()));
    rafraichirPhotos().then(lire).catch(() => {});
    window.addEventListener(PHOTO_EVENT, lire);
    return () => window.removeEventListener(PHOTO_EVENT, lire);
  }, []);

  // le moteur 3D, chargé à la demande (three et les animations ne pèsent que sur cette page)
  useEffect(() => {
    if (!admin || !boite.current) return;
    let fini = false;
    import("@/lib/jeu/studio.js").then(({ creerStudio }) => {
      if (fini || !boite.current) return;
      studio.current = creerStudio(boite.current, {
        surChoix: (nom: string) => setChoisiNom(nom),
      }) as unknown as Studio;
      setPret((p) => p + 1);
    });
    return () => {
      fini = true;
      studio.current?.detruire();
      studio.current = null;
    };
  }, [admin, monte]);

  const rangee = useMemo(() => liste.slice(rang * PAR_RANG, rang * PAR_RANG + PAR_RANG), [liste, rang]);
  const rangs = Math.max(1, Math.ceil(liste.length / PAR_RANG));
  const choisi = Math.max(0, rangee.findIndex(([n]) => n === choisiNom));
  const setChoisi = (i: number) => setChoisiNom(rangee[i]?.[0] ?? null);

  useEffect(() => {
    const s = studio.current;
    if (!s || !rangee.length) return;
    s.montrer(
      rangee.map(([nom, photo]) => ({ nom, photo, tenue, decalage: cadrages[nom] ?? null, joueuse: !!joueuses[nom] })),
      choisi,
    )
      .then((a) => {
        setAnalyses(a);
        s.poser(pose);
      })
      .then(() => setErreur(null))
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : "Le studio n'a pas pu charger."))
      .finally(() => setCharge(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangee, tenue, cadrages, joueuses, pret]);

  useEffect(() => studio.current?.choisir(choisi), [choisi]);
  useEffect(() => studio.current?.poser(pose), [pose]);

  const nomChoisi = rangee[choisi]?.[0];
  const photoChoisie = rangee[choisi]?.[1];
  const analyse = nomChoisi ? analyses[nomChoisi] : null;
  const dec = (nomChoisi && cadrages[nomChoisi]) || { x: 0, y: 0, taille: 0 };

  function regler(champ: keyof Decalage, v: number) {
    if (!nomChoisi) return;
    const next = { ...cadrages, [nomChoisi]: { ...dec, [champ]: v } };
    setCadrages(next);
    try {
      localStorage.setItem(CLE, JSON.stringify(next));
    } catch {}
  }

  if (!monte) return null;

  const page = (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0b] text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <BoutonRetour parent="/jouer" titre="Jouer" />
        <h1 className="titre-lettrage text-[22px] leading-none">STUDIO</h1>
        <span className="ml-auto text-[13px] tabular-nums text-white/50">
          {liste.length ? `${rang + 1} / ${rangs}` : ""}
        </span>
      </div>

      {!admin ? (
        <p className="px-6 pt-10 text-center text-[15px] text-white/60">Réservé aux admins.</p>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div ref={boite} className="absolute inset-0" />
            {charge && (
              <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-[12px] uppercase tracking-[0.2em] text-white/40">
                Chargement
              </div>
            )}
            {erreur && <div className="absolute inset-x-6 top-10 text-center text-[14px] text-white/70">{erreur}</div>}
            {liste.length > PAR_RANG && (
              <>
                <button
                  aria-label="Rang précédent"
                  className="absolute left-2 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-[20px] backdrop-blur"
                  onClick={() => { setChoisiNom(null); setCharge(true); setRang((r) => (r - 1 + rangs) % rangs); }}
                >
                  ‹
                </button>
                <button
                  aria-label="Rang suivant"
                  className="absolute right-2 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-[20px] backdrop-blur"
                  onClick={() => { setChoisiNom(null); setCharge(true); setRang((r) => (r + 1) % rangs); }}
                >
                  ›
                </button>
              </>
            )}
          </div>

          <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {rangee.map(([nom], i) => (
                <button
                  key={nom}
                  onClick={() => setChoisi(i)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold",
                    i === choisi ? "bg-white text-black" : "bg-white/10 text-white/80",
                  )}
                >
                  {nom}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              {(["noirs", "blancs"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTenue(t)}
                  className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold", tenue === t ? "bg-white text-black" : "bg-white/10 text-white/80")}
                >
                  {t === "noirs" ? "Noirs" : "Blancs"}
                </button>
              ))}
              <span className="w-2 shrink-0" />
              {POSES.map(([p, l]) => (
                <button
                  key={p}
                  onClick={() => setPose(p)}
                  className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold", pose === p ? "bg-white text-black" : "bg-white/10 text-white/80")}
                >
                  {l}
                </button>
              ))}
            </div>

            {nomChoisi && photoChoisie && (
              <div className="flex items-center gap-3">
                <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoChoisie} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                  {analyse && (
                    <div
                      className="absolute border-2 border-white"
                      style={{
                        left: `${analyse.boite.x * 100}%`,
                        top: `${analyse.boite.y * 100}%`,
                        width: `${analyse.boite.taille * 100}%`,
                        height: `${analyse.boite.taille * 100}%`,
                        borderRadius: "50%",
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {(
                    [
                      ["x", "Côté", -0.15, 0.15],
                      ["y", "Hauteur", -0.15, 0.15],
                      ["taille", "Taille", -0.3, 0.3],
                    ] as const
                  ).map(([champ, label, min, max]) => (
                    <label key={champ} className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/50">
                      <span className="w-[64px] shrink-0">{label}</span>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={0.005}
                        value={dec[champ]}
                        onChange={(e) => regler(champ, Number(e.target.value))}
                        className="min-w-0 flex-1 accent-white"
                      />
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/50">
                    <input
                      type="checkbox"
                      checked={!!joueuses[nomChoisi]}
                      onChange={(e) => setJoueuses((j) => ({ ...j, [nomChoisi]: e.target.checked }))}
                      className="accent-white"
                    />
                    Corps de joueuse
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
  return createPortal(page, document.body);
}
