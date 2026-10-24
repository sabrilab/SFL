"use client";

// La politique de confidentialité, côté admin (sous Activité & rétention) :
// qui l'a acceptée dans une version qui vaut encore (accordValable), qui pas
// encore, et surtout quelles cartes peuvent apparaître dans les vidéos et les
// posts de Bola (l'accord « hors de l'app », facultatif). Avant de monter une
// vidéo, c'est cette liste qui dit qui on peut montrer.
//
// La source est la table `consentements` (l'admin lit tout, par RLS) : la
// ligne la plus récente de chaque joueur fait foi. Le public suit le choix du
// haut de la page (Joueurs par défaut, Admins, Tout le monde).

import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdmin } from "@/lib/sfl/admin";
import { DATE_POLITIQUE, accordValable } from "@/lib/sfl/confidentialite";
import { erreurSansTable } from "@/lib/sfl/consentement";
import { supabase } from "@/lib/supabase";

const PAGE = 1000;

interface Joueur {
  nom: string;
  /** Accord à la version en vigueur. */
  accepte: boolean;
  horsApp: boolean;
  parent: boolean;
}

function Tuile({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-[8.5px] text-foreground/45">{label}</p>
      <div className="mt-1.5 text-[24px] leading-none font-extrabold tabular-nums">{valeur}</div>
    </div>
  );
}

function Noms({ titre, noms }: { titre: string; noms: string[] }) {
  if (!noms.length) return null;
  return (
    <div>
      <p className="mono-label mb-2 text-[8.5px] text-foreground/45">
        {titre} · {noms.length}
      </p>
      <p className="text-[13px] leading-relaxed text-foreground/75">{noms.join(", ")}</p>
    </div>
  );
}

export function AccordsStats({
  public: public_ = "joueurs",
  admins,
}: {
  public?: "joueurs" | "admins" | "tous";
  admins?: ReadonlySet<string>;
} = {}) {
  const [joueurs, setJoueurs] = useState<Joueur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lire = useCallback(async () => {
    const sb = supabase();
    const [{ data: profils, error: e1 }, lignes] = await Promise.all([
      sb.from("profiles").select("id, name, valide"),
      (async () => {
        const lu: { user_id: string; version: string; hors_app: boolean; parent: boolean }[] = [];
        for (let debut = 0; ; debut += PAGE) {
          const { data, error } = await sb
            .from("consentements")
            .select("user_id, version, hors_app, parent")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(debut, debut + PAGE - 1);
          if (error) return { lu, error };
          lu.push(...((data ?? []) as typeof lu));
          if (!data || data.length < PAGE) return { lu, error: null };
        }
      })(),
    ]);
    if (e1 || lignes.error) {
      // Pas encore de table (base pas migrée) : la section le dit sans alarmer.
      const sansTable = erreurSansTable(lignes.error?.code);
      setErreur(sansTable ? "La table des accords arrive avec la prochaine mise en ligne." : (e1 ?? lignes.error)!.message);
      setJoueurs([]);
      return;
    }
    // La ligne la plus récente de chacun (déjà triées du plus récent au plus ancien).
    const dernier = new Map<string, (typeof lignes.lu)[number]>();
    for (const l of lignes.lu) if (!dernier.has(l.user_id)) dernier.set(l.user_id, l);
    setErreur(null);
    setJoueurs(
      ((profils ?? []) as { id: string; name: string; valide: boolean | null }[])
        .filter((p) => p.valide !== false)
        .map((p) => {
          const l = dernier.get(p.id);
          const accepte = accordValable(l?.version);
          return { nom: p.name, accepte, horsApp: accepte && !!l?.hors_app, parent: accepte && !!l?.parent };
        })
    );
  }, []);

  useEffect(() => {
    Promise.resolve().then(lire);
  }, [lire]);

  const a = useMemo(() => {
    if (!joueurs) return null;
    const estAdmin = (nom: string) => (admins ? admins.has(nom) : isAdmin(nom));
    const vus = joueurs
      .filter((j) => (public_ === "tous" ? true : public_ === "admins" ? estAdmin(j.nom) : !estAdmin(j.nom)))
      .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
    return {
      acceptes: vus.filter((j) => j.accepte).length,
      attendus: vus.filter((j) => !j.accepte).map((j) => j.nom),
      horsApp: vus.filter((j) => j.horsApp).map((j) => j.nom),
      parents: vus.filter((j) => j.parent).length,
    };
  }, [joueurs, public_, admins]);

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-[17px] font-bold tracking-tight">Confidentialité</h2>
      <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">
        La politique du {DATE_POLITIQUE}{" "}: qui l&apos;a acceptée, et quelles cartes peuvent sortir de l&apos;app.
      </p>
      {erreur && <p className="mt-3 text-[12.5px] text-foreground/55">{erreur}</p>}
      {a && !erreur && (
        <div className="mt-4 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2">
            <Tuile label="Acceptée" valeur={a.acceptes} />
            <Tuile label="Pas encore" valeur={a.attendus.length} />
            <Tuile label="Hors de l'app" valeur={a.horsApp.length} />
          </div>
          <Noms titre="Cartes utilisables dans les vidéos et les posts" noms={a.horsApp} />
          <Noms titre="Pas encore acceptée" noms={a.attendus} />
          {a.parents > 0 && (
            <p className="text-[12.5px] text-foreground/55">
              {a.parents === 1 ? "1 joueur de moins de 15 ans" : `${a.parents} joueurs de moins de 15 ans`}, avec
              l&apos;accord d&apos;un parent.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
