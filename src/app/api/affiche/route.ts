// L'affiche du match — SERVEUR. Sabri, 31/10 : il préfère l'image générée des
// deux meilleurs joueurs (l'essai Jouneid contre Zakary) aux vignettes.
//
// L'app envoie, pour un match, ses joueurs triés par note : les Noirs et les
// Blancs une fois les équipes faites (le vendredi), sinon les présents ou les
// habitués d'un seul tenant. La route garde ceux qui ont accepté l'usage de
// leur carte hors de l'app (consentements.hors_app, la dernière ligne fait
// foi) et qui ont une photo de carte, puis prend le meilleur Noir contre le
// meilleur Blanc (ou les deux premiers). L'image de cette paire est faite une
// seule fois par fal, posée dans le bucket public « affiches » et notée dans
// match_affiches (supabase/schema.sql) : tous les appels suivants la relisent.
//
// Même modèle que la couverture d'équipe (Seedream 5 Pro, qui garde le mieux
// les visages). Le crédit fal est celui de Sabri : LIMITE_JOUR affiches par
// jour pour toute l'app, remises à minuit, heure de Paris ; une image ratée
// reste comptée. fal est prié de ne rien garder (X-Fal-Store-IO: 0).

import { NextRequest, NextResponse } from "next/server";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { jourDeParis } from "@/lib/sfl/photo-studio";

export const maxDuration = 120;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const MODELE = process.env.FAL_MODEL_AFFICHE ?? process.env.FAL_MODEL_STUDIO ?? "bytedance/seedream/v5/pro/edit";
const LIMITE_JOUR = 6;
/** Une affiche « en cours » plus vieille que ça a échoué sans le dire. */
const EN_COURS_MAX = 3 * 60_000;
const NOMS_MAX = 40;

type Sortie = { image: string; joueurs: [string, string] } | { attente: true } | { aucune: true };

/** La clé Storage d'une photo de carte : le nom en hexadécimal UTF-8 (lib/sfl/photos.ts). */
const hex = (nom: string) => Buffer.from(nom, "utf8").toString("hex");
const cleDePaire = (a: string, b: string) => [a, b].sort((x, y) => x.localeCompare(y, "fr")).join("+");
const publique = (chemin: string) => `${SUPABASE_URL}/storage/v1/object/public/affiches/${chemin}`;

const listeDeNoms = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length <= NOMS_MAX && v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 60) ? (v as string[]) : null;

