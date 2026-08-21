"use client";

// La messagerie de la ligue : un salon où tout le monde parle, et des
// conversations à deux.
//
// Deux vues seulement — la liste des fils, et un fil ouvert. Le salon est
// toujours en tête : c'est la place du village, celle où l'on tombe quand on
// n'a encore écrit à personne.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Plus, Search, Hash, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { isAdmin } from "@/lib/sfl/admin";
import { isHidden } from "@/lib/sfl/hidden";
import { supabase } from "@/lib/supabase";
import {
  SALON,
  blocage,
  chargerProfils,
  chargerTout,
  dernierLu,
  ecouter,
  envoyer,
  marquerLu,
  nonLus,
  type Fil,
  type Profil,
} from "@/lib/sfl/messages";

/** Initiales : deux lettres max, majuscules. */
function initiales(nom: string) {
  const w = nom.trim().split(/\s+/);
  return (w.length > 1 ? `${w[0][0]}${w[1][0]}` : w[0].slice(0, 2)).toUpperCase();
}

function heure(at: number) {
  const d = new Date(at);
  const auj = new Date();
  const memeJour = d.toDateString() === auj.toDateString();
  return memeJour
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Messagerie() {
  const session = useSession();
  const [moi, setMoi] = useState<string | null>(null);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [salon, setSalon] = useState<Fil | null>(null);
  const [prives, setPrives] = useState<Fil[]>([]);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [choix, setChoix] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [prete, setPrete] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  const empeche = blocage();

  const recharger = useCallback(async (uid: string, liste: Profil[]) => {
    const tout = await chargerTout(uid, liste);
    if (!tout.ok) {
      setErreur(tout.raison);
      setPrete(true);
      return;
    }
    setErreur(null);
    setSalon(tout.salon);
    setPrives(tout.prives);
    setPrete(true);
  }, []);

  // Premier chargement + temps réel.
  useEffect(() => {
    if (!session?.server) {
      Promise.resolve().then(() => setPrete(true));
      return;
    }
    let vivant = true;
    let stop = () => {};
    (async () => {
      const { data: auth } = await supabase().auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!vivant) return;
      setMoi(uid);
      if (!uid) {
        // La session de l'app se croit vérifiée mais le jeton Supabase a
        // disparu. Sans ce message, l'écran restait vide sans rien expliquer.
        setErreur("Ta session serveur a expiré. Déconnecte-toi puis reconnecte-toi.");
        setPrete(true);
        return;
      }
      const liste = await chargerProfils();
      if (!vivant) return;
      setProfils(liste);
      await recharger(uid, liste);
      if (!vivant) return;
      stop = ecouter(() => void recharger(uid, liste));
    })();
    return () => {
      vivant = false;
      stop();
    };
  }, [session?.server, recharger]);

  const filOuvert: Fil | null =
    ouvert === SALON ? salon : ouvert ? (prives.find((f) => f.cle === ouvert) ?? null) : null;

  // Marquer lu et descendre en bas du fil quand on l'ouvre ou qu'il bouge.
  useEffect(() => {
    if (!filOuvert) return;
    const dernier = filOuvert.dernier?.at ?? 0;
    if (dernier > dernierLu(filOuvert.cle)) marquerLu(filOuvert.cle, dernier);
    bas.current?.scrollIntoView({ block: "end" });
  }, [filOuvert]);

  async function soumettre() {
    if (!ouvert) return;
    const corps = texte;
    setTexte("");
    const r = await envoyer(corps, ouvert === SALON ? null : ouvert);
    if (!r.ok) {
      setErreur(r.raison);
      setTexte(corps); // on ne perd pas ce qui vient d'être écrit
      return;
    }
    setErreur(null);
    if (moi) await recharger(moi, profils);
  }

  /* ----------------------------- Sans serveur ---------------------------- */

  if (empeche) {
    return (
      <div className="glass rounded-3xl p-4">
        <h2 className="text-[16px] font-bold tracking-tight">Discussions</h2>
        <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-snug text-amber-400">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
          {empeche}
        </p>
      </div>
    );
  }

  /* ------------------------------- Un fil -------------------------------- */

  if (filOuvert) {
    const salonOuvert = filOuvert.cle === SALON;
    return (
      <div className="glass flex flex-col overflow-hidden rounded-3xl">
        <div className="flex items-center gap-2.5 border-b border-white/8 px-3.5 py-2.5">
          <button
            onClick={() => setOuvert(null)}
            aria-label="Retour aux discussions"
            className="glass-soft flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              salonOuvert ? "bg-primary/20 text-primary" : "bg-white/8"
            )}
          >
            {salonOuvert ? <Hash className="size-4" /> : initiales(filOuvert.titre)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold tracking-tight">
              {filOuvert.titre}
            </span>
            <span className="mono-label block text-foreground/35">
              {salonOuvert ? "Toute la ligue" : "Conversation privée"}
            </span>
          </span>
        </div>

        <div className="flex max-h-[52dvh] min-h-[220px] flex-col gap-2 overflow-y-auto px-3.5 py-3">
          {filOuvert.messages.length === 0 && (
            <p className="py-8 text-center text-[13px] text-foreground/35">
              {salonOuvert
                ? "Personne n'a encore parlé. Lance la conversation."
                : `Écris le premier message à ${filOuvert.titre}.`}
            </p>
          )}
          {filOuvert.messages.map((m, i) => {
            // Le nom ne se répète pas quand la même personne enchaîne.
            const suite = i > 0 && filOuvert.messages[i - 1].auteurId === m.auteurId;
            return (
              <div
                key={m.id}
                className={cn("flex flex-col", m.mien ? "items-end" : "items-start")}
              >
                {salonOuvert && !m.mien && !suite && (
                  <span className="mono-label mb-0.5 px-1 text-foreground/35">{m.auteur}</span>
                )}
                <span
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug break-words",
                    m.mien ? "bg-primary text-primary-foreground" : "bg-white/8"
                  )}
                >
                  {m.texte}
                </span>
                <span className="mono-label mt-0.5 px-1 text-foreground/25">{heure(m.at)}</span>
              </div>
            );
          })}
          <div ref={bas} />
        </div>

        {erreur && (
          <p className="flex items-start gap-1.5 border-t border-white/8 px-3.5 py-2 text-[12.5px] leading-snug text-red-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            {erreur}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void soumettre();
          }}
          className="flex items-center gap-2 border-t border-white/8 px-3 py-2.5"
        >
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            placeholder={salonOuvert ? "Écrire au salon…" : `Écrire à ${filOuvert.titre}…`}
            maxLength={2000}
            className="glass-soft min-w-0 flex-1 rounded-full px-4 py-2.5 text-[14px] outline-none placeholder:text-foreground/30"
          />
          <button
            type="submit"
            disabled={!texte.trim()}
            aria-label="Envoyer"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95 disabled:opacity-30"
          >
            <Send className="size-4" strokeWidth={2.5} />
          </button>
        </form>
      </div>
    );
  }

  /* ---------------------------- Le choix d'un joueur --------------------- */

  if (choix) {
    const visibles = profils
      .filter((p) => p.id !== moi)
      .filter((p) => isAdmin(session?.name) || !isHidden(p.name))
      .filter((p) => p.name.toLowerCase().includes(recherche.trim().toLowerCase()));
    return (
      <div className="glass rounded-3xl p-3.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setChoix(false);
              setRecherche("");
            }}
            aria-label="Retour"
            className="glass-soft flex size-8 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h2 className="text-[15px] font-bold tracking-tight">À qui veux-tu écrire ?</h2>
        </div>
        <label className="glass-soft mt-3 flex items-center gap-2 rounded-full px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-foreground/35" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Un joueur…"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-foreground/30"
          />
        </label>
        <div className="mt-2 flex max-h-[46dvh] flex-col overflow-y-auto">
          {visibles.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setChoix(false);
                setRecherche("");
                setOuvert(p.id);
              }}
              className="flex items-center gap-2.5 border-b border-white/6 py-2.5 text-left last:border-0"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold">
                {initiales(p.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
            </button>
          ))}
          {visibles.length === 0 && (
            <p className="py-6 text-center text-[13px] text-foreground/35">Personne à ce nom.</p>
          )}
        </div>
      </div>
    );
  }

  /* ----------------------------- La liste -------------------------------- */

  const fils: Fil[] = salon ? [salon, ...prives] : prives;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[16px] font-bold tracking-tight">Discussions</h2>
        <button
          onClick={() => setChoix(true)}
          className="flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[12.5px] font-bold text-background"
        >
          <Plus className="size-3.5" strokeWidth={3} /> Nouveau
        </button>
      </div>

      {erreur && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3">
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-amber-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            {erreur}
          </p>
          {erreur.includes("Installation Supabase") && (
            <Link
              href="/admin/setup"
              className="glass-soft mt-2.5 block rounded-full py-2 text-center text-[13px] font-semibold text-foreground/75"
            >
              Ouvrir l&apos;installation
            </Link>
          )}
        </div>
      )}

      {!prete && <p className="px-1 text-[13px] text-foreground/35">Chargement…</p>}

      {fils.map((f) => {
        const neufs = nonLus(f);
        const estSalon = f.cle === SALON;
        return (
          <button
            key={f.cle}
            onClick={() => setOuvert(f.cle)}
            className="glass flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left"
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                estSalon ? "bg-primary/20 text-primary" : "bg-white/8"
              )}
            >
              {estSalon ? <Hash className="size-4" /> : initiales(f.titre)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14.5px] font-bold tracking-tight">{f.titre}</span>
                {f.dernier && (
                  <span className="mono-label shrink-0 text-foreground/30">
                    {heure(f.dernier.at)}
                  </span>
                )}
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground/42">
                  {f.dernier
                    ? `${f.dernier.mien ? "Toi : " : estSalon ? `${f.dernier.auteur} : ` : ""}${f.dernier.texte}`
                    : estSalon
                      ? "Le salon de toute la ligue"
                      : "Aucun message"}
                </span>
                {neufs > 0 && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground tabular-nums">
                    {neufs > 9 ? "9+" : neufs}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
