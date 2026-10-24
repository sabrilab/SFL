"use client";

// La case de l'ouverture : la politique de confidentialité en court, avant
// d'entrer dans l'app (Sabri, 22/10/2026 : « quand ils se connectent, ils ont
// un truc à cocher rapidement, qui peuvent lire en profondeur aussi »).
//
// Tant que le joueur connecté n'a pas d'accord qui vaille encore (une version
// au moins aussi récente que VERSION_ACCEPTEE), l'app se voile au-dessus de
// tout le reste : l'essentiel
// en cinq points, le texte entier à un toucher (politique.tsx), une case
// obligatoire, une case facultative pour l'usage de sa carte hors de l'app
// et, avant 15 ans, celle d'un parent. « Continuer » enregistre l'accord
// (lib/sfl/consentement.ts) ; « Me déconnecter » laisse la porte fermée.
//
// Les invitations de l'ouverture (nouvelles cartes, badges, notifications,
// photo, identité) attendent l'accord : ApresAccord ne les monte qu'après.
//
// Pas de voile sur les pages qui ont leur propre case ou pas de compte :
// l'inscription (la case est à sa dernière étape), le lien d'accueil et la
// politique elle-même.

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Camera, Check, ChevronLeft, ChevronRight, Loader2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAccord } from "@/hooks/use-accord";
import { signOut } from "@/lib/sfl/auth/session";
import { AGE_ACCORD_PARENT, DATE_POLITIQUE } from "@/lib/sfl/confidentialite";
import { donnerAccord, monAge, rafraichirAccord } from "@/lib/sfl/consentement";
import { TextePolitique } from "./politique";
import { cn } from "@/lib/utils";

/** Les pages sans voile : elles ont leur propre case, ou pas de compte. */
const SANS_VOILE = ["/confidentialite", "/inscription", "/bienvenue"];

/** En dev, `?confidentialite` le montre sans compte vérifié (captures) ; `=mineur` ajoute la case du parent. */
function apercu(): { mineur: boolean } | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("confidentialite");
  return v === null ? null : { mineur: v === "mineur" };
}

const POINTS = [
  {
    icone: Camera,
    titre: "Ta photo de carte",
    texte:
      "Tes selfies partent chez fal.ai le temps que l'IA fasse ta photo ; Bola ne les garde pas. La photo obtenue s'affiche sur ta carte, partout dans l'app, et se voit sans compte.",
  },
  {
    icone: Users,
    titre: "Ce que la ligue voit",
    texte: "Ta carte, tes stats, tes messages au Vestiaire et ta ville sur la Map (le mode fantôme t'en retire).",
  },
  {
    icone: Sparkles,
    titre: "Bola Agent",
    texte:
      "Tes questions et ton dossier de joueur partent chez Anthropic pour que le coach te réponde. Ta santé : dis-lui seulement ce que tu veux.",
  },
  {
    icone: Activity,
    titre: "Le journal d'usage",
    texte: "Les pages ouvertes et le temps passé, lus par les administrateurs pour améliorer la bêta.",
  },
  {
    icone: ShieldCheck,
    titre: "Tes données restent à toi",
    texte: "Pas de pub, rien de vendu. Tu corriges, retires ou fais effacer ce que tu veux.",
  },
] as const;

/** La case d'un parent, avant AGE_ACCORD_PARENT (voile et inscription). */
export const PHRASE_PARENT = `J'ai moins de ${AGE_ACCORD_PARENT}\u00a0ans\u00a0: un de mes parents l'a lue et donne son accord avec moi.`;

