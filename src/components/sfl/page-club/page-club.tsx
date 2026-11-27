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
import { Check, Loader2 } from "lucide-react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import {
  ANCRE_DEMANDE,
  CAPTURE,
  CAPTURE_HAUT,
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

const BARRE = 56;
const COLONNE = "mx-auto w-full px-5 min-[720px]:max-w-[600px] min-[960px]:max-w-[1120px] min-[960px]:px-10";
const ETIQUETTE = "mono-label text-encre-3";
const TITRE = "mt-3 text-nom leading-[1.05] font-extrabold tracking-tight text-balance min-[960px]:text-[clamp(40px,3.6vw,52px)] min-[960px]:leading-[1.03]";
const PHRASE = "text-[clamp(16px,4.6vw,19px)] leading-snug font-bold text-balance min-[960px]:text-titre-m";
const ANNEAU = "outline-offset-4 focus-visible:outline-2 focus-visible:outline-foreground";
const APPARAIT =
  "transition-[opacity,translate] duration-[400ms] ease-out data-[cache]:translate-y-3 data-[cache]:opacity-0 motion-reduce:transition-none";
const SAISIE =
  "h-12 w-full rounded-champ bg-foreground/[0.06] px-4 text-lecture font-semibold outline-none placeholder:text-foreground/25 focus:bg-foreground/[0.09] focus-visible:ring-2 focus-visible:ring-foreground/40 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#ff5a4c]";

