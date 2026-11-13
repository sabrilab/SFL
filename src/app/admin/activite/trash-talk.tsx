"use client";

// Le trash talk, côté admin (sous Activité & rétention, après les vidéos ;
// lib/sfl/trash-talk.ts) : les posts de la saison, ceux qui demandent un
// regard d'abord (signalés ou masqués), puis les plus récents. Par ligne : la
// phrase, son auteur, sa journée, le nombre de signalements, l'état (« Masqué
// · cité », « Masqué · signalements », « Masqué · admin »), et trois gestes :
// Masquer, Remettre, Retirer. Personne n'est prévenu, ni l'auteur ni la
// ligue. Sans les tables en base, le bloc n'est pas monté.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { direErreur } from "@/lib/sfl/matchs";
import { lireTrashTalks, masquerTrashTalk, MOTIFS, ordreAdmin, remettreTrashTalk, retirerTrashTalk, type TrashTalk } from "@/lib/sfl/trash-talk";
import { Section } from "./cadre";

export function TrashTalkAdmin() {
  const { saison } = useSeason();
  const identite = useIdentites();
  const numero = saison.numero ?? 0;
  const [posts, setPosts] = useState<TrashTalk[] | null>(null);
  const [tout, setTout] = useState(false);
  const charger = useCallback(() => {
    if (numero <= 0) return;
    lireTrashTalks(numero, { admin: true })
      .then((l) => setPosts(l.etat === "base" ? ordreAdmin(l.posts) : null))
      .catch(() => {});
  }, [numero]);
  useEffect(() => {
    let vivant = true;
    Promise.resolve().then(() => vivant && charger());
    return () => {
      vivant = false;
    };
  }, [charger]);
  if (!posts) return null;

  const faire = async (geste: () => Promise<void>, retour: string) => {
    try {
      await geste();
      toast.success(retour);
    } catch (e) {
      toast.error(direErreur(e));
    }
    charger();
  };
  const montres = tout ? posts : posts.slice(0, 12);

  return (
    <Section id="trash-talk" titre="Trash talk">
      {posts.length === 0 ? (
        <p className="text-corps text-encre-3">Aucun post.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/[0.08]">
          {montres.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <p className={p.masque ? "text-lecture leading-snug text-encre-3" : "text-lecture leading-snug font-medium"}>{p.texte}</p>
              <p className="mono-label flex flex-wrap gap-x-2 gap-y-1 text-encre-3">
                <span className="text-foreground">{identite.nom(p.nom)}</span>
                <span>J{p.j}</span>
                <span>{p.format === "une" ? "La une" : "Tweet"}</span>
                {p.signalements > 0 && (
                  <span className="text-foreground">
                    {p.signalements} signalement{p.signalements > 1 ? "s" : ""}
                  </span>
                )}
                {p.masque && <span className="text-foreground">{MOTIFS[p.masque]}</span>}
              </p>
              <div className="flex gap-1.5">
                {p.masque ? (
                  <button type="button" onClick={() => void faire(() => remettreTrashTalk(p.id), "Remis.")} className="bouton-secondaire px-3 py-1.5 text-corps font-semibold">
                    Remettre
                  </button>
                ) : (
                  <button type="button" onClick={() => void faire(() => masquerTrashTalk(p.id), "Masqué.")} className="bouton-secondaire px-3 py-1.5 text-corps font-semibold">
                    Masquer
                  </button>
                )}
                <button type="button" onClick={() => void faire(() => retirerTrashTalk(p.id, false), "Retiré.")} className="bouton-secondaire bouton--rouge px-3 py-1.5 text-corps font-semibold">
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {posts.length > montres.length && (
        <button type="button" onClick={() => setTout(true)} className="bouton-discret mt-3 px-1 py-1.5 text-corps font-semibold">
          Tout voir · {posts.length}
        </button>
      )}
    </Section>
  );
}
