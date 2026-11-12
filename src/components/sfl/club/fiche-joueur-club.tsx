"use client";

// La fiche d'un joueur d'un club, vue de son entraîneur (Bola Club,
// bola-app#14 : « la carte, l'évolution (jauges par stat, comme
// src/app/profil/evolution), présences, notes privées, poste,
// surclassement »). Une page enfant du club :
//   · sa carte complète (la toucher l'ouvre en grand), sa catégorie, son
//     poste, son âge ; « Surclassé en U17 » le cas échéant ;
//   · Évolution : la même page que Ma carte → Évolution (ma-carte/
//     ma-note.tsx, NoteEvolution), sur les matchs de son club : sa note, ce
//     qui est gagné depuis la dernière mise à jour, les six jauges, sa série,
//     ses matchs (lib/sfl/club/saison.ts : le vrai moteur des cartes) ;
//   · Présences : ses séances passées, une pastille chacune (pleine :
//     présent ; cerclée : en retard ; vide : absent) ;
//   · Notes privées, datées et signées : seuls le staff de sa catégorie et
//     l'admin les lisent et en ajoutent ;
//   · Poste et Surclassement, en puces ; « Déplacer » vers une autre
//     catégorie ; pour l'admin, « Libérer la licence » : la licence redevient
//     libre, le joueur garde son compte et sa carte (« Bola gratuit »).
// Le joueur lui-même, ou son parent, y lit sa carte, son évolution et ses
// présences : ni les notes privées, ni les réglages. Tout autre point de vue
// n'y a que la carte.

import { useState } from "react";
import { toast } from "sonner";
import { NoteEvolution } from "@/components/sfl/ma-carte/ma-note";
import { useClub } from "@/hooks/use-club";
import { jourCourt } from "@/lib/sfl/carte-bola";
import { estGardien } from "@/lib/sfl/gardien";
import { POSTES } from "@/lib/sfl/inscription";
import { assiduite, seancesDe } from "@/lib/sfl/club/classements";
import { ajouterNote, changerPoste, deplacerJoueur, libererLicence, surclasser } from "@/lib/sfl/club/mutations";
import { accordParentalRequis, ageLe, categorieDe, licenceDe, membreDe, surclassementsPossibles } from "@/lib/sfl/club/regles";
import { nomComplet, nomCourt, type Membre } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { CHAMP, Feuille, NOMBRE, PageEnfant, TitreSection } from "./puces";

const PUCE = "shrink-0 px-3.5 py-2 text-corps font-semibold whitespace-nowrap";

function Presences({ m }: { m: Membre }) {
  const { club } = useClub();
  const seances = seancesDe(club, m.id);
  const a = assiduite(club, m.id, "saison");
  return (
    <section className="flex flex-col gap-3">
      <TitreSection droite={a.pct !== null && <span className="mono-label text-encre-3">{a.pct} %</span>}>Présences</TitreSection>
      <span style={{ ...NOMBRE, fontSize: 40 }} className="tabular-nums">
        {a.presents}
        <span className="text-foreground/30"> / {a.total}</span>
      </span>
      <ul className="flex flex-wrap gap-1.5" aria-label="Séances">
        {seances.map((s) => {
          const etat = s.appel[m.id] ?? "absent";
          return (
            <li
              key={s.id}
              title={`${jourCourt(s.jour)} · ${s.genre === "match" ? s.adversaire : "Entraînement"}`}
              aria-label={`${jourCourt(s.jour)}, ${s.genre === "match" ? "match" : "entraînement"} : ${etat === "present" ? "présent" : etat === "retard" ? "en retard" : "absent"}`}
              className={cn(
                "size-3 rounded-full",
                etat === "present" ? "bg-foreground" : etat === "retard" ? "border-2 border-foreground" : "bg-foreground/12",
              )}
            />
          );
        })}
      </ul>
    </section>
  );
}

function NotesPrivees({ m }: { m: Membre }) {
  const { club, agir } = useClub();
  const [texte, setTexte] = useState("");
  const notes = club.notes.filter((n) => n.membre === m.id).sort((a, b) => b.jour.localeCompare(a.jour) || b.id.localeCompare(a.id));
  const ajouter = () => {
    if (!agir((c, moi) => ajouterNote(c, moi, m.id, texte))) return;
    navigator.vibrate?.(10);
    setTexte("");
  };
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Notes privées</TitreSection>
      {notes.length > 0 && (
        <ul className="flex flex-col">
          {notes.map((n) => {
            const auteur = club.staff.find((s) => s.id === n.auteur);
            return (
              <li key={n.id} className="flex flex-col gap-1.5 border-b border-foreground/10 py-3 first:pt-0 last:border-0">
                <span className="mono-label text-encre-3">{`${jourCourt(n.jour)}${auteur ? ` · ${nomCourt(auteur)}` : ""}`}</span>
                <p className="text-lecture leading-snug text-pretty">{n.texte}</p>
              </li>
            );
          })}
        </ul>
      )}
      <textarea
        aria-label="Nouvelle note"
        placeholder="Nouvelle note"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={2}
        maxLength={500}
        className={cn(CHAMP, "resize-none")}
      />
      <button type="button" disabled={!texte.trim()} onClick={ajouter} className="bouton-secondaire h-11 text-lecture font-semibold">
        Ajouter
      </button>
    </section>
  );
}

