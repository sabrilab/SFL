"use client";

// Les inscriptions à valider — les joueurs qui ont créé leur compte eux-mêmes
// (/inscription) et attendent l'accord de l'admin. Dans l'onglet Joueurs de
// l'admin, sous « À valider » (refonte du 24/11/2026, maquette v3) : la vraie
// carte de l'app, le nom, « POSTE · jj/mm », ✕ et Accepter. Toucher la ligne
// déplie la fiche (identité, gabarit, les quatre photos de référence).
//
// Accepter : le compte devient membre (valider_inscription, côté base) et le
// joueur entre dans l'effectif avec son poste, base 75 partout comme tout
// nouveau joueur. Sa session s'ouvre d'elle-même chez lui.
// Refuser (✕) : il n'y a pas de refus en base ; son compte part pour de bon
// (/api/comptes/supprimer), après une confirmation qui le nomme.
//
// Le panneau ne s'affiche que s'il y a quelqu'un à valider.

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { emailsDeContact } from "@/lib/sfl/contacts";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { signalerInscriptions } from "@/hooks/use-inscriptions-en-attente";
import { addRoster, newRosterPlayer, rosterHasName } from "@/lib/sfl/saisie/mutations";
import type { Saison } from "@/lib/sfl/saisie/types";
import { ANGLES, age, type Angle } from "@/lib/sfl/inscription";
import { liensReferences } from "@/lib/sfl/references";
import { famillePoste } from "@/lib/sfl/admin-joueurs";
import { Confirmer, type Confirmation } from "@/components/sfl/admin/confirmer";
import { Liste, Rubrique, SURFACE, Tete } from "@/components/sfl/admin/ui-admin";

const jjmm = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" });

interface Demande {
  id: string;
  name: string;
  username: string;
  contact_email: string | null;
  created_at: string;
  fiche: {
    prenom: string;
    nom: string;
    naissance: string;
    taille_cm: number | null;
    poids_kg: number | null;
    pointure: number | null;
    maillot: string | null;
    pied: string | null;
    poste: string | null;
  } | null;
}

