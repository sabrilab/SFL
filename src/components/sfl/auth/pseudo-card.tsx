"use client";

// Le pseudo du joueur, dans Réglages : unique, et changeable une fois tous
// les 30 jours (règle tenue par la base, voir garde_pseudo). Passé ce délai,
// le bouton s'ouvre ; avant, la date du prochain changement le remplace.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AtSign, Check, Loader2 } from "lucide-react";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { erreurPseudo, normaliserPseudo } from "@/lib/sfl/inscription";
import { cn } from "@/lib/utils";

type Etat = { pseudo: string; prochain: string | null };
/** Le pseudo et, s'il vient d'être changé, la date où il le redevient. */
type Affiche = Etat & { bloque: boolean };

const affiche = (e: Etat): Affiche => ({
  ...e,
  bloque: !!e.prochain && new Date(e.prochain).getTime() > Date.now(),
});

async function appeler(methode: "GET" | "POST", corps?: object, query = "") {
  const jeton = await jetonServeur();
  if (!jeton) return null;
  const r = await fetch(`/api/pseudo${query}`, {
    method: methode,
    headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { "Content-Type": "application/json" } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  }).catch(() => null);
  if (!r) return null;
  return { ok: r.ok, d: (await r.json().catch(() => ({}))) as Etat & { libre?: boolean; error?: string } };
}

const jour = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function PseudoCard() {
  const [etat, setEtat] = useState<Affiche | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [libre, setLibre] = useState<boolean | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let annule = false;
    appeler("GET").then((r) => {
      if (!annule && r?.ok) setEtat(affiche({ pseudo: r.d.pseudo, prochain: r.d.prochain }));
    });
    return () => {
      annule = true;
    };
  }, []);

  const pseudo = normaliserPseudo(saisie);
  useEffect(() => {
    if (!ouvert || erreurPseudo(pseudo) || pseudo === etat?.pseudo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- réinitialise l'état d'une requête réseau
      setLibre(null);
      return;
    }
    let annule = false;
    const t = setTimeout(() => {
      appeler("GET", undefined, `?pseudo=${encodeURIComponent(pseudo)}`).then((r) => {
        if (!annule && r?.ok) setLibre(r.d.libre ?? null);
      });
    }, 420);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [pseudo, ouvert, etat?.pseudo]);

  if (!etat) return null;
  const { bloque } = etat;
  const pret = !erreurPseudo(pseudo) && pseudo !== etat.pseudo && libre === true;

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || envoi) return;
    setEnvoi(true);
    const r = await appeler("POST", { pseudo });
    setEnvoi(false);
    if (r?.ok) {
      const prochain = new Date(Date.now() + 30 * 864e5).toISOString();
      setEtat(affiche({ pseudo, prochain }));
      setOuvert(false);
      setSaisie("");
      toast.success(`Tu es @${pseudo}`);
    } else {
      toast.error(r?.d.error ?? "Changement impossible pour l'instant.");
    }
  }

  return (
    <div className="mt-3 border-t border-contraste/8 pt-3">
      <div className="flex items-center gap-2">
        <AtSign className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{etat.pseudo}</span>
        {bloque ? (
          <span className="mono-label text-foreground/35">Modifiable le {jour(etat.prochain!)}</span>
        ) : (
          !ouvert && (
            <button
              type="button"
              onClick={() => setOuvert(true)}
              className="bouton-secondaire mono-label px-3.5 py-2"
            >
              Changer
            </button>
          )
        )}
      </div>
      {ouvert && !bloque && (
        <form onSubmit={enregistrer} className="mt-2.5 flex gap-2">
          <span className="glass-soft flex min-w-0 flex-1 items-center rounded-full px-4">
            <span className="text-[13.5px] font-bold text-foreground/30">@</span>
            <input
              autoFocus
              value={saisie}
              onChange={(e) => setSaisie(normaliserPseudo(e.target.value))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              placeholder={etat.pseudo}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[13.5px] font-medium outline-none placeholder:text-foreground/30"
            />
            {libre === true && <Check className="size-3.5 shrink-0 text-foreground/55" />}
            {libre === false && <span className="mono-label shrink-0 text-[#c8352b] dark:text-[#FF6B5E]">Pris</span>}
          </span>
          <button
            type="submit"
            disabled={!pret || envoi}
            className={cn(
              "bouton-principal bouton--vert flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-[13px] font-bold",
              (!pret || envoi) && "opacity-40"
            )}
          >
            {envoi && <Loader2 className="size-3.5 animate-spin" />}
            OK
          </button>
          <button
            type="button"
            onClick={() => {
              setOuvert(false);
              setSaisie("");
            }}
            className="bouton-secondaire shrink-0 px-4 py-2.5 text-[13px] font-semibold"
          >
            Annuler
          </button>
        </form>
      )}
    </div>
  );
}
