"use client";

// La page publique getbola.app/club : Bola Club présenté à un club amateur
// (27/11/2026). C'est le lien de la campagne de mails vers les clubs
// francophones : on y arrive depuis un mail, souvent sur ordinateur, sans
// rien savoir de Bola. La page dit ce que le club reçoit, avec de vraies
// captures du club de démonstration, puis recueille une demande de démo.
//
// De haut en bas : la barre (le logo, « Demander une démo »), le haut
// (« Votre club. Une carte par licencié. », les deux boutons, l'effectif du
// club en cartes), quatre sections (actus, jour du match, progression,
// licences), chacune une phrase et sa capture dans un téléphone, les quatre
// vues (admin, entraîneur, joueur, parent), le formulaire, le pied de page.
//
// Les textes et les règles du formulaire sont dans lib/sfl/page-club.ts ;
// l'envoi va à app/api/clubs/route.ts. La page ne lit ni la base ni le joueur
// connecté : elle est la même pour tous.
//
// Ouverte à tous (lib/sfl/routes-publiques.ts, estPageClub, l'adresse
// entière), plein écran au-dessus de la barre d'onglets comme /sfl : c'est le
// cadre qui défile (overflow-y-auto, exigé par ViewportLock), il force le
// français de gauche à droite. Le thème de l'app, clair ou sombre : rien que
// des jetons ; les captures sont celles de l'app en sombre, posées dans un
// téléphone noir, le même dans les deux modes.
//
// Deux mises en page : une colonne sur téléphone (20 px de marge, 600 px au
// centre d'une tablette), et dès 960 px le texte et le téléphone côte à côte,
// en alternance. Mouvement : chaque section monte de 12 px en fondu une fois,
// rien avec « Réduire les animations ».

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, Check, Loader2 } from "lucide-react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import {
  ANCRE_DEMANDE,
  type CaptureClub,
  CHIFFRES_CLUB,
  JOUEURS_CLUB,
  MANIFESTE_CLUB,
  ORDINATEUR_CLUB,
  type JoueurClub,
  FORMULAIRE_CLUB,
  HAUT_CLUB,
  PAYS,
  ROLES_CLUB,
  ROLES_CONTACT,
  SECTIONS_CLUB,
  TAILLES,
  erreurDemande,
  nettoyerDemande,
  sourceDemande,
  type DemandeClub,
} from "@/lib/sfl/page-club";
import { cn } from "@/lib/utils";
import "./page-club.css";

const BARRE = 56;
const COLONNE = "mx-auto w-full px-5 min-[720px]:max-w-[600px] min-[960px]:max-w-[1120px] min-[960px]:px-10";
const ANNEAU = "outline-offset-4 focus-visible:outline-2 focus-visible:outline-foreground";
const APPARAIT =
  "transition-[opacity,translate] duration-[400ms] ease-out data-[cache]:translate-y-3 data-[cache]:opacity-0 motion-reduce:transition-none";
const SAISIE =
  "h-12 w-full rounded-champ bg-foreground/[0.06] px-4 text-lecture font-semibold outline-none placeholder:text-foreground/25 focus:bg-foreground/[0.09] focus-visible:ring-2 focus-visible:ring-foreground/40 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#ff5a4c]";

