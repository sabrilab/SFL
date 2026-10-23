"use client";

// Ouvrir un match — n'importe quel joueur, sans être admin.
//
// La feuille se lit dans l'ordre où l'on se pose les questions (Sabri,
// 23/10 : « beaucoup plus intuitif », et que rien ne se chevauche) :
//   · quand : les deux semaines qui viennent en une rangée de jours, puis
//     les heures, de demi-heure en demi-heure ; un toucher chacune, les
//     heures déjà passées éteintes, et le choix redit en clair à droite ;
//   · où : les terrains de la ligue, ou « Ailleurs », en toutes lettres ;
//   · les joueurs : combien, public ou privé, et qui, sur le terrain même
//     (terrain-places.tsx) : chaque place libre est un +, qui ouvre la liste
//     des joueurs (libres à ce moment-là, près de toi, partenaires, tous :
//     choisir-joueur.tsx) ; toucher un invité le retire (sa petite croix).
// Un match privé ne montre que ceux qu'on a ajoutés ; un public affiche ses
// places restantes sur la Map.
//
// Plus de « Match ou Exhibition » (Sabri, 23/10) : tout match ouvert ici est
// un match Bola, classé s'il en remplit les conditions (8 présents, un seul
// classé par jour et par joueur : lib/sfl/ligue-vierge.ts).
//
// La même feuille modifie un match déjà ouvert (partie) : son organisateur
// en change la visibilité, le jour, l'heure, le lieu et le nombre de places ;
// les joueurs se gèrent sur la fiche du match (fiche-partie.tsx). La feuille
// reste dans son cadre (feuille-cadree.tsx) : seul le milieu défile, le
// bouton reste en bas.
//
// En haut, la ligue où l'on organise (Sabri, 22/10), en onglets et non plus
// en boutons à choisir comme les autres : un match ouvert ici compte en
// Bola ; un admin passe à la SFL (ses journées, réglées depuis la fiche des
// matchs) ; Team mène aux défis entre équipes (page Team).

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Globe, Lock, Minus, Plus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { FeuilleCadree } from "@/components/sfl/feuille-cadree";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import {
  aujourdhuiIso,
  direErreur,
  listerDispos,
  listerProfils,
  modifierPartie,
  momentDeLHeure,
  ouvrirPartie,
  prochainsJours,
  type Dispo,
  type Partie,
  type Profil,
  type Visibilite,
} from "@/lib/sfl/matchs";
import type { Terrain } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
/** Les heures proposées : toutes les demi-heures, de 8 h à 23 h 30. */
const HEURES = Array.from({ length: 32 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const dateDe = (iso: string) => new Date(`${iso}T12:00:00Z`);
/** « jeu. 23 oct. » */
const enClair = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(dateDe(iso));
/** L'heure qu'il est à Paris, « 21:37 ». */
const maintenant = () =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

/** Deux choix côte à côte, à parts égales (public ou privé). */
function Choix<T extends string>({
  valeur,
  options,
  onChange,
}: {
  valeur: T;
  options: { id: T; libelle: string; icone?: LucideIcon }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-secondary p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valeur === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex h-10 items-center justify-center gap-2 text-[14px] font-semibold",
            valeur === o.id ? "bouton-principal" : "bouton-discret text-muted-foreground"
          )}
        >
          {o.icone && <o.icone className="size-4" strokeWidth={2.2} />}
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

/** Une rangée qui défile de côté, d'un bord à l'autre de la feuille ; elle s'ouvre sur ce qui est choisi. */
function Bande({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const choisi = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el && choisi) el.scrollLeft = choisi.offsetLeft - (el.clientWidth - choisi.offsetWidth) / 2;
  }, []);
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className="relative -mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        maskImage: "linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent)",
      }}
    >
      {children}
    </div>
  );
}

/** Le titre d'une partie de la feuille, et ce qui s'y règle à droite. */
function Rubrique({ titre, droite, children }: { titre: string; droite?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h3 className="mono-label text-muted-foreground">{titre}</h3>
        {droite}
      </div>
      {children}
    </section>
  );
}

