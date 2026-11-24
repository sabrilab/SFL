"use client";

// « Créer un compte » (onglet Joueurs de l'admin, 24/11/2026, maquette v3) :
// le prénom, le nom, le poste, et la feuille devient « Karim est prêt » avec
// son identifiant et son mot de passe provisoire, prêts à copier.
//
// Le nom dans la ligue suit l'usage de l'inscription (nomDeLigue) : le
// prénom seul, puis « Prénom N » s'il est pris, puis le nom complet. Il
// s'affiche dans la feuille avant de créer. Si ce nom est celui d'un joueur
// Bola (venu par un parrain, hors de la saison), l'admin choisit : c'est lui
// (son compte entre dans la SFL, `lier`) ou un autre (« Prénom N »).
//
// L'ordre est celui de toujours (admin-dashboard.tsx) : l'effectif d'abord,
// en ligne aussitôt, puis le compte (/api/comptes/creer). Si le serveur
// refuse, le joueur reste dans l'effectif « pas de compte », et sa fiche
// propose de le créer.
// Le poste n'est choisi qu'en famille (GB, DEF, MIL, ATT) ; l'effectif
// garde un code (G, DC, MC, AT), affinable dans le tableau complet.

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Feuille } from "@/components/sfl/admin/journee/ui";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { nomDeLigue, nettoyerNom } from "@/lib/sfl/inscription";
import { addRoster, newRosterPlayer, rosterHasName } from "@/lib/sfl/saisie/mutations";
import { CODE_DE_FAMILLE, FAMILLES_POSTE, texteDAcces, type FamillePoste } from "@/lib/sfl/admin-joueurs";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { Rubrique, SegmenteClair, SURFACE, Tete } from "../ui-admin";
import { appelAdmin, type Compte } from "./donnees";

interface Pret {
  name: string;
  user: string;
  password?: string;
  deja?: boolean;
  poste: FamillePoste;
}

function Champ({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-12 items-center gap-3 px-4">
      <span className="w-20 shrink-0 text-lecture text-encre-3">{libelle}</span>
      {children}
    </label>
  );
}

const SAISIE = "h-12 min-w-0 flex-1 bg-transparent text-lecture outline-none placeholder:text-encre-4";

