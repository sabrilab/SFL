"use client";

// Le tableau de présence de la prochaine journée.
//
// Vue joueur : ma réponse, en gros, avec le décompte de l'effectif.
// Vue admin : qui a répondu quoi, et surtout qui n'a pas répondu — la liste
// que l'admin passait son dimanche à reconstituer à la main.
//
// Toute la donnée vient de usePresence : partagée (Supabase, temps réel)
// quand la base est branchée, locale sinon. L'écran ne fait pas la différence.
//
// Un joueur Bola (venu par un parrain, hors de la saison) la regarde en
// spectateur : qui vient, les équipes, mais ni « Ma présence » ni boutons.
//
// La réponse se donne une fois et se scelle (reponse-scellee.tsx, 27/10).
//
// La vue admin reste discrète (Sabri, 30/10) : repliée sur une ligne, les
// trois chiffres seuls ; on la déplie pour voir qui manque et relancer.
//
// Un joueur suspendu pour cette journée (carton rouge, lib/sfl/cartons.ts,
// 01/11) ne répond pas : à la place du glissé, « Suspendu · J5 » et son
// carton rouge.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Radio, X } from "lucide-react";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { usePresence } from "@/hooks/use-presence";
import { ligneDuRendezVous } from "@/lib/sfl/matchs-du-jour";
import { equipesDeConvocation } from "@/lib/sfl/saisie/equipes";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { QuiVient } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { useJoueurBola } from "@/components/sfl/player-provider";
import { divisionsDeLaJournee, terrainsDesEquipes } from "@/lib/sfl/equipes-division";
import { cn } from "@/lib/utils";
import { Suspendu } from "@/components/sfl/cartons/mes-cartons";

