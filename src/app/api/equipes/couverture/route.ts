// La couverture d'une équipe de Bola Team — SERVEUR. Sabri, 24/10 : « cette
// équipe a une page sur Bola. Cette page-là donne lieu à un profil d'équipe
// qui peut accueillir une couverture faite justement en IA aussi, avec les
// joueurs présents de cette équipe, leur maillot et leur blason. »
//
// Le capitaine (ou le vice) envoie le maillot et l'écusson de l'équipe, deux
// PNG peints par l'app (equipe/fiche-couverture.tsx) ; la route y ajoute la
// photo de carte de chaque joueur (le bucket public « photos »), demande
// l'image à fal.ai et la rend en data URL. L'app la montre, puis la pose
// (bucket « couvertures », equipe_couverture : supabase/schema.sql).
//
// Sur l'image : les joueurs de l'équipe qui ont signé le Règlement Team
// version 2 (son neuvième point le prévoit, et sa case l'accepte) et qui ont
// une photo de carte ; deux au moins, sept au plus. Le demandeur, lui, doit
// avoir accepté la politique de confidentialité en vigueur. fal est prié de
// ne garder ni les photos ni l'image (en-tête X-Fal-Store-IO: 0).
//
// Le modèle est celui de la photo de studio, Seedream 5 Pro, qui garde le
// mieux les visages (Sabri, 18/10). Le crédit fal est celui de Sabri : deux
// couvertures par équipe et par jour, remises à minuit, heure de Paris.
// Chaque demande est notée AVANT l'appel (equipe_couvertures) : la base
// refuse celle qui dépasse (indice « credit-du-jour »), et une image ratée
// chez fal reste comptée.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SANS_ACCORD, accordEnregistre } from "@/lib/sfl/confidentialite.server";
import { dansCombien, jourDeParis } from "@/lib/sfl/photo-studio";
import { libelleCouleur, lireBlason } from "@/lib/sfl/blason";

export const maxDuration = 120;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

const MODELE = process.env.FAL_MODEL_COUVERTURE ?? process.env.FAL_MODEL_STUDIO ?? "bytedance/seedream/v5/pro/edit";
/** Recopiée dans la base (equipe_couverture_credit) : les changer ensemble. */
const LIMITE_JOUR = 2;
const JOUEURS_MIN = 2;
const JOUEURS_MAX = 7;
/** Un PNG peint par l'app, au plus ~2 Mo une fois décodé. */
const IMAGE_MAX = 2_800_000;

type Credit = { restantes: number; fin: string };

function erreur(message: string, status: number, credit?: Credit) {
  return NextResponse.json({ error: message, ...credit }, { status });
}

const estPng = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/png;base64,") && v.length <= IMAGE_MAX;

/** La clé Storage d'une photo de carte : le nom en hexadécimal UTF-8 (lib/sfl/photos.ts). */
const cleStorage = (nom: string) => Buffer.from(nom, "utf8").toString("hex") + ".jpg";

function prompt(n: number, nom: string, ville: string | null, couleurs: string): string {
  return [
    `Cinematic team photo of the amateur five-a-side football club "${nom}"${ville ? ` from ${ville}, France` : ""}, made as the cover image of the club's page.`,
    `The first ${n} images are portraits of the club's ${n} players, one person per image. Show exactly these ${n} people, every one of them, each instantly recognisable: same face, skin tone, hairstyle, facial hair, build and age. Nobody else.`,
    `Image ${n + 1} is the club's jersey, seen from the front: every player wears exactly this jersey, same colours (${couleurs}), same pattern, same collar and cuffs, with the BOLA wordmark on the wearer's right chest and the club crest on the wearer's left chest.`,
    `Image ${n + 2} is the club crest: reproduce it faithfully on every jersey.`,
    "They stand together as a team, proud and confident, on an outdoor artificial-turf five-a-side pitch at dusk, floodlights glowing, a light haze; some arms crossed, some hands on a teammate's shoulder, a football at the feet of the player in the middle.",
    "Wide 16:9 composition, the players framed from the knees up across the centre of the frame, faces sharp and well lit, the top of the image kept calm.",
    "Photorealistic sports photography, 35 mm lens, natural skin texture, rich colour grade, high-end club media-day quality.",
    "No text, no numbers, no sponsor, no watermark, no other people.",
  ].join(" ");
}

