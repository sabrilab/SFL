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
//
// Trois photos par jour, studio et filtres confondus, remises à minuit
// (Sabri, 23/10/2026). Trois points le disent sous « Créer ma photo » et sous
// la photo, et chaque photo faite l'annonce, dès la première : ce qui reste,
// et dans combien de temps le compte repart. Les photos faites restent dans
// l'album du téléphone (lib/sfl/album-studio.ts) : le studio rouvre sur le
// dernier visage fait, les autres en ronds dessous, pour choisir entre eux.

import { useEffect, useRef, useState } from "react";
import { ImageUp, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CameraVisage } from "@/components/sfl/camera-visage";
import { AttenteFiltre, AttenteStudio } from "@/components/sfl/attente-studio";
import { garderPhoto, lireAlbum, tailler, type PhotoGardee } from "@/lib/sfl/album-studio";
import {
  COLORIS,
  FILTRES,
  LIMITE_JOUR,
  PAYS,
  SELFIES_MAX,
  SELFIE_COTE,
  chercherPays,
  dansCombien,
  emojiDrapeau,
  jourDeParis,
  unPays,
  type Coloris,
  type Filtre,
  type Pays,
} from "@/lib/sfl/photo-studio";

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

/** L'heure d'une photo faite (hors rendu). */
const horloge = () => Date.now();

/** Ce qui reste aujourd'hui, quand le compte repart, et quand on l'a su (ms). */
type Credit = { restantes: number; fin: number; lu: number };

/** Une photo refusée ou ratée : le message, et le crédit quand la route le donne. */
class ErreurStudio extends Error {
  credit: Credit | null;
  constructor(message: string, credit: Credit | null) {
    super(message);
    this.credit = credit;
  }
}

async function demander(corps: Record<string, unknown>): Promise<{ image: string; credit: Credit | null }> {
  const { data } = await supabase().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new ErreurStudio("Reconnecte-toi pour créer ta photo.", null);
  const r = await fetch("/api/photo-studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, ...corps }),
  });
  const sortie = (await r.json().catch(() => ({}))) as {
    image?: string;
    error?: string;
    restantes?: number;
    fin?: string;
  };
  const credit =
    typeof sortie.restantes === "number" && sortie.fin
      ? { restantes: sortie.restantes, fin: Date.parse(sortie.fin), lu: Date.now() }
      : null;
  if (!r.ok || !sortie.image) throw new ErreurStudio(sortie.error ?? "La photo n'a pas pu être faite.", credit);
  return { image: sortie.image, credit };
}

/**
 * Le crédit à l'ouverture : les photos du jour notées sur le serveur, ou à
 * défaut celles de l'album (sans connexion vérifiée, le serveur ne dit rien).
 */
async function lireCredit(album: PhotoGardee[]): Promise<Credit> {
  const lu = Date.now();
  const { debut, fin } = jourDeParis(new Date(lu));
  let faites = album.filter((p) => p.faite >= debut.getTime()).length;
  try {
    const { data } = await supabase().auth.getSession();
    const id = data.session?.user.id;
    if (id) {
      // Filtré sur le joueur : un admin lit les lignes de tout le monde.
      const { count } = await supabase()
        .from("photo_studio")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .gte("created_at", debut.toISOString());
      if (count != null) faites = Math.max(faites, count);
    }
  } catch {
    // Hors ligne : le compte de l'album suffit.
  }
  return { restantes: Math.max(0, LIMITE_JOUR - faites), fin: fin.getTime(), lu };
}

/** À chaque photo faite, dès la première : ce qui reste, et quand le compte repart. */
function annoncer(c: Credit) {
  const repart = `De nouveau ${LIMITE_JOUR} dans ${dansCombien(c.fin - c.lu)}.`;
  if (c.restantes > 0) {
    toast(`Il te reste ${c.restantes} photo${c.restantes > 1 ? "s" : ""} aujourd'hui`, { description: repart });
  } else {
    toast("C'était ta dernière photo du jour", { description: `${repart} Tes photos restent ici.` });
  }
}

