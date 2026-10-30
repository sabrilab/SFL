"use client";

// « Qui ramène du monde » : les joueurs dont un geste fait venir ou revenir
// les autres (lib/sfl/rassembleurs.ts). Sabri, 24/10 : « avoir une espèce de
// schéma de compréhension sur les personnalités qui font ramener les gens ».
//
// En haut, le schéma de celui qu'on choisit (le premier du classement
// d'abord) : lui au centre, autour de lui les joueurs qu'il a fait venir ou
// revenir, rangés par canal (Vestiaire, matchs, Bola Team, suivis,
// félicitations, parrainage). Plus le trait est épais, plus c'est arrivé
// souvent ; un disque plein, il est revenu, a signé ou a joué par lui ; un
// anneau, il est venu pour la première fois par lui (son filleul). Dessous,
// le classement : un toucher change le schéma. L'app elle-même ferme la
// liste, pour comparer.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  CANAUX_LIEN,
  entourage,
  parCanal,
  type AnalyseLiens,
  type CanalLien,
  type Lien,
  type Proche,
  type Rassembleur,
} from "@/lib/sfl/rassembleurs";
import { cn } from "@/lib/utils";
import { useLargeur } from "./graphiques";

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Au plus autant de joueurs autour de lui ; les autres se comptent (« +3 »). */
const AUTOUR = 14;
const HAUTEUR = 290;
/** Le disque du centre. */
const CENTRE = 27;

const LABEL_CANAL = new Map(CANAUX_LIEN.map((c) => [c.id, c.label]));

/** « Mohamed-Ali » → « Mohamed-A… » : un prénom tient à côté de son disque. */
const court = (nom: string, n = 9) => (nom.length > n ? `${nom.slice(0, n - 1)}…` : nom);

type Place = { proche: Proche | null; reste: number; angle: number };

/**
 * Les angles autour du centre : un groupe par canal, un écart entre deux
 * groupes, le premier centré en haut.
 */
function placer(proches: Proche[], reste: number): Place[] {
  const items: { proche: Proche | null; canal: CanalLien | null }[] = [
    ...proches.map((p) => ({ proche: p, canal: p.canal })),
    ...(reste > 0 ? [{ proche: null, canal: null }] : []),
  ];
  if (items.length === 0) return [];
  const groupes = items.filter((it, k) => k === 0 || it.canal !== items[k - 1].canal).length;
  const ecart = groupes > 1 ? 0.7 : 0;
  const pas = (2 * Math.PI) / (items.length + groupes * ecart);
  const premier = items.findIndex((it) => it.canal !== items[0].canal);
  const taillePremier = premier < 0 ? items.length : premier;
  let angle = -Math.PI / 2 - ((taillePremier - 1) * pas) / 2;
  return items.map((it, k) => {
    if (k > 0 && it.canal !== items[k - 1].canal) angle += ecart * pas;
    const place = { proche: it.proche, reste, angle };
    angle += pas;
    return place;
  });
}

