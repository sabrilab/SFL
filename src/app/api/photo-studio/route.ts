// Photo officielle — SERVEUR. Un joueur connecté envoie ses selfies (ou sa
// photo de studio, pour un filtre) ; la route demande l'image à fal.ai et la
// rend en data URL. La clé fal (FAL_KEY) ne quitte jamais le serveur : elle
// n'existe que dans les variables de production du projet Vercel.
//
// Deux appels possibles :
//   · { filtre: "studio", selfies: [dataURL…], coloris } : les selfies + la
//     photo du maillot Bola (public/avatars/maillot-<coloris>.png, capturé sur
//     bola-site /sponsoring sans sponsor : avec un sponsor sur la référence,
//     le modèle le recopie) donnent la photo de studio ;
//   · { filtre: "drapeau", pays, source: dataURL } : le fond gris de la photo
//     de studio devient le drapeau du pays choisi, le reste gardé ;
//   · { filtre: "manga", source: dataURL } : la photo de studio redessinée.
//
// Le crédit fal est celui de Sabri : chaque appel est noté dans la table
// photo_studio, et un joueur s'arrête à LIMITE_JOUR générations sur 24 h.
//
// Confidentialité (22/10/2026) : pas de selfie chez fal sans l'accord du
// joueur à la politique en vigueur (lib/sfl/confidentialite.server.ts), et
// fal est prié de ne garder ni les selfies ni la photo dans son historique de
// requêtes (en-tête X-Fal-Store-IO: 0) ; Bola ne les garde pas non plus.
// Les prompts viennent des essais du 17/10/2026 (/mnt/project-files/avatars).
//
// Deux modèles : la photo de studio passe par Seedream 5 Pro (choisi par Sabri
// le 18/10/2026 après le comparatif sur un vrai selfie : il garde le mieux les
// traits ; ~0,07 $ l'image en 1536²), les filtres restent sur Nano Banana
// (~0,04 $), qui ne touche qu'au fond ou au style d'une photo déjà faite.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SANS_ACCORD, accordEnregistre } from "@/lib/sfl/confidentialite.server";
import {
  LIMITE_JOUR,
  SELFIES_MAX,
  estColoris,
  estFiltre,
  estPays,
  unPays,
  type Coloris,
} from "@/lib/sfl/photo-studio";

export const maxDuration = 120;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

/** La photo de studio (selfies + maillot). */
const MODELE_STUDIO = process.env.FAL_MODEL_STUDIO ?? "bytedance/seedream/v5/pro/edit";
/** Les filtres (drapeau, manga), à partir de la photo de studio. */
const MODELE = process.env.FAL_MODEL ?? "fal-ai/nano-banana/edit";
/** Une data URL d'image, au plus ~3 Mo une fois décodée. */
const IMAGE_MAX = 4_000_000;

function promptStudio(coloris: Coloris): string {
  const couleur = coloris === "noir" ? "black" : "white";
  return [
    "Official BOLA league player portrait, photographed like a football club's media-day studio shoot.",
    "Use the person from the first images and keep them instantly recognisable: same facial structure, eyes, nose, mouth, skin tone, hairstyle, facial hair and age.",
    "Show them at their very best, like a top sports photographer's hero portrait: flattering light, clean healthy glowing skin with natural texture, neatly groomed hair and beard, bright eyes, a confident attractive expression, an athletic look, a polished professional retouch.",
    `Dress them in exactly the BOLA match jersey from the last image, with the same marks in the same places and nothing added: ${couleur} satin polyester football shirt, modern fitted cut, round collar with a small V-notch trimmed with a ribbed band, striped sleeve cuffs, small "BOLA" wordmark on the wearer's left chest, small "SFL" badge on the wearer's right chest, no sponsor, no number.`,
    "Pose: front-facing, shoulders square to the camera, arms relaxed at the sides, chin level, calm confident expression, eyes looking straight into the lens.",
    "Light: large soft key light from the front left, gentle fill, thin rim light separating the shoulders from the background. Plain seamless light grey studio backdrop, evenly lit, no shadow on the backdrop.",
    "Camera: 85 mm portrait lens, sharp focus on the eyes, rich true-to-life colour, high-end magazine quality.",
    "Framing: square, head and shoulders down to mid-chest, head centred, eyes on the upper-third line, small headroom.",
    "No text, no watermark, no props, no hands in frame, no other people.",
  ].join(" ");
}

function promptDrapeau(pays: string): string {
  return `Keep this exact photo: same person, same face, same expression, same pose, same framing, same BOLA jersey with its marks, same studio lighting on the person. Only replace the plain grey backdrop with the national flag of ${pays}, large and gently waving, filling the whole background behind the player, slightly out of focus like a backdrop in a football team photo shoot. The flag colours and emblem must be accurate. No text, no other people.`;
}

const PROMPT_MANGA =
  "Redraw this exact photo as a black and white manga panel: same person, recognisable face, same hairstyle and facial hair, same pose, same framing, same jersey with its BOLA and SFL marks. Clean confident ink lines, screentone shading, speed lines radiating softly behind the head, pure white paper. Sports manga cover style. No speech bubbles, no extra text.";

