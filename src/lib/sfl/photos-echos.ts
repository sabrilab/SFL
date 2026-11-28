// Les photos de journée comme sur un réseau social (Bola, 28/11/2026 :
// « qu'on puisse réagir à la photo, mettre un j'aime, mettre un commentaire,
// et qu'on puisse la partager aussi »). Le j'aime, les commentaires et leur
// temps réel sont ceux des vidéos des Actus (useEchos(cle, "photo"), tables
// photo_reactions et photo_commentaires) ; ici, la clé d'une photo, les
// compteurs du fil (une lecture pour toutes les photos d'un dimanche), et le
// partage : le lien public (app/photo/[cle]) et l'image en story ou en
// publication (photo-export.ts), seulement si la photo peut sortir de l'app
// (photo_peut_sortir : chacun de ses joueurs a accepté l'usage hors de l'app
// et n'a pas mis ses photos en privé).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { codeValide, monCode, normaliserCode } from "@/lib/sfl/parrainage";
import { JAIME } from "@/lib/sfl/videos";
import { cleDePhoto, type PhotoJournee } from "@/lib/sfl/photos-journees";

export { cleDePhoto };


/** Les compteurs d'une photo dans le fil. */
export interface Compteurs {
  jaimes: number;
  commentaires: number;
  /** Mon j'aime est posé. */
  moi: boolean;
}

export const SANS_ECHO: Compteurs = { jaimes: 0, commentaires: 0, moi: false };

/** Les j'aime et les commentaires de plusieurs photos, en deux lectures. */
export async function lireCompteurs(cles: string[]): Promise<Map<string, Compteurs>> {
  const m = new Map<string, Compteurs>();
  if (cles.length === 0) return m;
  const sb = supabase();
  const [{ data: s }, r, c] = await Promise.all([
    sb.auth.getSession(),
    sb.from("photo_reactions").select("photo, joueur").eq("emoji", JAIME).in("photo", cles),
    sb.from("photo_commentaires").select("photo").in("photo", cles).limit(5000),
  ]);
  if (r.error || c.error) return m;
  const moi = s.session?.user.id ?? null;
  const de = (cle: string) => m.get(cle) ?? { ...SANS_ECHO };
  for (const x of (r.data ?? []) as { photo: string; joueur: string }[]) {
    const e = de(x.photo);
    m.set(x.photo, { ...e, jaimes: e.jaimes + 1, moi: e.moi || x.joueur === moi });
  }
  for (const x of (c.data ?? []) as { photo: string }[]) {
    const e = de(x.photo);
    m.set(x.photo, { ...e, commentaires: e.commentaires + 1 });
  }
  return m;
}

/** Peut-elle sortir de l'app (le lien public, la story, la publication) ? */
export async function peutSortir(p: PhotoJournee): Promise<boolean> {
  const { data, error } = await supabase().rpc("photo_peut_sortir", { noms: p.joueurs });
  return !error && data === true;
}

export function adressePhoto(cle: string, code?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_ADRESSE || window.location.origin).replace(/\/+$/, "");
  return `${base}/photo/${cle}${code ? `?de=${encodeURIComponent(code)}` : ""}`;
}

/** Le lien de la photo, avec mon code de parrain : qui crée son compte depuis ce lien arrive par moi. */
export async function lienDePhoto(cle: string): Promise<string> {
  const code = await monCode(getSession()?.user ?? null).catch(() => null);
  const n = code ? normaliserCode(code) : null;
  return adressePhoto(cle, n && codeValide(n) ? n : null);
}

export type FormatPartage = "lien" | "story" | "publication";

export function noterPartage(cle: string, format: FormatPartage): void {
  void supabase()
    .rpc("photo_partage", { p: cle, f: format })
    .then(
      () => {},
      () => {}
    );
}