/** Une capture de l'app, dans un téléphone noir. */
function Telephone({ capture, className, vite }: { capture: CaptureClub; className?: string; vite?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-[42px] bg-[#0b0b0d] p-[9px] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_30px_60px_-20px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {/* Une image déjà à sa taille (WebP, 2 px par px affiché) : l'optimiseur de Next n'y ajouterait rien. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={capture.src}
        alt={capture.lue}
        width={capture.largeur}
        height={capture.hauteur}
        loading={vite ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="block h-auto w-full rounded-[33px] select-none"
      />
    </div>
  );
}

/** Une capture de l'app sur ordinateur, dans un portable : l'écran noir, puis le socle. */
function Portable({ capture }: { capture: CaptureClub }) {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-[4%]">
      <div className="rounded-t-[16px] bg-[#16171a] p-[8px] pb-[12px] shadow-[0_0_0_1px_rgba(255,255,255,0.08)] min-[960px]:rounded-t-[24px] min-[960px]:p-[14px] min-[960px]:pb-[20px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={capture.src}
          alt={capture.lue}
          width={capture.largeur}
          height={capture.hauteur}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="block h-auto w-full rounded-[4px] select-none min-[960px]:rounded-[8px]"
        />
      </div>
      <div className="relative mx-[-4%] h-[10px] rounded-b-[14px] bg-gradient-to-b from-[#3a3b3f] to-[#161719] min-[960px]:h-[16px]">
        <div className="absolute top-0 left-1/2 h-[4px] w-[16%] -translate-x-1/2 rounded-b-[6px] bg-[#0e0f11]" />
      </div>
    </div>
  );
}

/** Les quatre cartes : un onglet par rôle, la carte dans le téléphone. */
function Roles() {
  const [actif, setActif] = useState<string>(ROLES_CLUB.roles[0].id);
  const role = ROLES_CLUB.roles.find((r) => r.id === actif) ?? ROLES_CLUB.roles[0];
  return (
    <div className="grid items-center gap-12 min-[960px]:grid-cols-2 min-[960px]:gap-24">
      <div className="text-center min-[960px]:text-left">
        <p className="text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">{ROLES_CLUB.etiquette}</p>
        <h2 className="club-titre mt-4 text-[clamp(30px,7.6vw,54px)] leading-[1.02] text-balance">{ROLES_CLUB.titre}</h2>
        <div
          role="tablist"
          aria-label={ROLES_CLUB.etiquette}
          className="mt-8 flex flex-wrap justify-center gap-2 min-[960px]:mt-10 min-[960px]:block min-[960px]:divide-y min-[960px]:divide-white/[0.08] min-[960px]:border-y min-[960px]:border-white/[0.08]"
        >
          {ROLES_CLUB.roles.map((r, i) => {
            const choisi = r.id === role.id;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={choisi}
                onClick={() => setActif(r.id)}
                className={cn(
                  "rounded-full px-4 py-2.5 text-ligne font-bold transition-[opacity,background-color] min-[960px]:flex min-[960px]:w-full min-[960px]:items-baseline min-[960px]:gap-5 min-[960px]:rounded-none min-[960px]:px-0 min-[960px]:py-5 min-[960px]:text-left",
                  ANNEAU,
                  choisi ? "bg-white text-black min-[960px]:bg-transparent min-[960px]:text-white" : "bg-white/[0.07] text-white/70 min-[960px]:bg-transparent min-[960px]:opacity-45 min-[960px]:hover:opacity-75"
                )}
              >
                <span className="hidden w-7 shrink-0 font-display text-titre-m text-white/40 min-[960px]:inline">{i + 1}</span>
                <span className="shrink-0 min-[960px]:w-40 min-[960px]:text-titre-m min-[960px]:font-extrabold min-[960px]:tracking-tight">{r.nom}</span>
                <span className="hidden text-lecture leading-snug font-semibold text-white/70 min-[960px]:inline">{r.phrase}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-[clamp(16px,4.4vw,20px)] leading-snug font-semibold text-white/60 min-[960px]:hidden">{role.phrase}</p>
      </div>
      <div className="relative" role="tabpanel" aria-label={role.nom}>
        <div aria-hidden className="absolute inset-[10%] rounded-full bg-[radial-gradient(closest-side,rgba(90,170,110,0.35),transparent)] blur-2xl" />
        <Telephone key={role.id} capture={role.carte} className="relative mx-auto w-[min(72vw,290px)] min-[960px]:w-[min(25vw,330px)]" />
      </div>
    </div>
  );
}

/** Une rangée de puces : un seul choix. */
function Puces<T extends string>({
  nom,
  champ,
  options,
  valeur,
  choisir,
  invalide,
}: {
  nom: string;
  champ: keyof DemandeClub;
  options: readonly { id: T; texte: string }[];
  valeur: T | "";
  choisir: (v: T) => void;
  invalide: boolean;
}) {
  return (
    <div role="radiogroup" data-champ={champ} aria-label={nom} aria-invalid={invalide || undefined} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const pris = o.id === valeur;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={pris}
            onClick={() => choisir(o.id)}
            className={cn(
              ANNEAU,
              "min-h-11 rounded-full px-4 text-ligne font-semibold transition-colors",
              pris ? "bg-foreground text-background" : "bg-foreground/[0.06] text-encre-2 hover:bg-foreground/[0.1]",
              invalide && !valeur && "ring-2 ring-[#ff5a4c]"
            )}
          >
            {o.texte}
          </button>
        );
      })}
    </div>
  );
}