/** Une case à cocher de l'accord : la case native, cachée, garde le clavier et les lecteurs d'écran. */
export function CaseAccord({
  coche,
  onChange,
  children,
  note,
}: {
  coche: boolean;
  onChange: (coche: boolean) => void;
  children: React.ReactNode;
  note?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-[13px] py-[8px] select-none">
      <input
        id={id}
        type="checkbox"
        checked={coche}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-[1px] grid size-[22px] shrink-0 place-items-center rounded-[7px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground/60",
          coche ? "bg-foreground text-background" : "ring-1 ring-foreground/35 ring-inset"
        )}
      >
        {coche && <Check className="size-[15px]" strokeWidth={3} />}
      </span>
      <span className="min-w-0 text-[13.5px] leading-snug font-medium text-foreground/80">
        {children}
        {note && <span className="ml-[6px] text-foreground/40">{note}</span>}
      </span>
    </label>
  );
}

/** La phrase de la case obligatoire : « politique de confidentialité » ouvre le texte entier. */
export function PhraseAccord({ onLire }: { onLire: () => void }) {
  return (
    <>
      J&apos;accepte la{" "}
      <button
        type="button"
        onClick={(e) => {
          // Dans le <label> : lire sans cocher.
          e.preventDefault();
          onLire();
        }}
        className="font-semibold text-foreground underline underline-offset-2"
      >
        politique de confidentialité
      </button>{" "}
      et l&apos;usage de ma photo sur ma carte, dans l&apos;app.
    </>
  );
}

/**
 * Le texte entier, lu sans quitter l'écran où l'on coche (le voile,
 * l'inscription) : rien de ce qui est en cours ne se perd.
 */
export function LecturePolitique({ onRetour }: { onRetour: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Politique de confidentialité" className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[420px] items-center px-[13px] pt-[8px] pb-[8px]">
        <button
          type="button"
          onClick={onRetour}
          className="bouton-discret flex items-center gap-[2px] py-[8px] pr-[13px] pl-[6px] text-[14px] font-semibold"
        >
          <ChevronLeft className="size-5" />
          Retour
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div
          className="mx-auto w-full max-w-[420px] px-[21px] pt-[13px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 34px)" }}
        >
          <TextePolitique />
          <button
            type="button"
            onClick={onRetour}
            className="bouton-secondaire mt-[34px] w-full py-[15px] text-[15px] font-bold"
          >
            Revenir à l&apos;accord
          </button>
        </div>
      </div>
    </div>
  );
}

