"use client";

// Les vidéos de Bola, côté admin (sous Activité & rétention ;
// lib/sfl/videos.ts). Deux choses :
//
//   · les poser : choisir le fichier (50 Mo au plus), un titre, une légende.
//     L'image d'attente est prise dans la vidéo elle-même. Le tout part dans
//     le bucket privé, en brouillon : « Voir » l'ouvre dans le vrai lecteur,
//     « Publier » la met en tête des Actus, « Retirer » l'en enlève (rien
//     n'est effacé). « Prévenir » envoie une notification à toute l'app,
//     dont le texte exact est lu avant (/api/videos/annoncer) ;
//   · les lire : vue par combien de joueurs, combien de lectures, jusqu'où,
//     les réactions, les commentaires, les partages, puis le lien hors de
//     l'app (ouvert, puis vers l'app : se connecter ou créer son compte), et
//     qui l'a vue. Le public suit le choix du haut de la page (Joueurs par
//     défaut).
//
// Les sources, lues par l'admin seul (RLS) : videos (brouillons compris),
// video_vues, video_reactions, video_commentaires, video_partages,
// video_liens.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isAdmin } from "@/lib/sfl/admin";
import { erreurSansTable } from "@/lib/sfl/consentement";
import { BUCKET_VIDEOS, EMOJIS_VIDEO, type Video } from "@/lib/sfl/videos";
import { texteAnnonceVideo } from "@/lib/sfl/videos-annonce";
import { supabase } from "@/lib/supabase";
import { LecteurVideo } from "@/components/sfl/actus/video";

const PAGE = 1000;
/** La limite du projet Supabase pour un fichier. */
const MAX_OCTETS = 50 * 1024 * 1024;

interface Vue {
  video: string;
  nom: string;
  premiere: number;
  fois: number;
  vu_s: number;
  fini: boolean;
}

interface Donnees {
  videos: Video[];
  vues: Vue[];
  reactions: { video: string; nom: string; emoji: string }[];
  commentaires: { video: string; nom: string }[];
  partages: { video: string; nom: string }[];
  liens: { video: string; etape: "ouvert" | "app"; de: string | null }[];
  membres: string[];
}

function Tuile({ label, valeur }: { label: string; valeur: number | string }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-[8.5px] text-foreground/45">{label}</p>
      <div className="mt-1.5 text-[24px] leading-none font-extrabold tabular-nums">{valeur}</div>
    </div>
  );
}

async function toutLire<T>(lire: (debut: number) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>) {
  const lu: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await lire(debut);
    if (error) return { lu, error };
    lu.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { lu, error: null };
  }
}

type AvecNom = { profiles: { name: string } | { name: string }[] | null };
const nomDe = (r: AvecNom) => (Array.isArray(r.profiles) ? r.profiles[0]?.name : r.profiles?.name) ?? "?";

/** Le nom d'une vidéo dans l'adresse (/v/<id>) : tiré du titre. */
function idDepuis(titre: string): string {
  return (
    titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "video"
  );
}