export function PresencePanel({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();
  const { saison } = useSeason();
  const bola = useJoueurBola();
  const [vueAdmin, setVueAdmin] = useState(false);
  // Dès la J4, chaque équipe dit sa division : « Noirs · Match 2 · D1 ».
  const divisionDe = useMemo(() => {
    const etat = p.teams?.length ? divisionsDeLaJournee(saison, p.journee) : null;
    return new Map(etat && p.teams ? terrainsDesEquipes(p.teams, etat).flatMap(({ divisions, equipes }) => equipes.map((e) => [e.name, divisions] as const)) : []);
  }, [saison, p.journee, p.teams]);

  function copyRelances() {
    const list = p.sansReponse.join(", ");
    navigator.clipboard
      ?.writeText(
        `Convocation J${p.journee} — ${p.jour}, ${p.heure}, ${p.lieu}.\n` +
          `${p.presents.length} confirmés.\n` +
          `Sans réponse : ${list || "personne"}`
      )
      .then(() => toast.success("Relance copiée"))
      .catch(() => toast.error("Copie impossible"));
  }

  async function publish() {
    if (!p.publish) return;
    const ok = await p.publish();
    if (ok) toast.success("Convocation publiée — la liste devient commune à toute la ligue.");
    else toast.error("Publication impossible. Vérifie l'installation (Réglages → Espace admin).");
  }

  return (
    <section className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label text-primary">J{p.journee} · {bola ? "Sunday Five League" : "Ma présence"}</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{p.jour}</h2>
          <p className="mt-1 text-corps text-encre-3">
            {ligneDuRendezVous(p.rendezVous)}
          </p>
        </div>
        {p.mine && !bola && !p.suspendu && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              p.mine === "present" ? "bg-primary/15 text-primary" : "bg-foreground/10 text-encre-3"
            )}
          >
            {p.mine === "present" ? (
              <Check className="size-[18px]" strokeWidth={2.5} />
            ) : (
              <X className="size-[18px]" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>

      {/* Les deux boutons, jusqu'à vendredi minuit ; une fois la réponse
          donnée, elle est scellée. */}
      {bola ? null : p.suspendu ? (
        <Suspendu j={p.suspendu.j} className="mt-4" />
      ) : p.reponsesOuvertes ? (
        <>
          <ReponseScellee className="mt-4" mine={p.mine} onRepondre={p.answer} />
          {!p.mine && (
            <p className="mono-label mt-2.5 text-center text-encre-4">
              Réponses jusqu&apos;à vendredi minuit
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 rounded-[14px] bg-contraste/5 px-3.5 py-3 text-corps leading-snug text-encre-3">
          Les réponses sont closes depuis vendredi minuit.
          {p.mine === "present"
            ? " Tu es sur la liste — à dimanche ⚽"
            : p.mine === "absent"
              ? " Tu as passé ton tour."
              : " Sans réponse, tu n'es pas retenu. La conversation rouvre lundi."}
        </p>
      )}

      {/* Le compte des participants : la journée reste ouverte, on peut
          toujours s'ajouter — pas de plafond affiché. */}
      <div className="mt-4 flex items-baseline justify-between">
        <span className="mono-label text-encre-3">Participants</span>
        <span className="text-corps font-bold tabular-nums">{p.presents.length} déjà</span>
      </div>

      {p.equipesVisibles && p.teams && p.teams.length > 0 ? (
        <div className="mt-4 border-t border-contraste/8 pt-3.5">
          <p className="mono-label text-primary">Les équipes de dimanche</p>
          <div className="mt-2 flex flex-col gap-3">
            {equipesDeConvocation(p.teams).map((t) => (
              <div key={t.nom}>
                <p className="mb-1.5 flex items-center gap-1.5 text-corps font-bold text-encre-2">
                  {t.camp && <PointMaillot camp={t.camp} />}
                  {t.libelle}
                  {divisionDe.get(t.nom) && <span className="font-normal text-encre-3">· {divisionDe.get(t.nom)}</span>}
                </p>
                <QuiVient noms={t.joueurs} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        p.presents.length > 0 && (
          <div className="mt-4 border-t border-contraste/8 pt-3.5">
            <p className="mono-label mb-2 text-encre-3">Qui vient</p>
            <QuiVient noms={p.presents} />
          </div>
        )
      )}

      {/* « Je viens » sans équipe : remplaçants, ils ne disparaissent pas de la liste. */}
      {p.remplacants.length > 0 && (
        <div className="mt-4 border-t border-contraste/8 pt-3.5">
          <p className="mono-label mb-2 text-encre-3">Remplaçants · {p.remplacants.length}</p>
          <QuiVient noms={p.remplacants} />
        </div>
      )}

      {p.shared ? (
        <p className="mono-label mt-3 flex items-center gap-1.5 text-primary">
          <Radio className="size-3" /> En direct — toute la ligue voit cette liste
        </p>
      ) : (
        <p className="mt-3 text-petit leading-snug text-encre-4">
          Réponses enregistrées sur cet appareil pour l&apos;instant. Elles seront partagées
          avec toute la ligue dès la mise en base.
        </p>
      )}

      {/* Admin, base branchée mais pas de convocation publiée : on publie. */}
      {admin && p.publish && (
        <button
          onClick={publish}
          className="bouton-secondaire bouton--vert mt-3 w-full py-3 text-corps font-semibold"
        >
          Publier la convocation J{p.journee} pour toute la ligue
        </button>
      )}

      {/* Vue admin : repliée par défaut, le tableau complet une fois dépliée */}
      {admin && !compact && (
        <div className="mt-5 border-t border-contraste/8 pt-1">
          <button
            type="button"
            onClick={() => setVueAdmin((o) => !o)}
            aria-expanded={vueAdmin}
            className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
          >
            <span className="mono-label text-encre-3">Vue admin</span>
            <span className="mono-label flex items-center gap-2 text-encre-3 tabular-nums">
              {p.presents.length} · {p.absents.length} · {p.sansReponse.length}
              <ChevronDown className={cn("size-3.5 transition-transform", vueAdmin && "rotate-180")} />
            </span>
          </button>

          {vueAdmin && (
            <div className="pb-1 pt-1.5">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    [p.presents.length, "Présents", "text-foreground"],
                    [p.absents.length, "Absents", "text-encre-2"],
                    [p.sansReponse.length, "Sans réponse", "text-encre-2"],
                  ] as const
                ).map(([n, label, cls]) => (
                  <div key={label} className="glass-soft rounded-2xl px-2 py-3 text-center">
                    <div className={cn("text-titre-m leading-none font-extrabold tabular-nums", cls)}>
                      {n}
                    </div>
                    <p className="mono-label mt-1.5 text-encre-3">{label}</p>
                  </div>
                ))}
              </div>

              {(
                [
                  // Les présents sont déjà en cartes plus haut ; ici, qui manque.
                  ["Absents", p.absents, "glass-soft text-encre-3"],
                  ["Sans réponse", p.sansReponse, "glass-soft text-encre-2"],
                ] as const
              ).map(([label, list, cls]) =>
                list.length > 0 ? (
                  <div key={label} className="mt-3.5">
                    <p className="mono-label mb-2 text-encre-3">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((n) => (
                        <span
                          key={n}
                          className={cn("rounded-full px-2.5 py-1 text-corps font-semibold", cls)}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null
              )}

              {p.sansReponse.length > 0 && (
                <button
                  onClick={copyRelances}
                  className="bouton-secondaire bouton--mauve mono-label mt-4 flex w-full items-center justify-center gap-1.5 py-2.5"
                >
                  <Copy className="size-3" /> Copier la relance
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
