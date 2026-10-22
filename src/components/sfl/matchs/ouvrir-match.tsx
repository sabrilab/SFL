"use client";

// Ouvrir un match — n'importe quel joueur, sans être admin.
//
// Quatre choix, dans l'ordre où on se les pose : match ou exhibition, public
// ou privé, quand, où. Puis qui, sur le terrain même (terrain-places.tsx) :
// chaque place libre est un +, qui ouvre la liste des joueurs (libres à ce
// moment-là, près de toi, partenaires, tous : choisir-joueur.tsx) ; toucher
// un invité le retire. Un match privé ne montre que ceux qu'on a ajoutés ;
// un public affiche ses places restantes sur la Map.
//
// La même feuille modifie un match déjà ouvert (partie) : son organisateur
// en change le genre, la visibilité, le jour, l'heure, le lieu et le nombre
// de places ; les joueurs se gèrent sur la fiche du match (fiche-partie.tsx).
// La feuille reste dans son cadre (feuille-cadree.tsx) : seul le milieu
// défile, le bouton reste en bas.

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { FeuilleCadree } from "@/components/sfl/feuille-cadree";
import {
  aujourdhuiIso,
  direErreur,
  listerDispos,
  listerProfils,
  modifierPartie,
  momentDeLHeure,
  ouvrirPartie,
  type Dispo,
  type Genre,
  type Partie,
  type Profil,
  type Visibilite,
} from "@/lib/sfl/matchs";
import type { Terrain } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

function Choix<T extends string>({
  valeur,
  options,
  onChange,
}: {
  valeur: T;
  options: { id: T; libelle: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-full bg-secondary p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full py-2 text-[14px] font-semibold transition-colors",
            valeur === o.id ? "bg-foreground text-background" : "text-muted-foreground"
          )}
        >
          {o.libelle}
        </button>
      ))}
    </div>
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
}) {
  const [genre, setGenre] = useState<Genre>(partie?.genre ?? "match");
  const [visibilite, setVisibilite] = useState<Visibilite>(partie?.visibilite ?? "public");
  const [jour, setJour] = useState(() => partie?.jour ?? jourInitial ?? aujourdhuiIso());
  // En base, « 20h00 » ; dans le champ, « 20:00 ».
  const [heure, setHeure] = useState(partie ? partie.heure.replace("h", ":").padStart(5, "0") : (heureInitial ?? "19:00"));
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

  const terrain = terrains.find((t) => t.id === terrainId) ?? null;
  const lieu = terrain?.nom ?? lieuLibre.trim();
  // L'organisateur compte pour une place ; un match ouvert garde au moins ses joueurs.
  const pleins = invites.length + 1 >= places;
  const minimum = Math.max(2, partie ? partie.joueurs.length : invites.length + 1);
  const pret =
    !!jour && !!heure && !!lieu && jour >= aujourdhuiIso() && (partie || visibilite === "public" || invites.length > 0);

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
          genre,
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
        genre,
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

  const bouton = (
    <Button disabled={!pret || envoi} onClick={ouvrir} className="h-12 w-full rounded-full text-[15px] font-semibold">
      {partie
        ? "Enregistrer"
        : visibilite === "public"
          ? `Ouvrir · ${places - invites.length - 1} place${places - invites.length - 1 > 1 ? "s" : ""} sur la Map`
          : "Ouvrir le match privé"}
    </Button>
  );

  return (
    <FeuilleCadree open={open} onOpenChange={onOpenChange} titre={partie ? "Modifier le match" : "Ouvrir un match"} pied={bouton}>
      <div className="flex flex-col gap-5">
        <Choix
          valeur={genre}
          onChange={setGenre}
          options={[
            { id: "match", libelle: "Match" },
            { id: "exhibition", libelle: "Exhibition" },
          ]}
        />
        <Choix
          valeur={visibilite}
          onChange={setVisibilite}
          options={[
            { id: "public", libelle: "Public" },
            { id: "prive", libelle: "Privé" },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={jour} min={aujourdhuiIso()} onChange={(e) => setJour(e.target.value)} aria-label="Le jour" />
          <Input type="time" value={heure} step={900} onChange={(e) => setHeure(e.target.value)} aria-label="L'heure" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="mono-label text-muted-foreground">Où</p>
          {terrains.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {terrains.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTerrainId(t.id === terrainId ? null : t.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[13px] font-semibold",
                    t.id === terrainId ? "border-foreground bg-foreground text-background" : "border-border/60 bg-card"
                  )}
                >
                  {t.nom}
                </button>
              ))}
            </div>
          )}
          {terrainId == null && (
            <Input value={lieuLibre} onChange={(e) => setLieuLibre(e.target.value)} placeholder="Le terrain" maxLength={120} />
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="mono-label text-muted-foreground">Joueurs</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Une place de moins"
              disabled={places <= minimum}
              onClick={() => setPlaces((n) => Math.max(minimum, n - 1))}
              className="bouton-secondaire grid size-9 place-items-center disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-8 text-center text-lg font-bold tabular-nums">{places}</span>
            <button
              type="button"
              aria-label="Une place de plus"
              disabled={places >= 22}
              onClick={() => setPlaces((n) => Math.min(22, n + 1))}
              className="bouton-secondaire grid size-9 place-items-center disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

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
              hauteur={420}
              onPlus={pleins ? undefined : () => setChoisir(true)}
              onOccupant={(o) => o.cle !== (moi ?? "moi") && setInvites((l) => l.filter((x) => x.id !== o.cle))}
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
      </div>
    </FeuilleCadree>
  );
}
