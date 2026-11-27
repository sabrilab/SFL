"use client";

// L'agent de l'entraîneur (Bola Club, /club/agent) : sa discussion à lui,
// comme Bola Agent l'est pour un joueur (components/sfl/agent.tsx), sur son
// équipe. Demande de Bola (27/11/2026) : l'entraîneur lui parle des blessures,
// du ressenti, de la reprise d'un joueur ; l'agent propose des séances, des
// reprises, des schémas, des conseils qui restent des conseils ; et
// l'entraîneur doit s'y sentir aidé, et avoir envie de revenir.
//
// En haut du fil : sa semaine (lib/sfl/club/agent-club.ts, semaineDe), des
// tuiles toutes vraies et toutes bonnes à entendre, puis les blessés de la
// catégorie en une ligne chacun (l'étape de leur reprise). Puis la
// conversation : l'agent ouvre toujours par une question sur lui
// (ouvertureDe) ; venu de la fiche d'un joueur (?joueur=), sur ce joueur.
// Au-dessus de la barre d'écriture, des départs : la reprise d'un blessé,
// préparer le prochain entraînement, le groupe fatigué, motiver avant le
// match, et « Comment je vais, moi ».
//
// La conversation est gardée sur le téléphone, par entraîneur et par
// catégorie (CLE), comme toute la démo du club. Tant que la route n'a pas sa
// clé (/club/api/agent répond { pret: false }), l'agent répond par des
// réponses d'exemple bâties sur les vraies données du club (la séance
// proposée de proposition.ts, la reprise de suivi.ts), marquées comme
// telles. ?demo=agent ouvre une conversation d'essai, pour juger le rendu.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ArrowUp, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { useEcranClavier } from "@/hooks/use-ecran-clavier";
import { useFilAuBas } from "@/hooks/use-fil-au-bas";
import { LIBELLE_CARTE, QUESTION_MAX, lireCartes, type CarteCoach, type MessageAgent } from "@/lib/sfl/agent";
import { dossierEquipe, joueursDe, ouvertureDe, semaineDe } from "@/lib/sfl/club/agent-club";
import { exerciceDe } from "@/lib/sfl/club/exercices";
import { proposer } from "@/lib/sfl/club/proposition";
import { seancePassee } from "@/lib/sfl/club/regles";
import { blessureEnCours, ETAPES_REPRISE } from "@/lib/sfl/club/suivi";
import type { Club, Membre } from "@/lib/sfl/club/types";
import { lireSchema, type SchemaCoach } from "@/lib/sfl/schemas-coach";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { SchemaVue } from "../schemas-coach";
import { ditBlessure } from "./blessures";
import { NOMBRE, Puces } from "./puces";

const CLE = "bola-club-agent-1";
const GARDES = 60;
/** L'heure d'un envoi (hors rendu). */
const horloge = () => Date.now();
const tactile = () => window.matchMedia("(pointer: coarse)").matches;

type Message = MessageAgent & { exemple?: boolean };

