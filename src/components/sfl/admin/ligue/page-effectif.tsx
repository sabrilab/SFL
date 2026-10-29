"use client";

// Ligue › Effectif : tout l'effectif en cartes, la recherche tolérante en
// tête. La fiche d'un joueur dit et règle « Joue / Ne joue pas »
// (profiles.joue, poser_joue, 30/10/2026) : un membre qui ne joue pas
// (l'admin qui organise) n'entre dans aucun sélecteur, aucune composition,
// aucune notification de joueur. Le reste de sa fiche (poste, profil,
// stats, requalification, détail des points) est dans le tableau complet.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIdentites } from "@/hooks/use-identites";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { isAdmin } from "@/lib/sfl/admin";
import { isArbitre, neJouePas } from "@/lib/sfl/hidden";
import { poserJoue } from "@/lib/sfl/non-joueurs";
import { chercherTolerant } from "@/lib/sfl/recherche-tolerante";
import { supabase } from "@/lib/supabase";
import { haptique } from "@/lib/sfl/haptique";
import { Etiquette, Feuille, Pastille, Segmente } from "../journee/ui";

type Filtre = "tous" | "joue" | "ne-joue-pas" | "arbitres" | "attente";

export function PageEffectif() {
  const { me } = useMyPlayer();
  const { saison, isClient } = useSaisieAdmin();
  const ids = useIdentites();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [fiche, setFiche] = useState<string | null>(null);
  const [, setRev] = useState(0);
  const liste = useMemo(() => {
    const garde = saison.roster.filter((r) =>
      filtre === "joue" ? !neJouePas(r.name) && !isArbitre(r.name) : filtre === "ne-joue-pas" ? neJouePas(r.name) : filtre === "arbitres" ? isArbitre(r.name) : filtre === "attente" ? r.profil !== "Actif" : true
    );
    const range = [...garde].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return chercherTolerant(range, (r) => [r.name, ids.nom(r.name), ids.pseudo(r.name), r.poste, r.profil], q);
  }, [saison.roster, filtre, q, ids]);
  if (!isClient || !isAdmin(me)) return null;
  const r = fiche ? saison.roster.find((x) => x.name === fiche) : undefined;

  async function regler(nom: string, joue: boolean) {
    const { data } = await supabase().from("profiles").select("id").eq("name", nom).maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    if (!id) {
      haptique.refus();
      toast(`${nom} n'a pas de compte.`);
      return;
    }
    const fait = await poserJoue(id, joue);
    if (!fait.ok) {
      haptique.refus();
      toast(fait.raison ?? "Refusé");
      return;
    }
    haptique.sceau();
    setRev((n) => n + 1);
  }

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:max-w-[600px]">
      <header className="flex items-center gap-2">
        <BoutonRetour parent="/admin/ligue" titre="la Ligue" />
        <h1 className="titre-lettrage flex-1 text-[22px]">Effectif</h1>
        <span className="mono-label text-foreground/55">{saison.roster.length}</span>
      </header>
      <label className="glass-soft flex h-11 items-center gap-2 rounded-full px-4">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, pseudo, poste"
          aria-label="Chercher un joueur"
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-foreground/30"
        />
      </label>
      <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
        {(
          [
            ["tous", "Tous"],
            ["joue", "Joue"],
            ["ne-joue-pas", "Ne joue pas"],
            ["arbitres", "Arbitres"],
            ["attente", "Pas actifs"],
          ] as const
        ).map(([id, l]) => (
          <Pastille key={id} actif={filtre === id} onClick={() => setFiltre(id)}>
            {l}
          </Pastille>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 min-[430px]:grid-cols-4 sm:grid-cols-5">
        {liste.map((x) => (
          <button key={x.name} type="button" onClick={() => setFiche(x.name)} className="flex flex-col items-center gap-1 active:scale-95">
            <span className={neJouePas(x.name) ? "opacity-40" : ""}>
              <CarteDe name={x.name} size={FORMAT_CARTE.petite * 1.35} inerte />
            </span>
            <span className="max-w-full truncate text-[12px] font-semibold">
              <Nom n={x.name} />
            </span>
            <span className="mono-label h-3 text-[9px] text-foreground/50">
              {neJouePas(x.name) ? "ne joue pas" : isArbitre(x.name) ? "arbitre" : x.profil !== "Actif" ? x.profil : x.poste && x.poste !== "—" ? x.poste : ""}
            </span>
          </button>
        ))}
      </div>
      {liste.length === 0 && <p className="mono-label py-10 text-center text-foreground/40">Personne</p>}

      <Feuille
        open={!!r}
        onOpenChange={(o) => !o && setFiche(null)}
        titre={r?.name ?? ""}
        bas={
          <Link href="/admin/tableau?onglet=joueurs" className="bouton-secondaire grid h-12 place-items-center text-[15px] font-semibold">
            Fiche complète
          </Link>
        }
      >
        {r && (
          <>
            <div className="flex items-center gap-4">
              <CarteDe name={r.name} size={FORMAT_CARTE.moyenne} />
              <div className="flex flex-col gap-1">
                <span className="mono-label text-foreground/55">{[r.poste && r.poste !== "—" ? r.poste : null, r.profil].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            <section className="flex flex-col gap-2">
              <Etiquette>Sur le terrain</Etiquette>
              <Segmente
                label="Joue"
                options={[
                  { id: "joue" as const, libelle: "Joue" },
                  { id: "non" as const, libelle: "Ne joue pas" },
                ]}
                valeur={neJouePas(r.name) ? "non" : "joue"}
                onChange={(v) => void regler(r.name, v === "joue")}
              />
            </section>
          </>
        )}
      </Feuille>
    </div>
  );
}