export function NouveauCompte({
  open,
  onOpenChange,
  comptes,
  onCree,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  comptes: Map<string, Compte> | null;
  /** Un compte est né (ou un existant rattaché) : relire la liste. */
  onCree: () => void;
}) {
  const { saison, faire } = useSaisieAdmin();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [poste, setPoste] = useState<FamillePoste | null>(null);
  const [bola, setBola] = useState<Map<string, string>>(new Map());
  const [lier, setLier] = useState<"lui" | "autre" | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pret, setPret] = useState<Pret | null>(null);
  const [copie, setCopie] = useState(false);

  // Les joueurs Bola hors de l'effectif : un même nom demande qui c'est.
  useEffect(() => {
    if (!open) return;
    let vivant = true;
    void appelAdmin("/api/comptes/joueurs-bola").then(({ json }) => {
      const j = (json.joueurs ?? []) as { name: string; username: string }[];
      if (vivant) setBola(new Map(j.map((x) => [x.name.toLowerCase(), x.username])));
    });
    return () => {
      vivant = false;
    };
  }, [open]);

  // Les noms déjà portés : l'effectif et tous les comptes (un ancien membre
  // garde le sien), sauf les joueurs Bola, pour qui l'admin tranche.
  const pris = useMemo(() => {
    const s = new Set(saison.roster.map((r) => r.name.toLowerCase()));
    for (const k of comptes?.keys() ?? []) if (!bola.has(k)) s.add(k);
    return s;
  }, [saison.roster, comptes, bola]);
  const propose = nettoyerNom(prenom) ? nomDeLigue(prenom, nom, pris) : "";
  const pseudoBola = propose ? bola.get(propose.toLowerCase()) : undefined;
  const autre = useMemo(() => (pseudoBola ? nomDeLigue(prenom, nom, new Set([...pris, ...bola.keys()])) : ""), [pseudoBola, prenom, nom, pris, bola]);
  const nomFinal = pseudoBola ? (lier === "lui" ? propose : lier === "autre" ? autre : "") : propose;
  const pretACreer = !!nomFinal && !!poste && !occupe;

  function fermer(o: boolean) {
    onOpenChange(o);
    if (!o) {
      // La feuille se referme : on repart de zéro au prochain compte.
      setTimeout(() => {
        setPrenom("");
        setNom("");
        setPoste(null);
        setLier(null);
        setErreur(null);
        setPret(null);
        setCopie(false);
      }, 300);
    }
  }

  async function creer() {
    if (!pretACreer || !poste) return;
    const name = nomFinal;
    setOccupe(true);
    setErreur(null);
    const code = CODE_DE_FAMILLE[poste];
    // L'effectif d'abord : la carte du joueur existe tout de suite.
    const fait = faire((s) => (rosterHasName(s, name) ? s : addRoster(s, { ...newRosterPlayer(name), poste: code })), `Nouveau joueur — ${name}`);
    if (!fait) {
      haptique.refus();
      setErreur("L'effectif n'a pas pu être écrit.");
      setOccupe(false);
      return;
    }
    try {
      const { json } = await appelAdmin("/api/comptes/creer", lier === "lui" ? { name, lier: true } : { name });
      if (typeof json.error === "string") {
        haptique.refus();
        setErreur(json.error);
      } else {
        haptique.sceau();
        setPret({ name, user: String(json.user ?? ""), password: typeof json.password === "string" ? json.password : undefined, deja: !!json.deja, poste });
      }
    } catch {
      haptique.refus();
      setErreur("Serveur injoignable.");
    }
    setOccupe(false);
    onCree();
  }

  async function provisoire() {
    if (!pret) return;
    setOccupe(true);
    setErreur(null);
    const { json } = await appelAdmin("/api/comptes/reinitialiser", { name: pret.name });
    if (typeof json.error === "string") setErreur(json.error);
    else setPret({ ...pret, user: String(json.user ?? pret.user), password: String(json.password ?? ""), deja: false });
    setOccupe(false);
  }

  function copier() {
    if (!pret?.password) return;
    void navigator.clipboard?.writeText(texteDAcces(pret.name, pret.user, pret.password)).then(
      () => {
        haptique.sceau();
        setCopie(true);
      },
      () => {}
    );
  }

  const erreurVue = erreur && <p className="px-1 text-corps font-medium text-foreground">{erreur}</p>;

  if (pret)
    return (
      <Feuille
        open={open}
        onOpenChange={fermer}
        titre={`${pret.name} est prêt`}
        bas={
          <div className="flex gap-2">
            <button type="button" onClick={() => fermer(false)} className="bouton-secondaire grid h-12 flex-1 place-items-center text-lecture font-semibold">
              Fermer
            </button>
            {pret.password ? (
              <button type="button" onClick={copier} className="bouton-principal flex h-12 flex-[2] items-center justify-center gap-2 text-lecture font-semibold">
                {copie ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
                {copie ? "Copié" : "Copier pour l'envoyer"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void provisoire()}
                disabled={occupe}
                className="bouton-principal flex h-12 flex-[2] items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-60"
              >
                {occupe && <Loader2 className="size-4 animate-spin" />}
                Mot de passe provisoire
              </button>
            )}
          </div>
        }
      >
        <div className="flex justify-center pt-1">
          <Tete nom={pret.name} cote={78} />
        </div>
        <div className={cn(SURFACE, "divide-y divide-border/60 overflow-hidden")}>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4">
            <span className="text-lecture text-encre-3">Identifiant</span>
            <span className="font-mono text-lecture">{pret.user}</span>
          </div>
          {pret.password && (
            <div className="flex min-h-12 items-center justify-between gap-3 px-4">
              <span className="text-lecture text-encre-3">Mot de passe provisoire</span>
              <span className="font-mono text-lecture">{pret.password}</span>
            </div>
          )}
        </div>
        <p className="flex items-center gap-1.5 px-1 text-corps text-encre-3">
          <Check className="size-3.5" strokeWidth={2} /> {pret.poste} · dans l&apos;effectif{pret.deja ? " · compte existant" : ""}
        </p>
        {erreurVue}
      </Feuille>
    );

  return (
    <Feuille
      open={open}
      onOpenChange={fermer}
      titre="Nouveau compte"
      bas={
        <button
          type="button"
          onClick={() => void creer()}
          disabled={!pretACreer}
          className="bouton-principal flex h-12 items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-40"
        >
          {occupe && <Loader2 className="size-4 animate-spin" />}
          Créer le compte
        </button>
      }
    >
      <div className={cn(SURFACE, "divide-y divide-border/60 overflow-hidden")}>
        <Champ libelle="Prénom">
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="off" autoCapitalize="words" enterKeyHint="next" className={SAISIE} />
        </Champ>
        <Champ libelle="Nom">
          <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" autoCapitalize="words" enterKeyHint="done" className={SAISIE} />
        </Champ>
        {nomFinal && (
          <div className="flex min-h-12 items-center gap-3 px-4">
            <span className="w-20 shrink-0 text-lecture text-encre-3">Ligue</span>
            <span className="min-w-0 flex-1 truncate text-lecture font-medium">{nomFinal}</span>
          </div>
        )}
      </div>
      {pseudoBola && (
        <div className="flex flex-col gap-2">
          <Rubrique>Joueur Bola · {propose}</Rubrique>
          <SegmenteClair
            label="Joueur Bola"
            options={[
              { id: "lui", libelle: pseudoBola },
              { id: "autre", libelle: autre },
            ]}
            valeur={lier}
            onChange={(v) => setLier(v)}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Rubrique>Poste</Rubrique>
        <SegmenteClair label="Poste" options={FAMILLES_POSTE.map((f) => ({ id: f, libelle: f }))} valeur={poste} onChange={(v) => setPoste(v)} />
      </div>
      {erreurVue}
    </Feuille>
  );
}
