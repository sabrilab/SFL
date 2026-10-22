"use client";

// Créer son compte — l'inscription autonome, de bout en bout.
//
// Avant, seul l'admin fabriquait les comptes et distribuait les accès. Ici le
// joueur crée le sien, une question par écran, et voit sa carte se remplir à
// chaque réponse : son nom, son pseudo, son poste. Viennent ensuite les quatre
// photos en pied imposées (face, droite, gauche, dos), le personnage de
// référence des futurs skins, et le mot de passe.
//
// Pas de photo de carte ici : elle ne vient que du studio (photo-studio.tsx,
// Sabri, 22/10/2026 : pas de photo de pellicule sur les cartes), qui demande
// un compte accepté. L'invitation de l'ouverture (invitation-carte.tsx) la
// propose dès que l'admin a dit oui.
//
// Proportions : tout suit le nombre d'or. La carte occupe le petit segment de
// l'écran (0,382), la question le grand (0,618) ; espacements 8 · 13 · 21 ·
// 34 · 55, titres en 34 px, texte en 13 et 21.
//
// Le compte naît en attente (voir lib/sfl/inscription.ts) : la fin du parcours
// le dit, et l'app montre l'écran d'attente jusqu'à l'accord de l'admin.
// Sauf venu par le lien d'une équipe (?equipe=jeton, mode Team) : le
// capitaine s'en porte garant, le compte entre aussitôt et l'équipe l'attend.
//
// Page publique (hors de la porte de connexion, voir AuthGate).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Eye, EyeOff, Loader2, Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { BolaCard } from "@/components/sfl/bola-card";
import { PriseReference } from "@/components/sfl/inscription/prise-reference";
import { ovr, type Stats } from "@/lib/sfl/engine";
import {
  bootstrapServerSession,
  inscriptionSocialeEnCours,
  jetonServeur,
  oublierSessionServeur,
  refusAuRetour,
  signIn,
  type Fournisseur,
} from "@/lib/sfl/auth/session";
import { BoutonsSociaux } from "@/components/sfl/auth/boutons-sociaux";
import { envoyerReferences } from "@/lib/sfl/references";
import { useSession } from "@/hooks/use-session";
import {
  ANGLES,
  BORNES,
  MAILLOTS,
  PIEDS,
  POSTES,
  age,
  capitaliser,
  emailValide,
  erreurPseudo,
  nettoyerNom,
  normaliserPseudo,
  type Angle,
  type Inscription,
} from "@/lib/sfl/inscription";

const ETAPES = ["accueil", "identite", "contact", "naissance", "gabarit", "jeu", "angles", "secret", "fini"] as const;
type Etape = (typeof ETAPES)[number];

/** Par Google ou Apple : ni email (le fournisseur le donne), ni mot de passe. */
const ETAPES_SOCIALES = ETAPES.filter((e) => e !== "secret");

const NOM_FOURNISSEUR: Record<Fournisseur, string> = { google: "Google", apple: "Apple" };

/** La carte d'un joueur qui arrive : base 75 partout, comme newRosterPlayer. */
const STATS_DEPART: Stats = { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 };

const BROUILLON = "sfl-inscription";

type Formulaire = Omit<Inscription, "motDePasse">;

const VIDE: Formulaire = {
  prenom: "",
  nom: "",
  pseudo: "",
  naissance: "",
  email: "",
  taille: BORNES.taille.defaut,
  poids: BORNES.poids.defaut,
  pointure: BORNES.pointure.defaut,
  maillot: "M",
  pied: "droit",
  poste: "MC",
};

/* ───────────────────────────── Briques ───────────────────────────── */

function Champ({
  label,
  children,
  note,
}: {
  label: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="glass-soft flex flex-col gap-[8px] rounded-[21px] px-[21px] py-[13px]">
        <span className="mono-label text-foreground/40">{label}</span>
        {children}
      </span>
      {note && <span className="mt-[8px] block px-[13px] text-[12.5px] font-medium">{note}</span>}
    </label>
  );
}

const SAISIE =
  "w-full bg-transparent text-[21px] font-bold tracking-tight outline-none placeholder:text-foreground/20";