function estImage(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^data:image\/(jpeg|png|webp);base64,/.test(v) &&
    v.length <= IMAGE_MAX
  );
}

function erreur(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** L'image rendue par fal, en data URL (fal peut rendre une data URL ou un lien). */
async function enDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`image fal ${r.status}`);
  const type = r.headers.get("content-type") ?? "image/jpeg";
  const octets = Buffer.from(await r.arrayBuffer());
  return `data:${type};base64,${octets.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const cle = process.env.FAL_KEY;
  if (!cle) return erreur("La photo officielle n'est pas encore branchée.", 503);

  const corps = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    filtre?: unknown;
    coloris?: unknown;
    selfies?: unknown;
    source?: unknown;
    pays?: unknown;
  };
  if (!corps.accessToken) return erreur("Session requise.", 401);
  if (!estFiltre(corps.filtre)) return erreur("Filtre inconnu.", 400);
  const filtre = corps.filtre;

  // Les images, vérifiées avant toute dépense.
  let images: string[];
  let prompt: string;
  if (filtre === "studio") {
    const coloris = estColoris(corps.coloris) ? corps.coloris : "blanc";
    const selfies = Array.isArray(corps.selfies) ? corps.selfies : [];
    if (selfies.length === 0 || selfies.length > SELFIES_MAX || !selfies.every(estImage)) {
      return erreur(`Envoie 1 à ${SELFIES_MAX} photos de ton visage.`, 400);
    }
    images = [...selfies, `${req.nextUrl.origin}/avatars/maillot-${coloris}.png`];
    prompt = promptStudio(coloris);
  } else {
    if (!estImage(corps.source)) return erreur("Photo de studio manquante.", 400);
    images = [corps.source];
    if (filtre === "drapeau") {
      const pays = corps.pays;
      if (!estPays(pays)) return erreur("Choisis un pays.", 400);
      const p = unPays(pays)!;
      // Le code ISO lève les doutes sur les pays au nom ambigu ou peu connu.
      prompt = promptDrapeau(p.id.length === 2 ? `${p.en} (ISO country code ${p.id.toUpperCase()})` : p.en);
    } else {
      prompt = PROMPT_MANGA;
    }
  }

  // L'appelant : un joueur accepté, avec ses propres droits (RLS).
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${corps.accessToken}` } },
  });
  const { data: auth, error: authError } = await sb.auth.getUser(corps.accessToken);
  if (authError || !auth.user) return erreur("Session invalide.", 401);

  const { data: profil } = await sb
    .from("profiles")
    .select("valide")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profil?.valide) return erreur("Ton compte attend d'être accepté.", 403);
  if (!(await accordEnregistre(sb, auth.user.id))) return erreur(SANS_ACCORD, 403);

  // Le crédit : LIMITE_JOUR générations sur 24 h glissantes.
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: compteError } = await sb
    .from("photo_studio")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .gte("created_at", depuis);
  if (compteError) return erreur("Photo officielle indisponible pour l'instant.", 503);
  if ((count ?? 0) >= LIMITE_JOUR) {
    return erreur("Tu as fait assez de photos pour aujourd'hui. Reviens demain.", 429);
  }
  // Noté AVANT l'appel : deux demandes simultanées comptent toutes les deux.
  // Le pays du drapeau est gardé pour la page Activité de l'admin.
  const { error: noteError } = await sb
    .from("photo_studio")
    .insert({ filtre, pays: filtre === "drapeau" && estPays(corps.pays) ? corps.pays : null });
  if (noteError) return erreur("Photo officielle indisponible pour l'instant.", 503);

  try {
    // Seedream prend une taille en pixels, Nano Banana un format.
    const seedream = filtre === "studio";
    const r = await fetch(`https://fal.run/${seedream ? MODELE_STUDIO : MODELE}`, {
      method: "POST",
      // X-Fal-Store-IO: 0 : fal ne garde ni les selfies ni la photo dans
      // l'historique des requêtes (la politique de confidentialité le promet).
      headers: { Authorization: `Key ${cle}`, "Content-Type": "application/json", "X-Fal-Store-IO": "0" },
      body: JSON.stringify({
        prompt,
        image_urls: images,
        num_images: 1,
        ...(seedream ? { image_size: { width: 1536, height: 1536 } } : { aspect_ratio: "1:1" }),
        output_format: "jpeg",
        sync_mode: true,
      }),
    });
    if (!r.ok) {
      console.error("[photo-studio] fal", r.status, (await r.text()).slice(0, 500));
      return erreur("La photo n'a pas pu être faite. Réessaie.", 502);
    }
    const sortie = (await r.json()) as { images?: { url?: string }[] };
    const url = sortie.images?.[0]?.url;
    if (!url) return erreur("La photo n'a pas pu être faite. Réessaie.", 502);
    return NextResponse.json({ image: await enDataUrl(url), filtre });
  } catch (e) {
    console.error("[photo-studio]", e);
    return erreur("La photo n'a pas pu être faite. Réessaie.", 502);
  }
}
