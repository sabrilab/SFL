"use client";

// Messages : mes conversations privées (Sabri, 24/10 : « Permets aussi que
// les joueurs puissent envoyer des messages privés »). Une page enfant du
// Vestiaire, ouverte par l'avion de papier de son en-tête
// (messages/bouton-messages.tsx).
//
// Une ligne par conversation, la plus récente en haut, comme Messages sur
// iPhone : la carte de l'autre en pastille (la hiérarchie des cartes : petite
// dans une liste), son nom, la dernière phrase (« Toi : » quand c'est la
// mienne), l'heure, et en rouge ce qu'il m'a écrit que je n'ai pas lu. Le
// crayon, en haut à droite, écrit à un nouveau joueur (la liste des joueurs
// des matchs : ceux que je suis d'abord). La conversation s'ouvre sur sa page
// (/messages/<lui>).
//
// Hors production, ?demo=prives montre trois conversations d'essai.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, SquarePen } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { useMessagesPrives } from "@/hooks/use-messages-prives";
import { useSession } from "@/hooks/use-session";
import { listerProfils, monId, type Profil } from "@/lib/sfl/matchs";
import { DEMO_PRIVES, conversationsDemo, type Conversation } from "@/lib/sfl/messages-prives";
import { resumeMessage } from "@/lib/sfl/resume-message";
import { cn } from "@/lib/utils";

/** « 14:05 », « hier », « lun. », puis « 12 oct. ». */
function quand(at: number) {
  const d = new Date(at);
  const auj = new Date();
  if (d.toDateString() === auj.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const jours = Math.floor((new Date(auj.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400_000);
  if (jours === 1) return "hier";
  if (jours < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function MessagesPage() {
  const router = useRouter();
  const session = useSession();
  const { me } = useMyPlayer();
  const { players } = useSeason();
  const vrai = useMessagesPrives();
  // Ceux qu'on peut choisir pour un nouveau message (les comptes acceptés) ;
  // l'annuaire, lui, nomme toutes les conversations, même avec un compte
  // remis en attente ou provisoire (28/10/2026).
  const [profils, setProfils] = useState<Profil[]>([]);
  const [annuaire, setAnnuaire] = useState<Profil[]>([]);
  const [moi, setMoi] = useState<string | null>(null);
  const [choisir, setChoisir] = useState(false);

  const demo = useMemo(
    () =>
      DEMO_PRIVES && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "prives"
        ? conversationsDemo(players.map((p) => p.name).filter((n) => n !== me))
        : null,
    [players, me]
  );

  useEffect(() => {
    if (!session?.server) return;
    let vivant = true;
    void monId().then((id) => vivant && setMoi(id));
    listerProfils()
      .then((p) => vivant && setProfils(p))
      .catch(() => {});
    listerProfils({ tous: true })
      .then((p) => vivant && setAnnuaire(p))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [session?.server]);

  const conversations: Conversation[] = demo ?? vrai.conversations;
  const charge = demo !== null || vrai.charge || !session?.server;
  // En démo, l'identifiant d'une conversation est déjà le nom.
  const nomDe = useMemo(() => {
    const parId = new Map(annuaire.map((p) => [p.id, p.name]));
    return (id: string) => (demo ? id : (parId.get(id) ?? ""));
  }, [annuaire, demo]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--fib-13)] px-5 py-4 sm:py-8 lg:max-w-[760px]">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="min-w-0 flex-1 text-titre-l font-bold tracking-tight">Messages</h1>
        {session?.server && (
          <button
            type="button"
            onClick={() => setChoisir(true)}
            aria-label="Nouveau message"
            className="bouton-secondaire flex size-11 shrink-0 items-center justify-center"
          >
            <SquarePen className="size-[18px]" strokeWidth={2.1} />
          </button>
        )}
      </div>

      {charge && conversations.length === 0 && (
        <div className="flex flex-col items-center gap-[var(--fib-21)] pt-[18vh]">
          <span className="flex size-20 items-center justify-center rounded-full border border-foreground/12 text-encre-4">
            <Send className="size-8 -translate-x-0.5 translate-y-0.5" strokeWidth={1.6} />
          </span>
          {session?.server && (
            <button
              type="button"
              onClick={() => setChoisir(true)}
              className="bouton-principal bouton--mauve flex h-12 items-center justify-center px-6 text-lecture font-semibold"
            >
              Écrire à un joueur
            </button>
          )}
        </div>
      )}

      <ul className="-mx-2 flex flex-col">
        {conversations.map((c) => {
          const nom = nomDe(c.avec);
          const lu = c.nonLus === 0;
          return (
            <li key={c.avec}>
              <Link
                href={demo ? `/messages/${encodeURIComponent(c.avec)}?demo=prives` : `/messages/${c.avec}`}
                className="flex items-center gap-3 rounded-[20px] px-2 py-2.5 active:bg-contraste/6"
              >
                <CarteDe name={nom || "?"} size={FORMAT_CARTE.petite} inerte />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-titre tracking-tight", lu ? "font-semibold" : "font-bold")}>
                      {nom ? <Nom n={nom} /> : "Un joueur"}
                    </span>
                    <span className={cn("shrink-0 text-petit tabular-nums", lu ? "text-encre-3" : "font-semibold text-foreground")}>
                      {quand(c.dernier.at)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-ligne", lu ? "text-encre-3" : "font-semibold text-encre-2")}>
                      {c.dernier.mien ? "Toi : " : ""}
                      {resumeMessage(c.dernier.texte, c.dernier.piece)}
                    </span>
                    {!lu && (
                      <span
                        aria-label={`${c.nonLus} pas lu${c.nonLus > 1 ? "s" : ""}`}
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-[5px] text-petit leading-none font-bold text-white tabular-nums"
                        style={{ background: "#FF3B30" }}
                      >
                        {c.nonLus > 9 ? "9+" : c.nonLus}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {choisir && (
        <ChoisirJoueur
          open={choisir}
          onOpenChange={setChoisir}
          profils={profils}
          exclus={new Set(moi ? [moi] : [])}
          libres={new Set()}
          moiNom={me ?? ""}
          titre="Nouveau message"
          geste="Écrire"
          onChoisir={(p) => {
            setChoisir(false);
            router.push(`/messages/${p.id}`);
          }}
        />
      )}
    </div>
  );
}
