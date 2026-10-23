"use client";

// L'écran « Nouveau mot de passe » — avant l'app, une seule fois.
//
// Les mots de passe que la ligue distribuait ont été lisibles par tout le
// monde (le dépôt du code était public). Chaque compte né de l'un d'eux, ou
// d'un mot de passe provisoire donné par l'admin, choisit donc le sien avant
// d'entrer : la base tient la liste (mot_de_passe_a_changer) et efface la
// ligne d'elle-même quand le mot de passe change vraiment.
//
// La session ouverte prouve qui est le joueur : l'actuel n'est pas redemandé,
// sauf si Supabase l'exige (session trop ancienne) — le champ apparaît alors.
// Même langage que l'écran de connexion : verre, micro-libellés, une seule
// action blanche.

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { choisirMotDePasse, signOut, type RefusMotDePasse, type Session } from "@/lib/sfl/auth/session";
import { BORNES } from "@/lib/sfl/inscription";
import { cn } from "@/lib/utils";

const MESSAGES: Record<RefusMotDePasse, string> = {
  "too-short": `${BORNES.motDePasse} caractères au moins.`,
  weak: "Trop facile à deviner. Choisis-en un autre.",
  "same-password": "C'est celui que tu as déjà. Choisis-en un nouveau.",
  "bad-password": "Mot de passe actuel incorrect.",
  reauth: "Tape aussi ton mot de passe actuel, pour confirmer que c'est bien toi.",
  unavailable: "Pas de réponse du serveur. Vérifie ta connexion et réessaie.",
};

export function NouveauMotDePasse({ session }: { session: Session }) {
  const [next, setNext] = useState("");
  const [current, setCurrent] = useState("");
  const [demandeActuel, setDemandeActuel] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provisoire = session.motDePasseAChanger === "provisoire";
  const pret = next.length >= BORNES.motDePasse && (!demandeActuel || !!current);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pret) return;
    setBusy(true);
    setError(null);
    const res = await choisirMotDePasse(next, demandeActuel ? current : undefined);
    setBusy(false);
    if (res.ok) {
      toast.success("Mot de passe enregistré 🔒");
      // La session a changé : AuthGate ouvre l'app à la place de cet écran.
      return;
    }
    if (res.reason === "reauth") setDemandeActuel(true);
    setError(MESSAGES[res.reason]);
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="mono-label text-primary">Mot de passe</p>
        <h1 className="mt-2 text-[34px] leading-[1.05] font-extrabold tracking-tight">
          Choisis le tien.
        </h1>
        <p className="mt-3 text-[13.5px] leading-snug text-foreground/45">
          {provisoire
            ? "Ton mot de passe provisoire ne sert qu'à entrer. Choisis-en un à toi : personne d'autre ne le connaîtra."
            : "Le mot de passe donné par la ligue n'est plus sûr. Choisis-en un à toi : personne d'autre ne le connaîtra."}
        </p>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          {/* Pour le trousseau du téléphone : il range le nouveau mot de passe
              sous le bon identifiant. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={session.user}
            readOnly
            hidden
          />

          {demandeActuel && (
            <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
              <span className="mono-label text-foreground/40">Mot de passe actuel</span>
              <input
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent text-[16px] font-semibold outline-none placeholder:text-foreground/25"
              />
            </label>
          )}

          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
            <span className="mono-label text-foreground/40">Nouveau mot de passe</span>
            <span className="flex items-center gap-2">
              <input
                type={show ? "text" : "password"}
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setError(null);
                }}
                autoComplete="new-password"
                autoFocus
                placeholder={`${BORNES.motDePasse} caractères au moins`}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-foreground/25"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="shrink-0 text-foreground/40"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {error && <p className="px-1 text-[12.5px] font-medium text-[#c8352b] dark:text-[#FF6B5E]">{error}</p>}

          <button
            type="submit"
            disabled={busy || !pret}
            className={cn(
              "bouton-principal bouton--vert mt-1 flex items-center justify-center gap-2 py-4 text-[15px] font-bold",
              (busy || !pret) && "opacity-40"
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Enregistrer et entrer
          </button>
        </form>

        <button
          type="button"
          onClick={signOut}
          className="bouton-discret bouton--rouge mt-5 w-full py-[8px] text-center text-[13px] font-semibold"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
