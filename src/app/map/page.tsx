"use client";

// La Map — où se joue le prochain match de la Sunday Five League.
//
// Première section de l'app, comme dans BOLA : la carte, le terrain du match
// ouvert avec son adresse et le compte des présents (les places vides en
// pointillés braise, le signe du manque), le chemin pour y aller, et le
// tableau de présence pour répondre sans changer d'écran.
//
// Les terrains vivent dans la saison (`saison.terrains`) : l'admin les pose
// ici, une fois, avec leur adresse ; la convocation garde son lieu en texte
// et la Map retrouve le terrain par son nom (sinon le terrain par défaut).

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "@/hooks/use-session";
import { saisieStore } from "@/lib/sfl/saisie/store";
import {
  ajouterTerrain,
  definirTerrainParDefaut,
  retirerTerrain,
  terrainDuMatch,
} from "@/lib/sfl/saisie/mutations";
import type { Saison, Terrain } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const CarteMap = dynamic(() => import("@/components/sfl/map/carte-map").then((m) => m.CarteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-card" aria-hidden />,
});

interface Lieu {
  lat: number;
  lng: number;
  libelle: string;
}

/** L'itinéraire dans l'app de plans du téléphone : Plans sur iPhone, Google Maps ailleurs. */
function urlItineraire(t: Terrain, ios: boolean): string {
  return ios
    ? `https://maps.apple.com/?daddr=${t.lat},${t.lng}&q=${encodeURIComponent(t.nom)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
}

export default function MapPage() {
  const { saison } = useSeason();
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();

  const terrains = useMemo(() => saison.terrains ?? [], [saison.terrains]);
  const terrainMatch = useMemo(() => terrainDuMatch(saison, p.lieu), [saison, p.lieu]);
  const reperes = useMemo(
    () =>
      terrains.map((t) => ({
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        nom: t.nom,
        match: t.id === terrainMatch?.id,
        sousTitre: t.id === terrainMatch?.id ? `j${p.journee} · ${p.jour.toLowerCase()} ${p.heure}` : undefined,
      })),
    [terrains, terrainMatch, p.journee, p.jour, p.heure]
  );

  const [ios, setIos] = useState(false);
  useEffect(() => {
    setIos(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
  }, []);

  function sauver(next: Saison, message: string) {
    saisieStore.save(next);
    window.dispatchEvent(new Event(SAISIE_EVENT));
    toast.success(message);
  }

  const manque = Math.max(0, p.effectif - p.presents.length);

  return (
    <div className="shell flex flex-col gap-5 py-2 sm:py-6">
      <header className="px-1">
        <p className="mono-label text-muted-foreground">la map · sunday five league</p>
        <h1 className="mt-0.5 text-[30px] font-bold tracking-tight">Où ça se joue</h1>
      </header>

      {/* La carte */}
      <div className="relative overflow-hidden rounded-[26px] border border-border bg-card">
        <div className="h-[52dvh] min-h-[320px] w-full">
          <CarteMap reperes={reperes} className="h-full w-full" />
        </div>
        {terrains.length === 0 && (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-background/85 px-4 py-3 text-center backdrop-blur">
            <p className="text-[14px] font-semibold">Aucun terrain sur la Map pour l&apos;instant.</p>
            <p className="mono-label mt-0.5 text-muted-foreground">
              {admin ? "ajoute le terrain de la ligue ci-dessous" : "l'admin le pose depuis cette page"}
            </p>
          </div>
        )}
      </div>

      {/* Le prochain match, là où il se joue */}
      {terrainMatch && (
        <section className="glass rounded-[26px] p-5">
          <p className="mono-label text-muted-foreground">j{p.journee} · prochain match</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-bold tracking-tight">{terrainMatch.nom}</h2>
              <p className="mt-0.5 text-[13px] text-foreground/60">{terrainMatch.adresse}</p>
              <p className="mono-label mt-2 text-foreground/80">
                {p.jour.toLowerCase()} · {p.heure} · {p.lieu.toLowerCase()}
              </p>
            </div>
            <a
              href={urlItineraire(terrainMatch, ios)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
            >
              <Navigation className="size-4" /> Y aller
            </a>
          </div>

          {/* L'effectif : un point par place, les manquantes en pointillés braise */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[28px] leading-none font-bold tracking-tight tabular-nums">
              {p.presents.length}
              <span className="text-foreground/40">/{p.effectif}</span>
            </span>
            <div className="flex flex-wrap gap-1.5" aria-hidden>
              {Array.from({ length: p.effectif }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-3 rounded-full",
                    i < p.presents.length ? "bg-foreground" : "border border-dashed border-braise"
                  )}
                />
              ))}
            </div>
          </div>
          <p className={cn("mono-label mt-2", manque > 0 ? "text-braise" : "text-vert")}>
            {manque > 0 ? `il manque ${manque} joueur${manque > 1 ? "s" : ""}` : "l'effectif est au complet"}
          </p>
        </section>
      )}

      <PresencePanel />

      {admin && <Terrains saison={saison} terrains={terrains} onSauver={sauver} />}
    </div>
  );
}

/* ----------------------------- Côté admin ----------------------------- */

function Terrains({
  saison,
  terrains,
  onSauver,
}: {
  saison: Saison;
  terrains: Terrain[];
  onSauver: (next: Saison, message: string) => void;
}) {
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [choisi, setChoisi] = useState<Lieu | null>(null);
  const [cherche, setCherche] = useState(false);

  async function chercher() {
    const q = adresse.trim();
    if (q.length < 3) return;
    setCherche(true);
    setChoisi(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { resultats: Lieu[]; erreur?: string };
      if (data.erreur) toast.error(data.erreur);
      setLieux(data.resultats ?? []);
      if (data.resultats?.length === 1) setChoisi(data.resultats[0]);
      if (!data.erreur && !data.resultats?.length) toast.error("Aucun lieu trouvé pour cette adresse.");
    } catch {
      toast.error("Le service d'adresses est injoignable.");
    } finally {
      setCherche(false);
    }
  }

  function ajouter() {
    if (!choisi || !nom.trim()) return;
    onSauver(
      ajouterTerrain(saison, { nom: nom.trim(), adresse: adresse.trim(), lat: choisi.lat, lng: choisi.lng }),
      `${nom.trim()} est sur la Map.`
    );
    setNom("");
    setAdresse("");
    setLieux([]);
    setChoisi(null);
  }

  return (
    <section className="overflow-hidden rounded-[26px] bg-card">
      <div className="px-5 pt-4 pb-3">
        <p className="mono-label text-muted-foreground">admin · terrains</p>
        <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">Les terrains de la ligue</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Le match s&apos;affiche sur le terrain dont le nom figure dans le lieu de la convocation, sinon
          sur le terrain par défaut.
        </p>
      </div>

      {terrains.length > 0 && (
        <ul className="border-t border-border/60">
          {terrains.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-b-0">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  {t.nom}
                  {t.defaut && <span className="mono-label ml-2 text-vert">par défaut</span>}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">{t.adresse}</p>
              </div>
              {!t.defaut && (
                <button
                  type="button"
                  aria-label={`${t.nom} par défaut`}
                  onClick={() => onSauver(definirTerrainParDefaut(saison, t.id), `${t.nom} devient le terrain par défaut.`)}
                  className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
                >
                  <Star className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Retirer ${t.nom}`}
                onClick={() => onSauver(retirerTerrain(saison, t.id), `${t.nom} retiré de la Map.`)}
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Nom du terrain</span>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Five du canal" maxLength={40} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Adresse</span>
          <div className="flex gap-2">
            <Input
              value={adresse}
              onChange={(e) => {
                setAdresse(e.target.value);
                setLieux([]);
                setChoisi(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void chercher();
                }
              }}
              placeholder="12 rue du Stade, Lille"
            />
            <Button type="button" variant="secondary" disabled={cherche || adresse.trim().length < 3} onClick={chercher}>
              <Search className="size-4" /> {cherche ? "…" : "Chercher"}
            </Button>
          </div>
        </label>

        {lieux.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {lieux.map((l) => (
              <li key={`${l.lat},${l.lng}`}>
                <button
                  type="button"
                  onClick={() => setChoisi(l)}
                  aria-pressed={choisi === l}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-[12px] leading-snug",
                    choisi === l ? "border-foreground bg-secondary" : "border-border text-muted-foreground"
                  )}
                >
                  {l.libelle}
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button disabled={!choisi || !nom.trim()} onClick={ajouter} className="font-semibold">
          <Plus className="size-4" /> Ajouter sur la Map
        </Button>
      </div>
    </section>
  );
}