function Etoile({ r }: { r: Rassembleur }) {
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const { places, groupes } = useMemo(() => {
    const tous = entourage(r);
    // Les plus fidèles d'abord quand il y en a trop, puis l'ordre des canaux.
    const gardes = new Set(
      tous.length > AUTOUR ? [...tous].sort((x, y) => y.fois - x.fois).slice(0, AUTOUR - 1) : tous
    );
    const proches = tous.filter((p) => gardes.has(p));
    const places = placer(proches, tous.length - proches.length);
    // Le nom de chaque canal, au milieu de son groupe, entre le centre et les joueurs.
    const groupes: { canal: CanalLien; angle: number; n: number }[] = [];
    for (const p of places) {
      if (!p.proche) continue;
      const g = groupes.at(-1);
      if (g && g.canal === p.proche.canal) {
        g.angle = (g.angle * g.n + p.angle) / (g.n + 1);
        g.n++;
      } else groupes.push({ canal: p.proche.canal, angle: p.angle, n: 1 });
    }
    return { places, groupes };
  }, [r]);

  const cx = largeur / 2;
  const cy = HAUTEUR / 2;
  // La place des prénoms à gauche et à droite.
  const rayon = Math.max(60, Math.min(largeur / 2 - 70, HAUTEUR / 2 - 36));
  const taille = (p: Proche) => 4.5 + 1.5 * Math.min(p.fois, 6);
  const centreEcrit = r.nom.length <= 7;

  return (
    <div ref={ref} style={{ height: HAUTEUR }}>
      {largeur > 0 && (
        <svg
          width={largeur}
          height={HAUTEUR}
          className="block overflow-visible text-foreground"
          role="img"
          aria-label={`${r.nom} et les joueurs qu'il a fait venir ou revenir`}
        >
          {places.map(({ proche, angle }, k) => {
            const rn = proche ? taille(proche) : 10;
            const fois = proche?.fois ?? 1;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return (
              <line
                key={`t${k}`}
                x1={cx + (CENTRE + 3) * c}
                y1={cy + (CENTRE + 3) * s}
                x2={cx + (rayon - rn - 2) * c}
                y2={cy + (rayon - rn - 2) * s}
                stroke="currentColor"
                strokeOpacity={proche ? 0.18 + 0.1 * Math.min(fois, 5) : 0.2}
                strokeWidth={proche ? 0.8 + 0.6 * Math.min(fois, 5) : 1}
                strokeDasharray={proche ? undefined : "2 3"}
                strokeLinecap="round"
              />
            );
          })}
          {groupes.map((g) => (
            <text
              key={g.canal}
              x={cx + rayon * 0.6 * Math.cos(g.angle)}
              y={cy + rayon * 0.6 * Math.sin(g.angle) + 3}
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="700"
              letterSpacing="0.06em"
              fill="currentColor"
              fillOpacity="0.55"
              stroke="var(--background)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {LABEL_CANAL.get(g.canal)!.toUpperCase()}
            </text>
          ))}
          {places.map(({ proche, reste, angle }, k) => {
            const rn = proche ? taille(proche) : 10;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const px = cx + rayon * c;
            const py = cy + rayon * s;
            const loin = rayon + rn + 5;
            const ancre = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
            const ty = ancre === "middle" ? cy + loin * s + (s < 0 ? -2 : 9) : cy + loin * s + 3.5;
            return (
              <g key={`n${k}`}>
                {!proche ? (
                  <>
                    <circle cx={px} cy={py} r={rn} fill="var(--background)" stroke="currentColor" strokeOpacity="0.4" strokeDasharray="2 2" />
                    <text x={px} y={py + 3} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" fillOpacity="0.6">
                      +{reste}
                    </text>
                  </>
                ) : proche.nouveau ? (
                  <>
                    <circle cx={px} cy={py} r={rn} fill="var(--background)" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx={px} cy={py} r={Math.max(1.5, rn - 5)} fill="currentColor" fillOpacity="0.85" />
                  </>
                ) : (
                  <circle cx={px} cy={py} r={rn} fill="currentColor" fillOpacity="0.85" />
                )}
                {proche && (
                  <text
                    x={cx + loin * c}
                    y={ty}
                    textAnchor={ancre}
                    fontSize="10"
                    fontWeight="600"
                    fill="currentColor"
                    fillOpacity="0.8"
                  >
                    {court(proche.nom)}
                    {proche.fois > 1 && (
                      <tspan fillOpacity="0.5" fontWeight="500">
                        {" "}
                        ×{proche.fois}
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={CENTRE} fill="currentColor" />
          <text
            x={cx}
            y={cy + (centreEcrit ? 4 : 5)}
            textAnchor="middle"
            fontSize={centreEcrit ? 11 : 14}
            fontWeight="800"
            fill="var(--background)"
          >
            {centreEcrit ? r.nom : r.nom.slice(0, 2).toUpperCase()}
          </text>
        </svg>
      )}
    </div>
  );
}

/** « 11 retours sur 40 notifications · Vestiaire 8 · Suivis 2 ». */
function detailDe(r: Rassembleur): string {
  const canaux = parCanal(r)
    .map((c) => `${c.label} ${c.n}`)
    .join(" · ");
  const retours = r.retours > 0 ? `${pluriel(r.retours, "retour", "retours")} sur ${pluriel(r.envoyees, "notification", "notifications")}` : null;
  return [retours, canaux].filter(Boolean).join(" · ");
}

/** Ce qu'il a fait, en clair, sous le schéma. */
function phraseDe(r: Rassembleur): string {
  const compte = (genre: Lien["genre"]) => new Set(r.liens.filter((l) => l.genre === genre).map((l) => l.a)).size;
  const parties = [
    compte("revenu") > 0 && `a fait revenir ${pluriel(compte("revenu"), "joueur", "joueurs")}`,
    compte("venu") > 0 && `en a fait venir ${compte("venu")} (parrainage)`,
    compte("signe") > 0 && `en a fait signer ${compte("signe")} (Bola Team)`,
    compte("inscrit") > 0 && `en a fait jouer ${compte("inscrit")} à ses matchs`,
  ].filter(Boolean) as string[];
  if (parties.length === 0) return r.nom;
  const fin = parties.length > 1 ? `${parties.slice(0, -1).join(", ")} et ${parties.at(-1)}` : parties[0];
  return `${r.nom} ${fin}.`;
}

/** Au départ, le classement montre les premiers ; « Tout voir » déroule le reste. */
const PREMIERS = 8;

export function QuiRamene({
  analyse,
  tousLiens,
  deduites,
  libellePeriode,
  admins,
  onFiche,
}: {
  analyse: AnalyseLiens;
  /** Tous les liens hors notifications, toute l'histoire : par qui le joueur choisi est lui-même venu. */
  tousLiens: Lien[];
  /** Les notifications d'avant le 24/10 dont la source a été déduite. */
  deduites: number;
  libellePeriode: string;
  admins: ReadonlySet<string>;
  onFiche: (nom: string) => void;
}) {
  const [choix, setChoix] = useState<string | null>(null);
  const [tout, setTout] = useState(false);
  const { rassembleurs, app, sansSource } = analyse;
  const choisi = rassembleurs.find((r) => r.nom === choix) ?? rassembleurs[0] ?? null;
  const venuPar = choisi ? tousLiens.find((l) => l.genre === "venu" && l.a === choisi.nom)?.de : undefined;
  const liste = tout ? rassembleurs : rassembleurs.slice(0, PREMIERS);

  return (
    <section id="activite-ramene" className="glass scroll-mt-16 rounded-3xl p-5">
      <h2 className="text-titre font-bold tracking-tight">Qui ramène du monde</h2>
      <p className="mt-0.5 text-petit leading-snug text-encre-3">
        Les joueurs dont un message, une invitation, un suivi, une félicitation ou un parrainage a fait venir ou revenir
        quelqu&apos;un, {libellePeriode}.
      </p>

      {choisi ? (
        <>
          <div className="mt-3">
            <Etoile r={choisi} />
          </div>
          <div className="mt-1 flex items-start justify-between gap-3">
            <p className="text-corps leading-snug">
              {phraseDe(choisi)}
              {venuPar && <span className="text-encre-3"> Lui-même est venu par {venuPar}.</span>}
            </p>
            <button
              onClick={() => onFiche(choisi.nom)}
              className="bouton-secondaire mono-label flex shrink-0 items-center gap-1 px-2.5 py-1 text-micro"
            >
              Fiche
              <ChevronRight className="size-3" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-legende text-encre-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-foreground/85" />
              revenu, a signé ou a joué par lui
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex size-2.5 items-center justify-center rounded-full border-[1.5px] border-foreground">
                <span className="size-1 rounded-full bg-foreground" />
              </span>
              venu par lui
            </span>
          </div>

          <div className="mt-4 flex flex-col">
            {liste.map((r, k) => (
              <button
                key={r.nom}
                onClick={() => setChoix(r.nom)}
                aria-pressed={r === choisi}
                className={cn(
                  "-mx-2 flex items-center gap-3 rounded-xl border-b border-foreground/6 px-2 py-2.5 text-left last:border-0",
                  r === choisi && "bg-foreground/[0.05]"
                )}
              >
                <span className="mono-label w-4 shrink-0 text-micro text-encre-3 tabular-nums">{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="truncate text-ligne font-semibold">{r.nom}</span>
                    {admins.has(r.nom) && <span className="mono-label text-micro text-encre-3">admin</span>}
                  </span>
                  <span className="block text-petit leading-snug text-encre-3">{detailDe(r)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-titre-fort leading-none font-extrabold tabular-nums">{r.joueurs}</span>
                  <span className="mono-label text-micro text-encre-3">{r.joueurs > 1 ? "joueurs" : "joueur"}</span>
                </span>
              </button>
            ))}
            {rassembleurs.length > PREMIERS && (
              <button onClick={() => setTout((v) => !v)} className="mono-label mt-2 self-start text-micro text-encre-3">
                {tout ? "Moins" : `Tout voir · ${rassembleurs.length}`}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-4 text-corps text-encre-3">Personne n&apos;a encore fait venir ou revenir quelqu&apos;un {libellePeriode}.</p>
      )}

      {(app.envoyees > 0 || app.retours > 0) && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-foreground/15 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-corps font-semibold">L&apos;app elle-même</span>
            <span className="block text-petit leading-snug text-encre-3">
              Annonces, divisions, missions, rappels de la veille · {pluriel(app.retours, "retour", "retours")} sur{" "}
              {pluriel(app.envoyees, "notification", "notifications")}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-titre-fort leading-none font-extrabold text-encre-2 tabular-nums">{app.joueurs}</span>
            <span className="mono-label text-micro text-encre-3">{app.joueurs > 1 ? "joueurs" : "joueur"}</span>
          </span>
        </div>
      )}

      <p className="mt-3 text-legende leading-snug text-encre-3">
        Revenu : il a rouvert l&apos;app dans les 2 h après une notification née du geste de ce joueur, sans l&apos;avoir
        ouverte depuis au moins 1 h (une seule notification compte par retour : celle qu&apos;il a touchée, sinon la
        dernière). Venu : son filleul. Signé : dans sa Bola Team, sur son invitation. Joué : à un match qu&apos;il a ouvert.
        {deduites > 0 &&
          (deduites > 1
            ? ` Avant le 24/10, la source de ${deduites} notifications a été retrouvée dans le geste qui les a déclenchées.`
            : " Avant le 24/10, la source d'une notification a été retrouvée dans le geste qui l'a déclenchée.")}
        {sansSource > 0 &&
          ` ${pluriel(sansSource, "retour suit", "retours suivent")} une notification d'une discussion de match ou d'équipe d'avant le 24/10, privée : sans source.`}
      </p>
    </section>
  );
}
