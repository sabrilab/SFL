"use client";

// Ouvrir un match — n'importe quel joueur, sans être admin.
//
// Quatre choix, dans l'ordre où on se les pose : match ou exhibition, public
// ou privé, quand, où. Puis qui, sur le terrain même (terrain-places.tsx) :
// chaque place libre est un +, qui ouvre la liste des joueurs (libres à ce
// moment-là, près de toi, partenaires, tous : choisir-joueur.tsx) ; toucher
// un invité le retire. Un match privé ne montre que ceux qu'on a ajoutés ;
// un public affiche ses places restantes sur la Map.

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  aujourdhuiIso,
  direErreur,
  listerDispos,
  listerProfils,
  momentDeLHeure,
  ouvrirPartie,
  type Dispo,
  type Genre,
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
            "py-2 text-[14px] font-semibold",
            valeur === o.id ? "bouton-principal" : "bouton-discret text-muted-foreground"
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
}) {
  const [genre, setGenre] = useState<Genre>("match");
  const [visibilite, setVisibilite] = useState<Visibilite>("public");
  const [jour, setJour] = useState(() => jourInitial ?? aujourdhuiIso());
  const [heure, setHeure] = useState(heureInitial ?? "19:00");
  const [terrainId, setTerrainId] = useState<number | null>(terrainInitial?.id ?? terrains.find((t) => t.defaut)?.id ?? null);
  const [lieuLibre, setLieuLibre] = useState("");
  const [places, setPlaces] = useState(10);
  const [invites, setInvites] = useState<Profil[]>([]);
  const [choisir, setChoisir] = useState(false);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [dispos, setDispos] = useState<Dispo[]>([]);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    listerProfils().then(setProfils).catch(() => setProfils([]));
  }, [open]);

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
  // L'organisateur compte pour une place.
  const pleins = invites.length + 1 >= places;
  const pret = !!jour && !!heure && !!lieu && jour >= aujourdhuiIso() && (visibilite === "public" || invites.length > 0);

  function ajouter(p: Profil) {
    if (pris.has(p.id) || pleins) return;
    setInvites((l) => [...l, p]);
  }

  async function ouvrir() {
    setEnvoi(true);
    try {
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[26px] font-bold tracking-tight">Ouvrir un match</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4">
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
                      "px-3 py-1.5 text-[13px] font-semibold",
                      t.id === terrainId ? "bouton-principal" : "bouton-secondaire"
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
                onClick={() => setPlaces((n) => Math.max(Math.max(2, invites.length + 1), n - 1))}
                className="bouton-secondaire grid size-9 place-items-center"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center text-lg font-bold tabular-nums">{places}</span>
              <button
                type="button"
                aria-label="Une place de plus"
                onClick={() => setPlaces((n) => Math.min(22, n + 1))}
                className="bouton-secondaire grid size-9 place-items-center"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>

          {/* Le terrain du match : moi devant, mes invités, et un + sur chaque place libre. */}
          <TerrainPlaces
            places={places}
            moi={moiNom}
            occupants={[
              { cle: moi ?? "moi", nom: moiNom },
              ...invites.map((p) => ({ cle: p.id, nom: p.name })),
            ]}
            hauteur={460}
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

          <Button variant="vert" disabled={!pret || envoi} onClick={ouvrir} className="h-12 rounded-full text-[15px] font-semibold">
            {visibilite === "public"
              ? `Ouvrir · ${places - invites.length - 1} place${places - invites.length - 1 > 1 ? "s" : ""} sur la Map`
              : "Ouvrir le match privé"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
