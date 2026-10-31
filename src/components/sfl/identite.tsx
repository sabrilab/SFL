"use client";

// « C'est bien toi ? » — le prénom, le nom, le pseudo et l'email du joueur.
//
// Les noms de saison ont été tapés par l'admin, parfois de travers, et la
// ligue n'a pas l'email de tout le monde. Tant que le joueur connecté n'a pas
// confirmé (profiles.identite_le, voir lib/sfl/identites), l'accueil de
// l'app le lui demande avant tout le reste (components/sfl/accueil, depuis le
// 24/10) : sa carte arrive, elle change pendant qu'il tape, son nom et son
// pseudo s'y écrivent. On ne passe pas : l'email est obligatoire pour
// continuer. Une fois validé, le nom et le pseudo apparaissent partout
// (cartes, classements, feuilles), chez tout le monde.
//
// Ma carte rouvre la même saisie en touchant son nom, pour corriger plus
// tard (le pseudo, lui, reste soumis aux 30 jours) : FormulaireIdentite.
// L'accueil prend la saisie seule (useSaisieIdentite, ChampsIdentite).
//
// Le nom affiché suit l'usage de la ligue : le prénom seul, l'initiale du nom
// en cas d'homonyme (le serveur tranche, voir /api/identite).

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/sfl/player-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIdentites } from "@/hooks/use-identites";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { poserIdentite } from "@/lib/sfl/identites";
import { separerNom } from "@/lib/sfl/identites-regles";
import { capitaliser, emailValide, erreurPseudo, nettoyerNom, normaliserPseudo } from "@/lib/sfl/inscription";
import { cn } from "@/lib/utils";

type Etat = {
  prenom: string;
  nom: string;
  pseudo: string;
  prochain: string | null;
  email: string;
  /** Pseudo changé il y a moins de 30 jours : il attend `prochain`. */
  bloque: boolean;
};

