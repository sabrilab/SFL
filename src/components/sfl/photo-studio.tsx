"use client";

// Photo officielle, en trois temps. 1. Visage : l'appareil photo s'ouvre
// avec un ovale où poser la tête (camera-visage.tsx), trois prises guidées —
// de face, puis la tête un peu tournée de chaque côté —, ou la galerie si la
// caméra n'est pas là. 2. Maillot : blanc ou noir. 3. Photo : une photo de studio au maillot Bola,
// la même mise en scène pour toutes les cartes, sur fond gris (Neutre). Il
// peut ensuite mettre le drapeau de son pays derrière lui (Drapeau) ou la
// passer en Manga, puis la poser sur sa carte : elle repart alors dans le
// recadrage habituel (recadrer-photo.tsx).
//
// Les images sont faites côté serveur (/api/photo-studio, fal.ai) ; chaque
// variante (un drapeau par pays) n'est demandée qu'une fois, puis gardée.
// Pendant qu'elles se font, le joueur regarde sa séance (attente-studio.tsx),
// et la photo arrive dans un flash. Le pays du drapeau se cherche parmi tous
// les pays du monde ; ceux de la ligue sont proposés d'abord.

import { useEffect, useRef, useState } from "react";
import { ImageUp, Plus, RotateCcw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CameraVisage } from "@/components/sfl/camera-visage";
import { AttenteFiltre, AttenteStudio } from "@/components/sfl/attente-studio";
import {
  COLORIS,
  FILTRES,
  PAYS,
  SELFIES_MAX,
  SELFIE_COTE,
  chercherPays,
  emojiDrapeau,
  unPays,
  type Coloris,
  type Filtre,
  type Pays,
} from "@/lib/sfl/photo-studio";

/** La clé d'une variante : le filtre, et le pays pour un drapeau. */
function cle(filtre: Filtre, pays: Pays | null): string {
  return filtre === "drapeau" ? `drapeau-${pays}` : filtre;
}

/** Un selfie réduit à SELFIE_COTE de côté et recompressé : moins à envoyer. */
async function reduire(fichier: File): Promise<string> {
  const image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  const echelle = Math.min(1, SELFIE_COTE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.86);
}

/** Les trois prises guidées : de face d'abord, la seule indispensable. */
const POSES = ["De face, regarde l'objectif", "Tourne un peu la tête à gauche", "Puis un peu à droite"];

const ETAPES = ["Visage", "Maillot", "Photo"] as const;

/** Les légendes d'un filtre en cours. */
function seanceFiltre(f: Exclude<Filtre, "studio">, pays: Pays | null): string[] {
  if (f === "manga") return ["On sort l'encre", "Les traits", "Les trames", "Derniers coups de plume"];
  const p = pays ? unPays(pays) : undefined;
  return ["On déplie le drapeau", p ? `${emojiDrapeau(p.id)}  ${p.nom}` : "Le drapeau", "Mise au point"];
}

async function demander(corps: Record<string, unknown>): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Reconnecte-toi pour créer ta photo.");
  const r = await fetch("/api/photo-studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, ...corps }),
  });
  const sortie = (await r.json().catch(() => ({}))) as { image?: string; error?: string };
  if (!r.ok || !sortie.image) throw new Error(sortie.error ?? "La photo n'a pas pu être faite.");
  return sortie.image;
}