/** L'image rendue par fal, en data URL (fal peut rendre une data URL ou un lien). */
async function enDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`image fal ${r.status}`);
  const type = r.headers.get("content-type") ?? "image/jpeg";
  return `data:${type};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const cle = process.env.FAL_KEY;
  if (!cle) return erreur("La couverture n'est pas encore branchée.", 503);

  const corps = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    equipe?: unknown;
    maillot?: unknown;
    ecusson?: unknown;
  };
  if (!corps.accessToken) return erreur("Session requise.", 401);
  const e = corps.equipe;
  if (typeof e !== "number" || !Number.isSafeInteger(e) || e <= 0) return erreur("Équipe inconnue.", 400);
  if (!estPng(corps.maillot) || !estPng(corps.ecusson)) return erreur("Maillot ou écusson manquant.", 400);

  // L'appelant : un joueur accepté, avec ses propres droits (RLS).
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${corps.accessToken}` } },
  });
  const { data: auth, error: authError } = await sb.auth.getUser(corps.accessToken);
  if (authError || !auth.user) return erreur("Session invalide.", 401);
  const moi = auth.user.id;

  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi).maybeSingle();
  if (!profil?.valide) return erreur("Ton compte attend d'être accepté.", 403);
  if (!(await accordEnregistre(sb, moi))) return erreur(SANS_ACCORD, 403);

  const [{ data: equipe }, { data: lignes, error: lignesError }] = await Promise.all([
    sb.from("equipes").select("nom, ville, blason, dissoute_le").eq("id", e).maybeSingle(),
    sb
      .from("equipe_membres")
      .select("joueur, role, reglement_version, p:profiles!equipe_membres_joueur_fkey(name)")
      .eq("equipe_id", e)
      .eq("statut", "membre"),
  ]);
  if (!equipe || equipe.dissoute_le) return erreur("Équipe introuvable.", 404);
  if (lignesError) return erreur("Couverture indisponible pour l'instant.", 503);
  const membres = (lignes ?? []) as unknown as {
    joueur: string;
    role: "capitaine" | "vice" | "membre";
    reglement_version: string | null;
    p: { name: string } | { name: string }[] | null;
  }[];
  if (!membres.some((m) => m.joueur === moi && m.role !== "membre")) return erreur("Réservé au capitaine et au vice.", 403);

  // Les joueurs sur l'image : signataires de la version 2, avec une photo de carte ; le capitaine d'abord.
  const rang = { capitaine: 0, vice: 1, membre: 2 } as const;
  const candidats = membres
    .filter((m) => m.reglement_version === "v2")
    .sort((a, b) => rang[a.role] - rang[b.role])
    .map((m) => (Array.isArray(m.p) ? m.p[0]?.name : m.p?.name) ?? "")
    .filter(Boolean);
  const photos = (
    await Promise.all(
      candidats.map(async (nom) => {
        const url = `${SUPABASE_URL}/storage/v1/object/public/photos/${cleStorage(nom)}`;
        const r = await fetch(url, { method: "HEAD" }).catch(() => null);
        return r?.ok ? `${url}?v=${Date.parse(r.headers.get("last-modified") ?? "") || 0}` : null;
      })
    )
  )
    .filter((u): u is string => !!u)
    .slice(0, JOUEURS_MAX);
  if (photos.length < JOUEURS_MIN) return erreur("Il faut au moins deux joueurs avec leur photo de carte.", 400);

  // Le crédit de l'équipe : LIMITE_JOUR couvertures depuis minuit, heure de Paris.
  const { debut, fin } = jourDeParis();
  const plusTard = () =>
    erreur(
      `Les ${LIMITE_JOUR} couvertures du jour sont faites. De nouveau ${LIMITE_JOUR} dans ${dansCombien(fin.getTime() - Date.now())}.`,
      429,
      { restantes: 0, fin: fin.toISOString() }
    );
  const { count, error: compteError } = await sb
    .from("equipe_couvertures")
    .select("id", { count: "exact", head: true })
    .eq("equipe_id", e)
    .gte("created_at", debut.toISOString());
  if (compteError) return erreur("Couverture indisponible pour l'instant.", 503);
  const faites = count ?? 0;
  if (faites >= LIMITE_JOUR) return plusTard();
  const credit: Credit = { restantes: LIMITE_JOUR - faites - 1, fin: fin.toISOString() };
  const { error: noteError } = await sb.from("equipe_couvertures").insert({ equipe_id: e });
  if (noteError?.hint === "credit-du-jour") return plusTard();
  if (noteError) return erreur("Couverture indisponible pour l'instant.", 503);

  const blason = lireBlason(equipe.blason);
  const couleurs = blason
    ? blason.couleurs.map((c) => libelleCouleur(c).toLowerCase()).join(", ")
    : "black and white";

  try {
    const r = await fetch(`https://fal.run/${MODELE}`, {
      method: "POST",
      headers: { Authorization: `Key ${cle}`, "Content-Type": "application/json", "X-Fal-Store-IO": "0" },
      body: JSON.stringify({
        prompt: prompt(photos.length, equipe.nom as string, (equipe.ville as string | null) ?? null, couleurs),
        image_urls: [...photos, corps.maillot, corps.ecusson],
        num_images: 1,
        image_size: { width: 2048, height: 1152 },
        output_format: "jpeg",
        sync_mode: true,
      }),
    });
    if (!r.ok) {
      console.error("[couverture] fal", r.status, (await r.text()).slice(0, 500));
      return erreur("La couverture n'a pas pu être faite. Réessaie.", 502, credit);
    }
    const sortie = (await r.json()) as { images?: { url?: string }[] };
    const url = sortie.images?.[0]?.url;
    if (!url) return erreur("La couverture n'a pas pu être faite. Réessaie.", 502, credit);
    return NextResponse.json({ image: await enDataUrl(url), joueurs: photos.length, ...credit });
  } catch (err) {
    console.error("[couverture]", err);
    return erreur("La couverture n'a pas pu être faite. Réessaie.", 502, credit);
  }
}
