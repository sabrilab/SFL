"use client";

// Les jeux du récap — pronostic de la prochaine journée et quiz de la journée
// écoulée. Les deux rapportent des Ballons et vivent en localStorage : ils
// fonctionnent déjà sans comptes, et basculeront côté serveur avec Supabase
// (le stockage est isolé derrière ces deux composants).

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useIsClient } from "@/hooks/use-is-client";
import { credit } from "@/lib/sfl/ballons";
import type { Journee, Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

const PRONO_REWARD = 25;
const QUIZ_REWARD = 5;

/* --------------------------- Petit stockage --------------------------- */

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Mélange déterministe : même journée = même ordre, sur tous les appareils. */
function shuffle<T>(items: T[], seed: number): T[] {
  return items
    .map((v, i) => ({ v, k: (Math.sin(seed * 97 + i * 31) * 10000) % 1 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

/* ----------------------- 17 · Le pronostic ---------------------------- */

export function PronosticModule({
  journee,
  date,
  candidates,
  me,
  resolvedMvp,
}: {
  /** Numéro de la journée à pronostiquer (celle qui arrive). */
  journee: number;
  date: string;
  candidates: Player[];
  me: string;
  /** MVP réel, quand la journée a été jouée et saisie. */
  resolvedMvp?: string | null;
}) {
  const isClient = useIsClient();
  const [tick, setTick] = useState(0);
  const key = `sfl-prono-${journee}`;
  const paidKey = `sfl-prono-paid-${journee}`;

  const pick = useMemo(() => {
    if (!isClient) return null;
    void tick;
    return readString(key);
  }, [isClient, tick, key]);

  const choose = (name: string) => {
    if (pick || resolvedMvp) return;
    localStorage.setItem(key, name);
    setTick((t) => t + 1);
  };

  const won = resolvedMvp && pick ? resolvedMvp === pick : null;

  // Résolution : dès que la journée est saisie, on crédite une seule fois.
  // Le paiement touche un système extérieur (le portefeuille de Ballons) :
  // sa place est dans un effet, pas dans le rendu.
  useEffect(() => {
    if (won !== true) return;
    if (readString(paidKey)) return;
    localStorage.setItem(paidKey, "1");
    credit(me, PRONO_REWARD, `Pronostic MVP J${journee}`);
  }, [won, paidKey, me, journee]);

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label text-primary">Le pronostic</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            Qui sera MVP de la J{journee} ?
          </h2>
          <p className="mt-1 text-[12.5px] text-foreground/45">{date}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/32 bg-primary/14 px-3 py-1.5">
          <span className="text-[12px] leading-none">⚽</span>
          <span className="mono-label font-semibold text-primary">+{PRONO_REWARD}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {candidates.map((p) => {
          const active = pick === p.name;
          const isAnswer = resolvedMvp === p.name;
          return (
            <button
              key={p.name}
              onClick={() => choose(p.name)}
              disabled={!!pick || !!resolvedMvp}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-transform active:scale-95",
                isAnswer
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "bg-foreground text-background"
                    : "glass-soft text-foreground/70"
              )}
            >
              {p.name}
              {active && <Check className="size-3.5" strokeWidth={3} />}
            </button>
          );
        })}
      </div>

      <p className="mt-3.5 text-[12.5px] text-foreground/45">
        {!isClient
          ? "Choisis ton MVP avant le coup d'envoi."
          : resolvedMvp
            ? won === true
              ? `Bien vu — ${resolvedMvp} était bien MVP. +${PRONO_REWARD} Ballons.`
              : won === false
                ? `Raté : c'est ${resolvedMvp} qui a été élu.`
                : `Tu n'avais pas pronostiqué — c'est ${resolvedMvp} qui a été élu.`
            : pick
              ? `Ton pari est posé sur ${pick}. Rendez-vous dimanche.`
              : "Un seul choix, impossible de revenir en arrière."}
      </p>
    </section>
  );
}

/* -------------------------- 18 · Le quiz ------------------------------ */

interface Question {
  q: string;
  options: string[];
  answer: string;
}

export function buildQuiz(journee: Journee, lines: { name: string; buts: number }[]): Question[] {
  const matches = journee.matches ?? [];
  const total = matches.reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);
  const qs: Question[] = [];

  const scorers = [...lines].sort((a, b) => b.buts - a.buts);
  if (scorers.length >= 3 && scorers[0].buts > 0) {
    const good = scorers[0].name;
    const others = scorers.slice(1, 3).map((s) => s.name);
    qs.push({
      q: "Qui a marqué le plus de buts ?",
      options: shuffle([good, ...others], journee.j),
      answer: good,
    });
  }

  if (total > 0) {
    const good = `${total}`;
    qs.push({
      q: "Combien de buts au total ce dimanche ?",
      options: shuffle([good, `${Math.max(1, total - 7)}`, `${total + 5}`], journee.j + 1),
      answer: good,
    });
  }

  const big = [...matches].sort(
    (a, b) => b.teamA.score + b.teamB.score - (a.teamA.score + a.teamB.score)
  )[0];
  if (big && big.teamA.score !== big.teamB.score) {
    const winner = big.teamA.score > big.teamB.score ? big.teamA.name : big.teamB.name;
    const loser = big.teamA.score > big.teamB.score ? big.teamB.name : big.teamA.name;
    const third =
      matches
        .flatMap((m) => [m.teamA.name, m.teamB.name])
        .find((n) => n !== winner && n !== loser) ?? "Match nul";
    qs.push({
      q: "Qui a gagné le match de la journée ?",
      options: shuffle([winner, loser, third], journee.j + 2),
      answer: winner,
    });
  }

  return qs.slice(0, 3);
}

export function QuizModule({
  journee,
  questions,
  me,
}: {
  journee: number;
  questions: Question[];
  me: string;
}) {
  const isClient = useIsClient();
  const [tick, setTick] = useState(0);
  const key = `sfl-quiz-${journee}`;
  const paidKey = `sfl-quiz-paid-${journee}`;

  const answers = useMemo<Record<number, string>>(() => {
    if (!isClient) return {};
    void tick;
    try {
      return JSON.parse(readString(key) ?? "{}");
    } catch {
      return {};
    }
  }, [isClient, tick, key]);

  if (questions.length === 0) return null;

  const answered = Object.keys(answers).length;
  const score = questions.filter((q, i) => answers[i] === q.answer).length;
  const done = answered === questions.length;

  const answer = (i: number, choice: string) => {
    if (answers[i]) return;
    const next = { ...answers, [i]: choice };
    localStorage.setItem(key, JSON.stringify(next));
    // Récompense unique, à la fin du quiz.
    if (Object.keys(next).length === questions.length && !readString(paidKey)) {
      localStorage.setItem(paidKey, "1");
      credit(me, QUIZ_REWARD, `Quiz J${journee}`);
    }
    setTick((t) => t + 1);
  };

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label text-primary">Le quiz de la journée</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">
            {done ? `${score}/${questions.length} — bien joué` : "Tu as suivi dimanche ?"}
          </h2>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/32 bg-primary/14 px-3 py-1.5">
          <span className="text-[12px] leading-none">⚽</span>
          <span className="mono-label font-semibold text-primary">+{QUIZ_REWARD}</span>
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {questions.map((q, i) => {
          const chosen = answers[i];
          return (
            <div key={q.q}>
              <p className="text-[14px] font-semibold">
                <span className="mono-label mr-2 text-foreground/30">{i + 1}</span>
                {q.q}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const isChosen = chosen === o;
                  const isGood = o === q.answer;
                  return (
                    <button
                      key={o}
                      onClick={() => answer(i, o)}
                      disabled={!!chosen}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-[13px] font-semibold transition-transform active:scale-95",
                        chosen
                          ? isGood
                            ? "bg-primary text-primary-foreground"
                            : isChosen
                              ? "bg-foreground/15 text-foreground/50 line-through"
                              : "glass-soft text-foreground/35"
                          : "glass-soft text-foreground/70"
                      )}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {done && (
        <p className="mt-4 text-[12.5px] text-foreground/45">
          {score === questions.length
            ? `Sans faute — +${QUIZ_REWARD} Ballons pour toi.`
            : `+${QUIZ_REWARD} Ballons quand même. Nouveau quiz la semaine prochaine.`}
        </p>
      )}
    </section>
  );
}
