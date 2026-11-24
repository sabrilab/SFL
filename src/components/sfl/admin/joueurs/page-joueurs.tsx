"use client";

// L'onglet Joueurs de l'admin (refonte du 24/11/2026, maquette v3 validée le
// 24/11) : la création d'un compte en tête, sous le pouce (« accès direct à
// la création de compte »), les inscriptions à valider, puis tout l'effectif,
// chacun avec sa vraie carte de l'app (« je veux quand même voir les
// joueurs »), son poste et sa dernière venue. Le segmenté trie : Tous, Joue,
// Arbitres, Sans accès (pas de compte, ou mot de passe pas encore choisi).
// Toucher un joueur ouvre sa fiche (fiche-joueur.tsx).
//
// Sur ordinateur, deux colonnes : la liste à gauche ; à droite « Créer un
// compte » et « À valider ». Les écrans d'avant restent ouverts au bout de
// la liste : Les accès (tous les identifiants, la création en série) et
// l'Effectif en cartes.

import { useMemo, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { useArbitres } from "@/hooks/use-arbitres";
import { useIdentites } from "@/hooks/use-identites";
import { Inscriptions } from "@/components/sfl/admin/inscriptions";
import { Nom } from "@/components/sfl/nom";
import { isArbitre, neJouePas } from "@/lib/sfl/hidden";
import { chercherTolerant } from "@/lib/sfl/recherche-tolerante";
import { famillePoste, libelleVu } from "@/lib/sfl/admin-joueurs";
import { haptique } from "@/lib/sfl/haptique";
import { useEstAdmin } from "../coquille";
import { Entete, Ligne, Liste, Reserve, SegmenteClair, Tete } from "../ui-admin";
import { useComptes, useDernieresVenues, type Compte } from "./donnees";
import { FicheJoueur } from "./fiche-joueur";
import { NouveauCompte } from "./nouveau-compte";

type Filtre = "tous" | "joue" | "arbitres" | "sans-acces";

const sansAcces = (c?: Compte) => !!c && (!!c.sansCompte || !!c.aChanger);

function etatDe(c: Compte | undefined, nom: string, vu: string | undefined, maintenant: Date): { texte: string | null; alerte: boolean } {
  if (c?.sansCompte) return { texte: "pas de compte", alerte: true };
  if (c?.aChanger) return { texte: "mot de passe à choisir", alerte: true };
  if (isArbitre(nom)) return { texte: "arbitre", alerte: false };
  if (neJouePas(nom)) return { texte: "ne joue pas", alerte: false };
  return { texte: vu ? libelleVu(new Date(vu), maintenant) : null, alerte: false };
}

export function PageJoueurs() {
  const admin = useEstAdmin();
  const session = useSession();
  const partage = !!(session?.server && session.admin);
  const { saison, isClient, commit } = useSaisieAdmin();
  useArbitres(); // les arbitres relus : le filtre et l'état les suivent
  const ids = useIdentites();
  const { comptes, relire } = useComptes();
  const vus = useDernieresVenues();
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [creer, setCreer] = useState(false);
  const [fiche, setFiche] = useState<string | null>(null);
  const [maintenant] = useState(() => new Date());
  // « À valider » n'est monté qu'une fois : sous la recherche, ou dans la colonne de droite.
  const large = useMediaQuery("(min-width: 1024px)");

  const liste = useMemo(() => {
    const garde = saison.roster.filter((r) => {
      const c = comptes?.get(r.name.toLowerCase());
      return filtre === "joue" ? !neJouePas(r.name) && !isArbitre(r.name) : filtre === "arbitres" ? isArbitre(r.name) : filtre === "sans-acces" ? sansAcces(c) : true;
    });
    const range = [...garde].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return chercherTolerant(range, (r) => [r.name, ids.nom(r.name), ids.pseudo(r.name), r.poste], q);
  }, [saison.roster, comptes, filtre, q, ids]);

  if (!isClient) return null;
  if (!admin) return <Reserve />;

  const nSansAcces = comptes ? saison.roster.filter((r) => sansAcces(comptes.get(r.name.toLowerCase()))).length : 0;
  const ouvrirCreer = () => {
    haptique.choix();
    setCreer(true);
  };
  const boutonCreer = (grand: boolean) => (
    <button
      type="button"
      onClick={ouvrirCreer}
      className={`bouton-principal flex shrink-0 items-center justify-center gap-1.5 px-4 text-ligne font-semibold ${grand ? "h-11" : "h-10"}`}
    >
      <UserPlus className="size-4" strokeWidth={2} aria-hidden />
      Créer un compte
    </button>
  );
  const aValider = <Inscriptions saison={saison} onCommit={commit} partage={partage} />;
  const ouvert = fiche ? saison.roster.find((r) => r.name === fiche) : undefined;

  return (
    <div className="mx-auto w-full max-w-[600px] px-5 pt-3 lg:max-w-[1176px] lg:px-12 lg:pt-5">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-5">
          <Entete titre="Joueurs" droite={<span className="lg:hidden">{boutonCreer(false)}</span>} />
          <label className="flex h-11 items-center gap-2 rounded-champ bg-secondary px-3.5">
            <Search className="size-4 shrink-0 text-encre-3" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher"
              aria-label="Rechercher un joueur"
              enterKeyHint="search"
              className="h-11 min-w-0 flex-1 bg-transparent text-lecture outline-none placeholder:text-encre-4"
            />
          </label>
          {!large && <div className="flex flex-col gap-6">{aValider}</div>}
          <div className="flex flex-col gap-2">
            <SegmenteClair
              label="Joueurs"
              options={[
                { id: "tous", libelle: `Tous ${saison.roster.length}` },
                { id: "joue", libelle: "Joue" },
                { id: "arbitres", libelle: "Arbitres" },
                { id: "sans-acces", libelle: nSansAcces ? `Sans accès ${nSansAcces}` : "Sans accès" },
              ]}
              valeur={filtre}
              onChange={setFiltre}
            />
            {liste.length > 0 ? (
              <Liste>
                {liste.map((r) => {
                  const c = comptes?.get(r.name.toLowerCase());
                  const etat = etatDe(c, r.name, vus.get(r.name.toLowerCase()), maintenant);
                  const sous = [famillePoste(r.poste), etat.texte].filter(Boolean).join(" · ");
                  return (
                    <Ligne
                      key={r.name}
                      titre={<Nom n={r.name} />}
                      sous={sous || undefined}
                      alerte={etat.alerte}
                      avant={<Tete nom={r.name} />}
                      onClick={() => {
                        haptique.choix();
                        setFiche(r.name);
                      }}
                    />
                  );
                })}
              </Liste>
            ) : (
              <p className="py-10 text-center text-lecture text-encre-3">Personne</p>
            )}
          </div>
          <Liste className="pb-2">
            <Ligne titre="Les accès" droite={nSansAcces || undefined} href="/admin/comptes" />
            <Ligne titre="Effectif en cartes" href="/admin/ligue/effectif" />
          </Liste>
        </div>

        {/* Sur ordinateur, la colonne de droite. */}
        <aside className="hidden flex-col gap-6 pt-16 lg:flex">
          {boutonCreer(true)}
          {large && aValider}
        </aside>
      </div>

      <NouveauCompte open={creer} onOpenChange={setCreer} comptes={comptes} onCree={() => void relire()} />
      <FicheJoueur
        nom={fiche}
        affiche={fiche ? ids.nom(fiche) : undefined}
        poste={ouvert?.poste ?? undefined}
        compte={fiche ? comptes?.get(fiche.toLowerCase()) : undefined}
        vu={fiche ? vus.get(fiche.toLowerCase()) : undefined}
        onOpenChange={(o) => !o && setFiche(null)}
        onChange={() => void relire()}
      />
    </div>
  );
}