function Champ({ label, facultatif, children }: { label: string; facultatif?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline gap-2 text-petit font-bold text-encre-2">
        {label}
        {facultatif && <span className="font-medium text-encre-3">{FORMULAIRE_CLUB.facultatif}</span>}
      </span>
      {children}
    </label>
  );
}

function Groupe({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-petit font-bold text-encre-2">{label}</p>
      {children}
    </div>
  );
}

const VIDE: DemandeClub = {
  club: "",
  ville: "",
  pays: "" as DemandeClub["pays"],
  licencies: "" as DemandeClub["licencies"],
  nom: "",
  role: "" as DemandeClub["role"],
  email: "",
  telephone: "",
  message: "",
};

function Formulaire() {
  const [d, setD] = useState<DemandeClub>(VIDE);
  const [piege, setPiege] = useState("");
  const [faute, setFaute] = useState<{ champ: keyof DemandeClub | null; texte: string } | null>(null);
  const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
  const F = FORMULAIRE_CLUB;
  const maj = <K extends keyof DemandeClub>(k: K, v: DemandeClub[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    if (faute?.champ === k) setFaute(null);
  };
  const invalide = (k: keyof DemandeClub) => faute?.champ === k;
  // Le champ fautif vient sous les yeux ; une saisie prend la main.
  const formulaire = useRef<HTMLFormElement>(null);
  const montrer = (k: keyof DemandeClub | null | undefined) => {
    const el = k ? formulaire.current?.querySelector<HTMLElement>(`[data-champ="${k}"]`) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: "auto", block: "center" });
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
  };

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (etat !== "saisie") return;
    const propre = nettoyerDemande(d);
    const erreur = erreurDemande(propre);
    if (erreur) {
      setFaute(erreur);
      montrer(erreur.champ);
      return;
    }
    setEtat("envoi");
    try {
      const r = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...propre, site: piege, source: sourceDemande(new URLSearchParams(window.location.search)) }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; champ?: keyof DemandeClub };
      if (!r.ok || !j.ok) {
        setFaute({ champ: j.champ ?? null, texte: j.error ?? "L’envoi n’est pas passé. Réessayez dans un instant." });
        montrer(j.champ);
        setEtat("saisie");
        return;
      }
      setEtat("envoye");
    } catch {
      setFaute({ champ: null, texte: "Pas de réseau. Réessayez dans un instant." });
      setEtat("saisie");
    }
  }

  if (etat === "envoye") {
    return (
      <div role="status" className="flex flex-col items-center py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="size-7" strokeWidth={2.5} aria-hidden />
        </span>
        <p className="club-titre mt-6 text-titre-l">{F.merci.titre}</p>
        <p className="mt-2 text-lecture font-semibold text-encre-2">{F.merci.phrase}</p>
      </div>
    );
  }

  return (
    <form ref={formulaire} noValidate onSubmit={envoyer} className="space-y-5">
      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <Champ label={F.champs.club}>
          <input className={SAISIE} value={d.club} data-champ="club" onChange={(e) => maj("club", e.target.value)} autoComplete="organization" maxLength={80} aria-invalid={invalide("club")} />
        </Champ>
        <Champ label={F.champs.ville}>
          <input className={SAISIE} value={d.ville} data-champ="ville" onChange={(e) => maj("ville", e.target.value)} autoComplete="address-level2" maxLength={60} aria-invalid={invalide("ville")} />
        </Champ>
      </div>
      <Groupe label={F.champs.pays}>
        <Puces nom={F.champs.pays} champ="pays" options={PAYS.map((p) => ({ id: p, texte: p }))} valeur={d.pays} choisir={(v) => maj("pays", v)} invalide={invalide("pays")} />
      </Groupe>
      <Groupe label={F.champs.licencies}>
        <Puces nom={F.champs.licencies} champ="licencies" options={TAILLES} valeur={d.licencies} choisir={(v) => maj("licencies", v)} invalide={invalide("licencies")} />
      </Groupe>
      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <Champ label={F.champs.nom}>
          <input className={SAISIE} value={d.nom} data-champ="nom" onChange={(e) => maj("nom", e.target.value)} autoComplete="name" maxLength={60} aria-invalid={invalide("nom")} />
        </Champ>
        <Champ label={F.champs.email}>
          <input className={SAISIE} type="email" inputMode="email" value={d.email} data-champ="email" onChange={(e) => maj("email", e.target.value)} autoComplete="email" maxLength={120} aria-invalid={invalide("email")} />
        </Champ>
      </div>
      <Groupe label={F.champs.role}>
        <Puces nom={F.champs.role} champ="role" options={ROLES_CONTACT.map((r) => ({ id: r, texte: r }))} valeur={d.role} choisir={(v) => maj("role", v)} invalide={invalide("role")} />
      </Groupe>
      <Champ label={F.champs.telephone} facultatif>
        <input className={SAISIE} type="tel" inputMode="tel" value={d.telephone} data-champ="telephone" onChange={(e) => maj("telephone", e.target.value)} autoComplete="tel" maxLength={20} aria-invalid={invalide("telephone")} />
      </Champ>
      <Champ label={F.champs.message} facultatif>
        <textarea
          className={cn(SAISIE, "h-28 resize-none py-3")}
          value={d.message}
          data-champ="message" onChange={(e) => maj("message", e.target.value)}
          maxLength={1000}
          aria-invalid={invalide("message")}
        />
      </Champ>
      {/* Champ piège : invisible, un humain ne le remplit jamais. */}
      <input
        tabIndex={-1}
        aria-hidden
        autoComplete="off"
        value={piege}
        onChange={(e) => setPiege(e.target.value)}
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div aria-live="polite" className="min-h-5 text-ligne font-semibold text-[#ff5a4c]">
        {faute?.texte}
      </div>
      <button
        type="submit"
        disabled={etat === "envoi"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#0b0b0b] py-4 text-lecture font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {etat === "envoi" && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {etat === "envoi" ? F.envoi : F.envoyer}
      </button>
      <p className="text-center text-petit font-medium text-encre-3">
        {F.confidentialite}{" "}
        <Link href="/confidentialite" className={cn(ANNEAU, "underline underline-offset-2")}>
          {F.lienConfidentialite}
        </Link>
      </p>
    </form>
  );
}