/** La ligue où l'on organise, en onglets : Bola ici, SFL pour un admin, Team ailleurs. */
function LigueOrganisee({ onSfl }: { onSfl?: () => void }) {
  const onglet = "flex h-11 items-center px-0.5";
  return (
    <nav aria-label="La ligue" className="-mt-1 flex gap-6 border-b border-contraste/[0.08]">
      <span aria-current="true" className={cn(onglet, "relative text-foreground")}>
        <SigleLigue ligue="bola" hauteur={14} />
        <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-foreground" />
      </span>
      {onSfl && (
        <button type="button" onClick={onSfl} className={cn(onglet, "text-foreground/35 active:text-foreground/60")}>
          <SigleLigue ligue="sfl" hauteur={14} />
        </button>
      )}
      <Link href="/bola-team" className={cn(onglet, "text-foreground/35 active:text-foreground/60")}>
        <SigleLigue ligue="team" hauteur={14} />
      </Link>
    </nav>
  );
}

export function OuvrirMatch({
  open,
  onOpenChange,
  terrains,
  terrainInitial,
  jourInitial,
  heureInitial,
  moi,
  onOuvert,
  partie,
  onSfl,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  terrains: Terrain[];
  terrainInitial: Terrain | null;
  /** Venu de « Mes dispos » : le jour et l'heure du moment choisi. */
  jourInitial?: string;
  heureInitial?: string;
  moi: string | null;
  onOuvert: (id: number) => void;
  /** Un match déjà ouvert, que son organisateur modifie. */
  partie?: Partie;
  /** Un admin : passer aux journées de la SFL. */
  onSfl?: () => void;
}) {
  const aujourdhui = aujourdhuiIso();
  const heureLa = maintenant();
  const [visibilite, setVisibilite] = useState<Visibilite>(partie?.visibilite ?? "public");
  // En base, « 20h00 » ; ici, « 20:00 ». Un moment d'aujourd'hui déjà passé (Mes dispos) cède la place à la demi-heure qui vient.
  const [heure, setHeure] = useState(() => {
    if (partie) return partie.heure.replace("h", ":").padStart(5, "0");
    const h = heureInitial ?? "19:00";
    const la = maintenant();
    return jourInitial === aujourdhuiIso() && h <= la ? (HEURES.find((x) => x > la) ?? h) : h;
  });
  // Ce soir est déjà passé : demain, à la même heure.
  const [jour, setJour] = useState(
    () => partie?.jour ?? jourInitial ?? ((heureInitial ?? "19:00") > maintenant() ? aujourdhuiIso() : prochainsJours(2)[1])
  );
  const terrainDuMatch = partie ? (terrains.find((t) => t.nom === partie.lieu) ?? null) : null;
  const [terrainId, setTerrainId] = useState<number | null>(
    partie ? (terrainDuMatch?.id ?? null) : (terrainInitial?.id ?? terrains.find((t) => t.defaut)?.id ?? null)
  );
  const modif = !!partie;
  const [lieuLibre, setLieuLibre] = useState(partie && !terrainDuMatch ? partie.lieu : "");
  const [places, setPlaces] = useState(partie?.places ?? 10);
  const [invites, setInvites] = useState<Profil[]>([]);
  const [choisir, setChoisir] = useState(false);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [dispos, setDispos] = useState<Dispo[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open || modif) return;
    listerProfils().then(setProfils).catch(() => setProfils([]));
  }, [open, modif]);

  // Ceux qui ont dit être libres ce jour-là, à ce moment-là.
  const moment = momentDeLHeure(heure);
  useEffect(() => {
    if (!open || !jour) return;
    let fini = false;
    listerDispos(jour, jour)
      .then((d) => !fini && setDispos(d))
      .catch(() => !fini && setDispos([]));
    return () => {
      fini = true;
    };
  }, [open, jour]);

  const pris = new Set(invites.map((p) => p.id));
  const libres = useMemo(() => {
    const ids = new Set(dispos.filter((d) => d.moment === moment && d.playerId !== moi).map((d) => d.playerId));
    return profils.filter((p) => ids.has(p.id));
  }, [dispos, moment, profils, moi]);
  const moiNom = profils.find((p) => p.id === moi)?.name ?? "Toi";

  // Les jours : les deux semaines qui viennent, et celui du match s'il est plus loin.
  const jours = useMemo(() => {
    const l = prochainsJours(14);
    return l.includes(jour) ? l : [...l, jour].sort();
  }, [jour]);
  const heures = useMemo(() => (HEURES.includes(heure) ? HEURES : [...HEURES, heure].sort()), [heure]);
  // Un nouveau match ne s'ouvre pas dans le passé : les heures d'aujourd'hui déjà passées s'éteignent.
  const passee = (h: string) => !partie && jour === aujourdhui && h <= heureLa;
  const resteAujourdhui = !!partie || HEURES.some((h) => h > heureLa);

  function choisirJour(j: string) {
    setJour(j);
    if (!partie && j === aujourdhui && heure <= heureLa) {
      const suivante = HEURES.find((h) => h > heureLa);
      if (suivante) setHeure(suivante);
    }
  }

  const terrain = terrains.find((t) => t.id === terrainId) ?? null;
  const lieu = terrain?.nom ?? lieuLibre.trim();
  // L'organisateur compte pour une place ; un match ouvert garde au moins ses joueurs.
  const pleins = invites.length + 1 >= places;
  const minimum = Math.max(2, partie ? partie.joueurs.length : invites.length + 1);
  const pret =
    !!jour &&
    !!heure &&
    !!lieu &&
    jour >= aujourdhui &&
    !passee(heure) &&
    (partie || visibilite === "public" || invites.length > 0);

  function ajouter(p: Profil) {
    if (pris.has(p.id) || pleins) return;
    setInvites((l) => [...l, p]);
  }

  async function ouvrir() {
    setEnvoi(true);
    try {
      if (partie) {
        // Un lieu inchangé garde son adresse et sa place sur la Map.
        const memeLieu = !terrain && lieu === partie.lieu;
        await modifierPartie(partie, {
          visibilite,
          jour,
          heure: heure.replace(":", "h"),
          lieu,
          adresse: terrain ? (terrain.adresse ?? null) : memeLieu ? partie.adresse : null,
          lat: terrain ? (terrain.lat ?? null) : memeLieu ? partie.lat : null,
          lng: terrain ? (terrain.lng ?? null) : memeLieu ? partie.lng : null,
          places,
        });
        navigator.vibrate?.(12);
        toast.success("Match modifié.");
        onOuvert(partie.id);
        onOpenChange(false);
        return;
      }
      const id = await ouvrirPartie({
        visibilite,
        jour,
        heure: heure.replace(":", "h"),
        lieu,
        adresse: terrain?.adresse ?? null,
        lat: terrain?.lat ?? null,
        lng: terrain?.lng ?? null,
        places,
        invites: invites.map((p) => p.id),
      });
      toast.success(visibilite === "public" ? "Match ouvert, il est sur la Map." : "Match privé ouvert, tes joueurs sont invités.");
      onOuvert(id);
      onOpenChange(false);
      setInvites([]);
    } catch (e) {
      toast.error(direErreur(e));
    } finally {
      setEnvoi(false);
    }
  }

  const restantes = places - invites.length - 1;
  const bouton = (
    <Button variant="vert" disabled={!pret || envoi} onClick={ouvrir} className="h-12 w-full rounded-full text-[15px] font-semibold">
      {partie
        ? "Enregistrer"
        : visibilite === "public"
          ? `Ouvrir · ${restantes} place${restantes > 1 ? "s" : ""} sur la Map`
          : "Ouvrir le match privé"}
    </Button>
  );

  const pastille = "shrink-0 font-semibold";
  return (
    <FeuilleCadree
      open={open}
      onOpenChange={onOpenChange}
      titre={partie ? "Modifier le match" : "Ouvrir un match"}
      surtitre={partie ? <SigleLigue ligue="bola" hauteur={11} className="text-foreground" /> : undefined}
      pied={bouton}
    >
      <div className="flex flex-col gap-6">
        {!partie && <LigueOrganisee onSfl={onSfl} />}

        <Rubrique
          titre="Quand"
          droite={
            <p className="mono-label text-foreground tabular-nums">
              {enClair(jour)} · {heure}
            </p>
          }
        >
          <Bande label="Le jour">
            {jours.map((j) => {
              const choisi = j === jour;
              return (
                <button
                  key={j}
                  type="button"
                  role="radio"
                  aria-checked={choisi}
                  aria-label={enClair(j)}
                  disabled={j === aujourdhui && !resteAujourdhui}
                  onClick={() => choisirJour(j)}
                  className={cn(
                    pastille,
                    "flex h-[60px] w-[52px] flex-col items-center justify-center gap-[5px] rounded-[18px]",
                    choisi ? "bouton-principal" : "bouton-secondaire"
                  )}
                >
                  <span className={cn("text-[11px] leading-none", choisi ? "bouton-sous" : "text-muted-foreground")}>
                    {j === aujourdhui ? "Auj." : JOURS[dateDe(j).getUTCDay()]}
                  </span>
                  <span className="text-[19px] leading-none font-bold tabular-nums">{dateDe(j).getUTCDate()}</span>
                </button>
              );
            })}
            {/* Plus loin : le calendrier du téléphone, sous une pastille. */}
            <label className={cn(pastille, "bouton-secondaire relative grid h-[60px] w-[52px] cursor-pointer place-items-center rounded-[18px]")}>
              <CalendarDays className="size-5 text-muted-foreground" strokeWidth={2} />
              <span className="sr-only">Un autre jour</span>
              <input
                type="date"
                min={aujourdhui}
                value={jour}
                onClick={(e) => e.currentTarget.showPicker?.()}
                onChange={(e) => e.target.value && choisirJour(e.target.value)}
                className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
              />
            </label>
          </Bande>
          <Bande label="L'heure">
            {heures.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={h === heure}
                disabled={passee(h)}
                onClick={() => setHeure(h)}
                className={cn(pastille, "h-10 px-3.5 text-[14px] tabular-nums", h === heure ? "bouton-principal" : "bouton-secondaire")}
              >
                {h}
              </button>
            ))}
          </Bande>
        </Rubrique>

        <Rubrique titre="Où">
          {terrains.length > 0 && (
            <div role="radiogroup" aria-label="Le terrain" className="flex flex-wrap gap-2">
              {terrains.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === terrainId}
                  onClick={() => setTerrainId(t.id)}
                  className={cn(pastille, "h-9 px-3.5 text-[14px]", t.id === terrainId ? "bouton-principal" : "bouton-secondaire")}
                >
                  {t.nom}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={terrainId == null}
                onClick={() => setTerrainId(null)}
                className={cn(pastille, "h-9 px-3.5 text-[14px]", terrainId == null ? "bouton-principal" : "bouton-secondaire")}
              >
                Ailleurs
              </button>
            </div>
          )}
          {terrainId == null && (
            <Input
              value={lieuLibre}
              onChange={(e) => setLieuLibre(e.target.value)}
              placeholder="Le terrain"
              maxLength={120}
              className="h-11 rounded-full px-4 text-[16px]"
            />
          )}
        </Rubrique>

        <Rubrique
          titre="Joueurs"
          droite={
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Une place de moins"
                disabled={places <= minimum}
                onClick={() => setPlaces((n) => Math.max(minimum, n - 1))}
                className="bouton-secondaire grid size-9 place-items-center"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold tabular-nums">{places}</span>
              <button
                type="button"
                aria-label="Une place de plus"
                disabled={places >= 22}
                onClick={() => setPlaces((n) => Math.min(22, n + 1))}
                className="bouton-secondaire grid size-9 place-items-center"
              >
                <Plus className="size-4" />
              </button>
            </div>
          }
        >
          <Choix
            valeur={visibilite}
            onChange={setVisibilite}
            options={[
              { id: "public", libelle: "Public", icone: Globe },
              { id: "prive", libelle: "Privé", icone: Lock },
            ]}
          />
          {/* Le terrain du match : moi devant, mes invités, et un + sur chaque place libre. */}
          {!partie && (
            <>
              <TerrainPlaces
                places={places}
                moi={moiNom}
                occupants={[
                  { cle: moi ?? "moi", nom: moiNom },
                  ...invites.map((p) => ({ cle: p.id, nom: p.name })),
                ]}
                onPlus={pleins ? undefined : () => setChoisir(true)}
                onOccupant={(o) => o.cle !== (moi ?? "moi") && setInvites((l) => l.filter((x) => x.id !== o.cle))}
                retirable
              />
              <ChoisirJoueur
                open={choisir}
                onOpenChange={setChoisir}
                profils={profils}
                exclus={new Set([...(moi ? [moi] : []), ...invites.map((p) => p.id)])}
                libres={new Set(libres.map((p) => p.id))}
                moiNom={moiNom}
                onChoisir={ajouter}
              />
            </>
          )}
        </Rubrique>
      </div>
    </FeuilleCadree>
  );
}
