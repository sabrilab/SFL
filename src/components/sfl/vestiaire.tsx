"use client";

// Le Vestiaire — la discussion de toute la ligue (onglet Ligue).
//
// On y chambre. Chaque message porte la carte de son auteur en pastille (la
// hiérarchie des cartes : petite ici, moyenne pour une carte partagée), et
// peut porter une pièce : sa carte, une feuille de match, un classement. Un
// toucher sur un message ouvre ses réactions (et, pour l'auteur ou l'admin,
// le retrait ; pour l'admin, la sourdine de 24 h).
//
// Noir et blanc, comme la Ligue : ma bulle en blanc, celles des autres en
// verre. Le fil se lit de haut en bas, le plus récent juste au-dessus de la
// barre d'écriture, qui reste collée au-dessus des onglets.
//
// Données : lib/sfl/vestiaire.ts. En développement seulement, ?demo=vestiaire
// remplit le fil de messages d'essai, sans base, pour juger le rendu.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Bell, BellOff, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { Nom } from "@/components/sfl/nom";
import { useSession } from "@/hooks/use-session";
import { RANKINGS } from "@/lib/sfl/rankings";
import { rankByMetric, type Journee } from "@/lib/sfl/engine";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { activerNotifications, etatNotifications, type EtatNotifications } from "@/lib/sfl/notifications";
import { supabase } from "@/lib/supabase";
import {
  EMOJIS,
  EVT_PIECE,
  blocageVestiaire,
  chargerProfilsV,
  chargerVestiaire,
  couperLaParole,
  ecouterVestiaire,
  lireSuivi,
  marquerVestiaireLu,
  posterAuVestiaire,
  prendrePiece,
  reagir,
  reglerNotifsVestiaire,
  retirerMessage,
  type Emoji,
  type MessageV,
  type ModeNotifs,
  type Piece,
  type ProfilV,
} from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";

/* --------------------------------- Temps -------------------------------- */

function quand(at: number) {
  const d = new Date(at);
  const auj = new Date();
  const hier = new Date(auj.getTime() - 86400_000);
  const h = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === auj.toDateString()) return h;
  if (d.toDateString() === hier.toDateString()) return `hier ${h}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${h}`;
}

/* -------------------------------- Pièces -------------------------------- */

function PieceVue({ piece, onOuvrirJournee }: { piece: Piece; onOuvrirJournee?: (j: number) => void }) {
  const { journees } = useSeason();

  if (piece.type === "carte") {
    return (
      <div className="flex justify-center px-1 pt-1 pb-3">
        <CarteDe name={piece.joueur} size={FORMAT_CARTE.grande} detail="Partagée au Vestiaire" />
      </div>
    );
  }

  if (piece.type === "classement") {
    const def = RANKINGS.find((r) => r.id === piece.id);
    return (
      <div className="flex flex-col gap-1.5 px-3 py-3">
        <p className="mono-label text-foreground/45">{def?.label ?? "Classement"}</p>
        {piece.top.map((l, i) => (
          <div key={l.n} className="flex items-center gap-2.5">
            <span className="w-4 text-[13px] font-bold text-foreground/40 tabular-nums">{i + 1}</span>
            <CarteDe name={l.n} size={FORMAT_CARTE.petite} />
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
              <Nom n={l.n} />
            </span>
            <span className="text-[15px] font-bold tabular-nums">
              {l.v}
              <span className="mono-label ml-1 text-foreground/40">{def?.unit}</span>
            </span>
          </div>
        ))}
      </div>
    );
  }

  const jn = journees.find((x) => x.j === piece.j);
  if (!jn) return <p className="px-3 py-3 text-[13px] text-foreground/45">Journée {piece.j}</p>;
  return <FeuilleVue journee={jn} onOuvrir={onOuvrirJournee ? () => onOuvrirJournee(jn.j) : undefined} />;
}