/** Le voile de l'ouverture : tant que la version en vigueur n'est pas acceptée. */
export function ConsentementObligatoire() {
  const session = useSession();
  const pathname = usePathname();
  const [force] = useState(apercu);
  const nom = session?.name ?? null;
  const serveur = !!session?.server;
  const { donne, accord } = useAccord(nom);

  // La ligne du serveur fait foi : un accord donné sur un autre téléphone
  // ouvre celui-ci, un accord effacé côté serveur referme la porte.
  useEffect(() => {
    if (nom) void rafraichirAccord(nom, serveur);
  }, [nom, serveur]);

  const libre = SANS_VOILE.some((r) => pathname?.startsWith(r));
  const visible = !!force || (!!nom && !libre && donne === false);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="consentement"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[90] flex flex-col bg-background"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="orbs" aria-hidden>
            <i />
            <i />
            <i />
          </div>
          <Accord
            nom={nom ?? "Toi"}
            serveur={serveur}
            mineurForce={!!force?.mineur}
            avant={accord}
            apercu={!!force}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Accord({
  nom,
  serveur,
  mineurForce,
  avant,
  apercu,
}: {
  nom: string;
  serveur: boolean;
  mineurForce: boolean;
  avant: ReturnType<typeof useAccord>["accord"];
  apercu: boolean;
}) {
  const [lecture, setLecture] = useState(false);
  const [oui, setOui] = useState(false);
  // Une nouvelle version garde son choix d'avant pour la carte hors de l'app.
  const [horsApp, setHorsApp] = useState(avant?.horsApp ?? false);
  const [parent, setParent] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const titre = useId();

  useEffect(() => {
    if (!serveur) return;
    let annule = false;
    void monAge().then((a) => {
      if (!annule) setAge(a);
    });
    return () => {
      annule = true;
    };
  }, [serveur]);

  const mineur = mineurForce || (age !== null && age < AGE_ACCORD_PARENT);
  const pret = oui && (!mineur || parent);
  const nouvelle = !!avant && !apercu;

  async function continuer() {
    if (!pret || envoi) return;
    setEnvoi(true);
    navigator.vibrate?.(12);
    // L'app s'ouvre aussitôt : l'accord est gardé ici et part au serveur, ou
    // à la prochaine ouverture s'il n'a pas pu.
    await donnerAccord(nom, { horsApp, parent: mineur && parent, ou: "ouverture" });
    setEnvoi(false);
  }

  if (lecture) return <LecturePolitique onRetour={() => setLecture(false)} />;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titre} className="relative z-10 flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[420px] flex-col px-[21px] pt-[21px] pb-[21px]">
          <Image src="/bola/logo-blanc.svg" alt="Bola" width={101} height={24} className="self-start" priority />
          <p className="mono-label mt-[34px] text-foreground/40">
            {nouvelle ? `Nouvelle version · ${DATE_POLITIQUE}` : "Bêta fermée · Confidentialité"}
          </p>
          <h1 id={titre} className="mt-[8px] text-[34px] leading-[1.05] font-extrabold tracking-tight">
            Ton image, tes données.
          </h1>

          <ul className="mt-[34px] flex flex-col gap-[21px]">
            {POINTS.map(({ icone: Icone, titre: t, texte }) => (
              <li key={t} className="flex gap-[13px]">
                <span className="glass-soft grid size-[34px] shrink-0 place-items-center rounded-full">
                  <Icone className="size-[16px] text-foreground/80" />
                </span>
                <span className="min-w-0 pt-[1px]">
                  <span className="block text-[15px] leading-tight font-bold">{t}</span>
                  <span className="mt-[5px] block text-[13.5px] leading-snug text-foreground/55">{texte}</span>
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setLecture(true)}
            className="bouton-secondaire mt-[34px] flex items-center justify-center gap-[6px] py-[13px] text-[14px] font-bold"
          >
            Lire la politique en entier
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Les cases et l'action, toujours sous le pouce. */}
      <div
        className="mx-auto w-full max-w-[420px] border-t border-foreground/8 bg-background/80 px-[21px] pt-[13px] backdrop-blur-md"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 13px)" }}
      >
        <CaseAccord coche={oui} onChange={setOui}>
          <PhraseAccord onLire={() => setLecture(true)} />
        </CaseAccord>
        {mineur && (
          <CaseAccord coche={parent} onChange={setParent}>
            {PHRASE_PARENT}
          </CaseAccord>
        )}
        <CaseAccord coche={horsApp} onChange={setHorsApp} note="Facultatif">
          Bola peut aussi montrer ma carte dans ses vidéos et ses posts, hors de l&apos;app.
        </CaseAccord>
        <button
          type="button"
          onClick={continuer}
          disabled={!pret || envoi}
          className="bouton-principal bouton--vert mt-[13px] flex w-full items-center justify-center gap-2 py-[16px] text-[15px] font-bold disabled:opacity-40"
        >
          {envoi && <Loader2 className="size-4 animate-spin" />}
          Continuer
        </button>
        <button
          type="button"
          onClick={signOut}
          className="bouton-discret bouton--rouge mt-[5px] block w-full py-[8px] text-center text-[13px] font-semibold"
        >
          Me déconnecter
        </button>
      </div>
    </div>
  );
}

/**
 * Ce qui s'ouvre de soi-même à l'ouverture (cérémonies, invitations,
 * identité) : seulement une fois l'accord donné, pour ne rien jouer sous le
 * voile.
 */
export function ApresAccord({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { donne } = useAccord(session?.name);
  if (session && donne !== true) return null;
  return <>{children}</>;
}