export function PhotoStudio({
  ouvert,
  onFermer,
  onChoisir,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** La photo retenue (data URL), à recadrer puis poser sur la carte. */
  onChoisir: (dataUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selfies, setSelfies] = useState<string[]>([]);
  const [coloris, setColoris] = useState<Coloris>("blanc");
  const [variantes, setVariantes] = useState<Record<string, string>>({});
  const [filtre, setFiltre] = useState<Filtre>("studio");
  const [pays, setPays] = useState<Pays | null>(null);
  const [enCours, setEnCours] = useState<Filtre | null>(null);
  const [etape, setEtape] = useState<"visage" | "maillot">("visage");
  // Pas de caméra (refusée ou absente) : on passe par la galerie.
  const [sansCamera, setSansCamera] = useState(false);
  const [recherche, setRecherche] = useState("");
  // La variante qui vient d'arriver : elle sort du flash, une fois.
  const [revelee, setRevelee] = useState<string | null>(null);

  useEffect(() => {
    if (!revelee) return;
    const id = window.setTimeout(() => setRevelee(null), 1300);
    return () => window.clearTimeout(id);
  }, [revelee]);

  function reveler(k: string) {
    setRevelee(k);
    navigator.vibrate?.([14, 70, 14]);
  }

  const studio = variantes.studio;
  const affichee = filtre === "drapeau" && !pays ? undefined : variantes[cle(filtre, pays)];

  function reinitialiser() {
    setSelfies([]);
    setEtape("visage");
    setVariantes({});
    setFiltre("studio");
    setPays(null);
    setEnCours(null);
    setRecherche("");
  }

  async function ajouter(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []);
    e.target.value = "";
    const place = SELFIES_MAX - selfies.length;
    try {
      const nouveaux = await Promise.all(fichiers.slice(0, place).map(reduire));
      setSelfies((s) => [...s, ...nouveaux].slice(0, SELFIES_MAX));
    } catch {
      toast.error("Cette image ne s'ouvre pas.");
    }
  }

  function prise(image: string) {
    const suite = [...selfies, image].slice(0, SELFIES_MAX);
    setSelfies(suite);
    if (suite.length === SELFIES_MAX) setEtape("maillot");
  }

  async function faireStudio() {
    setEnCours("studio");
    try {
      const image = await demander({ filtre: "studio", selfies, coloris });
      // Nouvelle photo de studio : les filtres faits sur l'ancienne ne valent plus.
      setVariantes({ studio: image });
      setFiltre("studio");
      reveler("studio");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La photo n'a pas pu être faite.");
    } finally {
      setEnCours(null);
    }
  }

  async function generer(f: Exclude<Filtre, "studio">, p: Pays | null) {
    const k = cle(f, p);
    if (variantes[k] || !studio || enCours) return;
    setEnCours(f);
    try {
      const image = await demander({ filtre: f, source: studio, pays: p ?? undefined });
      setVariantes((v) => ({ ...v, [k]: image }));
      reveler(k);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le filtre n'a pas pu être appliqué.");
      if (f !== "drapeau") setFiltre("studio");
    } finally {
      setEnCours(null);
    }
  }

  function choisirFiltre(f: Filtre) {
    setFiltre(f);
    if (f === "studio" || (f === "drapeau" && !pays)) return;
    void generer(f, f === "drapeau" ? pays : null);
  }

  function choisirPays(p: Pays) {
    setPays(p);
    void generer("drapeau", p);
  }

  return (
    <Sheet
      open={ouvert}
      onOpenChange={(o) => {
        if (!o && !enCours) onFermer();
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[94dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[22px] font-bold tracking-tight">Photo officielle</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-5">
          {/* Où on en est : Visage, Maillot, Photo */}
          <ol className="flex gap-1.5" aria-label="Étapes">
            {ETAPES.map((nom, i) => {
              const actuelle = studio || enCours === "studio" ? 2 : etape === "maillot" ? 1 : 0;
              return (
                <li key={nom} className="flex flex-1 flex-col gap-1.5" aria-current={i === actuelle ? "step" : undefined}>
                  <span className={cn("h-1 rounded-full", i <= actuelle ? "bg-foreground" : "bg-foreground/15")} />
                  <span className={cn("text-[11px] font-semibold", i === actuelle ? "text-foreground" : "text-muted-foreground")}>
                    {i + 1}. {nom}
                  </span>
                </li>
              );
            })}
          </ol>

          {!studio && etape === "visage" ? (
            <>
              {sansCamera ? (
                // Sans caméra : les photos du visage, depuis la galerie.
                <div className="grid grid-cols-3 gap-2.5">
                  {Array.from({ length: SELFIES_MAX }, (_, i) => {
                    const s = selfies[i];
                    return s ? (
                      <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-[18px] bg-secondary">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s} alt="" className="size-full object-cover" />
                        <button
                          type="button"
                          aria-label="Retirer cette photo"
                          disabled={!!enCours}
                          onClick={() => setSelfies((l) => l.filter((_, j) => j !== i))}
                          className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        key={i}
                        type="button"
                        aria-label="Ajouter une photo de mon visage"
                        disabled={!!enCours || i !== selfies.length}
                        onClick={() => input.current?.click()}
                        className={cn(
                          "grid aspect-[3/4] place-items-center rounded-[18px] border-2 border-dashed border-foreground/15 text-muted-foreground transition-opacity",
                          i !== selfies.length && "opacity-40"
                        )}
                      >
                        <Plus className="size-5" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <CameraVisage
                  consigne={POSES[Math.min(selfies.length, SELFIES_MAX - 1)]}
                  onPhoto={prise}
                  onIndisponible={() => setSansCamera(true)}
                />
              )}

              {/* Les prises déjà faites */}
              {!sansCamera && selfies.length > 0 && (
                <div className="flex justify-center gap-2">
                  {selfies.map((s, i) => (
                    <div key={i} className="relative h-16 w-12 overflow-hidden rounded-xl bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        aria-label="Reprendre cette photo"
                        onClick={() => setSelfies((l) => l.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2.5">
                {!sansCamera && (
                  <Button
                    variant="secondary"
                    className="h-12 flex-1 gap-2 rounded-full text-[14px]"
                    onClick={() => input.current?.click()}
                    disabled={selfies.length >= SELFIES_MAX}
                  >
                    <ImageUp className="size-4" /> Galerie
                  </Button>
                )}
                <Button
                  className="h-12 flex-1 rounded-full text-[15px] font-semibold"
                  disabled={selfies.length === 0}
                  onClick={() => setEtape("maillot")}
                >
                  Continuer
                </Button>
              </div>
            </>
          ) : !studio && enCours === "studio" ? (
            <>
              {/* La séance : la photo arrivera exactement à cette place. */}
              <AttenteStudio visage={selfies[0]} />
              <p className="text-center text-[13px] text-muted-foreground">
                Moins d&apos;une minute. Garde l&apos;app ouverte.
              </p>
            </>
          ) : !studio ? (
            <>
              {/* Les visages retenus, en rappel */}
              <div className="flex justify-center gap-2">
                {selfies.map((s, i) => (
                  <div key={i} className="h-20 w-[60px] overflow-hidden rounded-xl bg-secondary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s} alt="" className="size-full object-cover" />
                  </div>
                ))}
              </div>

              {/* Le maillot */}
              <div className="flex rounded-2xl bg-secondary/60 p-1" role="radiogroup" aria-label="Maillot">
                {COLORIS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={coloris === c.id}
                    disabled={!!enCours}
                    onClick={() => setColoris(c.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold transition-colors",
                      coloris === c.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-3.5 rounded-full ring-1 ring-foreground/25",
                        c.id === "noir" ? "bg-black" : "bg-white"
                      )}
                    />
                    {c.label}
                  </button>
                ))}
              </div>

              <Button
                className="h-12 rounded-full text-[15px] font-semibold"
                disabled={selfies.length === 0 || !!enCours}
                onClick={faireStudio}
              >
                Créer ma photo
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-full text-[13px] text-muted-foreground"
                disabled={!!enCours}
                onClick={() => setEtape("visage")}
              >
                Reprendre les photos
              </Button>
            </>
          ) : (
            <>
              {/* La photo, et ses filtres */}
              <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-secondary">
                {affichee && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={cle(filtre, pays)}
                    src={affichee}
                    alt="Ma photo officielle"
                    className={cn("size-full object-cover", revelee === cle(filtre, pays) && "studio-revelation")}
                  />
                )}
                {affichee && revelee === cle(filtre, pays) && (
                  <div aria-hidden className="studio-revelation-flash pointer-events-none absolute inset-0 bg-white" />
                )}
                {!affichee && studio && (
                  // Le fond attend : la photo neutre, voilée, sous le choix du pays.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={studio} alt="" className="size-full object-cover opacity-35" />
                )}
                {enCours && enCours !== "studio" && <AttenteFiltre legendes={seanceFiltre(enCours, pays)} />}
              </div>

              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Filtre">
                {FILTRES.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={filtre === f.id}
                    disabled={!!enCours}
                    onClick={() => choisirFiltre(f.id)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "block aspect-square w-full overflow-hidden rounded-[14px] bg-secondary ring-2 transition-all",
                        filtre === f.id ? "ring-foreground" : "ring-transparent"
                      )}
                    >
                      {variantes[cle(f.id, pays)] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={variantes[cle(f.id, pays)]} alt="" className="size-full object-cover" />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        filtre === f.id ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Drapeau : le pays, cherché parmi tous, ou pris dans la rangée de la ligue */}
              {filtre === "drapeau" && (
                <div className="flex flex-col gap-2.5">
                  <label className="flex h-11 items-center gap-2 rounded-full bg-secondary/70 px-4">
                    <Search className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      type="search"
                      value={recherche}
                      onChange={(e) => setRecherche(e.target.value)}
                      placeholder="Chercher un pays"
                      enterKeyHint="search"
                      autoComplete="off"
                      disabled={!!enCours}
                      className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
                    />
                    {recherche && (
                      <button
                        type="button"
                        aria-label="Effacer"
                        onClick={() => setRecherche("")}
                        className="grid size-5 place-items-center rounded-full bg-muted-foreground/40 text-background"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </label>
                  <ListePays recherche={recherche} choisi={pays} bloque={!!enCours} onChoisir={choisirPays} />
                </div>
              )}

              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  className="h-12 flex-1 gap-2 rounded-full text-[15px]"
                  disabled={!!enCours}
                  onClick={reinitialiser}
                >
                  <RotateCcw className="size-4" /> Refaire
                </Button>
                <Button
                  className="h-12 flex-1 rounded-full text-[15px] font-semibold"
                  disabled={!affichee || !!enCours}
                  onClick={() => affichee && onChoisir(affichee)}
                >
                  Sur ma carte
                </Button>
              </div>
            </>
          )}
        </div>

        <input ref={input} type="file" accept="image/*" multiple onChange={ajouter} className="hidden" />
      </SheetContent>
    </Sheet>
  );
}

/**
 * La rangée des pays : ceux de la ligue (et le pays choisi s'il n'en est pas)
 * quand rien n'est cherché, sinon tous ceux qui répondent à la recherche.
 */
function ListePays({
  recherche,
  choisi,
  bloque,
  onChoisir,
}: {
  recherche: string;
  choisi: Pays | null;
  bloque: boolean;
  onChoisir: (p: Pays) => void;
}) {
  const cherche = recherche.trim() !== "";
  let liste: { id: Pays; nom: string }[] = cherche ? chercherPays(recherche) : [...PAYS];
  if (!cherche && choisi && !PAYS.some((p) => p.id === choisi)) {
    const p = unPays(choisi);
    if (p) liste = [p, ...liste];
  }
  if (cherche && liste.length === 0) {
    return <p className="py-3 text-center text-[13px] text-muted-foreground">Aucun pays à ce nom.</p>;
  }
  return (
    <div
      className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
      role="radiogroup"
      aria-label="Pays"
    >
      {liste.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={choisi === p.id}
          aria-label={p.nom}
          disabled={bloque}
          onClick={() => onChoisir(p.id)}
          className={cn(
            "flex max-w-[132px] shrink-0 flex-col items-center gap-1 rounded-2xl px-2.5 py-2 transition-colors",
            choisi === p.id ? "bg-foreground/10 ring-1 ring-foreground/30" : "bg-secondary/60"
          )}
        >
          <span className="text-[26px] leading-none">{emojiDrapeau(p.id)}</span>
          <span className="max-w-full truncate text-[11px] font-semibold text-muted-foreground">{p.nom}</span>
        </button>
      ))}
    </div>
  );
}