/** Une capture de l'app, dans un téléphone noir. */
function Telephone({ src, lue, className, vite }: { src: string; lue: string; className?: string; vite?: boolean }) {
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
        src={src}
        alt={lue}
        width={CAPTURE.largeur}
        height={CAPTURE.hauteur}
        loading={vite ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        className="block h-auto w-full rounded-[33px] select-none"
      />
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
        <p className="mt-6 text-titre-l font-extrabold tracking-tight">{F.merci.titre}</p>
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
        className="bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-4 text-lecture font-bold"
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

export function PageClub() {
  const cadre = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={cadre}
      lang="fr"
      dir="ltr"
      className="fixed inset-0 z-[60] overflow-x-hidden overflow-y-auto overscroll-contain bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)", scrollPaddingTop: BARRE }}
    >
      {/* La barre du haut : le logo, et le bouton qui reste sous le pouce. */}
      <div
        className="glass-soft fixed inset-x-0 top-0 z-20 border-x-0 border-t-0 bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className={cn(COLONNE, "flex items-center justify-between")} style={{ height: BARRE }}>
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 1000 237" className="h-[15px] w-auto" fill="currentColor" role="img" aria-label="Bola">
              <path d={LOGO_BOLA.symbole} />
              <path d={LOGO_BOLA.logotype} />
            </svg>
            <span className="mono-label text-encre-2">Club</span>
          </div>
          <a
            href={`#${ANCRE_DEMANDE}`}
            onClick={aller(ANCRE_DEMANDE)}
            className="bouton-principal bouton--vert relative flex h-[36px] items-center px-4 text-petit font-bold before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-['']"
          >
            {HAUT_CLUB.bouton}
          </a>
        </div>
      </div>

      <div style={{ paddingTop: BARRE }}>
        {/* 1 · Le haut : le titre et les boutons ; sur ordinateur, l'écran des actus à droite. */}
        <header className={cn(COLONNE, "grid items-center gap-12 pt-12 pb-16 min-[960px]:grid-cols-[1.1fr_0.9fr] min-[960px]:gap-16 min-[960px]:pt-20 min-[960px]:pb-28")}>
          <div className="text-center min-[960px]:text-left">
            <p className={ETIQUETTE}>{HAUT_CLUB.etiquette}</p>
            <h1 className="mt-4 text-[clamp(40px,11.5vw,56px)] leading-[0.98] font-extrabold tracking-tight text-balance min-[960px]:text-[clamp(56px,5.4vw,76px)]">
              {HAUT_CLUB.titre.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </h1>
            <p className={cn(PHRASE, "mt-5 whitespace-pre-line text-encre-2")}>{HAUT_CLUB.ligne}</p>
            <div className="mt-9 flex flex-col gap-2.5 min-[720px]:mx-auto min-[720px]:max-w-[420px] min-[960px]:mx-0 min-[960px]:flex-row">
              <a href={`#${ANCRE_DEMANDE}`} onClick={aller(ANCRE_DEMANDE)} className="bouton-principal bouton--vert flex items-center justify-center py-4 text-lecture font-bold min-[960px]:px-8">
                {HAUT_CLUB.bouton}
              </a>
              <a href={`#${premiere.id}`} onClick={aller(premiere.id)} className="bouton-discret flex items-center justify-center py-3.5 text-ligne font-semibold min-[960px]:px-6">
                {HAUT_CLUB.second}
              </a>
            </div>
          </div>
          <Telephone src={CAPTURE_HAUT.src} lue={CAPTURE_HAUT.lue} vite className="mx-auto w-[min(76vw,300px)] min-[960px]:w-[min(26vw,340px)]" />
        </header>

        {/* 2 · Ce que le club reçoit : une phrase, sa capture ; en alternance sur ordinateur. */}
        <div className="space-y-24 min-[960px]:space-y-32">
          {SECTIONS_CLUB.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              data-apparait
              className={cn(COLONNE, APPARAIT, "grid items-center gap-10 min-[960px]:grid-cols-2 min-[960px]:gap-20")}
            >
              <div className={cn("text-center min-[960px]:text-left", i % 2 === 1 && "min-[960px]:order-2")}>
                <p className={ETIQUETTE}>{s.etiquette}</p>
                <h2 className={TITRE}>{s.titre}</h2>
                <div className={cn(PHRASE, "mt-5 space-y-1.5")}>
                  {s.phrases.map((p, j) => (
                    <p key={p} className={j === 0 ? "text-encre" : "text-encre-2"}>
                      {p}
                    </p>
                  ))}
                </div>
              </div>
              <Telephone src={s.capture.src} lue={s.capture.lue} className="mx-auto w-[min(70vw,280px)] min-[960px]:w-[min(24vw,320px)]" />
            </section>
          ))}
        </div>

        {/* 3 · Les quatre vues. */}
        <section data-apparait className={cn(COLONNE, APPARAIT, "mt-28 min-[960px]:mt-40")}>
          <div className="text-center">
            <p className={ETIQUETTE}>{ROLES_CLUB.etiquette}</p>
            <h2 className={TITRE}>{ROLES_CLUB.titre}</h2>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 min-[960px]:mt-14 min-[960px]:grid-cols-4 min-[960px]:gap-4">
            {ROLES_CLUB.roles.map((r) => (
              <li key={r.nom} className="rounded-[22px] bg-foreground/[0.05] p-5 min-[960px]:p-7">
                <p className="text-titre-fort font-extrabold tracking-tight min-[960px]:text-titre-m">{r.nom}</p>
                <p className="mt-2 text-ligne leading-snug font-semibold text-encre-2">{r.phrase}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 4 · La demande de démo. */}
        <section id={ANCRE_DEMANDE} data-apparait className={cn(COLONNE, APPARAIT, "mt-28 min-[960px]:mt-40")}>
          <div className="mx-auto max-w-[720px] rounded-[28px] bg-foreground/[0.04] px-5 py-10 shadow-[inset_0_0_0_1px_rgb(var(--foreground-rgb)/0.08)] min-[720px]:px-10 min-[960px]:px-14 min-[960px]:py-14">
            <div className="mb-10 text-center">
              <p className={ETIQUETTE}>{FORMULAIRE_CLUB.etiquette}</p>
              <h2 className={TITRE}>{FORMULAIRE_CLUB.titre}</h2>
              <p className={cn(PHRASE, "mt-4 whitespace-pre-line text-encre-2")}>{FORMULAIRE_CLUB.phrase}</p>
            </div>
            <Formulaire />
          </div>
        </section>
      </div>

      <footer className={cn(COLONNE, "mt-24 min-[960px]:mt-32")} style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div className="flex flex-col gap-5 border-t border-foreground/10 pt-7 pb-4 min-[960px]:flex-row min-[960px]:items-center min-[960px]:justify-between">
          <svg viewBox="0 0 1000 237" className="h-[14px] w-auto self-start" fill="currentColor" role="img" aria-label="Bola">
            <path d={LOGO_BOLA.symbole} />
            <path d={LOGO_BOLA.logotype} />
          </svg>
          <div className="flex items-center gap-5">
            <Link href="/confidentialite" className={cn(ETIQUETTE, ANNEAU, "-my-4 py-4 text-encre-2")}>
              {FORMULAIRE_CLUB.lienConfidentialite}
            </Link>
            <p className={ETIQUETTE}>© 2026 Bola</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