/** Durée, dimensions et une image (à 1,5 s, ou au tiers d'une vidéo courte) du fichier choisi. */
async function lireFichier(f: File): Promise<{ duree: number; largeur: number; hauteur: number; affiche: Blob | null }> {
  const url = URL.createObjectURL(f);
  try {
    const el = document.createElement("video");
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.src = url;
    await new Promise<void>((ok, ko) => {
      el.onloadedmetadata = () => ok();
      el.onerror = () => ko(new Error("Fichier illisible."));
    });
    const { duration: duree, videoWidth: largeur, videoHeight: hauteur } = el;
    el.currentTime = Math.min(1.5, duree / 3);
    await new Promise<void>((ok) => {
      el.onseeked = () => ok();
      setTimeout(ok, 4000);
    });
    let affiche: Blob | null = null;
    try {
      const c = document.createElement("canvas");
      const k = Math.min(1, 1080 / Math.max(1, largeur));
      c.width = Math.round(largeur * k);
      c.height = Math.round(hauteur * k);
      c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
      affiche = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    } catch {}
    return { duree, largeur, hauteur, affiche };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function VideosStats({
  public: public_ = "joueurs",
  admins,
}: {
  public?: "joueurs" | "admins" | "tous";
  admins?: ReadonlySet<string>;
} = {}) {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [voir, setVoir] = useState<Video | null>(null);
  const [annonce, setAnnonce] = useState<Video | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [toute, setToute] = useState(false);

  const lire = useCallback(async () => {
    const sb = supabase();
    const { data: videos, error } = await sb
      .from("videos")
      .select("id, titre, legende, fichier, affiche, largeur, hauteur, duree, publiee_le, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setErreur(erreurSansTable(error.code) ? "Les vidéos arrivent avec la prochaine mise en ligne." : error.message);
      return;
    }
    const [vues, reactions, commentaires, partages, liens, membres] = await Promise.all([
      toutLire<{ video: string; premiere: string; fois: number; vu_s: number; fini: boolean } & AvecNom>((debut) =>
        sb.from("video_vues").select("video, premiere, fois, vu_s, fini, profiles ( name )").range(debut, debut + PAGE - 1)
      ),
      toutLire<{ video: string; emoji: string } & AvecNom>((debut) =>
        sb.from("video_reactions").select("video, emoji, profiles ( name )").range(debut, debut + PAGE - 1)
      ),
      toutLire<{ video: string } & AvecNom>((debut) =>
        sb.from("video_commentaires").select("video, profiles ( name )").range(debut, debut + PAGE - 1)
      ),
      toutLire<{ video: string } & AvecNom>((debut) =>
        sb.from("video_partages").select("video, profiles ( name )").range(debut, debut + PAGE - 1)
      ),
      toutLire<{ video: string; etape: "ouvert" | "app"; de: string | null }>((debut) =>
        sb.from("video_liens").select("video, etape, de").range(debut, debut + PAGE - 1)
      ),
      toutLire<{ name: string }>((debut) => sb.from("profiles").select("name").eq("valide", true).range(debut, debut + PAGE - 1)),
    ]);
    setErreur(null);
    setD({
      videos: (videos ?? []) as Video[],
      vues: vues.lu.map((r) => ({
        video: r.video,
        nom: nomDe(r),
        premiere: Date.parse(r.premiere),
        fois: r.fois,
        vu_s: Number(r.vu_s),
        fini: r.fini,
      })),
      reactions: reactions.lu.map((r) => ({ video: r.video, nom: nomDe(r), emoji: r.emoji })),
      commentaires: commentaires.lu.map((r) => ({ video: r.video, nom: nomDe(r) })),
      partages: partages.lu.map((r) => ({ video: r.video, nom: nomDe(r) })),
      liens: liens.lu,
      membres: membres.lu.map((m) => m.name),
    });
  }, []);

  useEffect(() => {
    Promise.resolve().then(lire);
  }, [lire]);

  const estAdmin = useCallback((nom: string) => (admins ? admins.has(nom) : isAdmin(nom)), [admins]);
  const garde = useCallback(
    (nom: string) => (public_ === "tous" ? true : public_ === "admins" ? estAdmin(nom) : !estAdmin(nom)),
    [public_, estAdmin]
  );

  const id = choisie ?? d?.videos.find((v) => v.publiee_le)?.id ?? d?.videos[0]?.id ?? null;
  const a = useMemo(() => {
    if (!d || !id) return null;
    const v = d.videos.find((x) => x.id === id);
    if (!v) return null;
    const vues = d.vues.filter((x) => x.video === id && garde(x.nom)).sort((x, y) => y.premiere - x.premiere);
    const duree = v.duree ?? 0;
    const part = (x: Vue) => (duree > 0 ? Math.min(1, x.vu_s / duree) : x.fini ? 1 : 0);
    const reactions = d.reactions.filter((x) => x.video === id && garde(x.nom));
    const liens = d.liens.filter((x) => x.video === id);
    const partages = d.partages.filter((x) => x.video === id && garde(x.nom));
    const membres = d.membres.filter(garde);
    const ontVu = new Set(vues.map((x) => x.nom));
    return {
      v,
      vues,
      part,
      joueurs: vues.length,
      lectures: vues.reduce((s, x) => s + x.fois, 0),
      finies: vues.filter((x) => x.fini).length,
      moyenne: vues.length ? vues.reduce((s, x) => s + part(x), 0) / vues.length : 0,
      reactions: EMOJIS_VIDEO.map((e) => ({ e, n: reactions.filter((x) => x.emoji === e).length })),
      commentaires: d.commentaires.filter((x) => x.video === id && garde(x.nom)).length,
      partages: partages.length,
      partageurs: new Set(partages.map((x) => x.nom)).size,
      ouverts: liens.filter((x) => x.etape === "ouvert").length,
      versApp: liens.filter((x) => x.etape === "app").length,
      pasVue: membres.filter((n) => !ontVu.has(n)).length,
      membres: membres.length,
    };
  }, [d, id, garde]);

  async function publier(v: Video, oui: boolean) {
    setOccupe(v.id);
    try {
      const { error } = await supabase()
        .from("videos")
        .update({ publiee_le: oui ? new Date().toISOString() : null })
        .eq("id", v.id);
      if (error) toast.error(error.message);
      else toast.success(oui ? "En ligne, en tête des Actus." : "Retirée des Actus.");
      await lire();
    } finally {
      setOccupe(null);
    }
  }

  async function prevenir(v: Video) {
    setOccupe(v.id);
    try {
      const { data } = await supabase().auth.getSession();
      const r = await fetch("/api/videos/annoncer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ video: v.id }),
      });
      const j = (await r.json().catch(() => ({}))) as { envoyes?: number; deja?: number; error?: string };
      if (!r.ok) toast.error(j.error ?? "Refusé par le serveur.");
      else toast.success(`Notification reçue par ${j.envoyes ?? 0} joueur${(j.envoyes ?? 0) > 1 ? "s" : ""}${j.deja ? ` (${j.deja} l'avaient déjà)` : ""}.`);
      setAnnonce(null);
    } finally {
      setOccupe(null);
    }
  }

  const pct = (x: number) => `${Math.round(x * 100)} %`;

  return (
    <section id="activite-videos" className="glass scroll-mt-16 rounded-3xl p-5">
      <h2 className="text-[17px] font-bold tracking-tight">Vidéos</h2>
      <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">
        Elles ne se regardent que dans l&apos;app. Qui les voit, jusqu&apos;où, ce qu&apos;ils en disent, et où va le lien.
      </p>
      {erreur && <p className="mt-3 text-[12.5px] text-foreground/55">{erreur}</p>}

      {d && !erreur && (
        <div className="mt-4 flex flex-col gap-5">
          {d.videos.length > 0 && (
            <div className="flex flex-col">
              {d.videos.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-foreground/8 py-2.5 first:border-t-0">
                  <button type="button" onClick={() => setChoisie(v.id)} className="min-w-[60%] flex-1 text-left">
                    <span className={`block truncate text-[14px] font-semibold ${v.id === id ? "" : "text-foreground/70"}`}>{v.titre}</span>
                    <span className="block truncate font-mono text-[11px] text-foreground/45">
                      {v.publiee_le
                        ? `en ligne depuis le ${new Date(v.publiee_le).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                        : "brouillon"}
                      {` · /v/${v.id}`}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => setVoir(v)} className="bouton-secondaire px-3 py-1.5 text-[12px] font-semibold">
                      Voir
                    </button>
                    {v.publiee_le ? (
                      <>
                        <button
                          type="button"
                          disabled={occupe === v.id}
                          onClick={() => setAnnonce(annonce?.id === v.id ? null : v)}
                          className="bouton-secondaire px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                        >
                          Prévenir
                        </button>
                        <button
                          type="button"
                          disabled={occupe === v.id}
                          onClick={() => void publier(v, false)}
                          className="bouton-discret bouton--rouge px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={occupe === v.id}
                        onClick={() => void publier(v, true)}
                        className="bouton-principal bouton--vert px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                      >
                        Publier
                      </button>
                    )}
                  </div>
                  {annonce?.id === v.id && (
                    <div className="w-full rounded-2xl bg-foreground/[0.04] p-3.5 ring-1 ring-foreground/10">
                      <p className="mono-label text-[8.5px] text-foreground/45">La notification, à toute l&apos;app</p>
                      <p className="mt-1.5 text-[14px] font-semibold">{texteAnnonceVideo(v).titre}</p>
                      <p className="text-[13px] text-foreground/65">{texteAnnonceVideo(v).texte}</p>
                      <button
                        type="button"
                        disabled={occupe === v.id}
                        onClick={() => void prevenir(v)}
                        className="bouton-principal bouton--vert mt-3 px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
                      >
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {a && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Tuile label="Vue par" valeur={a.joueurs} />
                <Tuile label="Lectures" valeur={a.lectures} />
                <Tuile label="Jusqu'au bout" valeur={a.joueurs ? pct(a.finies / a.joueurs) : "–"} />
                <Tuile label="Regardée" valeur={a.joueurs ? pct(a.moyenne) : "–"} />
              </div>
              <p className="-mt-2 text-[12.5px] leading-snug text-foreground/55">
                {a.joueurs === 0
                  ? "Personne ne l'a encore vue."
                  : `${a.joueurs} sur ${a.membres} comptes l'ont vue ; ${a.pasVue} pas encore. En moyenne, ils en regardent ${pct(a.moyenne)}.`}
              </p>

              <div className="flex flex-col gap-1.5 text-[12.5px] text-foreground/70">
                <p>
                  <span className="mono-label mr-2 text-[8.5px] text-foreground/45">Réactions</span>
                  {a.reactions.map((r) => `${r.e} ${r.n}`).join("  ·  ")}
                </p>
                <p>
                  <span className="mono-label mr-2 text-[8.5px] text-foreground/45">Commentaires</span>
                  {a.commentaires}
                </p>
                <p>
                  <span className="mono-label mr-2 text-[8.5px] text-foreground/45">Lien</span>
                  {`partagé ${a.partages} fois par ${a.partageurs} · ouvert hors de l'app ${a.ouverts} · vers l'app ${a.versApp}`}
                </p>
              </div>

              {a.vues.length > 0 && (
                <div>
                  <p className="mono-label mb-1 text-[8.5px] text-foreground/45">Qui l&apos;a vue</p>
                  <div className="flex flex-col">
                    {a.vues.slice(0, toute ? undefined : 8).map((x) => (
                      <div key={x.nom} className="flex items-center gap-3 border-t border-foreground/8 py-1.5 first:border-t-0">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{x.nom}</span>
                        <span className="font-mono text-[11px] text-foreground/45">
                          {new Date(x.premiere).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="w-[44px] text-right text-[12px] font-bold tabular-nums">{x.fini ? "fin" : pct(a.part(x))}</span>
                        <span className="w-[26px] text-right text-[12px] text-foreground/45 tabular-nums">×{x.fois}</span>
                      </div>
                    ))}
                  </div>
                  {a.vues.length > 8 && (
                    <button type="button" onClick={() => setToute(!toute)} className="bouton-discret mt-1 px-0 py-1.5 text-[12.5px] font-semibold">
                      {toute ? "Moins" : `Les ${a.vues.length}`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          <NouvelleVideo existantes={d.videos.map((v) => v.id)} apres={lire} />
        </div>
      )}
      {voir && <LecteurVideo v={voir} commentaires={false} onFermer={() => setVoir(null)} />}
    </section>
  );
}

/** Poser une vidéo : le fichier, un titre, une légende ; elle part en brouillon. */
function NouvelleVideo({ existantes, apres }: { existantes: string[]; apres: () => Promise<void> }) {
  const [ouvert, setOuvert] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [legende, setLegende] = useState("");
  const [etat, setEtat] = useState<string | null>(null);
  const id = idDepuis(titre);
  const pris = existantes.includes(id);
  const trop = !!fichier && fichier.size > MAX_OCTETS;

  async function envoyer() {
    if (!fichier || !titre.trim() || trop) return;
    const sb = supabase();
    try {
      setEtat("Lecture du fichier…");
      const meta = await lireFichier(fichier);
      const ext = fichier.type === "video/webm" ? "webm" : fichier.type === "video/quicktime" ? "mov" : "mp4";
      const chemin = `${id}/video.${ext}`;
      setEtat(`Envoi de la vidéo (${Math.round(fichier.size / 1e6)} Mo)…`);
      const up = await sb.storage.from(BUCKET_VIDEOS).upload(chemin, fichier, { upsert: true, contentType: fichier.type || "video/mp4" });
      if (up.error) throw up.error;
      let affiche: string | null = null;
      if (meta.affiche) {
        setEtat("Envoi de l'image d'attente…");
        const a = await sb.storage.from(BUCKET_VIDEOS).upload(`${id}/affiche.jpg`, meta.affiche, { upsert: true, contentType: "image/jpeg" });
        if (!a.error) affiche = `${id}/affiche.jpg`;
      }
      const ligne = {
        id,
        titre: titre.trim().slice(0, 80),
        legende: legende.trim().slice(0, 200) || null,
        fichier: chemin,
        affiche,
        largeur: meta.largeur || null,
        hauteur: meta.hauteur || null,
        duree: Number.isFinite(meta.duree) ? Math.round(meta.duree * 10) / 10 : null,
      };
      const { error } = pris ? await sb.from("videos").update(ligne).eq("id", id) : await sb.from("videos").insert(ligne);
      if (error) throw error;
      toast.success(pris ? "Vidéo remplacée." : "Vidéo posée, en brouillon.");
      setFichier(null);
      setTitre("");
      setLegende("");
      setOuvert(false);
      await apres();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setEtat(null);
    }
  }

  if (!ouvert)
    return (
      <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire self-start px-4 py-2 text-[13px] font-semibold">
        Poser une vidéo
      </button>
    );
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-foreground/[0.04] p-3.5 ring-1 ring-foreground/10">
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
        className="text-[13px] file:mr-3 file:rounded-full file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-foreground"
      />
      {trop && <p className="text-[12.5px] text-foreground/60">Plus de 50 Mo : il faut une version plus légère (720p).</p>}
      <input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        maxLength={80}
        placeholder="Titre"
        className="h-10 rounded-xl bg-background px-3 text-[14px] ring-1 ring-foreground/12 outline-none focus:ring-foreground/30"
      />
      <input
        value={legende}
        onChange={(e) => setLegende(e.target.value)}
        maxLength={200}
        placeholder="Légende"
        className="h-10 rounded-xl bg-background px-3 text-[14px] ring-1 ring-foreground/12 outline-none focus:ring-foreground/30"
      />
      {titre.trim() && (
        <p className="font-mono text-[11px] text-foreground/45">
          {`/v/${id}`}
          {pris && " · remplace la vidéo de ce nom"}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!fichier || !titre.trim() || trop || !!etat}
          onClick={() => void envoyer()}
          className="bouton-principal bouton--vert px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
        >
          Envoyer en brouillon
        </button>
        <button type="button" disabled={!!etat} onClick={() => setOuvert(false)} className="bouton-discret px-3 py-2 text-[13px] font-semibold">
          Annuler
        </button>
      </div>
      {etat && <p className="text-[12.5px] text-foreground/55">{etat}</p>}
    </div>
  );
}
