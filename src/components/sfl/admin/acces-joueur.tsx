"use client";

// Les accès d'un joueur qu'on vient d'ajouter.
//
// Ajouter quelqu'un à l'effectif ne lui donnait aucun moyen d'entrer : la
// table des comptes est figée à la compilation, et lui n'y était pas. Il
// fallait relancer un générateur puis redéployer — autant dire jamais.
//
// Désormais l'ajout fabrique ses accès et crée son compte dans la foulée,
// et cet écran les montre une fois, prêts à être copiés et envoyés.

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

interface Acces {
  user: string;
  password: string;
  deja?: boolean;
}

export function AccesJoueur({
  nom,
  onClose,
}: {
  /** Le joueur qui vient d'être ajouté — null ferme la fenêtre. */
  nom: string | null;
  onClose: () => void;
}) {
  const [acces, setAcces] = useState<Acces | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!nom) return;
    let annule = false;
    // Aucun setState synchrone ici : l'état de départ est celui du montage.
    // Le parent remonte le composant à chaque joueur (clé), ce qui remet tout
    // à zéro sans que l'effet ait à le faire.
    (async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const accessToken = data.session?.access_token ?? null;
        if (!accessToken) {
          if (!annule)
            setErreur(
              "Ta session n'est pas vérifiée par le serveur : impossible de créer un compte. Déconnecte-toi puis reconnecte-toi."
            );
          return;
        }
        const r = await fetch("/api/comptes/creer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, name: nom }),
        });
        const j = (await r.json()) as Acces & { error?: string };
        if (annule) return;
        if (j.error) {
          setErreur(j.error);
          // Même en cas d'échec de création, les accès sont connus : ils se
          // déduisent du nom. Autant les montrer.
          if (j.user && j.password) setAcces({ user: j.user, password: j.password });
        } else {
          setAcces(j);
        }
      } catch {
        if (!annule) setErreur("Serveur injoignable.");
      }
    })();

    return () => {
      annule = true;
    };
  }, [nom]);

  const texte = acces ? `${nom}\nIdentifiant : ${acces.user}\nMot de passe : ${acces.password}` : "";

  return (
    <Dialog open={!!nom} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-[19px] font-bold tracking-tight">
          <KeyRound className="size-4.5" /> Accès de {nom}
        </DialogTitle>

        {!acces && !erreur && (
          <p className="text-[13.5px] text-foreground/45">Création du compte…</p>
        )}

        {acces && (
          <>
            <div className="glass-soft flex flex-col gap-2 rounded-2xl px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="mono-label text-foreground/35">Identifiant</span>
                <span className="font-mono text-[15px] font-bold">{acces.user}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="mono-label text-foreground/35">Mot de passe</span>
                <span className="font-mono text-[15px] font-bold">{acces.password}</span>
              </div>
            </div>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(texte).then(
                  () => setCopie(true),
                  () => {}
                );
              }}
              className="flex items-center justify-center gap-1.5 rounded-full bg-foreground py-2.5 text-[13.5px] font-bold text-background"
            >
              {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copie ? "Copié" : "Copier pour l'envoyer"}
            </button>
            {acces.deja && (
              <p className="text-[12.5px] leading-snug text-foreground/45">
                Ce joueur avait déjà un compte — voici ses accès, inchangés.
              </p>
            )}
          </>
        )}

        {erreur && (
          <p className="flex items-start gap-1.5 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-[12.5px] leading-snug text-amber-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            {erreur}
          </p>
        )}

        <p className="text-[11.5px] leading-relaxed text-foreground/30">
          Ce mot de passe est un mot de passe d&apos;ouverture, pas un secret. Demande-lui de le
          changer à sa première connexion, dans Réglages.
        </p>
      </DialogContent>
    </Dialog>
  );
}