function Puces<T extends string>({
  options,
  valeur,
  onChange,
  colonnes = 3,
}: {
  options: readonly { id: T; label: string; detail?: string }[];
  valeur: T;
  onChange: (v: T) => void;
  colonnes?: number;
}) {
  return (
    <div className="grid gap-[8px]" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => {
            navigator.vibrate?.(6);
            onChange(o.id);
          }}
          className={cn(
            "bouton--or flex min-h-[55px] flex-col items-center justify-center rounded-[13px] px-[8px] py-[8px]",
            valeur === o.id ? "bouton-principal" : "bouton-secondaire text-foreground/70"
          )}
        >
          <span className="text-[15px] font-extrabold tracking-tight">{o.label}</span>
          {o.detail && (
            <span className={cn("mt-0.5 text-[10.5px] leading-tight", valeur === o.id ? "text-background/60" : "text-foreground/35")}>
              {o.detail}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Un nombre qu'on règle au pouce : − / + et glissière. */
function Reglage({
  label,
  unite,
  valeur,
  min,
  max,
  pas = 1,
  onChange,
}: {
  label: string;
  unite: string;
  valeur: number;
  min: number;
  max: number;
  pas?: number;
  onChange: (v: number) => void;
}) {
  const borne = (v: number) => Math.min(max, Math.max(min, Math.round(v / pas) * pas));
  return (
    <div className="glass-soft rounded-[21px] px-[21px] pt-[13px] pb-[21px]">
      <div className="flex items-center justify-between">
        <span className="mono-label text-foreground/40">{label}</span>
        <div className="flex items-center gap-[13px]">
          <button
            type="button"
            onClick={() => onChange(borne(valeur - pas))}
            aria-label={`${label} moins`}
            className="bouton-secondaire bouton--or grid size-[34px] place-items-center"
          >
            <Minus className="size-4" />
          </button>
          <span className="min-w-[89px] text-center text-[34px] leading-none font-black tracking-tight tabular-nums">
            {String(valeur).replace(".", ",")}
            <span className="ml-1 text-[13px] font-bold text-foreground/40">{unite}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(borne(valeur + pas))}
            aria-label={`${label} plus`}
            className="bouton-secondaire bouton--or grid size-[34px] place-items-center"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        onChange={(e) => onChange(borne(Number(e.target.value)))}
        aria-label={label}
        className="mt-[13px] w-full accent-foreground"
      />
    </div>
  );
}

/* ───────────────────────────── La page ───────────────────────────── */

export default function InscriptionPage() {
  const router = useRouter();
  const session = useSession();
  const [etape, setEtape] = useState<Etape>("accueil");
  const [f, setF] = useState<Formulaire>(VIDE);
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [piege, setPiege] = useState("");
  const [refs, setRefs] = useState<Partial<Record<Angle, string>>>({});
  const [prise, setPrise] = useState<Angle | null>(null);
  const [pseudoEtat, setPseudoEtat] = useState<"?" | "libre" | "pris" | "verif">("?");
  const [ouvert, setOuvert] = useState<boolean | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [nomFinal, setNomFinal] = useState<string | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [aRenvoyer, setARenvoyer] = useState(false);
  // Revenu de Google ou Apple : le compte existe déjà, provisoire.
  const [sociale, setSociale] = useState<Fournisseur | null>(null);
  // Venu par le lien d'une équipe (mode Team, /equipe/[jeton]) : le compte
  // entre dans Bola sans attendre l'admin et l'équipe l'attend ; le parcours
  // est plus court (pas les quatre photos en pied).
  const [equipe, setEquipe] = useState<string | null>(null);
  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("equipe");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de l'URL au montage
    if (j) setEquipe(j);
  }, []);
  const fini = etape === "fini";
  const etapes: readonly Etape[] = sociale ? ETAPES_SOCIALES : equipe ? ETAPES.filter((e) => e !== "angles") : ETAPES;
  /** Les étapes comptées par la barre de progression (ni l'accueil, ni la fin). */
  const parcours = etapes.slice(1, -1);
  /** L'étape qui crée le compte. */
  const derniere = etapes[etapes.length - 2];

  // Un membre déjà connecté n'a rien à faire ici.
  useEffect(() => {
    if (session && !session.enAttente && (!fini || equipe)) router.replace(equipe ? "/bola-team" : "/");
  }, [session, fini, equipe, router]);

  // Brouillon : une page rechargée ne fait pas tout recommencer (le mot de
  // passe et les photos ne sont jamais gardés).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(BROUILLON);
      if (!brut) return;
      const b = JSON.parse(brut) as { f: Formulaire; etape: Etape };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique d'un stockage externe au montage
      setF({ ...VIDE, ...b.f });
      if (ETAPES.indexOf(b.etape) > 0 && ETAPES.indexOf(b.etape) <= ETAPES.indexOf("jeu")) setEtape(b.etape);
    } catch {}
  }, []);
  useEffect(() => {
    if (fini) return;
    try {
      sessionStorage.setItem(BROUILLON, JSON.stringify({ f, etape }));
    } catch {}
  }, [f, etape, fini]);

  // Retour de Google ou Apple : un refus à dire, ou un compte provisoire à
  // finir. Un membre qui s'est trompé de bouton (même email qu'un compte de
  // la ligue) est renvoyé à sa connexion, et le compte provisoire supprimé.
  useEffect(() => {
    const refus = refusAuRetour();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique de l'adresse au retour du fournisseur
    if (refus) setErreur(refus);
    let annule = false;
    void (async () => {
      const fournisseur = await inscriptionSocialeEnCours();
      const jeton = fournisseur && (await jetonServeur());
      if (!fournisseur || !jeton || annule) return;
      const r = await fetch("/api/inscription/sociale", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ action: "verifier" }),
      }).catch(() => null);
      const d = (await r?.json().catch(() => null)) as
        | { ok?: boolean; dejaMembre?: boolean; email?: string | null; prenom?: string; nom?: string; error?: string }
        | null;
      if (annule) return;
      if (!r?.ok || !d?.ok) {
        setErreur(d?.error ?? "Serveur de la ligue injoignable.");
        return;
      }
      if (d.dejaMembre) {
        await oublierSessionServeur();
        setErreur(
          `Tu as déjà un compte avec cet email. Connecte-toi avec ton pseudo, puis lie ${NOM_FOURNISSEUR[fournisseur]} dans Réglages.`
        );
        return;
      }
      setSociale(fournisseur);
      setF((x) => ({
        ...x,
        prenom: x.prenom || d.prenom || "",
        nom: x.nom || d.nom || "",
        email: d.email ?? x.email,
      }));
      setEtape((e) => (e === "accueil" ? "identite" : e));
    })();
    return () => {
      annule = true;
    };
  }, []);

  // Les inscriptions sont-elles ouvertes (clé serveur posée) ?
  useEffect(() => {
    fetch("/api/inscription?pseudo=___")
      .then((r) => setOuvert(r.status !== 503))
      .catch(() => setOuvert(true));
  }, []);

  // Le pseudo est-il libre ? Vérifié en tapant, sans attendre la fin.
  const pseudo = normaliserPseudo(f.pseudo);
  useEffect(() => {
    if (erreurPseudo(pseudo)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialise l'état d'une requête réseau
      setPseudoEtat("?");
      return;
    }
    setPseudoEtat("verif");
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/inscription?pseudo=${encodeURIComponent(pseudo)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: { libre?: boolean }) => setPseudoEtat(d.libre === false ? "pris" : d.libre ? "libre" : "?"))
        .catch(() => {});
    }, 420);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [pseudo]);

  const maj = useCallback(<K extends keyof Formulaire>(k: K, v: Formulaire[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErreur(null);
  }, []);

  const nomCarte = nomFinal ?? (capitaliser(nettoyerNom(f.prenom)) || "Toi");
  const ans = age(f.naissance);
  const carte = useMemo(
    () => ({
      name: nomCarte,
      username: pseudo ? `@${pseudo}` : undefined,
      position: f.poste,
      overall: ovr(STATS_DEPART),
      stats: STATS_DEPART,
    }),
    [nomCarte, pseudo, f.poste]
  );

  /** L'étape peut-elle être quittée ? Renvoie la raison sinon. */
  function bloquant(e: Etape): string | null {
    switch (e) {
      case "identite":
        if (!nettoyerNom(f.prenom)) return "Ton prénom.";
        if (!nettoyerNom(f.nom)) return "Ton nom.";
        return null;
      case "contact": {
        const ep = erreurPseudo(pseudo);
        if (ep) return `Pseudo : ${ep}`;
        if (pseudoEtat === "pris") return "Ce pseudo est déjà pris.";
        if (!sociale && !emailValide(f.email)) return "Ton email.";
        return null;
      }
      case "naissance":
        if (ans === null) return "Ta date de naissance.";
        if (ans < BORNES.ageMin || ans > 90) return "Vérifie ta date de naissance.";
        return null;
      case "angles":
        return ANGLES.every((a) => refs[a.id]) ? null : "Les quatre photos.";
      case "secret":
        if (motDePasse.length < BORNES.motDePasse) return `${BORNES.motDePasse} caractères au moins.`;
        if (motDePasse !== confirmation) return "Les deux mots de passe diffèrent.";
        return null;
      default:
        return null;
    }
  }

  function aller(sens: 1 | -1) {
    const i = etapes.indexOf(etape);
    if (sens === 1) {
      const b = bloquant(etape);
      if (b) {
        setErreur(b);
        navigator.vibrate?.([10, 40, 10]);
        return;
      }
    }
    setErreur(null);
    const suivante = etapes[Math.min(etapes.length - 1, Math.max(0, i + sens))];
    setEtape(suivante);
    document.getElementById("inscription-scroll")?.scrollTo({ top: 0 });
  }

  async function creer() {
    const b = bloquant("secret");
    if (b) {
      setErreur(b);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await fetch("/api/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, pseudo, motDePasse, site: piege, ...(equipe ? { equipe } : {}) }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; champ?: string; name?: string };
      if (!r.ok || !d.ok || !d.name) {
        setErreur(d.error ?? "Création impossible pour l'instant.");
        if (d.champ === "pseudo" || d.champ === "email") {
          if (d.champ === "pseudo") setPseudoEtat("pris");
          setEtape("contact");
        }
        return;
      }
      const nom = d.name;
      // Connexion immédiate, puis les quatre prises, envoyées sous sa
      // propre session.
      const connexion = await signIn(pseudo, motDePasse);
      if (connexion.ok) await envoyerPhotos();
      else setAvertissement(`Ton compte est créé. Connecte-toi avec @${pseudo} pour entrer.`);
      try {
        sessionStorage.removeItem(BROUILLON);
      } catch {}
      setNomFinal(nom);
      setEtape("fini");
      navigator.vibrate?.([12, 60, 24]);
    } catch {
      setErreur("Pas de réseau. Réessaie dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  /** Par Google ou Apple : la route pose le nom, le pseudo et la fiche. */
  async function finirSociale() {
    const b = bloquant(derniere);
    if (b) {
      setErreur(b);
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const jeton = await jetonServeur();
      if (!jeton) {
        setSociale(null);
        setEtape("accueil");
        setErreur("La connexion a expiré. Recommence avec Google ou Apple.");
        return;
      }
      const { email: _email, ...fiche } = f;
      void _email;
      const r = await fetch("/api/inscription/sociale", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ action: "finir", ...fiche, pseudo, site: piege }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; champ?: string; name?: string };
      if (!r.ok || !d.ok || !d.name) {
        setErreur(d.error ?? "Création impossible pour l'instant.");
        if (d.champ === "pseudo") {
          setPseudoEtat("pris");
          setEtape("contact");
        }
        return;
      }
      const nom = d.name;
      // La session Supabase est déjà là : elle devient la session de ligue
      // (en attente), puis les photos partent sous elle.
      await bootstrapServerSession();
      await envoyerPhotos();
      try {
        sessionStorage.removeItem(BROUILLON);
      } catch {}
      setNomFinal(nom);
      setEtape("fini");
      navigator.vibrate?.([12, 60, 24]);
    } catch {
      setErreur("Pas de réseau. Réessaie dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  /** Demi-tour d'un compte provisoire : il est supprimé. */
  async function annulerSociale() {
    const jeton = await jetonServeur();
    if (jeton) {
      await fetch("/api/inscription/sociale", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ action: "annuler" }),
      }).catch(() => {});
    }
    await oublierSessionServeur();
    router.replace("/");
  }

  /** Les quatre prises, sous la session du joueur. */
  async function envoyerPhotos() {
    const ok = (await envoyerReferences(refs)).length === 0;
    setARenvoyer(!ok);
    setAvertissement(ok ? null : "Certaines photos ne sont pas parties.");
  }

  /* ─────────────── Le contenu de chaque étape ─────────────── */

  const titres: Record<Etape, [string, string?]> = {
    accueil: ["Crée ta carte."],
    identite: ["Qui es-tu ?"],
    contact: ["Ton nom de joueur."],
    naissance: ["Ta date de naissance."],
    gabarit: ["Ton gabarit."],
    jeu: ["Ton jeu."],
    angles: ["Tes quatre angles.", "Même cadre pour toute la ligue : tes skins naîtront de ces quatre photos."],
    secret: ["Ton mot de passe."],
    fini: [`Bienvenue, ${nomCarte}.`],
  };

  const etapeIndex = parcours.indexOf(etape);
  const avecCarte = etape !== "angles";
  // Les étapes longues (gabarit, jeu) passent la carte au segment suivant de
  // la suite d'or : 0,236 de l'écran, carte à 0,382.
  const compacte = etape === "gabarit" || etape === "jeu";
  const [titre, sousTitre] = titres[etape];

  let corps: React.ReactNode = null;
  switch (etape) {
    case "identite":
      corps = (
        <div className="flex flex-col gap-[13px]">
          <Champ label="Prénom">
            <input
              autoFocus
              value={f.prenom}
              onChange={(e) => maj("prenom", e.target.value)}
              autoComplete="given-name"
              placeholder="Prénom"
              className={SAISIE}
            />
          </Champ>
          <Champ label="Nom">
            <input
              value={f.nom}
              onChange={(e) => maj("nom", e.target.value)}
              autoComplete="family-name"
              placeholder="Nom"
              className={SAISIE}
            />
          </Champ>
        </div>
      );
      break;
    case "contact":
      corps = (
        <div className="flex flex-col gap-[13px]">
          <Champ
            label="Pseudo"
            note={
              pseudoEtat === "pris" ? (
                <span className="text-[#FF6B5E]">Déjà pris.</span>
              ) : pseudoEtat === "libre" ? (
                <span className="text-foreground/55">
                  <Check className="mr-1 inline size-3.5" />
                  {sociale ? "Libre." : "Libre. C\u2019est aussi ton identifiant."}
                </span>
              ) : null
            }
          >
            <span className="flex items-center">
              <span className="text-[21px] font-bold text-foreground/30">@</span>
              <input
                autoFocus
                value={f.pseudo}
                onChange={(e) => maj("pseudo", normaliserPseudo(e.target.value))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                maxLength={20}
                placeholder="pseudo"
                className={SAISIE}
              />
              {pseudoEtat === "verif" && <Loader2 className="size-4 shrink-0 animate-spin text-foreground/30" />}
            </span>
          </Champ>
          {!sociale && (
            <Champ label="Email">
              <input
                type="email"
                inputMode="email"
                value={f.email}
                onChange={(e) => maj("email", e.target.value.trim())}
                autoCapitalize="none"
                autoComplete="email"
                placeholder="toi@exemple.fr"
                className={SAISIE}
              />
            </Champ>
          )}
        </div>
      );
      break;
    case "naissance":
      corps = (
        <Champ
          label="Né le"
          note={ans !== null && ans >= 0 ? <span className="text-foreground/45">{ans} ans</span> : null}
        >
          <input
            autoFocus
            type="date"
            value={f.naissance}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => maj("naissance", e.target.value)}
            autoComplete="bday"
            className={cn(SAISIE, "[color-scheme:dark]")}
          />
        </Champ>
      );
      break;
    case "gabarit":
      corps = (
        <div className="flex flex-col gap-[13px]">
          <Reglage label="Taille" unite="cm" valeur={f.taille} min={BORNES.taille.min} max={BORNES.taille.max} onChange={(v) => maj("taille", v)} />
          <Reglage label="Poids" unite="kg" valeur={f.poids} min={BORNES.poids.min} max={BORNES.poids.max} onChange={(v) => maj("poids", v)} />
          <Reglage label="Pointure" unite="EU" valeur={f.pointure} min={BORNES.pointure.min} max={BORNES.pointure.max} pas={0.5} onChange={(v) => maj("pointure", v)} />
          <div>
            <p className="mono-label mb-[8px] px-[13px] text-foreground/40">Maillot</p>
            <Puces
              options={MAILLOTS.map((m) => ({ id: m, label: m }))}
              valeur={f.maillot}
              onChange={(v) => maj("maillot", v)}
              colonnes={6}
            />
          </div>
        </div>
      );
      break;
    case "jeu":
      corps = (
        <div className="flex flex-col gap-[21px]">
          <div>
            <p className="mono-label mb-[8px] px-[13px] text-foreground/40">Poste</p>
            <Puces
              options={POSTES.map((p) => ({ id: p.id, label: p.id, detail: p.label }))}
              valeur={f.poste}
              onChange={(v) => maj("poste", v)}
            />
          </div>
          <div>
            <p className="mono-label mb-[8px] px-[13px] text-foreground/40">Pied fort</p>
            <Puces
              options={PIEDS.map((p) => ({ id: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              valeur={f.pied}
              onChange={(v) => maj("pied", v)}
            />
          </div>
        </div>
      );
      break;
    case "angles":
      corps = (
        <div className="grid grid-cols-2 gap-[13px]">
          {ANGLES.map((a, i) => {
            const src = refs[a.id];
            const prochaine = !src && ANGLES.findIndex((x) => !refs[x.id]) === i;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setPrise(a.id)}
                className={cn(
                  "relative aspect-[3/4] overflow-hidden rounded-[21px] text-left transition-all active:scale-[0.98]",
                  src ? "bg-black" : "glass-soft",
                  prochaine && "ring-2 ring-foreground"
                )}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL locale
                  <img src={src} alt={a.label} className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="text-[55px] leading-none font-black text-foreground/10 tabular-nums">{i + 1}</span>
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-[13px] pt-[21px] pb-[13px]">
                  <span className="text-[13px] font-bold text-white">{a.label}</span>
                  {src ? <RotateCcw className="size-3.5 text-white/70" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      );
      break;
    case "secret":
      corps = (
        <div className="flex flex-col gap-[13px]">
          <Champ label="Mot de passe">
            <span className="flex items-center gap-2">
              <input
                autoFocus
                type={voir ? "text" : "password"}
                value={motDePasse}
                onChange={(e) => {
                  setMotDePasse(e.target.value);
                  setErreur(null);
                }}
                autoComplete="new-password"
                placeholder="••••••••"
                className={SAISIE}
              />
              <button type="button" onClick={() => setVoir((v) => !v)} aria-label={voir ? "Masquer" : "Afficher"} className="text-foreground/40">
                {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </Champ>
          <Champ label="Encore une fois">
            <input
              type={voir ? "text" : "password"}
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value);
                setErreur(null);
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              className={SAISIE}
            />
          </Champ>
          {/* Champ piège : invisible pour un humain, rempli par les robots. */}
          <input
            tabIndex={-1}
            aria-hidden
            autoComplete="off"
            value={piege}
            onChange={(e) => setPiege(e.target.value)}
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <p className="px-[13px] text-[12.5px] text-foreground/40">
            Tu te connecteras avec <span className="font-bold text-foreground/70">@{pseudo}</span> et ce mot de passe.
          </p>
        </div>
      );
      break;
    case "fini":
      corps = (
        <div className="flex flex-col gap-[13px]">
          {!equipe && <div className="glass-soft rounded-[21px] px-[21px] py-[13px]">
            <p className="mono-label text-foreground/40">En attente</p>
            <p className="mt-[8px] text-[15px] leading-snug font-semibold">
              La ligue valide ton entrée. Ta carte s&apos;ouvre dès que c&apos;est fait.
            </p>
          </div>}
          {avertissement && <p className="px-[13px] text-[12.5px] text-[#FF6B5E]">{avertissement}</p>}
          {aRenvoyer && nomFinal && (
            <button
              type="button"
              disabled={envoi}
              onClick={async () => {
                setEnvoi(true);
                await envoyerPhotos();
                setEnvoi(false);
              }}
              className="bouton-secondaire bouton--or py-[13px] text-[14px] font-semibold"
            >
              Renvoyer les photos
            </button>
          )}
        </div>
      );
      break;
  }

  /* ─────────────── La mise en page ─────────────── */

  const accueil = etape === "accueil";
  const action = accueil ? "Commencer" : etape === derniere ? "Créer mon compte" : fini ? "Entrer" : "Continuer";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="orbs" aria-hidden>
        <i />
        <i />
        <i />
      </div>

      {/* Barre du haut : retour + progression */}
      {!accueil && !fini && (
        <div className="relative z-10 mx-auto flex w-full max-w-[420px] items-center gap-[13px] px-[21px] pt-[8px] pb-[8px]">
          <button
            type="button"
            onClick={() => aller(-1)}
            aria-label="Retour"
            className="bouton-discret -ml-2 grid size-[34px] shrink-0 place-items-center"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex flex-1 gap-[5px]">
            {parcours.map((p, i) => (
              <span
                key={p}
                className={cn(
                  "h-[3px] flex-1 rounded-full transition-colors duration-500",
                  i <= etapeIndex ? "bg-foreground" : "bg-foreground/15"
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div id="inscription-scroll" className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col px-[21px]">
          {/* Le petit segment (0,382) : la carte qui se remplit */}
          {avecCarte && (
            <div
              className={cn(
                "flex items-end justify-center transition-[height] duration-500",
                accueil || fini
                  ? "h-[52dvh] min-h-[340px]"
                  : compacte
                    ? "h-[23.6dvh] min-h-[150px]"
                    : "h-[38.2dvh] min-h-[230px]"
              )}
            >
              <div
                key={fini ? "fini" : "carte"}
                className={cn(fini && "animate-in zoom-in-90 fade-in duration-700")}
                style={{ filter: "drop-shadow(0 21px 34px rgba(0,0,0,.55))" }}
              >
                <BolaCard {...carte} size={accueil || fini ? 1 : compacte ? 0.382 : 0.618} />
              </div>
            </div>
          )}

          {/* Le grand segment (0,618) : la question */}
          <div className="flex flex-1 flex-col pt-[34px]">
            {accueil && <p className="mono-label text-foreground/40">Bola · Sunday Five League</p>}
            {/* La taille AVANT l'interligne : tailwind-merge retire un leading-*
                placé avant un text-[…], qui peut porter le sien. */}
            <h1 className={cn("font-extrabold tracking-tight", accueil || fini ? "mt-[8px] text-[42px]" : "text-[34px]", "leading-[1.05]")}>
              {titre}
            </h1>
            {sousTitre && <p className="mt-[8px] text-[13px] leading-snug text-foreground/45">{sousTitre}</p>}
            <div className="mt-[21px]">{corps}</div>
            {accueil && ouvert === false && (
              <p className="mt-[13px] text-[13px] text-foreground/50">
                Les inscriptions ouvrent bientôt. En attendant, l&apos;admin te donne ton accès.
              </p>
            )}
            {erreur && <p className="mt-[13px] px-[13px] text-[12.5px] font-medium text-[#FF6B5E]">{erreur}</p>}
            <div className="min-h-[34px] flex-1" />
          </div>
        </div>
      </div>

      {/* L'action, toujours sous le pouce */}
      <div
        className="relative z-10 mx-auto w-full max-w-[420px] px-[21px] pt-[13px]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 21px)" }}
      >
        <button
          type="button"
          disabled={envoi || (accueil && ouvert === false)}
          onClick={() => {
            if (fini) router.replace(equipe ? "/bola-team" : "/");
            else if (etape === derniere) void (sociale ? finirSociale() : creer());
            else aller(1);
          }}
          className={cn(
            "bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-[17px] text-[15px] font-bold",
            (envoi || (accueil && ouvert === false)) && "opacity-40"
          )}
        >
          {envoi && <Loader2 className="size-4 animate-spin" />}
          {action}
        </button>
        {accueil && !sociale && !equipe && ouvert !== false && (
          <BoutonsSociaux retour="/inscription" inscription enLigne onErreur={setErreur} className="mt-[8px]" />
        )}
        {accueil &&
          (sociale ? (
            <button
              type="button"
              onClick={() => void annulerSociale()}
              className="bouton-discret mt-[13px] block w-full py-[8px] text-center text-[13px] font-semibold"
            >
              Annuler
            </button>
          ) : (
            <Link href="/" className="bouton-discret mt-[13px] block py-[8px] text-center text-[13px] font-semibold">
              J&apos;ai déjà un compte
            </Link>
          ))}
      </div>

      {prise && (
        <PriseReference
          angle={prise}
          onFermer={() => setPrise(null)}
          onPrise={(dataUrl) => {
            const nouvelles = { ...refs, [prise]: dataUrl };
            setRefs(nouvelles);
            setErreur(null);
            // Enchaîne sur l'angle suivant qui manque : on ne quitte la caméra
            // qu'une fois les quatre faites.
            const suivant = ANGLES.find((a) => !nouvelles[a.id]);
            setPrise(suivant ? suivant.id : null);
          }}
        />
      )}
    </div>
  );
}