function Ligne({
  d,
  onAccepter,
  onRefuser,
  occupe,
}: {
  d: Demande;
  onAccepter: () => void;
  onRefuser: () => void;
  occupe: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [refs, setRefs] = useState<Partial<Record<Angle, string>> | null>(null);
  const f = d.fiche;
  const ans = f ? age(f.naissance) : null;

  useEffect(() => {
    if (!ouvert || refs) return;
    liensReferences(d.id).then(setRefs).catch(() => setRefs({}));
  }, [ouvert, refs, d.id]);

  return (
    <div className={cn(SURFACE, "overflow-hidden")}>
      <div className="flex items-center gap-3 py-2.5 pr-2.5 pl-4">
        <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Tete nom={d.name} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-lecture font-medium">{d.name}</span>
            <span className="truncate text-corps text-encre-2">
              {[famillePoste(f?.poste) ?? f?.poste, jjmm(d.created_at)].filter(Boolean).join(" · ")}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onRefuser}
          disabled={occupe}
          aria-label={`Refuser ${d.name}`}
          className="bouton-discret grid size-9 shrink-0 place-items-center text-encre-3 disabled:opacity-40"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onAccepter}
          disabled={occupe}
          className="bouton-principal grid h-9 shrink-0 place-items-center px-4 text-corps font-semibold disabled:opacity-60"
        >
          {occupe ? <Loader2 className="size-4 animate-spin" /> : "Accepter"}
        </button>
      </div>

      {ouvert && (
        <div className="border-t border-border/60 px-4 pt-3 pb-4">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-corps">
            <dt className="text-encre-3">Nom</dt>
            <dd className="truncate">{f ? `${f.prenom} ${f.nom}` : "—"}</dd>
            <dt className="text-encre-3">Pseudo</dt>
            <dd className="truncate">{d.username || "—"}</dd>
            <dt className="text-encre-3">Email</dt>
            <dd className="truncate">{d.contact_email ?? "—"}</dd>
            <dt className="text-encre-3">Âge</dt>
            <dd>{ans !== null ? `${ans} ans` : "—"}</dd>
            <dt className="text-encre-3">Gabarit</dt>
            <dd>{[f?.taille_cm ? `${f.taille_cm} cm` : null, f?.poids_kg ? `${f.poids_kg} kg` : null].filter(Boolean).join(" · ") || "—"}</dd>
            <dt className="text-encre-3">Pointure · maillot</dt>
            <dd>{[f?.pointure, f?.maillot].filter(Boolean).join(" · ") || "—"}</dd>
            <dt className="text-encre-3">Pied fort</dt>
            <dd>{f?.pied ?? "—"}</dd>
          </dl>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ANGLES.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-petit bg-secondary">
                <div className="aspect-[3/4]">
                  {refs?.[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- lien signé Storage
                    <img src={refs[a.id]} alt={a.label} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-legende text-encre-3">
                      {refs ? "—" : <Loader2 className="size-3.5 animate-spin" />}
                    </div>
                  )}
                </div>
                <figcaption className="px-1.5 py-1 text-legende text-encre-3">{a.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Inscriptions({
  saison,
  onCommit,
  partage,
}: {
  saison: Saison;
  onCommit: (next: Saison, label: string) => void;
  /** Session admin vérifiée par le serveur : sans elle, rien à lire. */
  partage: boolean;
}) {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  // Membres acceptés que la saison ne connaît pas : leur ajout à l'effectif
  // s'est perdu (publication écrasée par un appareil en retard, envoi raté).
  // Sans ligne dans l'effectif, l'app n'a pas de carte à leur montrer. Les
  // joueurs Bola venus par un parrain n'en sont pas : ils ont leur carte hors
  // de la saison (season-provider.tsx).
  const [absents, setAbsents] = useState<{ id: string; name: string }[]>([]);

  const charger = useCallback(async () => {
    const sb = supabase();
    const { data, error } = await sb
      .from("profiles")
      .select("id, name, username, created_at")
      .eq("valide", false)
      // Passé par Google ou Apple sans finir : pas encore une demande.
      .eq("pseudo_a_choisir", false)
      .order("created_at", { ascending: true });
    // Colonne absente (migration pas encore passée) : rien à montrer.
    if (error || !data) return;
    const ids = data.map((p) => p.id as string);
    const { data: fiches } = ids.length
      ? await sb.from("fiches").select("*").in("player_id", ids)
      : { data: [] as Record<string, unknown>[] };
    const parId = new Map((fiches ?? []).map((f) => [f.player_id as string, f]));
    // Les emails sont rangés à part (table contacts) : l'admin les lit tous.
    const emails = ids.length ? await emailsDeContact(sb).catch(() => new Map<string, string>()) : new Map<string, string>();
    setDemandes(
      data.map((p) => ({
        ...(p as Omit<Demande, "fiche" | "contact_email">),
        contact_email: emails.get(p.id as string) ?? null,
        fiche: (parId.get(p.id as string) as Demande["fiche"]) ?? null,
      }))
    );
    const [{ data: membres }, { data: venus }] = await Promise.all([
      sb.from("profiles").select("id, name").eq("valide", true).eq("is_admin", false).eq("pseudo_a_choisir", false),
      // Les joueurs Bola, venus par le lien d'un joueur ou d'une équipe : hors
      // de la saison par choix, pas des ajouts perdus (Activité → Parrainage).
      sb.from("parrainages").select("filleul"),
    ]);
    const bola = new Set(((venus ?? []) as { filleul: string }[]).map((v) => v.filleul));
    setAbsents(
      ((membres ?? []) as { id: string; name: string | null }[]).flatMap((m) =>
        m.name && !bola.has(m.id) ? [{ id: m.id, name: m.name }] : []
      )
    );
  }, []);
  const horsSaisonComptes = absents
    .filter((m) => !rosterHasName(saison, m.name))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const horsSaison = horsSaisonComptes.map((m) => m.name);

  // Membres que la saison n'a pas gardés : leur compte part pour de bon
  // (connexion, profil, activité), après une confirmation qui les nomme.
  function supprimer(comptes: { id: string; name: string }[], titre?: string) {
    const noms = comptes.map((c) => c.name).join(", ");
    setConfirmation({
      titre: titre ?? `Supprimer ${noms} ?`,
      detail: "Son compte part pour de bon, sans corbeille.",
      action: titre ? "Refuser" : "Supprimer",
      faire: () => void effacer(comptes),
    });
  }

  async function effacer(comptes: { id: string; name: string }[]) {
    const jeton = await jetonServeur();
    if (!jeton) {
      toast.error("Reconnecte-toi pour supprimer.");
      return;
    }
    setOccupe("suppression");
    try {
      const r = await fetch("/api/comptes/supprimer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ ids: comptes.map((c) => c.id) }),
      });
      const d = (await r.json().catch(() => ({}))) as { supprimes?: string[]; error?: string };
      if (!r.ok) {
        toast.error(d.error ?? "Suppression impossible pour l'instant.");
        return;
      }
      const partis = new Set(d.supprimes ?? []);
      setAbsents((l) => l.filter((m) => !partis.has(m.id)));
      setDemandes((l) => l.filter((m) => !partis.has(m.id)));
      signalerInscriptions();
      toast.success(partis.size > 1 ? `${partis.size} comptes supprimés.` : "Compte supprimé.");
    } finally {
      setOccupe(null);
    }
  }

  function ajouter(noms: string[]) {
    const next = noms.reduce((acc, n) => (rosterHasName(acc, n) ? acc : addRoster(acc, newRosterPlayer(n))), saison);
    if (next === saison) return;
    onCommit(next, noms.length > 1 ? `Effectif — ${noms.length} joueurs ajoutés` : `Effectif — ${noms[0]}`);
    toast.success(noms.length > 1 ? `${noms.length} joueurs ajoutés à la saison.` : `${noms[0]} ajouté à la saison.`);
  }

  useEffect(() => {
    if (!partage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture réseau au montage
    void charger();
    const relire = () => void charger();
    window.addEventListener("focus", relire);
    return () => window.removeEventListener("focus", relire);
  }, [partage, charger]);

  async function accepter(d: Demande) {
    setOccupe(d.id);
    try {
      const { data, error } = await supabase().rpc("valider_inscription", { joueur: d.id });
      if (error || !data) {
        toast.error("Validation refusée par le serveur.");
        return;
      }
      if (!rosterHasName(saison, d.name)) {
        onCommit(addRoster(saison, { ...newRosterPlayer(d.name), poste: d.fiche?.poste ?? "—" }), `Inscription — ${d.name}`);
      }
      setDemandes((l) => l.filter((x) => x.id !== d.id));
      signalerInscriptions();
      toast.success(`${d.name} entre dans la ligue.`);
    } finally {
      setOccupe(null);
    }
  }

  if (!partage || (demandes.length === 0 && horsSaison.length === 0)) return <Confirmer confirmation={confirmation} onFermer={() => setConfirmation(null)} />;

  return (
    <>
      {demandes.length > 0 && (
        <section className="flex flex-col gap-2">
          <Rubrique droite={demandes.length > 1 ? demandes.length : undefined}>À valider</Rubrique>
          {demandes.map((d) => (
            <Ligne
              key={d.id}
              d={d}
              occupe={occupe === d.id || occupe === "suppression"}
              onAccepter={() => void accepter(d)}
              onRefuser={() => supprimer([{ id: d.id, name: d.name }], `Refuser ${d.name} ?`)}
            />
          ))}
        </section>
      )}
      {/* Des membres acceptés que la saison n'a pas : leur ajout s'est perdu. */}
      {horsSaison.length > 0 && (
        <Liste
          titre="Sans carte dans la saison"
          droite={
            horsSaison.length > 1 ? (
              <button type="button" onClick={() => ajouter(horsSaison)} className="font-medium text-foreground underline-offset-2 active:underline">
                Tout ajouter
              </button>
            ) : undefined
          }
        >
          {horsSaisonComptes.map((m) => (
            <div key={m.id} className="ligne-admin flex items-center gap-3 pl-4">
              <Tete nom={m.name} cote={32} />
              <span className="ligne-admin__corps flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pr-2.5">
                <span className="min-w-0 flex-1 truncate text-lecture font-medium">{m.name}</span>
                <button
                  type="button"
                  disabled={occupe === "suppression"}
                  onClick={() => supprimer([m])}
                  className="bouton-discret h-9 px-3 text-corps font-medium text-encre-2 disabled:opacity-50"
                >
                  Supprimer
                </button>
                <button type="button" onClick={() => ajouter([m.name])} className="bouton-secondaire h-9 px-3.5 text-corps font-semibold">
                  Ajouter
                </button>
              </span>
            </div>
          ))}
        </Liste>
      )}
      <Confirmer confirmation={confirmation} onFermer={() => setConfirmation(null)} />
    </>
  );
}