export function PhotoStudio({
  joueur,
  ouvert,
  onFermer,
  onChoisir,
}: {
  /** Le joueur (nom de saison) : son album sur ce téléphone. */
  joueur: string;
  ouvert: boolean;
  onFermer: () => void;
  /** La photo retenue (data URL), à recadrer puis poser sur la carte. */
  onChoisir: (dataUrl: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [selfies, setSelfies] = useState<string[]>([]);
  const [coloris, setColoris] = useState<Coloris>("blanc");
  // Les photos faites (visages et filtres), gardées sur le téléphone.
  const [album, setAlbum] = useState<PhotoGardee[]>([]);
  // Le visage choisi dans l'album (son id) : les filtres partent de lui.
  const [choixVisage, setChoixVisage] = useState<string | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  // L'album relu pour cette ouverture : d'ici là, la caméra attend (elle
  // s'allumerait pour rien quand le studio rouvre sur les photos gardées).
  const [albumLu, setAlbumLu] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>("studio");
  const [pays, setPays] = useState<Pays | null>(null);
  const [enCours, setEnCours] = useState<Filtre | null>(null);
  const [etape, setEtape] = useState<"visage" | "maillot" | "photo">("visage");
  // Pas de caméra (refusée ou absente) : on passe par la galerie.
  const [sansCamera, setSansCamera] = useState(false);
  const [recherche, setRecherche] = useState("");
  // La photo qui vient d'arriver (son id) : elle sort du flash, une fois.
  const [revelee, setRevelee] = useState<string | null>(null);

  useEffect(() => {
    if (!revelee) return;
    const id = window.setTimeout(() => setRevelee(null), 1300);
    return () => window.clearTimeout(id);
  }, [revelee]);

  // À l'ouverture : l'album du téléphone, puis le crédit du jour. S'il y a
  // déjà un visage, le studio rouvre dessus.
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    void (async () => {
      const lu = await lireAlbum(joueur);
      if (annule) return;
      setAlbum((a) =>
        tailler([...a.filter((x) => x.joueur === joueur), ...lu.filter((p) => !a.some((x) => x.id === p.id))])
      );
      if (lu.some((p) => p.source === null)) setEtape((e) => (e === "visage" ? "photo" : e));
      setAlbumLu(true);
      const c = await lireCredit(lu);
      if (!annule) setCredit(c);
    })();
    return () => {
      annule = true;
    };
  }, [ouvert, joueur]);

  function reveler(id: string) {
    setRevelee(id);
    navigator.vibrate?.([14, 70, 14]);
  }

  // Le visage montré : celui qu'il a choisi, sinon le dernier fait.
  const visages = album.filter((p) => p.source === null);
  const visage = visages.find((v) => v.id === choixVisage) ?? visages[0];
  const epuise = credit?.restantes === 0;

  /** La photo d'un filtre pour ce visage (le visage lui-même pour Neutre). */
  function trouver(f: Filtre, p: Pays | null): PhotoGardee | undefined {
    if (!visage) return undefined;
    if (f === "studio") return visage;
    return album.find((x) => x.source === visage.id && x.filtre === f && (f !== "drapeau" || x.pays === p));
  }
  const affichee = filtre === "drapeau" && !pays ? undefined : trouver(filtre, pays);

  /** Une photo faite rejoint l'album, à l'écran et sur le téléphone. */
  function garder(photo: PhotoGardee) {
    setAlbum((a) => tailler([photo, ...a]));
    void garderPhoto(photo);
  }

  /** Le crédit qu'a rendu la route, annoncé. */
  function compter(c: Credit | null) {
    if (!c) return;
    setCredit(c);
    annoncer(c);
  }

  /** Un nouveau visage : on repart des selfies, l'album reste. */
  function nouvellePhoto() {
    setSelfies([]);
    setEtape("visage");
    setFiltre("studio");
    setRecherche("");
  }

  function choisirVisage(id: string) {
    setChoixVisage(id);
    setFiltre("studio");
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
    if (epuise) return;
    setEnCours("studio");
    try {
      const { image, credit: c } = await demander({ filtre: "studio", selfies, coloris });
      const photo: PhotoGardee = {
        id: crypto.randomUUID(),
        joueur,
        filtre: "studio",
        pays: null,
        source: null,
        image,
        faite: horloge(),
      };
      garder(photo);
      setChoixVisage(photo.id);
      setFiltre("studio");
      setEtape("photo");
      reveler(photo.id);
      compter(c);
    } catch (err) {
      if (err instanceof ErreurStudio && err.credit) setCredit(err.credit);
      toast.error(err instanceof Error ? err.message : "La photo n'a pas pu être faite.");
    } finally {
      setEnCours(null);
    }
  }

  async function generer(f: Exclude<Filtre, "studio">, p: Pays | null) {
    if (!visage || trouver(f, p) || enCours) return;
    if (epuise) {
      toast.error("Plus de photo aujourd'hui", {
        description: credit ? `De nouveau ${LIMITE_JOUR} dans ${dansCombien(credit.fin - horloge())}.` : undefined,
      });
      if (f !== "drapeau") setFiltre("studio");
      return;
    }
    const source = visage;
    setEnCours(f);
    try {
      const { image, credit: c } = await demander({ filtre: f, source: source.image, pays: p ?? undefined });
      const photo: PhotoGardee = {
        id: crypto.randomUUID(),
        joueur,
        filtre: f,
        pays: f === "drapeau" ? p : null,
        source: source.id,
        image,
        faite: horloge(),
      };
      garder(photo);
      reveler(photo.id);
      compter(c);
    } catch (err) {
      if (err instanceof ErreurStudio && err.credit) setCredit(err.credit);
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
    // Plus de photo aujourd'hui : un pays jamais fait ne remplace pas celui affiché.
    if (!(epuise && !trouver("drapeau", p))) setPays(p);
    void generer("drapeau", p);
  }

  return (
    // À part, par-dessus « Ma photo » (ui/sheet.tsx) : le studio refuse
    // d'être fermé pendant qu'il travaille ; posé dans la fenêtre, sa croix
    // le fermerait avec elle.
    <Sheet
      aPart
      open={ouvert}
      onOpenChange={(o) => {
        if (o || enCours) return;
        setAlbumLu(false);
        onFermer();
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
              const actuelle = etape === "photo" || enCours === "studio" ? 2 : etape === "maillot" ? 1 : 0;
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

          {etape === "visage" && !albumLu ? (
            <div className="mx-auto aspect-[3/4] w-full max-w-[340px] rounded-[26px] bg-secondary/40" />
          ) : etape === "visage" ? (
            <>
              {epuise && <Compteur credit={credit} />}
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
                          className="bouton-secondaire bouton--rouge absolute top-1.5 right-1.5 grid size-7 place-items-center"
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
                        className="bouton-secondaire bouton--rouge absolute top-0.5 right-0.5 grid size-5 place-items-center"
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
                    className="bouton--or h-12 flex-1 gap-2 rounded-full text-[14px]"
                    onClick={() => input.current?.click()}
                    disabled={selfies.length >= SELFIES_MAX}
                  >
                    <ImageUp className="size-4" /> Galerie
                  </Button>
                )}
                <Button
                  variant="or"
                  className="h-12 flex-1 rounded-full text-[15px] font-semibold"
                  disabled={selfies.length === 0}
                  onClick={() => setEtape("maillot")}
                >
                  Continuer
                </Button>
              </div>
              {visages.length > 0 && (
                <Button
                  variant="ghost"
                  className="bouton--or h-10 rounded-full text-[13px]"
                  onClick={() => setEtape("photo")}
                >
                  Revenir à mes photos
                </Button>
              )}
            </>
          ) : enCours === "studio" ? (
            <>
              {/* La séance : la photo arrivera exactement à cette place. */}
              <AttenteStudio visage={selfies[0]} />
              <p className="text-center text-[13px] text-muted-foreground">
                Moins d&apos;une minute. Garde l&apos;app ouverte.
              </p>
            </>
          ) : etape === "maillot" || !visage ? (
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
                      "flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold",
                      coloris === c.id ? "bouton-principal bouton--or" : "bouton-discret text-muted-foreground"
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
                variant="or"
                className="h-12 rounded-full text-[15px] font-semibold"
                disabled={selfies.length === 0 || !!enCours || epuise}
                onClick={faireStudio}
              >
                Créer ma photo
              </Button>
              <Compteur credit={credit} />
              <Button
                variant="ghost"
                className="bouton--or h-10 rounded-full text-[13px]"
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
                    key={affichee.id}
                    src={affichee.image}
                    alt="Ma photo officielle"
                    className={cn("size-full object-cover", revelee === affichee.id && "studio-revelation")}
                  />
                )}
                {affichee && revelee === affichee.id && (
                  <div aria-hidden className="studio-revelation-flash pointer-events-none absolute inset-0 bg-white" />
                )}
                {!affichee && (
                  // Le fond attend : la photo neutre, voilée, sous le choix du pays.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visage.image} alt="" className="size-full object-cover opacity-35" />
                )}
                {enCours && <AttenteFiltre legendes={seanceFiltre(enCours, pays)} />}
              </div>

              {/* Ses visages, le dernier fait d'abord : il choisit entre eux */}
              {visages.length > 1 && (
                <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none]">
                  <div className="mx-auto flex w-max gap-2.5 p-1" role="radiogroup" aria-label="Mes visages">
                    {visages.map((v, i) => (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={v.id === visage.id}
                        aria-label={`Visage ${visages.length - i}`}
                        disabled={!!enCours}
                        onClick={() => choisirVisage(v.id)}
                        className={cn(
                          "size-12 shrink-0 overflow-hidden rounded-full bg-secondary ring-2 ring-offset-2 ring-offset-background transition-all",
                          v.id === visage.id ? "ring-foreground" : "ring-transparent opacity-60"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.image} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Filtre">
                {FILTRES.map((f) => {
                  const faite = trouver(f.id, pays);
                  // Plus de photo aujourd'hui : un filtre jamais fait sur ce visage attend demain.
                  const bloque =
                    epuise && f.id !== "studio" && !album.some((x) => x.source === visage.id && x.filtre === f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={filtre === f.id}
                      disabled={!!enCours || bloque}
                      onClick={() => choisirFiltre(f.id)}
                      className={cn("flex flex-col items-center gap-1.5", bloque && "opacity-40")}
                    >
                      <span
                        className={cn(
                          "block aspect-square w-full overflow-hidden rounded-[14px] bg-secondary ring-2 transition-all",
                          filtre === f.id ? "ring-foreground" : "ring-transparent"
                        )}
                      >
                        {faite && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={faite.image} alt="" className="size-full object-cover" />
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
                  );
                })}
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

              <Compteur credit={credit} />

              <div className="flex gap-2.5">
                <Button
                  variant="secondary"
                  className="bouton--or h-12 flex-1 gap-2 rounded-full text-[15px]"
                  disabled={!!enCours || epuise}
                  onClick={nouvellePhoto}
                >
                  <Plus className="size-4" /> Nouvelle photo
                </Button>
                <Button
                  variant="or"
                  className="h-12 flex-1 rounded-full text-[15px] font-semibold"
                  disabled={!affichee || !!enCours}
                  onClick={() => affichee && onChoisir(affichee.image)}
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

/** Les photos qui restent aujourd'hui (trois points), et dans combien de temps le compte repart. */
function Compteur({ credit }: { credit: Credit | null }) {
  // L'heure, relue toutes les 30 s : l'attente affichée descend.
  const [maintenant, setMaintenant] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMaintenant(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  if (!credit) return null;
  const n = credit.restantes;
  return (
    <div className="flex flex-col items-center gap-1 text-center text-[12.5px] text-muted-foreground">
      <p className="flex items-center gap-2">
        <span className="flex shrink-0 gap-1" aria-hidden>
          {Array.from({ length: LIMITE_JOUR }, (_, i) => (
            <span key={i} className={cn("size-1.5 rounded-full", i < n ? "bg-foreground" : "bg-foreground/20")} />
          ))}
        </span>
        {n > 0 ? `Encore ${n} photo${n > 1 ? "s" : ""} aujourd'hui` : "Plus de photo aujourd'hui"}
      </p>
      {n < LIMITE_JOUR && (
        <p>
          De nouveau {LIMITE_JOUR} dans {dansCombien(credit.fin - Math.max(maintenant, credit.lu))}
        </p>
      )}
    </div>
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