async function appeler(chemin: string, methode: "GET" | "POST" = "GET", corps?: object) {
  const jeton = await jetonServeur();
  if (!jeton) return null;
  const r = await fetch(chemin, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).catch(() => null);
  if (!r) return null;
  return { ok: r.ok, status: r.status, d: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/**
 * La saisie de l'identité, partagée par la feuille de Ma carte
 * (FormulaireIdentite) et l'accueil de l'app (components/sfl/accueil) : ce
 * que le serveur sait déjà, le pseudo vérifié pendant la frappe, l'envoi.
 * `demo` : l'aperçu de l'accueil, sans rien lire ni écrire.
 */
export function useSaisieIdentite({ demo = false }: { demo?: boolean } = {}) {
  const { player } = useMyPlayer();
  const identite = useIdentites();
  const devine = separerNom(identite.nom(player.name));
  const [etat, setEtat] = useState<Etat>(() => ({
    ...devine,
    pseudo: identite.pseudo(player.name).replace(/^@/, ""),
    prochain: null,
    email: "",
    bloque: false,
  }));
  const [saisie, setSaisie] = useState<Etat>(etat);
  const [libre, setLibre] = useState<boolean | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [champ, setChamp] = useState<string | null>(null);
  /** Le dernier envoi est resté sans réponse du serveur : l'accueil laisse passer, et redemandera. */
  const [panne, setPanne] = useState(false);

  // Ce que le serveur sait déjà : la fiche, le vrai pseudo, l'email.
  useEffect(() => {
    if (demo) return;
    let annule = false;
    appeler("/api/identite").then((r) => {
      if (annule || !r?.ok) return;
      const d = r.d as Partial<Etat>;
      const e: Etat = {
        prenom: d.prenom ?? "",
        nom: d.nom ?? "",
        pseudo: d.pseudo ?? "",
        prochain: d.prochain ?? null,
        email: d.email ?? "",
        bloque: !!d.prochain && new Date(d.prochain).getTime() > Date.now(),
      };
      setEtat(e);
      setSaisie(e);
    });
    return () => {
      annule = true;
    };
  }, [demo]);

  const { bloque } = etat;
  const pseudo = normaliserPseudo(saisie.pseudo);
  const pseudoChange = pseudo !== etat.pseudo;

  useEffect(() => {
    if (demo || !pseudoChange || erreurPseudo(pseudo)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialise l'état d'une requête réseau
      setLibre(null);
      return;
    }
    let annule = false;
    const t = setTimeout(() => {
      appeler(`/api/pseudo?pseudo=${encodeURIComponent(pseudo)}`).then((r) => {
        if (!annule && r?.ok) setLibre((r.d.libre as boolean | undefined) ?? null);
      });
    }, 420);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [demo, pseudo, pseudoChange]);

  const prenom = capitaliser(nettoyerNom(saisie.prenom));
  const nom = capitaliser(nettoyerNom(saisie.nom));
  const email = saisie.email.trim().toLowerCase();
  const emailOk = emailValide(email) && !email.endsWith("@sfl.local");
  const pret = !!prenom && !!nom && emailOk && !erreurPseudo(pseudo) && (!pseudoChange || libre !== false);

  /** Enregistre et confirme ; le nom affiché retenu par le serveur, ou null (refusé : il est dit). */
  async function enregistrer(): Promise<string | null> {
    if (!pret || envoi) return null;
    if (demo) return prenom;
    setEnvoi(true);
    setChamp(null);
    const r = await appeler("/api/identite", "POST", { prenom, nom, pseudo, email });
    setEnvoi(false);
    // Pas un refus (un champ à reprendre) mais le serveur qui ne répond pas.
    setPanne(!r || r.status >= 500);
    if (r?.ok) {
      const affiche = String(r.d.affiche ?? prenom);
      poserIdentite(player.name, affiche, String(r.d.pseudo ?? pseudo));
      return affiche;
    }
    setChamp((r?.d.champ as string | undefined) ?? null);
    toast.error((r?.d.error as string | undefined) ?? "Enregistrement impossible pour l'instant.");
    return null;
  }

  return { player, etat, saisie, setSaisie, libre, envoi, champ, panne, bloque, pseudo, pseudoChange, prenom, pret, enregistrer };
}

/** La carte qui s'écrit, et les quatre champs. `onFini` : après l'enregistrement. */
export function FormulaireIdentite({ onFini }: { onFini?: () => void }) {
  const saisieIdentite = useSaisieIdentite();
  const { player, envoi, pseudo, prenom, pret, enregistrer } = saisieIdentite;

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const affiche = await enregistrer();
    if (affiche === null) return;
    toast.success(`C'est noté, ${affiche}`);
    onFini?.();
  }

  return (
    <form onSubmit={valider} className="flex w-full flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0.7, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
      >
        <PlayerCard player={player} size={0.7} affiche={prenom || " "} pseudo={pseudo ? `@${pseudo}` : ""} />
      </motion.div>

      <h2 className="text-center text-titre-g leading-tight font-extrabold tracking-tight">C&apos;est bien toi ?</h2>

      <ChampsIdentite saisie={saisieIdentite} />

      <button
        type="submit"
        disabled={!pret || envoi}
        className="bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-[15px] text-lecture font-bold disabled:opacity-40"
      >
        {envoi && <Loader2 className="size-4 animate-spin" />}
        C&apos;est moi
      </button>
    </form>
  );
}

/** Le prénom, le nom, le pseudo et l'email : les champs de la saisie (useSaisieIdentite). */
export function ChampsIdentite({ saisie: s }: { saisie: ReturnType<typeof useSaisieIdentite> }) {
  const { etat, saisie, setSaisie, libre, champ, bloque, pseudoChange } = s;
  const ligne = "glass-soft flex items-center rounded-2xl px-4";
  const entree =
    "min-w-0 flex-1 bg-transparent py-[13px] text-lecture font-medium text-foreground outline-none placeholder:text-encre-4";
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className={cn(ligne, champ === "prenom" && "ring-1 ring-[#FF6B5E]")}>
          <input
            value={saisie.prenom}
            onChange={(e) => setSaisie({ ...saisie, prenom: e.target.value })}
            autoComplete="given-name"
            maxLength={40}
            placeholder="Prénom"
            aria-label="Prénom"
            className={entree}
          />
        </label>
        <label className={cn(ligne, champ === "nom" && "ring-1 ring-[#FF6B5E]")}>
          <input
            value={saisie.nom}
            onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
            autoComplete="family-name"
            maxLength={60}
            placeholder="Nom"
            aria-label="Nom"
            className={entree}
          />
        </label>
      </div>

      <label className={cn(ligne, champ === "pseudo" && "ring-1 ring-[#FF6B5E]")}>
        <span className="text-lecture font-bold text-encre-4">@</span>
        <input
          value={saisie.pseudo}
          onChange={(e) => setSaisie({ ...saisie, pseudo: normaliserPseudo(e.target.value) })}
          readOnly={bloque}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          placeholder="pseudo"
          aria-label="Pseudo"
          className={cn(entree, bloque && "text-encre-3")}
        />
        {bloque ? (
          <span className="mono-label shrink-0 text-encre-4">Jusqu&apos;au {jour(etat.prochain!)}</span>
        ) : pseudoChange && libre === true ? (
          <Check className="size-4 shrink-0 text-encre-3" />
        ) : pseudoChange && libre === false ? (
          <span className="mono-label shrink-0 text-[#c8352b] dark:text-[#FF6B5E]">Pris</span>
        ) : null}
      </label>

      <label className={cn(ligne, champ === "email" && "ring-1 ring-[#FF6B5E]")}>
        <input
          type="email"
          inputMode="email"
          value={saisie.email}
          onChange={(e) => setSaisie({ ...saisie, email: e.target.value })}
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Email"
          aria-label="Email"
          className={entree}
        />
      </label>
    </div>
  );
}