/** Une feuille de match en résumé : les scores, puis les décisifs en cartes. */
function FeuilleVue({ journee, onOuvrir }: { journee: Journee; onOuvrir?: () => void }) {
  const matches = journee.matches ?? [];
  const decisifs = matches
    .flatMap((m) => [...m.teamA.players, ...m.teamB.players])
    .filter((l) => l.buts + l.passes > 0)
    .sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))
    .slice(0, 3);
  return (
    <button
      type="button"
      onClick={(e) => {
        if (!onOuvrir) return;
        e.stopPropagation();
        onOuvrir();
      }}
      className="block w-full px-3 py-3 text-left"
    >
      <p className="mono-label text-foreground/45">
        Feuille de match · J{journee.j} · {journee.date}
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-[13.5px] font-semibold">
            <span className="min-w-0 flex-1 truncate">{m.teamA.name}</span>
            <span className="shrink-0 text-[17px] font-extrabold tabular-nums">
              {m.teamA.score}
              <span className="mx-1 text-foreground/30">–</span>
              {m.teamB.score}
            </span>
            <span className="min-w-0 flex-1 truncate text-right">{m.teamB.name}</span>
          </div>
        ))}
      </div>
      {decisifs.length > 0 && (
        <div className="mt-3 flex gap-3">
          {decisifs.map((l) => (
            <span key={l.name} className="flex min-w-0 flex-col items-center gap-1">
              <CarteDe name={l.name} size={FORMAT_CARTE.petite} inerte />
              <span className="mono-label text-[9px] text-foreground/55 tabular-nums">
                {l.buts > 0 && `${l.buts}B`}
                {l.buts > 0 && l.passes > 0 && " "}
                {l.passes > 0 && `${l.passes}P`}
              </span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/* --------------------------- Choisir une pièce -------------------------- */

function ChoixPiece({ onChoix, onFermer }: { onChoix: (p: Piece) => void; onFermer: () => void }) {
  const { me } = useMyPlayer();
  const { players, saison, journees } = useSeason();
  const [etape, setEtape] = useState<"menu" | "feuille" | "classement">("menu");
  const jouees = useMemo(
    () => [...journees].filter((j) => journeeJouee(saison, j.j) && (j.matches?.length ?? 0) > 0).reverse(),
    [journees, saison]
  );

  const ligne = "flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-[14.5px] font-semibold active:bg-white/8";

  return (
    <div className="glass mb-2 overflow-hidden rounded-3xl p-1.5">
      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1">
        <span className="mono-label text-foreground/45">
          {etape === "menu" ? "Partager" : etape === "feuille" ? "Feuille de match" : "Classement"}
        </span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="flex size-7 items-center justify-center rounded-full text-foreground/50">
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-[42dvh] overflow-y-auto">
        {etape === "menu" && (
          <>
            <button type="button" className={ligne} onClick={() => onChoix({ type: "carte", joueur: me })}>
              Ma carte
            </button>
            <button type="button" className={ligne} onClick={() => setEtape("feuille")} disabled={jouees.length === 0}>
              Une feuille de match
            </button>
            <button type="button" className={ligne} onClick={() => setEtape("classement")}>
              Un classement
            </button>
          </>
        )}
        {etape === "feuille" &&
          jouees.map((j) => (
            <button key={j.j} type="button" className={ligne} onClick={() => onChoix({ type: "feuille", j: j.j })}>
              <span>J{j.j}</span>
              <span className="text-[13px] font-medium text-foreground/50">{j.date}</span>
            </button>
          ))}
        {etape === "classement" &&
          RANKINGS.filter((r) => r.id !== "discipline").map((r) => {
            const top = rankByMetric(players, r.value)
              .filter((p) => r.showAll || p.value > 0)
              .slice(0, 3);
            if (top.length === 0) return null;
            return (
              <button
                key={r.id}
                type="button"
                className={ligne}
                onClick={() => onChoix({ type: "classement", id: r.id, top: top.map((p) => ({ n: p.name, v: p.value })) })}
              >
                <span>{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground/50">
                  <CarteDe name={top[0].name} size={FORMAT_CARTE.petite * 0.62} inerte />
                  <span className="truncate">
                    <Nom n={top[0].name} /> · {top[0].value}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/* ------------------------------ Notifications --------------------------- */

const MODES: [ModeNotifs, string][] = [
  ["tout", "Tout"],
  ["cite", "Quand on me cite"],
  ["rien", "Rien"],
];

function ReglageNotifs({ mode, onMode, onFermer }: { mode: ModeNotifs; onMode: (m: ModeNotifs) => void; onFermer: () => void }) {
  const [etat, setEtat] = useState<EtatNotifications | null>(null);
  useEffect(() => {
    void etatNotifications().then(setEtat);
  }, []);
  return (
    <div className="glass absolute top-12 right-0 z-20 w-[248px] rounded-3xl p-1.5 shadow-2xl">
      {MODES.map(([m, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => {
            onMode(m);
            onFermer();
          }}
          className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-[14px] font-semibold active:bg-white/8"
        >
          {label}
          {mode === m && <Check className="size-4" />}
        </button>
      ))}
      {etat === "inactives" && (
        <button
          type="button"
          onClick={async () => {
            const e = await activerNotifications().catch(() => "inactives" as const);
            setEtat(e);
            if (e === "actives") toast.success("Notifications activées");
          }}
          className="mt-1 w-full rounded-full bg-foreground py-2.5 text-[13px] font-bold text-background"
        >
          Activer sur ce téléphone
        </button>
      )}
    </div>
  );
}

/* -------------------------------- Message ------------------------------- */

function Bulle({
  m,
  suite,
  ouvert,
  moi,
  admin,
  onToucher,
  onReagir,
  onRetirer,
  onCouper,
  onOuvrirJournee,
}: {
  m: MessageV;
  /** Même auteur que le message d'avant, de peu : pas de carte ni de nom. */
  suite: boolean;
  ouvert: boolean;
  moi: string | null;
  admin: boolean;
  onToucher: () => void;
  onReagir: (e: Emoji) => void;
  onRetirer: () => void;
  onCouper: () => void;
  onOuvrirJournee?: (j: number) => void;
}) {
  const pastille = 254 * FORMAT_CARTE.petite;
  const reactions = EMOJIS.filter((e) => (m.reactions[e]?.length ?? 0) > 0);
  return (
    <div className={cn("flex items-end gap-2", m.mien ? "flex-row-reverse" : "flex-row", suite ? "mt-1" : "mt-[var(--fib-13)]")}>
      {!m.mien &&
        (suite ? (
          <span className="shrink-0" style={{ width: pastille }} />
        ) : (
          <CarteDe name={m.auteur || "?"} size={FORMAT_CARTE.petite} className="mb-[18px]" />
        ))}
      <div className={cn("flex min-w-0 max-w-[78%] flex-col", m.mien ? "items-end" : "items-start")}>
        {!m.mien && !suite && (
          <span className="mb-1 px-1 text-[12px] font-semibold text-foreground/55">
            {m.auteur ? <Nom n={m.auteur} /> : "Quelqu'un"}
          </span>
        )}
        {/* Une div plutôt qu'un bouton : la pièce contient ses propres boutons
            (la carte s'ouvre en grand, la feuille ouvre la journée). */}
        <div
          role="button"
          tabIndex={0}
          onClick={onToucher}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToucher())}
          className={cn(
            "flex min-w-0 flex-col gap-1 text-left transition-transform active:scale-[0.985]",
            m.mien ? "items-end" : "items-start"
          )}
        >
          {m.texte && (
            <p
              className={cn(
                "rounded-[20px] px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                m.mien ? "bg-foreground text-background" : "glass-soft"
              )}
            >
              {m.texte}
            </p>
          )}
          {/* La pièce à part, sous la phrase : une carte se montre nue, une
              feuille ou un classement dans son verre. */}
          {m.piece &&
            (m.piece.type === "carte" ? (
              <PieceVue piece={m.piece} />
            ) : (
              <div className="glass-soft w-[min(280px,68vw)] overflow-hidden rounded-[20px]">
                <PieceVue piece={m.piece} onOuvrirJournee={onOuvrirJournee} />
              </div>
            ))}
        </div>

        {reactions.length > 0 && (
          <div className={cn("-mt-2 flex gap-1 px-2", m.mien ? "justify-end" : "justify-start")}>
            {reactions.map((e) => {
              const qui = m.reactions[e] ?? [];
              const mienne = !!moi && qui.includes(moi);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReagir(e)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-full border px-1.5 text-[12px] font-bold tabular-nums",
                    mienne ? "border-foreground bg-foreground text-background" : "border-white/10 bg-background"
                  )}
                >
                  <span className="text-[13px] leading-none">{e}</span>
                  {qui.length > 1 && qui.length}
                </button>
              );
            })}
          </div>
        )}

        {ouvert && (
          <div className={cn("mt-1.5 flex flex-col gap-1.5", m.mien ? "items-end" : "items-start")}>
            <div className="glass flex gap-0.5 rounded-full p-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReagir(e)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-[20px] transition-transform active:scale-90",
                    moi && m.reactions[e]?.includes(moi) && "bg-white/15"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            {(m.mien || admin) && (
              <div className="flex gap-1.5">
                <button type="button" onClick={onRetirer} className="glass-soft rounded-full px-3 py-1.5 text-[12.5px] font-semibold">
                  Retirer
                </button>
                {admin && !m.mien && (
                  <button type="button" onClick={onCouper} className="glass-soft rounded-full px-3 py-1.5 text-[12.5px] font-semibold">
                    Couper la parole 24 h
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <span className="mt-1 px-1 text-[10.5px] font-medium text-foreground/30 tabular-nums">{quand(m.at)}</span>
      </div>
    </div>
  );
}

/* ------------------------------- Vestiaire ------------------------------ */

const DEMO = process.env.NODE_ENV !== "production";

export function Vestiaire({ onOuvrirJournee }: { onOuvrirJournee?: (j: number) => void }) {
  const session = useSession();
  const { players, journees } = useSeason();
  const [moi, setMoi] = useState<string | null>(null);
  const [profils, setProfils] = useState<ProfilV[]>([]);
  const [messages, setMessages] = useState<MessageV[]>([]);
  const [prete, setPrete] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [piece, setPiece] = useState<Piece | null>(null);
  const [choix, setChoix] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [mode, setMode] = useState<ModeNotifs>("tout");
  const [reglage, setReglage] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [sourdine, setSourdine] = useState<number | null>(null);
  const bas = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  const demo = useMemo(() => DEMO && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "vestiaire", []);
  const empeche = demo ? null : blocageVestiaire();
  const admin = !!session?.admin;

  const recharger = useCallback(async (uid: string, liste: ProfilV[]) => {
    const r = await chargerVestiaire(uid, liste);
    if (!r.ok) setErreur(r.raison);
    else {
      setErreur(null);
      setMessages(r.messages);
    }
    setPrete(true);
  }, []);

  // Premier chargement, temps réel, et lecture.
  useEffect(() => {
    if (demo) {
      Promise.resolve().then(() => {
        setMoi("moi");
        setMessages(messagesDemo(players.map((p) => p.name), journees));
        setPrete(true);
      });
      return;
    }
    if (!session?.server) {
      Promise.resolve().then(() => setPrete(true));
      return;
    }
    let vivant = true;
    let stop = () => {};
    (async () => {
      const sb = supabase();
      const { data: auth } = await sb.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!vivant) return;
      setMoi(uid);
      if (!uid) {
        setErreur("Ta session a expiré. Déconnecte-toi puis reconnecte-toi.");
        setPrete(true);
        return;
      }
      const [liste, suivi, sd] = await Promise.all([
        chargerProfilsV(),
        lireSuivi(),
        sb.from("vestiaire_sourdines").select("jusqu_au").eq("user_id", uid).maybeSingle(),
      ]);
      if (!vivant) return;
      setProfils(liste);
      setMode(suivi.notifs);
      const fin = sd.data ? new Date((sd.data as { jusqu_au: string }).jusqu_au).getTime() : 0;
      setSourdine(fin > Date.now() ? fin : null);
      await recharger(uid, liste);
      if (!vivant) return;
      stop = ecouterVestiaire(() => void recharger(uid, liste));
    })();
    return () => {
      vivant = false;
      stop();
    };
  }, [session?.server, recharger, demo, players, journees]);

  // Le Vestiaire ouvert devant moi : tout ce qui arrive est lu.
  const dernier = messages[messages.length - 1]?.at ?? 0;
  useEffect(() => {
    if (demo || !prete || !session?.server) return;
    void marquerVestiaireLu(Math.max(Date.now(), dernier));
  }, [dernier, prete, demo, session?.server]);

  // Descendre au plus récent, à l'ouverture et quand un message arrive.
  useEffect(() => {
    if (!prete) return;
    bas.current?.scrollIntoView({ block: "end" });
  }, [prete, messages.length]);

  // Une pièce préparée ailleurs (« Au Vestiaire » d'un classement, d'une
  // feuille de match) attend dans la barre d'écriture.
  useEffect(() => {
    const prendre = () => {
      const p = prendrePiece();
      if (p) {
        setPiece(p);
        champ.current?.focus();
      }
    };
    prendre();
    window.addEventListener(EVT_PIECE, prendre);
    return () => window.removeEventListener(EVT_PIECE, prendre);
  }, []);

  // @pseudo : les joueurs qui commencent par ce qui est tapé.
  const enCours = /(?:^|\s)@([\p{L}0-9_.-]*)$/u.exec(texte)?.[1]?.toLowerCase();
  const suggestions =
    enCours !== undefined
      ? profils.filter((p) => p.id !== moi && (p.pseudo.startsWith(enCours) || p.name.toLowerCase().startsWith(enCours))).slice(0, 5)
      : [];

  async function envoyer() {
    if (envoi || (!texte.trim() && !piece)) return;
    if (demo) {
      setMessages((ms) => [
        ...ms,
        { id: Date.now(), auteurId: "moi", auteur: "", texte: texte.trim(), piece, at: Date.now(), mien: true, reactions: {} },
      ]);
      setTexte("");
      setPiece(null);
      return;
    }
    setEnvoi(true);
    const corps = texte;
    const p = piece;
    setTexte("");
    setPiece(null);
    const r = await posterAuVestiaire(corps, p);
    setEnvoi(false);
    if (!r.ok) {
      setTexte(corps);
      setPiece(p);
      toast.error(r.raison);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(8);
    if (moi) await recharger(moi, profils);
  }

  async function basculerReaction(m: MessageV, e: Emoji) {
    const deja = !!moi && (m.reactions[e] ?? []).includes(moi);
    // Tout de suite à l'écran ; la base suit.
    setMessages((ms) =>
      ms.map((x) =>
        x.id !== m.id || !moi
          ? x
          : {
              ...x,
              reactions: {
                ...x.reactions,
                [e]: deja ? (x.reactions[e] ?? []).filter((u) => u !== moi) : [...(x.reactions[e] ?? []), moi],
              },
            }
      )
    );
    setOuvert(null);
    if (demo) return;
    const ok = await reagir(m.id, e, !deja);
    if (!ok && moi) {
      toast.error("Réaction pas enregistrée.");
      await recharger(moi, profils);
    }
  }

  async function retirer(m: MessageV) {
    setOuvert(null);
    if (demo) {
      setMessages((ms) => ms.filter((x) => x.id !== m.id));
      return;
    }
    if (!(await retirerMessage(m.id))) toast.error("Impossible de retirer ce message.");
    else if (moi) await recharger(moi, profils);
  }

  async function couper(m: MessageV) {
    setOuvert(null);
    if (demo) return;
    const ok = await couperLaParole(m.auteurId, 24);
    if (ok) toast.success("Parole coupée pour 24 h");
    else toast.error("Impossible pour l'instant.");
  }

  async function changerMode(m: ModeNotifs) {
    setMode(m);
    if (!demo && !(await reglerNotifsVestiaire(m))) toast.error("Réglage pas enregistré.");
  }

  if (empeche) {
    return (
      <p className="glass flex items-start gap-1.5 rounded-3xl p-4 text-[13.5px] leading-snug text-foreground/70">
        <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
        {empeche}
      </p>
    );
  }

  return (
    // -mb-8 : au bout du fil, la barre d'écriture descend se poser juste
    // au-dessus des onglets au lieu de flotter dans le vide de la page.
    <section className="-mb-8 flex flex-col">
      <div className="relative flex items-center justify-end">
        <button
          type="button"
          onClick={() => setReglage((v) => !v)}
          aria-label="Notifications du Vestiaire"
          className="glass flex size-11 items-center justify-center rounded-full"
        >
          {mode === "rien" ? <BellOff className="size-[18px]" /> : <Bell className="size-[18px]" />}
        </button>
        {reglage && <ReglageNotifs mode={mode} onMode={changerMode} onFermer={() => setReglage(false)} />}
      </div>

      {erreur && (
        <p className="mt-3 flex items-start gap-1.5 rounded-2xl border border-white/10 px-3.5 py-3 text-[13px] leading-snug text-foreground/70">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
          {erreur}
        </p>
      )}

      <div className="flex min-h-[40dvh] flex-col justify-end pb-3" onClick={(e) => e.target === e.currentTarget && setOuvert(null)}>
        {prete && messages.length === 0 && !erreur && (
          <p className="py-16 text-center text-[15px] font-semibold text-foreground/35">Le Vestiaire est vide.</p>
        )}
        {messages.map((m, i) => {
          const avant = messages[i - 1];
          const suite = !!avant && avant.auteurId === m.auteurId && m.at - avant.at < 5 * 60_000;
          return (
            <Bulle
              key={m.id}
              m={m}
              suite={suite}
              ouvert={ouvert === m.id}
              moi={moi}
              admin={admin}
              onToucher={() => setOuvert((o) => (o === m.id ? null : m.id))}
              onReagir={(e) => void basculerReaction(m, e)}
              onRetirer={() => void retirer(m)}
              onCouper={() => void couper(m)}
              onOuvrirJournee={onOuvrirJournee}
            />
          );
        })}
        <div ref={bas} className="scroll-mb-40" />
      </div>

      {/* La barre d'écriture, collée au-dessus des onglets */}
      <div className="sticky z-10 pt-2" style={{ bottom: "calc(max(calc(env(safe-area-inset-bottom) - 4px), 14px) + 74px)" }}>
        {/* Le fil s'efface sous la barre au lieu de passer à travers le verre. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-[-20px] -top-6 -bottom-[120px] -z-10"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background) 34px)" }}
        />
        {choix && (
          <ChoixPiece
            onFermer={() => setChoix(false)}
            onChoix={(p) => {
              setPiece(p);
              setChoix(false);
              champ.current?.focus();
            }}
          />
        )}

        {suggestions.length > 0 && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setTexte((t) => t.replace(/@([\p{L}0-9_.-]*)$/u, `@${p.pseudo} `));
                  champ.current?.focus();
                }}
                className="glass flex shrink-0 items-center gap-2 rounded-full py-1 pr-3.5 pl-1"
              >
                <CarteDe name={p.name} size={FORMAT_CARTE.petite * 0.62} inerte />
                <span className="text-[13px] font-semibold">@{p.pseudo}</span>
              </button>
            ))}
          </div>
        )}

        {piece && (
          <div className="glass mb-2 flex items-start gap-2 overflow-hidden rounded-3xl">
            <div className="min-w-0 flex-1">
              <PieceVue piece={piece} />
            </div>
            <button type="button" onClick={() => setPiece(null)} aria-label="Retirer la pièce" className="m-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {sourdine ? (
          <p className="glass rounded-full px-4 py-3 text-center text-[13.5px] font-semibold text-foreground/55">
            Parole coupée jusqu&apos;à {quand(sourdine)}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void envoyer();
            }}
            className="glass flex items-end gap-1.5 rounded-[26px] p-1.5"
          >
            <button
              type="button"
              onClick={() => setChoix((v) => !v)}
              aria-label="Partager une carte, une feuille, un classement"
              className={cn("flex size-10 shrink-0 items-center justify-center rounded-full transition-colors", choix ? "bg-foreground text-background" : "bg-white/10")}
            >
              <Plus className="size-5" strokeWidth={2.5} />
            </button>
            <textarea
              ref={champ}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void envoyer();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Message"
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-[9px] text-[16px] leading-snug outline-none placeholder:text-foreground/30 [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={envoi || (!texte.trim() && !piece)}
              aria-label="Envoyer"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95 disabled:opacity-25"
            >
              <ArrowUp className="size-5" strokeWidth={2.75} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------- Démo -------------------------------- */

// Développement seulement (?demo=vestiaire) : un fil d'essai avec les vrais
// noms de la saison, pour juger le rendu sans écrire en base.
function messagesDemo(noms: string[], journees: Journee[]): MessageV[] {
  const n = (i: number) => noms[i % Math.max(1, noms.length)] ?? "Ilyes";
  const t0 = Date.now() - 50 * 60_000;
  const jn = [...journees].reverse().find((j) => (j.matches?.length ?? 0) > 0);
  const lignes: [string, string, Piece | null, Partial<Record<Emoji, string[]>>][] = [
    [n(3), "Qui a vu le retourné de dimanche ? Je l'attends encore au ralenti", null, { "😂": ["a", "b"] }],
    [n(0), "Personne parce que c'était un centre raté 😭", null, { "💀": ["a", "b", "c"] }],
    [n(0), "", jn ? { type: "feuille", j: jn.j } : null, {}],
    [n(5), "Regarde le classement avant de parler", { type: "classement", id: "buts", top: [{ n: n(0), v: 20 }, { n: n(1), v: 14 }, { n: n(5), v: 10 }] }, { "🐐": ["a"] }],
    ["moi", "@" + n(5).toLowerCase() + " ta carte elle sort du pack de Noël", { type: "carte", joueur: n(1) }, { "🔥": ["a", "b"], "🤡": ["c"] }],
    [n(3), "Dimanche on règle ça sur le terrain", null, {}],
  ];
  return lignes.map(([auteur, texte, piece, reactions], i) => ({
    id: i + 1,
    auteurId: auteur,
    auteur: auteur === "moi" ? "" : auteur,
    texte,
    piece,
    at: t0 + i * 7 * 60_000,
    mien: auteur === "moi",
    reactions,
  }));
}
