"use client";

// Les outils de la convocation (Bola Club), en tête de l'onglet Convocation
// d'une séance (seance.tsx) :
//   · les modèles de la catégorie, en puces, tant que la séance est à venir :
//     en toucher un convoque son groupe, et lui seul (les joueurs qui ne sont
//     plus licenciés de la catégorie restent dehors) ; « Garder comme modèle »
//     enregistre les convoqués du moment sous un nom ;
//   · pour un match, « Liste pour la feuille de match » : les présents
//     annoncés puis les autres convoqués, NOM Prénom et poste, à recopier dans
//     la FMI (la FFF n'ouvre pas d'API : doc « Espace entraîneur », 27/11/2026),
//     avec « Copier ».

import { useState } from "react";
import { ClipboardList, Copy, Save } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { appliquerGroupe, enregistrerGroupe } from "@/lib/sfl/club/mutations";
import { membreDe, seanceAVenir } from "@/lib/sfl/club/regles";
import type { Membre, Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, Feuille, puce } from "./puces";

export function OutilsConvocation({ s }: { s: Seance }) {
  const { club, agir } = useClub();
  const [garder, setGarder] = useState(false);
  const [nom, setNom] = useState("");
  const [liste, setListe] = useState(false);
  const aVenir = seanceAVenir(s, club.jour);
  const modeles = club.groupes.filter((g) => g.categorie === s.categorie);
  const meme = (j: string[]) => j.length === s.convoques.length && j.every((id) => s.convoques.includes(id));
  const joueurs = [...s.convoques]
    .sort((a, b) => Number(s.reponses[b] === "present") - Number(s.reponses[a] === "present"))
    .map((id) => membreDe(club, id))
    .filter((m): m is Membre => !!m);
  const texte = joueurs.map((m, i) => `${i + 1}. ${m.nom.toUpperCase()} ${m.prenom} · ${m.poste}${s.reponses[m.id] === "present" ? "" : " (sans réponse)"}`).join("\n");
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      toast.success("Liste copiée");
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
  };
  return (
    <>
      {aVenir && (
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {modeles.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={meme(g.joueurs)}
              onClick={() => agir((c, moi) => appliquerGroupe(c, moi, s.id, g.id)) && navigator.vibrate?.(10)}
              className={puce(meme(g.joueurs))}
            >
              {g.nom}
            </button>
          ))}
          <button type="button" onClick={() => setGarder(true)} className={cn(puce(false), "flex items-center gap-1.5")}>
            <Save className="size-4" strokeWidth={2.2} />
            Garder comme modèle
          </button>
        </div>
      )}
      {s.genre === "match" && (
        <button type="button" onClick={() => setListe(true)} className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold">
          <ClipboardList className="size-4" strokeWidth={2.4} />
          Liste pour la feuille de match
        </button>
      )}
      <Feuille titre="Modèle de convocation" open={garder} onOpenChange={setGarder}>
        <input aria-label="Nom du modèle" placeholder="Nom (Groupe du samedi)" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={30} className={CHAMP} />
        <span className="mono-label text-encre-3">{s.convoques.length} convoqués</span>
        <button
          type="button"
          disabled={nom.trim().length < 2}
          onClick={() => {
            if (!agir((c, moi) => enregistrerGroupe(c, moi, s.id, nom))) return;
            toast.success("Modèle gardé");
            setNom("");
            setGarder(false);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Garder
        </button>
      </Feuille>
      <Feuille titre="Feuille de match" open={liste} onOpenChange={setListe}>
        <ol className="flex flex-col">
          {joueurs.map((m, i) => (
            <li key={m.id} className="flex items-baseline gap-3 border-b border-foreground/[0.08] py-2.5 last:border-0">
              <span className="mono-label w-5 shrink-0 text-encre-3 tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-lecture">
                <span className="font-semibold">{m.nom.toUpperCase()}</span> {m.prenom}
              </span>
              <span className="mono-label shrink-0 text-encre-3">{s.reponses[m.id] === "present" ? m.poste : `${m.poste} · ?`}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={copier} className="bouton-principal flex h-12 items-center justify-center gap-2 text-[15px] font-semibold">
          <Copy className="size-4" strokeWidth={2.4} />
          Copier la liste
        </button>
      </Feuille>
    </>
  );
}