function prompt(): string {
  return [
    "Cinematic poster of an amateur five-a-side football match, made as the match poster in a football app.",
    "Image 1 and image 2 are portraits of the two players, one person per image. Show exactly these two people, side by side, each instantly recognisable: same face, skin tone, hairstyle, facial hair, build and age. Nobody else.",
    "The player of image 1 stands on the right and wears a plain black football jersey with thin white trims; the player of image 2 stands on the left and wears a plain white football jersey with thin black trims. Small white BOLA wordmark on the black jersey's chest, small black BOLA wordmark on the white one.",
    "Both face the camera, arms crossed, confident and calm, framed from the thighs up, a football on the turf between them.",
    "Outdoor artificial-turf five-a-side pitch at night, white floodlights, light haze, fences and dark trees behind, a cold neutral grade close to black and white.",
    "Wide 4:3 composition, faces sharp and well lit, the bottom quarter of the image kept dark and calm.",
    "Photorealistic sports photography, 35 mm lens, natural skin texture.",
    "No text other than the wordmarks, no numbers, no sponsor, no watermark, no coloured lights, no other people.",
  ].join(" ");
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  const cle = process.env.FAL_KEY;
  if (!sb || !cle) return NextResponse.json({ error: "L'affiche n'est pas encore branchée." }, { status: 503 });
  if (!(await appelant(sb, req))) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { noirs?: unknown; blancs?: unknown; joueurs?: unknown };
  const noirs = listeDeNoms(corps.noirs);
  const blancs = listeDeNoms(corps.blancs);
  const joueurs = listeDeNoms(corps.joueurs);
  const tous = noirs && blancs ? [...noirs, ...blancs] : joueurs;
  if (!tous?.length) return NextResponse.json({ error: "Joueurs manquants." }, { status: 400 });

  // Qui peut figurer sur l'affiche : un accord hors de l'app, et une photo de carte.
  const { data: profils } = await sb.from("profiles").select("id, name").in("name", [...new Set(tous)]);
  const idDe = new Map(((profils ?? []) as { id: string; name: string }[]).map((p) => [p.name, p.id]));
  const ids = [...idDe.values()];
  const { data: accords } = ids.length
    ? await sb.from("consentements").select("user_id, hors_app, created_at").in("user_id", ids).order("created_at", { ascending: false })
    : { data: [] };
  const horsApp = new Set<string>();
  const vus = new Set<string>();
  for (const a of (accords ?? []) as { user_id: string; hors_app: boolean }[]) {
    if (vus.has(a.user_id)) continue;
    vus.add(a.user_id);
    if (a.hors_app) horsApp.add(a.user_id);
  }
  const photos = new Map<string, string>();
  const peut = async (nom: string) => {
    const id = idDe.get(nom);
    if (!id || !horsApp.has(id)) return false;
    const url = `${SUPABASE_URL}/storage/v1/object/public/photos/${hex(nom)}.jpg`;
    const r = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (!r?.ok) return false;
    photos.set(nom, `${url}?v=${Date.parse(r.headers.get("last-modified") ?? "") || 0}`);
    return true;
  };
  const premier = async (liste: string[], sauf?: string) => {
    for (const nom of liste) if (nom !== sauf && (await peut(nom))) return nom;
    return null;
  };
  let noir: string | null;
  let blanc: string | null;
  if (noirs && blancs) {
    noir = await premier(noirs);
    blanc = await premier(blancs, noir ?? undefined);
  } else {
    noir = await premier(joueurs!);
    blanc = noir ? await premier(joueurs!, noir) : null;
  }
  if (!noir || !blanc) return NextResponse.json({ aucune: true } satisfies Sortie);

  // Déjà faite, ou en train de l'être ?
  const paire = cleDePaire(noir, blanc);
  const { data: ligne } = await sb.from("match_affiches").select("chemin, statut, updated_at, joueurs").eq("paire", paire).maybeSingle();
  const l = ligne as { chemin: string | null; statut: string; updated_at: string; joueurs: string[] } | null;
  if (l?.statut === "prete" && l.chemin) {
    return NextResponse.json({ image: publique(l.chemin), joueurs: [l.joueurs[0], l.joueurs[1]] } satisfies Sortie);
  }
  if (l?.statut === "en_cours" && Date.now() - Date.parse(l.updated_at) < EN_COURS_MAX) {
    return NextResponse.json({ attente: true } satisfies Sortie);
  }
  // Ratée aujourd'hui : on ne la redemande que demain.
  const { debut } = jourDeParis();
  if (l?.statut === "ratee" && Date.parse(l.updated_at) >= debut.getTime()) return NextResponse.json({ aucune: true } satisfies Sortie);

  // Le crédit du jour, pour toute l'app.
  const { count } = await sb.from("match_affiches").select("paire", { count: "exact", head: true }).gte("updated_at", debut.toISOString());
  if ((count ?? 0) >= LIMITE_JOUR) return NextResponse.json({ aucune: true } satisfies Sortie);

  const maintenant = new Date().toISOString();
  const { error: noteError } = await sb
    .from("match_affiches")
    .upsert({ paire, joueurs: [noir, blanc], chemin: null, statut: "en_cours", updated_at: maintenant });
  if (noteError) return NextResponse.json({ error: "Affiche indisponible pour l'instant." }, { status: 503 });
  const rate = async () => {
    await sb.from("match_affiches").update({ statut: "ratee", updated_at: new Date().toISOString() }).eq("paire", paire);
    return NextResponse.json({ aucune: true } satisfies Sortie);
  };

  try {
    const r = await fetch(`https://fal.run/${MODELE}`, {
      method: "POST",
      headers: { Authorization: `Key ${cle}`, "Content-Type": "application/json", "X-Fal-Store-IO": "0" },
      body: JSON.stringify({
        prompt: prompt(),
        image_urls: [photos.get(noir), photos.get(blanc)],
        num_images: 1,
        image_size: { width: 1600, height: 1200 },
        output_format: "jpeg",
        sync_mode: true,
      }),
    });
    if (!r.ok) {
      console.error("[affiche] fal", r.status, (await r.text()).slice(0, 500));
      return rate();
    }
    const url = ((await r.json()) as { images?: { url?: string }[] }).images?.[0]?.url;
    if (!url) return rate();
    const octets = url.startsWith("data:")
      ? Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
      : Buffer.from(await (await fetch(url)).arrayBuffer());
    const chemin = `${hex(paire)}-${Date.now().toString(36)}.jpg`;
    const { error: poseError } = await sb.storage.from("affiches").upload(chemin, octets, { contentType: "image/jpeg", upsert: true });
    if (poseError) {
      console.error("[affiche] pose", poseError.message);
      return rate();
    }
    await sb.from("match_affiches").update({ chemin, statut: "prete", updated_at: new Date().toISOString() }).eq("paire", paire);
    return NextResponse.json({ image: publique(chemin), joueurs: [noir, blanc] } satisfies Sortie);
  } catch (err) {
    console.error("[affiche]", err);
    return rate();
  }
}
