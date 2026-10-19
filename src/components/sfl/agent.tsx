"use client";

// Bola Agent — le coach personnel du joueur, sa page à lui (/agent), à côté
// du Vestiaire sous la même bulle de la barre d'onglets (le titre passe de
// l'un à l'autre, titre-discussion.tsx).
//
// En haut du fil, toujours, la fiche que le coach a sous les yeux : la carte
// du joueur et ses six stats, de la meilleure à la pire. Puis la conversation :
// mes questions en blanc à droite, ses réponses en verre à gauche, et sous
// elles ses cartes (programme, exercice, débrief, panier, santé, bilan), que
// l'app met en page elle-même (lib/sfl/agent.ts dit pourquoi pas d'images).
// Après un match récent, le coach ouvre : « J11 : victoire, 2 buts. Alors,
// c'était comment ? ». Au-dessus de la barre d'écriture, quatre départs :
// ma pire stat, le débrief, mes courses, une douleur.
//
// Comme le Vestiaire : un écran de discussion à la hauteur de ce qui est
// visible (le clavier d'iPhone recouvre la page), la barre d'écriture en bas,
// les onglets effacés pendant qu'on écrit.
//
// Tant que la clé du modèle n'est pas posée dans Vercel (/api/agent répond
// { pret: false }), la fiche reste et la barre d'écriture cède la place à une
// ligne : « Bola Agent arrive bientôt. »
//
// Données : la table agent_messages (la conversation, privée). En
// développement seulement, ?demo=agent montre une conversation d'essai, sans
// base ni modèle, pour juger le rendu.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { TitreDiscussion } from "@/components/sfl/titre-discussion";
import { useVueVisible } from "@/components/sfl/vestiaire";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { useSession } from "@/hooks/use-session";
import {
  HISTORIQUE_MAX,
  LIBELLE_CARTE,
  NOMS_STATS,
  QUESTION_MAX,
  debriefFrais,
  dossierJoueur,
  lireCartes,
  questionDebrief,
  type CarteCoach,
  type DossierJoueur,
  type MessageAgent,
} from "@/lib/sfl/agent";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const DEMO = process.env.NODE_ENV !== "production";
/** L'heure d'un envoi (hors rendu). */
const horloge = () => Date.now();

/* --------------------------------- La fiche ------------------------------- */

