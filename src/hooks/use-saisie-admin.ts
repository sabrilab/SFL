"use client";

// La saison telle que l'admin la prépare : le document entier, brouillons
// compris, relu à chaque changement (le même stockage que l'app joueur), et
// chaque geste enregistré avec son libellé — ↶ ↷ dans la session, la
// corbeille et le bandeau « Annuler » pour une suppression.
//
// Les piles ↶ ↷ ne valent que pour la version de la base sur laquelle elles
// ont été faites : si la base change par ailleurs (un autre admin, une
// réparation SQL comme celle de la J3, 28/10), elles se vident — sinon
// « Annuler » republierait une copie d'avant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsClient } from "@/hooks/use-is-client";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import { SYNC_EVENT, dernierEnvoiAuto, type EnvoiAuto } from "@/lib/sfl/saisie/sync";
import { nommer, remettre, retirer, type ElementCorbeille } from "@/lib/sfl/saisie/corbeille";
import { haptique } from "@/lib/sfl/haptique";
import type { Saison } from "@/lib/sfl/saisie/types";

type Pas = { saison: Saison; label: string; at: number };
const VERSION_KEY = "sfl-saison-remote-version";

const lireVersion = () => {
  try {
    return localStorage.getItem(VERSION_KEY);
  } catch {
    return null;
  }
};

/** Attend l'issue de l'envoi en base qui suit une sauvegarde (null : pas de session serveur, rien ne part). */
export function attendreEnvoi(delai = 15000): Promise<EnvoiAuto | null> {
  return new Promise((resolve) => {
    const avant = dernierEnvoiAuto();
    const fin = () => {
      window.removeEventListener(SYNC_EVENT, fin);
      clearTimeout(t);
      const e = dernierEnvoiAuto();
      resolve(e && e !== avant ? e : null);
    };
    const t = window.setTimeout(fin, delai);
    window.addEventListener(SYNC_EVENT, fin);
  });
}

export function useSaisieAdmin() {
  const isClient = useIsClient();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const relire = () => setVersion((v) => v + 1);
    window.addEventListener(SAISIE_EVENT, relire);
    window.addEventListener("storage", relire);
    return () => {
      window.removeEventListener(SAISIE_EVENT, relire);
      window.removeEventListener("storage", relire);
    };
  }, []);
  const saison = useMemo(() => {
    void version;
    return isClient ? saisieStore.load() : seedSaison();
  }, [isClient, version]);

  const [history, setHistory] = useState<Pas[]>([]);
  const [future, setFuture] = useState<Pas[]>([]);
  const enEnvoi = useRef(false);
  const base = useRef<string | null>(null);
  useEffect(() => {
    base.current = lireVersion();
    const verifier = () => {
      const v = lireVersion();
      if (base.current !== null && v !== base.current && !enEnvoi.current) {
        setHistory([]);
        setFuture([]);
      }
      base.current = v;
    };
    const apresEnvoi = () => {
      base.current = lireVersion();
      enEnvoi.current = false;
    };
    window.addEventListener(SAISIE_EVENT, verifier);
    window.addEventListener(SYNC_EVENT, apresEnvoi);
    return () => {
      window.removeEventListener(SAISIE_EVENT, verifier);
      window.removeEventListener(SYNC_EVENT, apresEnvoi);
    };
  }, []);

  /** Écrit la saison ; renvoie false si l'écriture est refusée (integrite.ts). */
  const persist = useCallback((next: Saison, opts?: { jeter?: number }) => {
    enEnvoi.current = true;
    const refus = saisieStore.save(next, opts);
    if (refus.length) {
      enEnvoi.current = false;
      return false;
    }
    window.dispatchEvent(new Event(SAISIE_EVENT));
    return true;
  }, []);

  const commit = useCallback(
    (next: Saison, label = "Modification", opts?: { jeter?: number }) => {
      const actuelle = saisieStore.load();
      if (next === actuelle || JSON.stringify(next) === JSON.stringify(actuelle)) return true;
      if (!persist(next, opts)) return false;
      setHistory((h) => [...h, { saison: actuelle, label, at: Date.now() }].slice(-200));
      setFuture([]);
      return true;
    },
    [persist]
  );

  /** Un geste qui part TOUJOURS de la saison du moment (jamais d'une copie gardée dans l'écran). */
  const faire = useCallback(
    (f: (s: Saison) => Saison, label: string, opts?: { jeter?: number }) => commit(f(saisieStore.load()), label, opts),
    [commit]
  );

  const remettreElement = useCallback(
    (x: ElementCorbeille, label: string) => {
      const actuelle = saisieStore.load();
      const next = remettre(actuelle, x);
      if (next === actuelle) return false;
      return commit(next, label);
    },
    [commit]
  );

  const supprimer = useCallback(
    (quoi: Parameters<typeof retirer>[1], label: string, opts?: { jeter?: number }) => {
      const actuelle = saisieStore.load();
      const fait = retirer(actuelle, quoi);
      if (!fait) return;
      if (!commit(fait.saison, label, opts)) return;
      haptique.retrait();
      toast(label, {
        duration: 8000,
        action: { label: "Annuler", onClick: () => remettreElement(fait.x, `Annulé — ${nommer(fait.x)}`) },
      });
    },
    [commit, remettreElement]
  );

  const undo = useCallback(() => {
    const pas = history[history.length - 1];
    if (!pas) return;
    const actuelle = saisieStore.load();
    if (!persist(pas.saison)) return;
    haptique.choix();
    setHistory(history.slice(0, -1));
    setFuture([...future, { saison: actuelle, label: pas.label, at: Date.now() }].slice(-200));
  }, [history, future, persist]);

  const redo = useCallback(() => {
    const pas = future[future.length - 1];
    if (!pas) return;
    const actuelle = saisieStore.load();
    if (!persist(pas.saison)) return;
    haptique.choix();
    setFuture(future.slice(0, -1));
    setHistory([...history, { saison: actuelle, label: pas.label, at: Date.now() }].slice(-200));
  }, [history, future, persist]);

  // ⌘Z / ⌘⇧Z.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return { isClient, saison, commit, faire, persist, supprimer, remettreElement, undo, redo, history, future };
}

export type SaisieAdmin = ReturnType<typeof useSaisieAdmin>;
