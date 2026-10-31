"use client";

// Les inscriptions à valider — les joueurs qui ont créé leur compte eux-mêmes
// (/inscription) et attendent l'accord de l'admin.
//
// Accepter : le compte devient membre (valider_inscription, côté base) et le
// joueur entre dans l'effectif avec son poste, base 75 partout comme tout
// nouveau joueur. Sa session s'ouvre d'elle-même chez lui.
//
// Le panneau ne s'affiche que s'il y a quelqu'un à valider.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { emailsDeContact } from "@/lib/sfl/contacts";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { addRoster, newRosterPlayer, rosterHasName } from "@/lib/sfl/saisie/mutations";
import type { Saison } from "@/lib/sfl/saisie/types";
import { ANGLES, age, type Angle } from "@/lib/sfl/inscription";
import { liensReferences } from "@/lib/sfl/references";

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
  occupe,
}: {
  d: Demande;
  onAccepter: () => void;
  occupe: boolean;
}) {
  const photo = usePhotoPerso(d.name);
  const [ouvert, setOuvert] = useState(false);
  const [refs, setRefs] = useState<Partial<Record<Angle, string>> | null>(null);
  const f = d.fiche;
  const ans = f ? age(f.naissance) : null;

  useEffect(() => {
    if (!ouvert || refs) return;
    liensReferences(d.id).then(setRefs).catch(() => setRefs({}));
  }, [ouvert, refs, d.id]);

  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOuvert((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="size-11 shrink-0 overflow-hidden rounded-full bg-muted">
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element -- photo de la ligue (Storage)
              <img src={photo} alt="" className="size-full object-cover" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lecture font-bold">
              {d.name} <span className="font-medium text-muted-foreground">{d.username}</span>
            </span>
            <span className="block truncate text-petit text-muted-foreground">
              {[f?.poste, ans !== null ? `${ans} ans` : null, f?.taille_cm ? `${f.taille_cm} cm` : null, f?.poids_kg ? `${f.poids_kg} kg` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", ouvert && "rotate-180")} />
        </button>
        <Button size="sm" variant="vert" className="rounded-full" disabled={occupe} onClick={onAccepter}>
          {occupe ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="mr-1 size-3.5" />}
          Accepter
        </Button>
      </div>

      {ouvert && (
        <div className="px-4 pb-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-corps">
            <dt className="text-muted-foreground">Nom</dt>
            <dd>{f ? `${f.prenom} ${f.nom}` : "—"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{d.contact_email ?? "—"}</dd>
            <dt className="text-muted-foreground">Né le</dt>
            <dd>{f?.naissance ? new Date(f.naissance).toLocaleDateString("fr-FR") : "—"}</dd>
            <dt className="text-muted-foreground">Pointure · maillot</dt>
            <dd>{[f?.pointure, f?.maillot].filter(Boolean).join(" · ") || "—"}</dd>
            <dt className="text-muted-foreground">Pied fort</dt>
            <dd>{f?.pied ?? "—"}</dd>
          </dl>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ANGLES.map((a) => (
              <figure key={a.id} className="overflow-hidden rounded-xl bg-muted">
                <div className="aspect-[3/4]">
                  {refs?.[a.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- lien signé Storage
                    <img src={refs[a.id]} alt={a.label} className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-legende text-muted-foreground">
                      {refs ? "—" : <Loader2 className="size-3.5 animate-spin" />}
                    </div>
                  )}
                </div>
                <figcaption className="px-1.5 py-1 text-legende text-muted-foreground">{a.label}</figcaption>
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
  async function supprimer(comptes: { id: string; name: string }[]) {
    const noms = comptes.map((c) => c.name).join(", ");
    if (!window.confirm(`Supprimer définitivement : ${noms} ? Son compte part pour de bon, sans corbeille.`)) return;
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
      toast.success(`${d.name} entre dans la ligue.`);
    } finally {
      setOccupe(null);
    }
  }

  if (!partage || (demandes.length === 0 && horsSaison.length === 0)) return null;

  return (
    <>
    {horsSaison.length > 0 && (
      <div className="overflow-hidden rounded-3xl bg-card">
        <div className="flex items-end justify-between gap-3 px-4 pt-3 pb-2">
          <div>
            <p className="mono-label text-etiquette text-muted-foreground">EFFECTIF</p>
            <p className="text-titre font-extrabold tracking-tight">
              {horsSaison.length} membre{horsSaison.length > 1 ? "s" : ""} sans carte dans la saison
            </p>
          </div>
          {horsSaison.length > 1 && (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={occupe === "suppression"}
                onClick={() => void supprimer(horsSaisonComptes)}
                className="bouton-secondaire bouton--rouge px-3.5 py-1.5 text-corps font-semibold disabled:opacity-50"
              >
                Tout supprimer
              </button>
              <button
                type="button"
                onClick={() => ajouter(horsSaison)}
                className="bouton-principal bouton--vert px-3.5 py-1.5 text-corps font-bold"
              >
                Tout ajouter
              </button>
            </div>
          )}
        </div>
        {horsSaisonComptes.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
            <span className="text-lecture font-semibold">{m.name}</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={occupe === "suppression"}
                onClick={() => void supprimer([m])}
                className="bouton-discret bouton--rouge px-3 py-1.5 text-corps font-semibold disabled:opacity-50"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={() => ajouter([m.name])}
                className="bouton-secondaire bouton--vert px-3 py-1.5 text-corps font-semibold"
              >
                Ajouter
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
    {demandes.length > 0 && (
    <div className="overflow-hidden rounded-3xl bg-card">
      <div className="px-4 pt-3 pb-1">
        <p className="mono-label text-etiquette text-muted-foreground">INSCRIPTIONS</p>
        <p className="text-titre font-extrabold tracking-tight">
          {demandes.length} joueur{demandes.length > 1 ? "s" : ""} à valider
        </p>
      </div>
      {demandes.map((d) => (
        <Ligne key={d.id} d={d} occupe={occupe === d.id} onAccepter={() => void accepter(d)} />
      ))}
    </div>
    )}
    </>
  );
}