/** La carte du joueur et ses six stats, de la meilleure à la pire. */
function Fiche({ dossier }: { dossier: DossierJoueur }) {
  const n = dossier.stats.length;
  return (
    <div className="mb-5 flex items-center gap-4 pt-1">
      <CarteDe name={dossier.nom} size={FORMAT_CARTE.moyenne} inerte />
      <ol className="flex min-w-0 flex-1 flex-col gap-[7px]">
        {dossier.stats.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2.5">
            <span className="w-[62px] shrink-0 text-[12.5px] font-semibold text-foreground/60">{s.nom}</span>
            <span className="relative h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-foreground"
                // La pire en dernier, et plus pâle à mesure qu'on descend.
                style={{ width: `${Math.min(100, (s.valeur / 99) * 100)}%`, opacity: 1 - (i / Math.max(1, n - 1)) * 0.6 }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-[13px] font-bold tabular-nums">{s.valeur}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------- Les cartes ----------------------------- */

function CarteVue({ carte, dossier }: { carte: CarteCoach; dossier: DossierJoueur }) {
  const cible = carte.cible ? dossier.stats.find((s) => s.id === carte.cible) : null;
  const numerotee = carte.type === "programme" || carte.type === "exercice" || carte.type === "sante";
  return (
    <div className="glass-soft w-full overflow-hidden rounded-[22px]">
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3">
        <div className="min-w-0">
          <span className="block text-[11px] font-bold tracking-[0.08em] text-foreground/40 uppercase">{LIBELLE_CARTE[carte.type]}</span>
          <span className="mt-0.5 block text-[17px] leading-tight font-bold tracking-tight">{carte.titre}</span>
          {carte.sousTitre && <span className="mt-1 block text-[13px] text-foreground/55">{carte.sousTitre}</span>}
        </div>
        {cible && (
          <span className="flex shrink-0 items-baseline gap-1 rounded-full border border-white/15 px-2.5 py-1">
            <span className="text-[11.5px] font-semibold text-foreground/60">{NOMS_STATS[cible.id]}</span>
            <span className="text-[13px] font-bold tabular-nums">{cible.valeur}</span>
          </span>
        )}
      </div>
      {carte.lignes.length > 0 && (
        <ol className="border-t border-white/[0.07]">
          {carte.lignes.map((l, i) => (
            <li key={i} className="flex items-start gap-3 border-b border-white/[0.07] px-4 py-2.5 last:border-b-0">
              {numerotee && <span className="w-4 shrink-0 pt-px text-[13px] font-bold text-foreground/35 tabular-nums">{i + 1}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] leading-snug font-semibold">{l.label}</span>
                {l.detail && <span className="mt-0.5 block text-[13px] leading-snug text-foreground/55">{l.detail}</span>}
              </span>
              {l.valeur && <span className="max-w-[40%] shrink-0 pt-px text-right text-[13.5px] font-bold tabular-nums">{l.valeur}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* --------------------------------- Le fil --------------------------------- */

function Message({ m, dossier }: { m: MessageAgent; dossier: DossierJoueur }) {
  const mien = m.role === "joueur";
  return (
    <div className={cn("mb-3 flex flex-col gap-2", mien ? "items-end" : "items-start")}>
      {m.texte && (
        <p
          className={cn(
            "max-w-[82%] rounded-[20px] px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
            mien ? "bg-foreground text-background" : "glass-soft"
          )}
        >
          {m.texte}
        </p>
      )}
      {m.cartes.map((c, i) => (
        <CarteVue key={i} carte={c} dossier={dossier} />
      ))}
    </div>
  );
}

function Reflechit() {
  return (
    <div className="glass-soft mb-3 flex w-fit items-center gap-1 rounded-[20px] px-4 py-3" aria-label="Le coach écrit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-[7px] animate-pulse rounded-full bg-foreground/60 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
    </div>
  );
}

/* --------------------------------- L'écran -------------------------------- */

export function Agent() {
  const session = useSession();
  const { saison, allPlayers } = useSeason();
  const { player } = useMyPlayer();
  const dossier = useMemo(() => dossierJoueur(saison, player, allPlayers), [saison, player, allPlayers]);

  const demo = useMemo(() => DEMO && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "agent", []);
  const [pret, setPret] = useState<boolean | null>(demo ? true : null);
  const [messages, setMessages] = useState<MessageAgent[]>([]);
  const [charge, setCharge] = useState(false);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const enBas = useRef(true);
  const vue = useVueVisible();
  const [ecrit, setEcrit] = useState(false);
  const clavier = ecrit && vue.tactile;
  const connecte = demo || !!session?.server;

  // La clé est-elle posée ?
  useEffect(() => {
    if (demo) return;
    let vivant = true;
    fetch("/api/agent")
      .then((r) => r.json())
      .then((d: { pret?: boolean }) => vivant && setPret(!!d.pret))
      .catch(() => vivant && setPret(false));
    return () => {
      vivant = false;
    };
  }, [demo]);

  // La conversation gardée.
  useEffect(() => {
    if (demo) {
      Promise.resolve().then(() => {
        setMessages(conversationDemo(dossier));
        setCharge(true);
      });
      return;
    }
    if (!session?.server) {
      Promise.resolve().then(() => setCharge(true));
      return;
    }
    let vivant = true;
    (async () => {
      const { data } = await supabase()
        .from("agent_messages")
        .select("id, role, texte, cartes, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!vivant) return;
      const lus = ((data ?? []) as { id: number; role: "joueur" | "coach"; texte: string; cartes: unknown; created_at: string }[])
        .reverse()
        .map((r) => ({ id: String(r.id), role: r.role, texte: r.texte, cartes: lireCartes(r.cartes), at: new Date(r.created_at).getTime() }));
      setMessages(lus);
      setCharge(true);
    })();
    return () => {
      vivant = false;
    };
    // Le dossier ne sert qu'à la démo : la recharger à chaque saison serait inutile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.server, demo]);

  // Après un match récent, le coach ouvre, s'il n'a pas déjà parlé depuis.
  const ouverture = useMemo(() => {
    const m = dossier.dernierMatch;
    if (!charge || !m || !debriefFrais(dossier)) return null;
    const jour = new Date();
    jour.setHours(0, 0, 0, 0);
    const depuis = jour.getTime() - m.ilYa * 86400_000;
    return messages.some((x) => x.at >= depuis) ? null : questionDebrief(m);
  }, [charge, dossier, messages]);

  // Rester au plus récent.
  useLayoutEffect(() => {
    const f = fil.current;
    if (!charge || !f) return;
    if (enBas.current) f.scrollTop = f.scrollHeight;
  }, [charge, messages.length, envoi, vue.hauteur]);

  // Les onglets s'effacent pendant qu'on écrit (bottom-nav.tsx).
  useEffect(() => {
    const html = document.documentElement;
    if (clavier) html.dataset.clavier = "";
    else delete html.dataset.clavier;
    return () => {
      delete html.dataset.clavier;
    };
  }, [clavier]);

  async function demander(question: string) {
    const q = question.trim();
    if (!q || envoi || !pret || !connecte) return;
    const ouv = ouverture;
    const avant = messages;
    const maintenant = horloge();
    const ajout: MessageAgent[] = [
      ...(ouv ? [{ id: `o-${maintenant}`, role: "coach" as const, texte: ouv, cartes: [], at: maintenant - 1 }] : []),
      { id: `q-${maintenant}`, role: "joueur", texte: q, cartes: [], at: maintenant },
    ];
    setMessages((ms) => [...ms, ...ajout]);
    setTexte("");
    setEnvoi(true);
    enBas.current = true;
    try {
      let rep: { texte: string; cartes: CarteCoach[] };
      if (demo) {
        await new Promise((r) => setTimeout(r, 1400));
        rep = reponseDemo(dossier);
      } else {
        const { data } = await supabase().auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Reconnecte-toi pour parler à ton coach.");
        const r = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            question: q,
            dossier,
            ouverture: ouv ?? undefined,
            historique: avant.slice(-HISTORIQUE_MAX).map(({ role, texte, cartes }) => ({ role, texte, cartes })),
          }),
        });
        const d = (await r.json().catch(() => ({}))) as { texte?: string; cartes?: unknown; error?: string };
        if (!r.ok) throw new Error(d.error ?? "Le coach n'a pas pu répondre. Réessaie.");
        rep = { texte: d.texte ?? "", cartes: lireCartes(d.cartes) };
      }
      if (navigator.vibrate) navigator.vibrate(8);
      setMessages((ms) => [...ms, { id: `r-${Date.now()}`, role: "coach", texte: rep.texte, cartes: rep.cartes, at: Date.now() }]);
    } catch (e) {
      // La question revient dans le champ, le fil reprend son état.
      setMessages(avant);
      setTexte(q);
      toast.error(e instanceof Error ? e.message : "Le coach n'a pas pu répondre. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  const pire = dossier.stats[dossier.stats.length - 1];
  const departs = [
    { label: `Ma pire stat : ${pire.nom}`, question: `Ma pire stat, c'est ${pire.nom.toLowerCase()} (${pire.valeur}). Fais-moi un programme pour la travailler cette semaine.` },
    ...(dossier.dernierMatch ? [{ label: `Débrief J${dossier.dernierMatch.j}`, question: `Débriefe mon dernier match, la J${dossier.dernierMatch.j}.` }] : []),
    { label: "Mes courses", question: "Fais-moi le panier de courses de la semaine pour être en forme dimanche." },
    { label: "J'ai mal", question: "J'ai une douleur depuis le dernier match." },
  ];
  const peutEcrire = connecte && pret === true;

  return (
    <section
      className="fixed inset-x-0 top-0 z-[35] flex flex-col bg-background"
      style={{
        height: vue.hauteur ? `${vue.hauteur}px` : "100dvh",
        transform: vue.haut ? `translateY(${vue.haut}px)` : undefined,
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <header className="relative mx-auto flex w-full max-w-[640px] shrink-0 items-center justify-between gap-3 px-5 pt-3 pb-2">
        <TitreDiscussion actif="/agent" />
        <BoutonRecherche />
      </header>

      <div
        ref={fil}
        onScroll={(e) => {
          const f = e.currentTarget;
          enBas.current = f.scrollHeight - f.scrollTop - f.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col px-5 pb-3">
          <Fiche dossier={dossier} />
          <div className="mt-auto">
            {messages.map((m) => (
              <Message key={m.id} m={m} dossier={dossier} />
            ))}
            {ouverture && !envoi && <Message m={{ id: "ouverture", role: "coach", texte: ouverture, cartes: [], at: 0 }} dossier={dossier} />}
            {envoi && <Reflechit />}
          </div>
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-[640px] shrink-0 px-3 pt-2"
        style={{ paddingBottom: clavier ? "8px" : "calc(max(calc(env(safe-area-inset-bottom) - 4px), 14px) + 62px + 10px)" }}
      >
        {!peutEcrire ? (
          pret !== null && (
            <p className="glass rounded-full px-4 py-3 text-center text-[13.5px] font-semibold text-foreground/55">
              {!connecte ? "Connecte-toi pour parler à ton coach." : "Bola Agent arrive bientôt."}
            </p>
          )
        ) : (
          <>
            {!texte.trim() && !envoi && !clavier && (
              <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
                {departs.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => void demander(d.question)}
                    className="glass shrink-0 rounded-full px-3.5 py-2 text-[13.5px] font-semibold transition-transform active:scale-95"
                  >
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
                ref={champ}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onFocus={() => setEcrit(true)}
                onBlur={() => {
                  setEcrit(false);
                  if (vue.tactile) window.scrollTo(0, 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !vue.tactile) {
                    e.preventDefault();
                    void demander(texte);
                  }
                }}
                rows={1}
                maxLength={QUESTION_MAX}
                placeholder="Demande à ton coach"
                className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-[9px] text-[16px] leading-snug outline-none placeholder:text-foreground/30 [field-sizing:content]"
              />
              <button
                type="submit"
                onPointerDown={(e) => e.preventDefault()}
                disabled={envoi || !texte.trim()}
                aria-label="Envoyer"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95 disabled:opacity-25"
              >
                <ArrowUp className="size-5" strokeWidth={2.75} />
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- Démo -------------------------------- */

// Développement seulement (?demo=agent) : une conversation d'essai sur le vrai
// dossier du joueur, pour juger la mise en page des cartes sans modèle.
function conversationDemo(d: DossierJoueur): MessageAgent[] {
  const t0 = Date.now() - 3 * 3600_000;
  const pire = d.stats[d.stats.length - 1];
  return [
    { id: "d1", role: "joueur", texte: `Ma pire stat, c'est ${pire.nom.toLowerCase()} (${pire.valeur}). Fais-moi un programme pour la travailler cette semaine.`, cartes: [], at: t0 },
    {
      id: "d2",
      role: "coach",
      texte: `${pire.nom} à ${pire.valeur}, c'est là qu'on gagne le plus vite. Trois séances courtes au city d'à côté, et dimanche tu le sens.`,
      cartes: [
        {
          type: "programme",
          titre: `${pire.nom} : semaine 1`,
          sousTitre: "3 séances · 40 min",
          cible: pire.id,
          lignes: [
            { label: "Lundi : appuis", detail: "Échelle de rythme ou plots tous les 50 cm, pieds rapides, regard haut.", valeur: "6 × 30 s" },
            { label: "Mercredi : duels", detail: "À deux, 1 contre 1 sur 10 m, tu défends sans te jeter.", valeur: "8 × 45 s" },
            { label: "Vendredi : explosivité", detail: "Sprints départ arrêté, récup marchée.", valeur: "10 × 15 m" },
            { label: "Gainage", detail: "Planche face et côtés, à la fin de chaque séance.", valeur: "3 × 40 s" },
          ],
        },
      ],
      at: t0 + 60_000,
    },
    { id: "d3", role: "joueur", texte: "Et pour manger avant dimanche ?", cartes: [], at: t0 + 120_000 },
    {
      id: "d4",
      role: "coach",
      texte: "Simple et pas cher. Les prix sont estimés, supermarché classique.",
      cartes: [
        {
          type: "panier",
          titre: "Le panier de la semaine",
          sousTitre: "Total ≈ 31 €",
          cible: "",
          lignes: [
            { label: "Riz complet", detail: "", valeur: "1 kg · 2,10 €" },
            { label: "Blancs de poulet", detail: "", valeur: "1 kg · 9,90 €" },
            { label: "Œufs", detail: "", valeur: "12 · 3,60 €" },
            { label: "Bananes", detail: "Une avant le match, une à la mi-temps.", valeur: "1 kg · 1,90 €" },
            { label: "Flocons d'avoine", detail: "", valeur: "1 kg · 1,80 €" },
            { label: "Légumes de saison", detail: "", valeur: "≈ 7 €" },
            { label: "Fromage blanc", detail: "Le soir, pour la récup.", valeur: "1 kg · 2,40 €" },
          ],
        },
      ],
      at: t0 + 180_000,
    },
  ];
}

function reponseDemo(d: DossierJoueur): { texte: string; cartes: CarteCoach[] } {
  const m = d.dernierMatch;
  return {
    texte: "Bien joué d'avoir tenu jusqu'au bout. Voilà ce que je retiens.",
    cartes: [
      {
        type: "debrief",
        titre: m ? `Débrief J${m.j}` : "Débrief",
        sousTitre: m ? [m.resultat, m.buts ? `${m.buts} but${m.buts > 1 ? "s" : ""}` : "", m.passes ? `${m.passes} passe${m.passes > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ") : "",
        cible: "",
        lignes: [
          { label: "Ce qui a marché", detail: "Tes appels dans le dos, tu as fait courir leur défense.", valeur: "" },
          { label: "Ce qui a coincé", detail: "Les replis après la perte, surtout en fin de match.", valeur: "" },
          { label: "Avant dimanche", detail: "Deux séances de fractionné pour finir aussi fort que tu commences.", valeur: "2 × 20 min" },
        ],
      },
    ],
  };
}