/** Une photo qui peut manquer : sans elle, rien ne casse (repli). */
function Photo({ src, lue, className, repli }: { src: string; lue: string; className?: string; repli: React.ReactNode }) {
  const [absente, setAbsente] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // Une erreur arrivée avant l'hydratation n'a pas d'écouteur : on la relit au montage.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setAbsente(true);
  }, []);
  if (absente) return <>{repli}</>;
  return (
    // Photos déjà à leur taille (WebP) : l'optimiseur de Next n'y ajouterait rien.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} src={src} alt={lue} loading="lazy" decoding="async" draggable={false} onError={() => setAbsente(true)} className={cn("select-none", className)} />
  );
}

/** La carte d'un joueur du haut : sa photo pleine, sa note, son prénom, sa catégorie. */
function CarteJoueur({ j, className, style }: { j: JoueurClub; className?: string; style?: React.CSSProperties }) {
  return (
    <figure
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-[20px] bg-[#111] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_40px_80px_-30px_rgba(0,0,0,0.7)]",
        className
      )}
      style={style}
    >
      <Photo
        src={j.photo}
        lue={j.lue}
        className="absolute inset-0 size-full object-cover"
        repli={
          <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${j.maillot} 0%, #0b0b0b 85%)` }}>
            <span className="absolute inset-x-0 top-[18%] text-center font-display text-[clamp(64px,9vw,120px)] leading-none text-white/25">{j.prenom[0]}</span>
          </div>
        }
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-[9%] text-white">
        <span className="min-w-0">
          <span className="club-titre block truncate text-[clamp(14px,1.4vw,19px)]">{j.prenom}</span>
          <span className="mt-0.5 block text-[clamp(9px,0.8vw,11px)] font-bold tracking-[0.14em] text-white/60 uppercase">
            {j.categorie} · {j.poste}
          </span>
        </span>
        <span className="font-display text-[clamp(28px,3vw,44px)] leading-[0.85]">{j.note}</span>
      </figcaption>
      <span aria-hidden className="absolute top-[7%] left-[8%] h-1 w-6 rounded-full" style={{ background: j.maillot }} />
    </figure>
  );
}

