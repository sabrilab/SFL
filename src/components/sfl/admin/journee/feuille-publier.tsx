"use client";

// « Publier pour tout le monde » (Sabri, 29/10/2026) et son geste inverse,
// « Remettre en brouillon » — un seul nom pour chacun.
//
// Publier : on voit d'abord EXACTEMENT ce que verra la ligue (CarteJournee,
// calculée par la même fonction que les téléphones), les compteurs en mots,
// qui prévenir avec le texte exact de la notification, puis on glisse. Une
// seule écriture, donc une seule version dans l'historique ; le sceau ne se
// pose qu'une fois la base d'accord. Un défaut bloquant (un doublon, un
// match vide…) se voit barré, et le glissé reste éteint.
//
// Remettre en brouillon : permis jusqu'au coup d'envoi, sans but ni
// résultat ; ce qui ne se reprend pas (les joueurs déjà prévenus) est dit
// comme un fait, pas comme un avertissement.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { ReponseScellee, type IssueReponse } from "@/components/sfl/reponse-scellee";
import { useSession } from "@/hooks/use-session";
import { attendreEnvoi } from "@/hooks/use-saisie-admin";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { designerArbitre } from "@/lib/sfl/arbitres";
import { heuresDeJournee } from "@/lib/sfl/missions";
import { QUI_PREVENIR, destinatairesPublication, textePublication, type QuiPrevenir } from "@/lib/sfl/annonce-publication";
import { apercuPublication, publierJournee, remettreEnBrouillon } from "@/lib/sfl/saisie/brouillon";
import { compteurs } from "@/lib/sfl/saisie/etat-journee";
import { bloquantsPublication, libelleEcart } from "@/lib/sfl/saisie/integrite";
import { matchsDeclares } from "@/lib/sfl/saisie/mutations";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { numeroSaison, type Saison } from "@/lib/sfl/saisie/types";
import { haptique } from "@/lib/sfl/haptique";
import { Etiquette, Feuille, PastilleEtat, Segmente } from "./ui";

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "S" : ""}`;

/** « 2 MATCHS · 20 JOUEURS · 2 REMPLAÇANTS ». */
export function compteursEnMots(s: Saison, j: number): string {
  const c = compteurs(s, j);
  return [pluriel(c.matchs, "MATCH"), pluriel(c.joueurs, "JOUEUR"), c.sansEquipe ? pluriel(c.sansEquipe, "REMPLAÇANT") : null].filter(Boolean).join(" · ");
}

export function FeuillePublier({
  open,
  onOpenChange,
  saison,
  j,
  par,
  faire,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  par: string;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
}) {
  const session = useSession();
  const [qui, setQui] = useState<QuiPrevenir>("viennent");
  const apercu = useMemo(() => apercuPublication(saison, j), [saison, j]);
  const defauts = useMemo(() => bloquantsPublication(saison, j), [saison, j]);
  const declares = matchsDeclares(saison, j);
  const arbitres = declares.filter((m) => m.arbitre).length;
  const texte = textePublication(saison, j);
  const destinataires = destinatairesPublication(saison, j, qui);

  async function publier(): Promise<IssueReponse> {
    const le = new Date();
    if (!faire((s) => publierJournee(s, j, par, le), `J${j} publiée`)) return "erreur";
    if (session?.server && session.admin) {
      const envoi = await attendreEnvoi();
      if (envoi && !envoi.ok) {
        toast(envoi.raison ?? "La base a refusé.", { id: "publier" });
        haptique.refus();
        return "dite";
      }
      // Les arbitres désignés pendant le brouillon : écrits maintenant que la base est d'accord.
      const doc = saisieStore.load();
      const numero = numeroSaison(doc);
      // Les notes des joueurs ferment le mardi à minuit qui suit le match (comme l'ancien tableau).
      const fermeLe = heuresDeJournee(doc, j, new Date())?.finDesNotes ?? null;
      await Promise.all(
        matchsDeclares(doc, j).map((m, n) => (m.arbitre ? designerArbitre(numero, j, n, [...m.equipes], m.arbitre, fermeLe) : null))
      );
      if (qui !== "personne") {
        const jeton = await jetonServeur();
        const r = await fetch("/api/ligue/publication", {
          method: "POST",
          headers: { "content-type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
          body: JSON.stringify({ j, qui }),
        }).catch(() => null);
        const lu = r?.ok ? ((await r.json().catch(() => null)) as { envoyes?: number } | null) : null;
        if (lu?.envoyes) toast(`${lu.envoyes} prévenus`, { id: "publier" });
      }
    }
    haptique.sceau();
    return "ok";
  }

  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Publier la J${j}`} etat={<PastilleEtat etat="brouillon" />} haute>
      {apercu ? <CarteJournee journee={apercu} /> : <div className="glass rounded-3xl px-5 py-10 text-center mono-label text-foreground/45">J{j} · 0 joueur</div>}

      {defauts.length ? (
        <div className="flex flex-wrap gap-1.5">
          {defauts.map((d) => (
            <span key={libelleEcart(d)} className="mono-label inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-background">
              <span aria-hidden>!</span>
              {libelleEcart(d)}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="mono-label text-foreground/70">{compteursEnMots(saison, j)}</p>
          {declares.length > 0 && <p className="mono-label text-foreground/45">Arbitres {arbitres} sur {declares.length}</p>}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <Etiquette>Prévenir</Etiquette>
        <Segmente taille="sm" label="Prévenir" options={QUI_PREVENIR.map((q) => ({ id: q.id, libelle: q.libelle }))} valeur={qui} onChange={setQui} />
        {qui !== "personne" && (
          <div className="glass-soft flex flex-col gap-1 rounded-[20px] px-4 py-3">
            <span className="mono-label text-foreground/45">SFL</span>
            <span className="text-[15px] font-semibold">{texte.titre}</span>
            <span className="text-[14px] text-foreground/70">{texte.texte}</span>
            <span className="mono-label mt-1 text-foreground/45">{pluriel(destinataires.length, "JOUEUR")}</span>
          </div>
        )}
      </section>

      <ReponseScellee
        mine={null}
        seul={{ r: "present", libelle: "Publier pour tout le monde" }}
        tonSeul="blanc"
        scelles={{ present: "En ligne" }}
        ouvert={defauts.length === 0}
        onRepondre={publier}
        onScellee={() => onOpenChange(false)}
      />
    </Feuille>
  );
}

export function FeuilleRemettre({
  open,
  onOpenChange,
  saison,
  j,
  par,
  faire,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  j: number;
  par: string;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
}) {
  const session = useSession();
  const [prevenus, setPrevenus] = useState<{ publication: number; missions: number } | null>(null);
  useEffect(() => {
    if (!open || !session?.server) return;
    let fini = false;
    (async () => {
      const jeton = await jetonServeur();
      const r = await fetch(`/api/ligue/publication?j=${j}`, { headers: jeton ? { Authorization: `Bearer ${jeton}` } : {} }).catch(() => null);
      const lu = r?.ok ? ((await r.json().catch(() => null)) as { publication: number; missions: number } | null) : null;
      if (!fini && lu) setPrevenus(lu);
    })();
    return () => {
      fini = true;
    };
  }, [open, j, session?.server]);
  const meta = saison.journees.find((m) => m.j === j);
  const le = meta?.publiee?.le ? new Date(meta.publiee.le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;

  async function remettre(): Promise<IssueReponse> {
    let refus: string | null = null;
    const ok = faire((s) => {
      const r = remettreEnBrouillon(s, j, par, new Date());
      if ("refus" in r) {
        refus = r.refus;
        return s;
      }
      return r.saison;
    }, `J${j} remise en brouillon`);
    if (refus || !ok) {
      toast(refus === "jouee" ? "Déjà jouée" : refus === "coup-d-envoi" ? "Coup d'envoi passé" : "Refusé", { id: "remettre" });
      haptique.refus();
      return "dite";
    }
    haptique.sceau();
    return "ok";
  }

  return (
    <Feuille open={open} onOpenChange={onOpenChange} titre={`Remettre la J${j}`} etat={<PastilleEtat etat="en-ligne" suffixe={le} />}>
      <div className="flex flex-col gap-1.5">
        <p className="mono-label text-foreground/70">{compteursEnMots(saison, j)}</p>
        {prevenus && (
          <>
            <p className="mono-label text-foreground/70">J{j} en ligne · {prevenus.publication} prévenus</p>
            <p className="mono-label text-foreground/70">Missions · J{j} · {prevenus.missions} prévenus</p>
          </>
        )}
      </div>
      <ReponseScellee
        mine={null}
        seul={{ r: "present", libelle: "Remettre en brouillon" }}
        tonSeul="blanc"
        scelles={{ present: "Brouillon" }}
        onRepondre={remettre}
        onScellee={() => onOpenChange(false)}
      />
    </Feuille>
  );
}
