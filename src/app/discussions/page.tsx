"use client";

// Section Discussions — réplique de l'écran « DISCUSSIONS matte » du design
// de référence : compteur de groupes, filtres en pilules, l'invitation de match
// en tête de liste (posée comme un message, avec sa carte de convocation), puis
// les fils du vestiaire en verre — initiales, aperçu, heure, série.
//
// L'INVITATION DE MATCH EST VIVANTE : ses boutons répondent vraiment à la
// convocation (même liste partagée que le panneau du fil, via usePresence).
// Et la messagerie l'est aussi désormais : le salon de la ligue et les
// conversations à deux vivent en base, en temps réel (voir messagerie.tsx).

import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { Messagerie } from "@/components/sfl/messagerie";
import { usePresence } from "@/hooks/use-presence";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import { useSession } from "@/hooks/use-session";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { activeConvocation } from "@/lib/sfl/saisie/mutations";
import { equipesDeConvocation } from "@/lib/sfl/saisie/equipes";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { cn } from "@/lib/utils";
import { BoutonRetour } from "@/components/layout/bouton-retour";

export default function Discussions() {
  const { saison } = useSeason();
  const { player } = useMyPlayer();
  const presence = usePresence();
  const session = useSession();

  const convoc = activeConvocation(saison);
  const next = convoc
    ? { date: convoc.date, heure: convoc.heure, lieu: convoc.lieu }
    : { date: NEXT_MATCH.date, heure: NEXT_MATCH.heure, lieu: NEXT_MATCH.lieu };
  // « 09/08 » à partir de « 16 août » : jour + mois, comme le design.
  const MOIS: Record<string, string> = {
    janv: "01", févr: "02", mars: "03", avr: "04", mai: "05", juin: "06",
    juil: "07", août: "08", sept: "09", oct: "10", nov: "11", déc: "12",
  };
  // « Dimanche 16 août » → jour 16, mois 08 — pour le gros « 16/08 » du design.
  const dateMatch = presence.jour.match(/(\d+)\s+(\S+)/);
  const dJour = dateMatch?.[1] ?? next.date.split(" ")[0];
  const dMois = dateMatch?.[2] ?? next.date.split(" ")[1];
  const moisNum = MOIS[Object.keys(MOIS).find((m) => (dMois ?? "").startsWith(m)) ?? "août"];

  return (
    <div className="shell py-4 sm:py-8">
      <div className="mb-5 flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-titre-l font-bold tracking-tight">Discussions</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-6">
      {/* L'invitation de match — VIVANTE : répond à la vraie convocation */}
      <section className="flex min-w-0 flex-col gap-[9px] lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-[7px]">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(111,168,255,0.8)]" />
            <span className="mono-label text-encre-3">
              {presence.shared ? "Convocation · en direct" : "Convocation"}
            </span>
          </span>
          <span className="mono-label text-encre-4">J{presence.journee}</span>
        </div>

        <div className="glass overflow-hidden rounded-[26px]">
          <div className="px-4 pt-3.5">
            <div className="flex items-center gap-2.5">
              <span className="glass-soft flex size-[30px] shrink-0 items-center justify-center rounded-full text-etiquette font-extrabold text-encre-2">
                IL
              </span>
              <div className="min-w-0">
                <div className="text-ligne font-bold">Ilyes</div>
                <div className="mono-label mt-0.5 text-encre-4">Admin · SFL</div>
              </div>
            </div>
            <p className="mt-[11px] text-ligne leading-[1.45] text-encre-2">
              Salut {player.name.split(" ")[0]}, dispo ce {presence.jour.toLowerCase()} pour la J
              {presence.journee} de la SFL ? Réponds avant vendredi minuit — oui ou non, ça
              rapporte 2 ⚽.
            </p>
          </div>

          <div className="m-3 overflow-hidden rounded-[20px] border border-contraste/10 bg-contraste/5">
            <div className="flex items-center gap-3.5 px-[15px] py-3.5">
              <div className="w-[46px] shrink-0">
                <div className="mono-label text-encre-3">J{presence.journee}</div>
                <div className="text-2xl leading-[1.1] font-extrabold tracking-tight">
                  {String(dJour).padStart(2, "0")}
                  <span className="text-petit text-encre-3">/{moisNum}</span>
                </div>
              </div>
              <span className="h-10 w-px bg-contraste/10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lecture font-semibold">{presence.rendezVous.lieu}</div>
                <div className="mt-[3px] text-corps text-encre-3">
                  {[presence.rendezVous.match, presence.rendezVous.terrain, presence.rendezVous.heure].filter(Boolean).join(" · ")} ·{" "}
                  {presence.presents.length} inscrit{presence.presents.length > 1 ? "s" : ""}
                </div>
              </div>
              {presence.mine && (
                <span
                  className={cn(
                    "mono-label shrink-0 rounded-full px-2.5 py-1",
                    presence.mine === "present"
                      ? "bg-primary/15 text-primary"
                      : "glass-soft text-encre-3"
                  )}
                >
                  {presence.mine === "present" ? "Inscrit ✓" : "Pas dispo"}
                </span>
              )}
            </div>
            {presence.reponsesOuvertes ? (
              // Une réponse, une seule : elle se scelle (reponse-scellee.tsx).
              <div className="px-3 pb-3">
                <ReponseScellee taille="sm" mine={presence.mine} onRepondre={presence.answer} />
              </div>
            ) : (
              // Vendredi minuit est passé : la conversation est close, la
              // règle est la règle — sans réponse, pas de dimanche.
              <p className="mx-3 mb-3 rounded-[14px] bg-contraste/5 px-3.5 py-2.5 text-corps leading-snug text-encre-3">
                Conversation clôturée vendredi à minuit.
                {presence.mine === "present"
                  ? " Tu es sur la liste — à dimanche ⚽"
                  : presence.mine === "absent"
                    ? " Tu as passé ton tour — à la prochaine."
                    : " Sans réponse, tu n'es pas retenu pour dimanche. Elle rouvre lundi."}
              </p>
            )}
          </div>

          {/* Vendredi 19h : les équipes composées tombent dans la conversation */}
          {presence.equipesVisibles && presence.teams && presence.teams.length > 0 && (
            <div className="border-t border-contraste/8 px-4 py-3.5">
              <p className="mono-label text-primary">Les équipes de dimanche</p>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {equipesDeConvocation(presence.teams).map((t) => {
                  const mine = t.joueurs.includes(player.name);
                  return (
                    <div key={t.nom}>
                      <p
                        className={cn(
                          "flex items-center gap-1.5 text-corps font-bold",
                          mine ? "text-primary" : "text-encre-2"
                        )}
                      >
                        {t.camp && <PointMaillot camp={t.camp} />}
                        {t.libelle}
                        {mine && " · ton équipe"}
                      </p>
                      <p className="mt-0.5 text-corps leading-snug text-encre-3">
                        {t.joueurs.join(" · ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* L'admin voit d'un coup d'œil qui manque à l'appel */}
          {session?.admin && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-contraste/8 px-4 py-2.5">
              <span className="mono-label text-primary">{presence.presents.length} présents</span>
              <span className="mono-label text-encre-3">{presence.absents.length} absents</span>
              <span className="mono-label text-[#c8352b] dark:text-[#FF6B5E]">
                {presence.sansReponse.length} sans réponse
              </span>
            </div>
          )}
        </div>
      </section>

      <Messagerie />
      </div>
    </div>
  );
}
