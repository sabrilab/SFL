"use client";

// Les accès d'un joueur qu'on vient d'ajouter.
//
// Ajouter quelqu'un à l'effectif ne lui donnait aucun moyen d'entrer : la
// table des comptes est figée à la compilation, et lui n'y était pas. Il
// fallait relancer un générateur puis redéployer — autant dire jamais.
//
// Désormais l'ajout crée son compte dans la foulée, avec un mot de passe
// PROVISOIRE tiré au hasard, que cet écran montre une fois, prêt à être
// copié et envoyé. Le joueur en choisit un à lui en se connectant. S'il avait
// déjà un compte, son mot de passe ne se lit nulle part : un bouton lui en
// donne un provisoire.

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { jetonServeur } from "@/lib/sfl/auth/session";

interface Acces {
  user: string;
  password?: string;
  deja?: boolean;
}

async function appel(route: string, name: string): Promise<Acces & { error?: string }> {
  const jeton = await jetonServeur();
  if (!jeton) {
    return {
      user: "",
      error:
        "Ta session n'est pas vérifiée par le serveur : impossible de créer un compte. Déconnecte-toi puis reconnecte-toi.",
    };
  }
  const r = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify({ name }),
  });
  return (await r.json()) as Acces & { error?: string };
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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nom) return;
    let annule = false;
    // Aucun setState synchrone ici : l'état de départ est celui du montage.
    // Le parent remonte le composant à chaque joueur (clé), ce qui remet tout
    // à zéro sans que l'effet ait à le faire.
    (async () => {
      try {
        const j = await appel("/api/comptes/creer", nom);
        if (annule) return;
        if (j.error) setErreur(j.error);
        else setAcces(j);
      } catch {
        if (!annule) setErreur("Serveur injoignable.");
      }
    })();

    return () => {
      annule = true;
    };
  }, [nom]);

  async function provisoire() {
    if (!nom) return;
    setBusy(true);
    setErreur(null);
    try {
      const j = await appel("/api/comptes/reinitialiser", nom);
      if (j.error) setErreur(j.error);
      else setAcces({ user: j.user, password: j.password });
    } catch {
      setErreur("Serveur injoignable.");
    }
    setBusy(false);
  }

  const texte = acces?.password
    ? `${nom}\nIdentifiant : ${acces.user}\nMot de passe provisoire : ${acces.password}`
    : "";

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
              {acces.password && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="mono-label text-foreground/35">Provisoire</span>
                  <span className="font-mono text-[15px] font-bold">{acces.password}</span>
                </div>
              )}
            </div>
            {acces.password ? (
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(texte).then(
                    () => setCopie(true),
                    () => {}
                  );
                }}
                className="bouton-principal bouton--mauve flex items-center justify-center gap-1.5 py-2.5 text-[13.5px] font-bold"
              >
                {copie ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copie ? "Copié" : "Copier pour l'envoyer"}
              </button>
            ) : (
              acces.deja && (
                <>
                  <p className="text-[12.5px] leading-snug text-foreground/45">
                    Ce joueur avait déjà un compte. Son mot de passe n&apos;est connu que de lui.
                  </p>
                  <button
                    onClick={() => void provisoire()}
                    disabled={busy}
                    className="bouton-secondaire bouton--vert flex items-center justify-center gap-1.5 py-2.5 text-[13.5px] font-semibold"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                    Lui donner un mot de passe provisoire
                  </button>
                </>
              )
            )}
          </>
        )}

        {erreur && (
          <p className="flex items-start gap-1.5 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-[12.5px] leading-snug text-amber-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            {erreur}
          </p>
        )}

        {acces?.password && (
          <p className="text-[11.5px] leading-relaxed text-foreground/30">
            Il ne s&apos;affiche qu&apos;ici : envoie-le en privé. À sa première connexion, le joueur
            en choisit un à lui.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