/**
 * L'essai des polices de titre (27/11) : Instrument Serif est retenue et posée
 * par défaut (app/club/page.tsx). ?police=2 à 4 essaie trois cousines
 * condensées, chargées de Google Fonts, le temps de choisir. Sans le
 * paramètre, rien n'est chargé de plus.
 */
const POLICES_ESSAI: readonly { nom: string; poids: number; css: string; reglage?: string }[] = [
  { nom: "Instrument Serif", poids: 400, css: "Instrument+Serif" },
  { nom: "Libre Caslon Condensed", poids: 400, css: "Libre+Caslon+Condensed:wght@400..700" },
  { nom: "Noto Serif Display", poids: 400, css: "Noto+Serif+Display:wdth,wght@62.5,300..500", reglage: '"wdth" 62.5' },
  { nom: "Playfair", poids: 400, css: "Playfair:opsz,wdth,wght@5..1200,87.5,300..500", reglage: '"wdth" 87.5, "opsz" 144' },
];

function useEssaiPolice(cadre: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("police"));
    const p = POLICES_ESSAI[n - 1];
    const el = cadre.current;
    if (!p || !el) return;
    const lien = document.createElement("link");
    lien.rel = "stylesheet";
    lien.href = `https://fonts.googleapis.com/css2?family=${p.css}&display=swap`;
    document.head.appendChild(lien);
    el.style.setProperty("--font-club-titre", `"${p.nom}"`);
    el.style.setProperty("--club-titre-poids", String(p.poids));
    if (p.reglage) el.style.setProperty("--club-titre-reglage", p.reglage);
    return () => lien.remove();
  }, [cadre]);
}

/** Les catégories qui défilent : le club entier, d'un bout à l'autre. */
const CATEGORIES = ["U7", "U9", "U11", "U13", "U15", "U17", "U19", "Seniors", "Féminines", "Vétérans", "Futsal", "Loisir"];