function Reglages({ m }: { m: Membre }) {
  const { club, droits, agir } = useClub();
  const [deplacer, setDeplacer] = useState(false);
  const [liberer, setLiberer] = useState(false);
  const possibles = surclassementsPossibles(m, club.categories);
  const destinations = club.categories.filter((c) => c.id !== m.categorie && droits.gere(c.id)).sort((a, b) => a.ordre - b.ordre);
  const licence = licenceDe(club, m.id);
  return (
    <>
      <section className="flex flex-col gap-3">
        <TitreSection>Poste</TitreSection>
        <div role="radiogroup" aria-label="Poste" className="flex flex-wrap gap-2">
          {POSTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={m.poste === p.id}
              aria-label={p.label}
              onClick={() => agir((c, moi) => changerPoste(c, moi, m.id, p.id))}
              className={cn(PUCE, m.poste === p.id ? "bouton-principal" : "bouton-secondaire text-encre-2")}
            >
              {p.id}
            </button>
          ))}
        </div>
      </section>

      {droits.gere(m.categorie) && possibles.length > 0 && (
        <section className="flex flex-col gap-3">
          <TitreSection>Surclassement</TitreSection>
          <div role="radiogroup" aria-label="Surclassement" className="flex flex-wrap gap-2">
            {[{ id: null as string | null, nom: "Aucun" }, ...possibles].map((c) => (
              <button
                key={c.id ?? "aucun"}
                type="button"
                role="radio"
                aria-checked={m.surclasseEn === c.id}
                onClick={() => agir((k, moi) => surclasser(k, moi, m.id, c.id))}
                className={cn(PUCE, m.surclasseEn === c.id ? "bouton-principal" : "bouton-secondaire text-encre-2")}
              >
                {c.nom}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {droits.gere(m.categorie) && destinations.length > 0 && (
          <button type="button" onClick={() => setDeplacer(true)} className="bouton-secondaire h-12 text-[15px] font-semibold">
            Déplacer
          </button>
        )}
        {droits.administre &&
          (licence ? (
            <button type="button" onClick={() => setLiberer(true)} className="bouton-discret h-11 text-lecture font-semibold text-encre-2">
              Libérer la licence
            </button>
          ) : (
            <span className="mono-label py-3 text-center text-encre-3">Bola gratuit</span>
          ))}
      </div>

      <Feuille titre="Déplacer" open={deplacer} onOpenChange={setDeplacer}>
        <div className="flex flex-col gap-2">
          {destinations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                if (agir((k, moi) => deplacerJoueur(k, moi, m.id, c.id))) {
                  navigator.vibrate?.(10);
                  setDeplacer(false);
                }
              }}
              className="bouton-secondaire flex h-12 items-center justify-between px-5 text-[15px] font-semibold"
            >
              {c.nom}
              <span className="mono-label text-encre-3">{`${club.membres.filter((x) => x.categorie === c.id).length} joueurs`}</span>
            </button>
          ))}
        </div>
      </Feuille>

      <Feuille titre="Libérer la licence" open={liberer} onOpenChange={setLiberer}>
        <span className="text-lecture font-semibold">{nomComplet(m)}</span>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setLiberer(false)} className="bouton-secondaire h-12 text-[15px] font-semibold">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (agir((k, moi) => libererLicence(k, moi, m.id))) {
                toast.success("Licence libérée");
                setLiberer(false);
              }
            }}
            className="bouton-principal h-12 text-[15px] font-semibold"
          >
            Libérer
          </button>
        </div>
      </Feuille>
    </>
  );
}

export function FicheJoueurClub({ id }: { id: string }) {
  const { club, cartes, droits } = useClub();
  const m = membreDe(club, id);
  const carte = cartes.get(id);
  if (!m || !carte) return <PageEnfant titre="Joueur">{null}</PageEnfant>;
  const gardien = estGardien(m.poste);
  const cat = categorieDe(club, m.categorie);
  const surclasse = categorieDe(club, m.surclasseEn);
  const mien = droits.joueur?.id === m.id;
  const voit = droits.voitFiche(m);
  const cal = carte.calendrier;
  const attente = licenceDe(club, m.id)?.statut === "attente_accord" && accordParentalRequis(m.naissance, club.jour);
  return (
    <PageEnfant titre={nomComplet(m)}>
      <div className="flex flex-col items-center gap-4">
        <CarteClub id={m.id} size={190 / 254} />
        <div className="flex flex-col items-center gap-2">
          <span className="mono-label text-encre-2">{`${cat?.nom ?? ""} · ${m.poste} · ${ageLe(m.naissance, club.jour)} ans`}</span>
          {surclasse && <span className="mono-label rounded-full px-3 py-1.5 ring-1 ring-foreground/20 ring-inset">Surclassé en {surclasse.nom}</span>}
          {attente && <span className="mono-label rounded-full px-3 py-1.5 text-encre-2 ring-1 ring-foreground/20 ring-inset">Accord parental en attente</span>}
        </div>
      </div>

      {voit && (
        <section className="flex flex-col gap-3">
          <TitreSection>Évolution</TitreSection>
          <NoteEvolution
            nom="Évolution"
            note={carte.note}
            ev={carte.ev}
            gardien={gardien}
            maj={cal ? { prochaine: `dans ${cal.avantProchaine} ${cal.avantProchaine > 1 ? "matchs" : "match"}`, reste: null } : null}
            serie="Série de présence"
            journal={mien ? "Mes matchs" : "Ses matchs"}
            date
            majLe={(j) => (carte.matchs[j - 1] ? jourCourt(carte.matchs[j - 1].jour) : `match ${j}`)}
            vide={mien ? "Ta note bouge dès ton premier match." : "Sa note bouge dès son premier match."}
          />
        </section>
      )}

      {voit && <Presences m={m} />}
      {droits.litNotes(m) && <NotesPrivees m={m} />}
      {droits.gereJoueur(m) && <Reglages m={m} />}
    </PageEnfant>
  );
}