function lire(cle: string): Message[] {
  try {
    const v = JSON.parse(localStorage.getItem(`${CLE}:${cle}`) ?? "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .filter((m) => (m.role === "joueur" || m.role === "coach") && typeof m.texte === "string")
      .map((m) => ({
        id: String(m.id),
        role: m.role as Message["role"],
        texte: m.texte as string,
        cartes: lireCartes(m.cartes),
        schema: lireSchema(m.schema),
        at: Number(m.at) || 0,
        exemple: m.exemple === true,
      }));
  } catch {
    return [];
  }
}

function garder(cle: string, ms: Message[]) {
  try {
    localStorage.setItem(`${CLE}:${cle}`, JSON.stringify(ms.slice(-GARDES)));
  } catch {}
}

/* ------------------------------- Les cartes ------------------------------- */

function CarteVue({ carte }: { carte: CarteCoach }) {
  const numerotee = carte.type === "programme" || carte.type === "exercice" || carte.type === "sante";
  return (
    <div className="glass-soft w-full overflow-hidden rounded-[22px]">
      <div className="px-4 pt-3.5 pb-3">
        <span className="block text-legende font-bold tracking-[0.08em] text-encre-3 uppercase">{LIBELLE_CARTE[carte.type]}</span>
        <span className="mt-0.5 block text-titre leading-tight font-bold tracking-tight">{carte.titre}</span>
        {carte.sousTitre && <span className="mt-1 block text-corps text-encre-3">{carte.sousTitre}</span>}
      </div>
      {carte.lignes.length > 0 && (
        <ol className="border-t border-contraste/[0.07]">
          {carte.lignes.map((l, i) => (
            <li key={i} className="flex items-start gap-3 border-b border-contraste/[0.07] px-4 py-2.5 last:border-b-0">
              {numerotee && <span className="w-4 shrink-0 pt-px text-corps font-bold text-encre-4 tabular-nums">{i + 1}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-lecture leading-snug font-semibold">{l.label}</span>
                {l.detail && <span className="mt-0.5 block text-corps leading-snug text-encre-3">{l.detail}</span>}
              </span>
              {l.valeur && <span className="max-w-[40%] shrink-0 pt-px text-right text-ligne font-bold tabular-nums">{l.valeur}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const Bulle = memo(function Bulle({ m }: { m: Message }) {
  const mien = m.role === "joueur";
  return (
    <div className={cn("mb-3 flex flex-col gap-2", mien ? "items-end" : "items-start")}>
      {m.texte && (
        <p
          className={cn(
            "max-w-[82%] rounded-[20px] px-3.5 py-2 text-lecture leading-snug break-words whitespace-pre-wrap",
            mien ? "bg-foreground text-background" : "glass-soft",
          )}
        >
          {m.texte}
        </p>
      )}
      {m.schema && <SchemaVue schema={m.schema} />}
      {m.cartes.map((c, i) => (
        <CarteVue key={i} carte={c} />
      ))}
      {m.exemple && <span className="mono-label px-1 text-encre-4">Réponse d&apos;exemple</span>}
    </div>
  );
});

function Reflechit() {
  return (
    <div className="glass-soft mb-3 flex w-fit items-center gap-1 rounded-[20px] px-4 py-3" aria-label="L'agent écrit">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[7px] animate-pulse rounded-full bg-foreground/60 motion-reduce:animate-none" style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </div>
  );
}

/* -------------------------------- Sa semaine ------------------------------ */

function SaSemaine({ club, staff, categorie }: { club: Club; staff: string; categorie: string }) {
  const moments = semaineDe(club, staff);
  const blesses = joueursDe(club, categorie)
    .map((m) => ({ m, b: blessureEnCours(club, m.id) }))
    .filter((x): x is { m: Membre; b: NonNullable<ReturnType<typeof blessureEnCours>> } => !!x.b);
  return (
    <div className="mb-6 flex flex-col gap-3 pt-1">
      {moments.length > 0 && (
        <>
          <span className="mono-label text-encre-3">Ta semaine</span>
          <div className="grid grid-cols-2 gap-2">
            {moments.map((x) => (
              <div key={x.dit} className="flex flex-col gap-1.5 rounded-[20px] bg-card p-3.5">
                <span style={{ ...NOMBRE, fontSize: 30 }} className="tabular-nums">
                  {x.chiffre}
                </span>
                <span className="text-corps leading-snug text-encre-2">{x.dit}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {blesses.length > 0 && (
        <ul className="flex flex-col rounded-[20px] bg-card px-3.5 py-1">
          {blesses.map(({ m, b }) => (
            <li key={m.id} className="border-b border-contraste/[0.07] last:border-b-0">
              <Link href={`/club/joueur/${m.id}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-lecture font-semibold">{m.prenom}</span>
                  <span className="block text-corps text-encre-3">{ditBlessure(b)}</span>
                </span>
                <span className="shrink-0 text-right text-corps text-encre-2">{`${ETAPES_REPRISE[b.etape].nom} · ${b.etape + 1}/6`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------- Les réponses d'exemple ------------------------- */

/**
 * Sans clé (aperçus), une réponse bâtie sur les vraies données du club, pour
 * juger le parcours : jamais présentée comme celle du modèle.
 */
function reponseExemple(club: Club, categorie: string, question: string, focus: Membre | null): { texte: string; cartes: CarteCoach[]; schema: SchemaCoach | null } {
  const q = question.toLowerCase();
  const blesse = focus ?? joueursDe(club, categorie).find((m) => blessureEnCours(club, m.id)) ?? null;
  const b = blesse ? blessureEnCours(club, blesse.id) : null;
  if (b && blesse && /bless|repris|mal|douleur|cheville|genou|ischio|retour/.test(q)) {
    const ici = ETAPES_REPRISE[b.etape];
    const suite = ETAPES_REPRISE[b.etape + 1];
    return {
      texte: `${blesse.prenom} en est à « ${ici.nom.toLowerCase()} ». Pendant la séance du groupe, voilà ce qu'il peut faire à côté. Si la douleur revient, on reste à cette étape et on le fait voir par un kiné.`,
      schema: { type: "corps", zones: [{ zone: b.zone, cote: b.cote }], legende: `${ditBlessure(b)} : la zone à ménager` },
      cartes: [
        {
          type: "sante",
          titre: `La reprise de ${blesse.prenom}`,
          sousTitre: `Étape ${b.etape + 1} sur 6`,
          cible: "",
          lignes: [
            { label: `Maintenant : ${ici.nom.toLowerCase()}`, detail: ici.detail, valeur: "cette semaine" },
            ...(suite ? [{ label: `Ensuite : ${suite.nom.toLowerCase()}`, detail: suite.detail, valeur: "sans douleur" }] : []),
            { label: "À surveiller", detail: "Gonflement, boiterie, douleur le lendemain : on revient à l'étape d'avant.", valeur: "" },
          ],
        },
      ],
    };
  }
  if (/s[ée]ance|entra[iî]n|mercredi|pr[ée]pare/.test(q)) {
    const prochaine = club.seances
      .filter((s) => s.categorie === categorie && s.genre === "entrainement" && !seancePassee(s, club.jour) && s.jour >= club.jour)
      .sort((x, y) => x.jour.localeCompare(y.jour))[0];
    if (prochaine) {
      const p = proposer(club, prochaine, { objectif: "technique", minutes: 75, joueurs: prochaine.convoques.length || 12 });
      return {
        texte: "Voilà une base de 75 minutes sur la technique, adaptée à l'âge et au groupe. Tu me dis ce que tu veux changer.",
        schema: null,
        cartes: [
          {
            type: "programme",
            titre: "Technique · 75 min",
            sousTitre: `${prochaine.convoques.length} convoqués`,
            cible: "",
            lignes: p.lignes.map((l) => ({ label: exerciceDe(club, l.exercice)?.nom ?? l.exercice, detail: "", valeur: `${l.minutes} min` })),
          },
        ],
      };
    }
  }
  if (/fatigu|lourd|dur|crev/.test(q))
    return {
      texte: "Ça arrive après un match engagé. Cette semaine, on garde le ballon et on retire l'intensité : du jeu réduit sans sprint à fond, et un vrai retour au calme. Tu as noté leur ressenti à la dernière séance ?",
      schema: null,
      cartes: [],
    };
  return {
    texte: "Merci de me le dire. Tu fais déjà beaucoup pour eux, et ça se voit dans tes présences. Qu'est-ce qui te pèse le plus en ce moment ?",
    schema: null,
    cartes: [],
  };
}

/** ?demo=agent : une conversation d'essai sur un vrai blessé de la catégorie. */
function conversationDemo(club: Club, staff: string, categorie: string): Message[] {
  const blesse = joueursDe(club, categorie).find((m) => blessureEnCours(club, m.id));
  const ouv = ouvertureDe(club, staff);
  const t = Date.now() - 600_000;
  const out: Message[] = [{ id: "d-0", role: "coach", texte: ouv, cartes: [], at: t }];
  out.push({ id: "d-1", role: "joueur", texte: "Un peu crevé, mais ça va. Par contre je m'inquiète pour la reprise de mes blessés.", cartes: [], at: t + 1 });
  if (blesse) {
    const r = reponseExemple(club, categorie, "reprise", blesse);
    out.push({ id: "d-2", role: "coach", texte: r.texte, cartes: r.cartes, schema: r.schema, at: t + 2, exemple: true });
  }
  return out;
}

/* --------------------------------- L'écran -------------------------------- */

export function AgentClub() {
  const { club, moi, droits } = useClub();
  const params = useSearchParams();
  const focusId = params.get("joueur");
  const demo = params.get("demo") === "agent";
  const siennes = club.categories.filter((c) => droits.gere(c.id)).sort((a, b) => a.ordre - b.ordre);
  const focus = focusId ? (club.membres.find((m) => m.id === focusId && droits.gereJoueur(m)) ?? null) : null;
  const [cat, setCat] = useState<string>(() => focus?.categorie ?? params.get("cat") ?? siennes[0]?.id ?? "");
  const categorie = siennes.some((c) => c.id === cat) ? cat : (siennes[0]?.id ?? "");
  const cle = `${moi.id}:${categorie}`;
  const dossier = useMemo(() => dossierEquipe(club, moi.id, categorie, focus?.id), [club, moi.id, categorie, focus?.id]);
  const ouverture = useMemo(() => ouvertureDe(club, moi.id, focus?.id), [club, moi.id, focus?.id]);

  const [pret, setPret] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [charge, setCharge] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const ecran = useEcranClavier();
  const { fil, contenu, onScroll, tenir, allerEnBas } = useFilAuBas();

  useEffect(() => {
    let vivant = true;
    fetch("/club/api/agent")
      .then((r) => r.json())
      .then((d: { pret?: boolean }) => vivant && setPret(!!d.pret))
      .catch(() => vivant && setPret(false));
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      setMessages(demo ? conversationDemo(club, moi.id, categorie) : lire(cle));
      setCharge(true);
    });
    // La conversation se relit quand on change de catégorie, pas à chaque changement du club.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, demo]);

  useLayoutEffect(() => {
    if (charge) tenir();
  }, [charge, messages, envoi, tenir]);

  // L'ouverture de l'agent, tant que la conversation n'a pas commencé (ou, venu d'une fiche, sur ce joueur).
  const ouvre = charge && (!messages.length || !!focus) && !demo;

  async function demander(question: string) {
    const q = question.trim();
    if (!q || envoi || pret === null) return;
    const avant = messages;
    const t = horloge();
    const ajout: Message[] = [
      ...(ouvre ? [{ id: `o-${t}`, role: "coach" as const, texte: ouverture, cartes: [], at: t - 1 }] : []),
      { id: `q-${t}`, role: "joueur", texte: q, cartes: [], at: t },
    ];
    setMessages([...avant, ...ajout]);
    setTexte("");
    setEnvoi(true);
    allerEnBas();
    try {
      let rep: { texte: string; cartes: CarteCoach[]; schema: SchemaCoach | null; exemple?: boolean };
      if (!pret || demo) {
        await new Promise((r) => setTimeout(r, 900));
        rep = { ...reponseExemple(club, categorie, q, focus), exemple: true };
      } else {
        const { data } = await supabase().auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Reconnecte-toi pour parler à ton agent.");
        const r = await fetch("/club/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            question: q,
            dossier,
            ouverture: ouvre ? ouverture : undefined,
            historique: avant.slice(-16).map((m) => ({ role: m.role, texte: m.texte, cartes: m.cartes, schema: m.schema ?? null })),
          }),
        });
        const d = (await r.json().catch(() => ({}))) as { texte?: string; cartes?: unknown; schema?: unknown; error?: string };
        if (!r.ok) throw new Error(d.error ?? "L'agent n'a pas pu répondre. Réessaie.");
        rep = { texte: d.texte ?? "", cartes: lireCartes(d.cartes), schema: lireSchema(d.schema) };
      }
      navigator.vibrate?.(8);
      const suite = [...avant, ...ajout, { id: `r-${horloge()}`, role: "coach" as const, texte: rep.texte, cartes: rep.cartes, schema: rep.schema, at: horloge(), exemple: rep.exemple }];
      setMessages(suite);
      if (!demo) garder(cle, suite);
    } catch (e) {
      setMessages(avant);
      setTexte(q);
      toast.error(e instanceof Error ? e.message : "L'agent n'a pas pu répondre. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  const blesse = (focus && blessureEnCours(club, focus.id) ? focus : null) ?? joueursDe(club, categorie).find((m) => blessureEnCours(club, m.id)) ?? null;
  const departs = [
    ...(blesse ? [{ label: `La reprise de ${blesse.prenom}`, question: `Comment je gère la reprise de ${blesse.prenom} cette semaine ?` }] : []),
    { label: "Préparer l'entraînement", question: "Aide-moi à préparer le prochain entraînement." },
    { label: "Le groupe est fatigué", question: "Le groupe est fatigué en ce moment. J'adapte comment ?" },
    { label: "Motiver avant le match", question: "Donne-moi une idée pour motiver le groupe avant le match." },
    { label: "Comment je vais, moi", question: "Franchement, en ce moment je suis un peu à bout." },
  ];

  if (!siennes.length)
    return <p className="mx-auto max-w-xl px-5 py-10 text-center text-lecture text-encre-3">L&apos;agent est celui des entraîneurs.</p>;

  return (
    <section
      ref={ecran}
      data-ecran-fixe=""
      data-onglets=""
      className="ecran-discussion fixed inset-x-0 top-0 z-[35] flex flex-col bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="mx-auto flex w-full max-w-[640px] shrink-0 flex-col gap-3 pt-3 pb-2 lg:max-w-[760px]">
        <div className="flex items-center gap-2 px-3">
          <Link href="/club/planning" aria-label="Retour" className="bouton-discret grid size-10 place-items-center">
            <ChevronLeft className="size-6" strokeWidth={2.2} />
          </Link>
          <h1 className="text-[26px] leading-none font-bold tracking-tight">Mon agent</h1>
        </div>
        {siennes.length > 1 && <Puces nom="Catégorie" choix={siennes.map((c) => ({ id: c.id, label: c.nom }))} actif={categorie} onChange={setCat} />}
      </header>

      <div ref={fil} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={contenu} className="mx-auto flex min-h-full w-full max-w-[640px] flex-col px-5 pb-3 lg:max-w-[760px]">
          {charge && (
            <>
              <SaSemaine club={club} staff={moi.id} categorie={categorie} />
              <div className="mt-auto">
                {messages.map((m) => (
                  <Bulle key={m.id} m={m} />
                ))}
                {ouvre && !envoi && <Bulle m={{ id: "ouverture", role: "coach", texte: ouverture, cartes: [], at: 0 }} />}
                {envoi && <Reflechit />}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[640px] shrink-0 px-3 pt-2 lg:max-w-[760px]" style={{ paddingBottom: "var(--pied-ecriture)" }}>
        {!texte.trim() && !envoi && (
          <div className="hors-clavier -mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
            {departs.map((d) => (
              <button key={d.label} type="button" onClick={() => void demander(d.question)} className="bouton-secondaire shrink-0 px-3.5 py-2 text-ligne font-semibold">
                {d.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void demander(texte);
          }}
          className="glass flex items-end gap-1.5 rounded-[26px] p-1.5 pl-3"
        >
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !tactile()) {
                e.preventDefault();
                void demander(texte);
              }
            }}
            rows={1}
            maxLength={QUESTION_MAX}
            placeholder="Écris à ton agent"
            aria-label="Écris à ton agent"
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-[9px] text-titre leading-snug outline-none placeholder:text-encre-4 [field-sizing:content]"
          />
          <button
            type="submit"
            onPointerDown={(e) => e.preventDefault()}
            disabled={envoi || !texte.trim()}
            aria-label="Envoyer"
            className="bouton-principal flex size-10 shrink-0 items-center justify-center disabled:opacity-25"
          >
            <ArrowUp className="size-5" strokeWidth={2.75} />
          </button>
        </form>
      </div>
    </section>
  );
}