export function PageClub({ police }: { police?: string }) {
  const cadre = useRef<HTMLDivElement>(null);
  useEssaiPolice(cadre);

  // Les apparitions : seules les sections encore sous l'écran sont cachées, une seule fois.
  useEffect(() => {
    const racine = cadre.current;
    if (!racine || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sections = [...racine.querySelectorAll<HTMLElement>("[data-apparait]")];
    const io = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          delete (e.target as HTMLElement).dataset.cache;
          io.unobserve(e.target);
        }
      },
      { root: racine, rootMargin: "0px 0px -8% 0px" }
    );
    const bas = racine.getBoundingClientRect().bottom;
    for (const s of sections) {
      if (s.getBoundingClientRect().top < bas) continue;
      s.dataset.cache = "";
      io.observe(s);
    }
    return () => {
      io.disconnect();
      for (const s of sections) delete s.dataset.cache;
    };
  }, []);

  // Le cadre défile, pas la fenêtre : une ancre s'y rejoint à la main.
  const aller = (id: string) => (e: React.MouseEvent) => {
    const cible = document.getElementById(id);
    if (!cible) return;
    e.preventDefault();
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cible.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
  };

  const premiere = SECTIONS_CLUB[0];
  // L'éventail du haut : la carte du milieu devant, les autres qui s'écartent.
  const milieu = (JOUEURS_CLUB.length - 1) / 2;

  return (
    <div
      ref={cadre}
      lang="fr"
      dir="ltr"
      className={cn("club-page fixed inset-0 z-[60] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#080908] text-[#f3f3ef]", police)}
      style={{ paddingTop: "env(safe-area-inset-top)", scrollPaddingTop: BARRE, colorScheme: "dark" }}
    >
      {/* La barre du haut. */}
      <div className="fixed inset-x-0 top-0 z-20 border-b border-white/[0.07] bg-[#080908]/75 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className={cn(COLONNE, "flex items-center justify-between")} style={{ height: BARRE }}>
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 1000 237" className="h-[15px] w-auto" fill="currentColor" role="img" aria-label="Bola">
              <path d={LOGO_BOLA.symbole} />
              <path d={LOGO_BOLA.logotype} />
            </svg>
            <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-bold tracking-[0.16em] text-white/70 uppercase">Club</span>
          </div>
          <a
            href={`#${ANCRE_DEMANDE}`}
            onClick={aller(ANCRE_DEMANDE)}
            className="relative flex h-[36px] items-center rounded-full bg-white px-4 text-petit font-bold text-black transition-transform before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-[''] active:scale-[0.97]"
          >
            {HAUT_CLUB.bouton}
          </a>
        </div>
      </div>

      {/* 1 · Le haut : le titre, puis l'éventail des cartes, une par catégorie. */}
      <header className="relative isolate overflow-hidden" style={{ paddingTop: BARRE }}>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_50%_70%,rgba(70,140,90,0.28),transparent_70%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#080908]" />
        <div className={cn(COLONNE, "pt-12 text-center min-[960px]:pt-14")}>
          <p className="text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">{HAUT_CLUB.etiquette}</p>
          <h1 className="club-titre mx-auto mt-6 max-w-[16ch] text-[clamp(38px,10.4vw,112px)] leading-[0.98] text-balance min-[960px]:max-w-none min-[960px]:text-[clamp(56px,5.6vw,92px)]">
            {HAUT_CLUB.titre.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-6 max-w-[34ch] text-[clamp(16px,4.4vw,21px)] leading-snug font-semibold whitespace-pre-line text-white/65">{HAUT_CLUB.ligne}</p>
          <div className="mx-auto mt-9 flex max-w-[420px] flex-col gap-2.5 min-[600px]:max-w-none min-[600px]:flex-row min-[600px]:justify-center">
            <a href={`#${ANCRE_DEMANDE}`} onClick={aller(ANCRE_DEMANDE)} className="flex items-center justify-center rounded-full bg-white px-8 py-4 text-lecture font-bold text-black transition-transform active:scale-[0.98]">
              {HAUT_CLUB.bouton}
            </a>
            <a href={`#${premiere.id}`} onClick={aller(premiere.id)} className="flex items-center justify-center gap-2 rounded-full border border-white/15 px-7 py-4 text-lecture font-semibold text-white/85 hover:bg-white/[0.06]">
              {HAUT_CLUB.second}
              <ArrowDown className="size-4" aria-hidden />
            </a>
          </div>
        </div>

        {/* L'éventail : chaque carte tourne et descend selon sa distance au milieu. */}
        <div className="relative mx-auto mt-14 flex h-[clamp(260px,72vw,520px)] max-w-[1200px] items-start justify-center min-[960px]:mt-12">
          {JOUEURS_CLUB.map((j, i) => {
            const d = i - milieu;
            return (
              <CarteJoueur
                key={j.id}
                j={j}
                className="club-carte absolute top-0 w-[clamp(120px,34vw,280px)]"
                style={
                  {
                    "--x": `${d * 62}%`,
                    "--r": `${d * 7}deg`,
                    "--y": `${Math.abs(d) * Math.abs(d) * 4 + Math.abs(d) * 6}%`,
                    zIndex: 10 - Math.abs(d),
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      </header>

      {/* 2 · Les catégories qui défilent. */}
      <div aria-hidden className="relative overflow-hidden border-y border-white/[0.08] py-5">
        <div className="club-defile flex w-max gap-10 whitespace-nowrap">
          {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <span key={i} className="club-titre flex items-center gap-10 text-[clamp(22px,4vw,40px)] text-white/85">
              {c}
              <span className="size-2 rounded-full bg-white/25" />
            </span>
          ))}
        </div>
      </div>

      {/* 3 · Le manifeste. */}
      <section data-apparait className={cn(COLONNE, APPARAIT, "py-28 text-center min-[960px]:py-40")}>
        <h2 className="club-titre text-[clamp(36px,9vw,96px)] leading-[1] text-balance">
          {MANIFESTE_CLUB.ligne.map((l, i) => (
            <span key={l} className={cn("block", i === 1 && "text-white/35")}>
              {l}
            </span>
          ))}
        </h2>
        <p className="mx-auto mt-7 max-w-[30ch] text-[clamp(17px,4.6vw,22px)] leading-snug font-semibold text-white/65">{MANIFESTE_CLUB.phrase}</p>
      </section>

      {/* 4 · Ce que le club reçoit : numérotées, en alternance sur ordinateur. */}
      <div className="space-y-28 min-[960px]:space-y-40">
        {SECTIONS_CLUB.map((s, i) => (
          <section key={s.id} id={s.id} data-apparait className={cn(COLONNE, APPARAIT, "grid items-center gap-12 min-[960px]:grid-cols-2 min-[960px]:gap-24")}>
            <div className={cn("text-center min-[960px]:text-left", i % 2 === 1 && "min-[960px]:order-2")}>
              <p className="club-titre text-[clamp(56px,9vw,96px)] leading-none text-white/15">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">{s.etiquette}</p>
              <h2 className="club-titre mt-4 text-[clamp(30px,7.6vw,54px)] leading-[1.02] text-balance">{s.titre}</h2>
              <div className="mt-5 space-y-1.5 text-[clamp(16px,4.4vw,20px)] leading-snug font-semibold">
                {s.phrases.map((p, k) => (
                  <p key={p} className={k === 0 ? "text-white/90" : "text-white/55"}>
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <div className="relative">
              <div aria-hidden className="absolute inset-[10%] -z-0 rounded-full bg-[radial-gradient(closest-side,rgba(90,170,110,0.35),transparent)] blur-2xl" />
              <Telephone capture={s.capture} className="relative mx-auto w-[min(72vw,290px)] min-[960px]:w-[min(25vw,330px)]" />
            </div>
          </section>
        ))}
      </div>

      {/* 5 · Les chiffres. */}
      <section data-apparait className={cn(COLONNE, APPARAIT, "mt-32 min-[960px]:mt-44")}>
        <ul className="grid gap-px overflow-hidden rounded-[28px] bg-white/[0.08] min-[720px]:grid-cols-3">
          {CHIFFRES_CLUB.map((c) => (
            <li key={c.texte} className="bg-[#080908] px-7 py-9 min-[960px]:px-10 min-[960px]:py-12">
              <p className="font-display text-[clamp(64px,10vw,112px)] leading-none">{c.valeur}</p>
              <p className="mt-3 text-lecture font-semibold text-white/60">{c.texte}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 · Le bureau du club, sur ordinateur. */}
      <section data-apparait className={cn(COLONNE, APPARAIT, "mt-32 text-center min-[960px]:mt-44")}>
        <p className="text-[11px] font-bold tracking-[0.22em] text-white/50 uppercase">{ORDINATEUR_CLUB.etiquette}</p>
        <h2 className="club-titre mt-4 text-[clamp(30px,7.6vw,54px)] leading-[1.02] text-balance">{ORDINATEUR_CLUB.titre}</h2>
        <p className="mx-auto mt-5 max-w-[32ch] text-[clamp(16px,4.4vw,20px)] leading-snug font-semibold text-white/60">{ORDINATEUR_CLUB.phrase}</p>
        <div className="mt-14">
          <Portable capture={ORDINATEUR_CLUB.capture} />
        </div>
      </section>

      {/* 7 · Les quatre cartes, une par rôle. */}
      <section data-apparait className={cn(COLONNE, APPARAIT, "mt-32 min-[960px]:mt-44")}>
        <Roles />
      </section>

      {/* 8 · La demande de démo : la photo des seniors à gauche sur ordinateur. */}
      <section id={ANCRE_DEMANDE} data-apparait className={cn(COLONNE, APPARAIT, "mt-32 min-[960px]:mt-44")}>
        <div className="grid overflow-hidden rounded-[32px] bg-[#f3f3ef] text-[#0b0b0b] min-[960px]:grid-cols-[0.85fr_1.15fr]" style={{ colorScheme: "light" }}>
          <div className="relative hidden min-h-full min-[960px]:block" style={{ background: `linear-gradient(160deg, ${JOUEURS_CLUB[2].maillot}, #0b0b0b 85%)` }}>
            <Photo src={JOUEURS_CLUB[2].photo} lue={JOUEURS_CLUB[2].lue} className="absolute inset-0 size-full object-cover" repli={null} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <p className="club-titre absolute inset-x-10 bottom-10 text-[40px] leading-[1] text-white">
              {FORMULAIRE_CLUB.titre}
            </p>
          </div>
          <div className="club-formulaire px-5 py-10 min-[720px]:px-10 min-[960px]:px-14 min-[960px]:py-14">
            <div className="mb-9 text-center min-[960px]:text-left">
              <p className="text-[11px] font-bold tracking-[0.22em] text-black/45 uppercase">{FORMULAIRE_CLUB.etiquette}</p>
              <h2 className="club-titre mt-3 text-[clamp(28px,7.4vw,38px)] leading-[1.02] text-balance min-[960px]:hidden">{FORMULAIRE_CLUB.titre}</h2>
              <p className="mt-3 text-[clamp(16px,4.4vw,19px)] leading-snug font-semibold whitespace-pre-line text-black/60">{FORMULAIRE_CLUB.phrase}</p>
            </div>
            <Formulaire />
          </div>
        </div>
      </section>

      <footer className={cn(COLONNE, "mt-24 min-[960px]:mt-32")} style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div className="flex flex-col gap-5 border-t border-white/10 pt-7 pb-4 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between">
          <svg viewBox="0 0 1000 237" className="h-[14px] w-auto self-start" fill="currentColor" role="img" aria-label="Bola">
            <path d={LOGO_BOLA.symbole} />
            <path d={LOGO_BOLA.logotype} />
          </svg>
          <div className="flex items-center gap-5 text-[11px] font-bold tracking-[0.16em] text-white/45 uppercase">
            <Link href="/confidentialite" className={cn(ANNEAU, "-my-4 py-4 text-white/70")}>
              {FORMULAIRE_CLUB.lienConfidentialite}
            </Link>
            <p>© 2026 Bola</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
