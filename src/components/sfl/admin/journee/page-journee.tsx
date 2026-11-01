"use client";

// L'admin, d'un coup d'œil (Sabri, 29/10/2026 : « beaucoup plus visuel, dans
// la même démarche que ce qu'on a fait pour les utilisateurs »).
//
// Une seule page : la prochaine journée, dessinée avec les objets des
// joueurs. En haut, la frise des journées (J1 J2 J3 (J4) ┄J5┄) ; puis la
// journée elle-même, en pointillé tant qu'elle est en brouillon, pleine
// ensuite, avec sa pastille d'état (○ BROUILLON, ● EN LIGNE, ◉ EN DIRECT,
// ✓ TERMINÉE) et le segmenté ADMIN · JOUEURS (« Joueurs » : ce que voit la
// ligue en ce moment, par la même fonction que les téléphones). Dedans : la
// convocation (la vraie, en cartes ; « Il manque N » en braise), les matchs
// un par un sur leur terrain, les remplaçants. En bas, sous le pouce, le
// geste du moment — il n'y en a jamais qu'un (etat-journee.ts) — et ↶ ↷.
// Sous les matchs, les outils de la journée, à toute heure (31/10/2026 :
// Sabri ne les trouvait plus derrière ≡) : la Feuille à consulter (lignes,
// points décomposés, alertes), la Saisie (le direct de toujours), les Votes,
// les Points d'un joueur et la Grille. Les « Je viens » de la convocation
// se posent sur les terrains d'un geste (venus-sur-la-feuille.ts).
// La feuille en direct d'un match tenue par un de ses joueurs (01/11/2026,
// components/sfl/direct) se voit sur son terrain : qui la tient, son score ;
// la toucher l'ouvre, pour la reprendre, la libérer ou la rouvrir.
// Tout le reste de la ligue est derrière ≡ (Ligue), rien n'est perdu.
//
// Aucune phrase d'aide : la pastille, le pointillé et le libellé de chaque
// bouton (qui dit son résultat) suffisent. Noir et blanc ; la braise ne sert
// qu'à « Il manque N ».

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Menu, Redo2, Undo2 } from "lucide-react";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { ChoisirJoueurs } from "@/components/sfl/admin/choisir-joueurs";
import { Confirmer, type Confirmation } from "@/components/sfl/admin/confirmer";
import { PastilleSynchro, Synchro } from "@/components/sfl/admin/synchro";
import { ResultatsVotes } from "@/components/sfl/admin/resultats-votes";
import { DetailPoints } from "@/components/sfl/admin/detail-points";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { usePresence } from "@/hooks/use-presence";
import { useSaisieAdmin } from "@/hooks/use-saisie-admin";
import { useFeuillesDirect } from "@/hooks/use-feuilles-direct";
import { FeuilleDuMatch } from "@/components/sfl/direct/feuille-du-match";
import { scoreDeLaFeuille } from "@/lib/sfl/feuille-direct";
import { isAdmin } from "@/lib/sfl/admin";
import { TERRAINS_MAX } from "@/lib/sfl/equipes-division";
import { haptique } from "@/lib/sfl/haptique";
import { dejaPubliee, estBrouillon, jeterBrouillon } from "@/lib/sfl/saisie/brouillon";
import { computeJournees } from "@/lib/sfl/saisie/engine";
import { choixDEquipe } from "@/lib/sfl/saisie/equipes";
import { placementsDeLaJournee } from "@/lib/sfl/saisie/effectif";
import { etatJournee, gesteDuMoment, prochaineJournee } from "@/lib/sfl/saisie/etat-journee";
import { verifierFeuille } from "@/lib/sfl/saisie/integrite";
import { mvpAutomatique } from "@/lib/sfl/saisie/mvp";
import { addEntry, ajouterMatch, matchsDeclares, memeDate, newEntry, poserEquipes, retirerMatchVide } from "@/lib/sfl/saisie/mutations";
import { equipesDesVenus, joueursPoses } from "@/lib/sfl/saisie/venus-sur-la-feuille";
import { saisieStore } from "@/lib/sfl/saisie/store";
import type { MatchDuJour } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";
import { BlocConvocation, FeuilleConvocation } from "./bloc-convocation";
import { BlocMatchs, matchsVus } from "./bloc-matchs";
import { FeuilleArbitre } from "./feuille-arbitre";
import { FeuilleConsulter } from "./feuille-consulter";
import { FeuilleDirect } from "./feuille-direct";
import { FeuilleLigne } from "./feuille-ligne";
import { FeuillePreparer } from "./feuille-preparer";
import { compteursEnMots, FeuillePublier, FeuilleRemettre } from "./feuille-publier";
import { FeuilleQuandOu } from "./feuille-quand-ou";
import { Etiquette, Feuille, Pastille, PastilleEtat, Segmente } from "./ui";
import { leverSuspension, suspendusPour } from "@/lib/sfl/cartons";

const heureDe = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null);

export function PageJournee() {
  const { me } = useMyPlayer();
  const admin = useSaisieAdmin();
  const { saison, faire, commit, supprimer, undo, redo, history, future, isClient } = admin;
  const { journees: vuesLigue } = useSeason();
  const presence = usePresence();
  const [maintenant] = useState(() => new Date());

  const [choix, setChoix] = useState<number | null | undefined>(undefined);
  const j = choix === undefined ? prochaineJournee(saison, maintenant) : choix;
  const meta = j != null ? saison.journees.find((m) => m.j === j) : undefined;
  const [vue, setVue] = useState<"admin" | "joueurs">("admin");
  const [matchCourant, setMatchCourant] = useState(1);

  const [preparer, setPreparer] = useState(false);
  const [quandOu, setQuandOu] = useState<number | null | false>(false);
  const [ligne, setLigne] = useState<number | null>(null);
  const [publier, setPublier] = useState(false);
  const [remettre, setRemettre] = useState(false);
  const [enDirect, setEnDirect] = useState(false);
  const [convocation, setConvocation] = useState(false);
  const [arbitre, setArbitre] = useState<number | null>(null);
  const [synchro, setSynchro] = useState(false);
  const [votes, setVotes] = useState(false);
  const [consulter, setConsulter] = useState(false);
  const [points, setPoints] = useState(false);
  // Une ligne ouverte depuis la Feuille y ramène en se fermant.
  const [retourFeuille, setRetourFeuille] = useState(false);
  const [ajouterA, setAjouterA] = useState<string | null | false>(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [feuilleOuverte, setFeuilleOuverte] = useState<number | null>(null);

  const declares = useMemo<MatchDuJour[]>(() => (j != null && meta ? matchsDeclares(saison, j) : []), [saison, j, meta]);
  const matchs = useMemo(() => (j != null ? matchsVus(saison, j, declares) : []), [saison, j, declares]);
  const ecarts = useMemo(() => (j != null && meta ? verifierFeuille(saison, j) : []), [saison, j, meta]);
  const places = useMemo(() => (j != null ? placementsDeLaJournee(saison, j, declares) : new Map<string, string>()), [saison, j, declares]);
  const equipes = useMemo(() => {
    if (j == null) return [];
    const noms = [...new Set(saison.entries.filter((e) => e.j === j && e.team).map((e) => e.team as string))];
    return choixDEquipe(computeJournees(saison).find((x) => x.j === j), noms, declares);
  }, [saison, j, declares]);
  // Les feuilles en direct tenues par les joueurs (01/11/2026) : une feuille
  // prise, c'est le coup d'envoi, la journée en ligne passe « en direct ».
  const direct = useFeuillesDirect(j ?? null);
  const etatSaisi = j != null && meta ? etatJournee(saison, j, maintenant) : "brouillon";
  const etat = etatSaisi === "en-ligne" && direct.feuilles.size > 0 ? "en-direct" : etatSaisi;
  const geste = gesteDuMoment(saison, meta ? j : null, maintenant);
  const par = me ?? "admin";
  // La convocation n'est celle de la journée ouverte que si c'est son dimanche :
  // sinon ses « Je viens » et son « Il manque N » parleraient d'un autre jour.
  const convocationDuJour = !!meta && memeDate(presence.jour.replace(/^\D+/, ""), meta.date);
  const viens = useMemo(
    () => (convocationDuJour ? new Set([...presence.presents, ...presence.remplacants]) : new Set<string>()),
    [convocationDuJour, presence.presents, presence.remplacants]
  );

  // Les « Je viens » de ce dimanche qui ne sont pas encore sur les terrains, posés d'un geste.
  const proposition = useMemo(
    () => (j != null && convocationDuJour ? equipesDesVenus(saison, j, presence.ordreDesVenus, presence.teams) : null),
    [saison, j, convocationDuJour, presence.ordreDesVenus, presence.teams]
  );

  // Hors des camps : les lignes sans équipe (remplaçants), puis les « Je viens » pas encore sur la feuille.
  const camps = new Set(declares.flatMap((m) => m.equipes));
  const horsCamps = j != null ? saison.entries.map((e, i) => ({ e, i })).filter((x) => x.e.j === j && !x.e.extraTime && (!x.e.team || !camps.has(x.e.team) || x.e.statut !== "Présent")) : [];
  const sansPlace = [...viens].filter((n) => !places.has(n.trim().toLowerCase()));

  // La frise : la journée ouverte reste en vue.
  const frise = useRef<HTMLDivElement>(null);
  useEffect(() => {
    frise.current?.querySelector<HTMLElement>("[aria-current='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [j, isClient]);

  if (!isClient) return null;
  if (!isAdmin(me)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-card">
          <Lock className="size-6 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-bold tracking-tight">Espace réservé</h1>
      </div>
    );
  }

  const triees = [...saison.journees].sort((a, b) => a.j - b.j);
  const aPreparer = triees.reduce((m, x) => Math.max(m, x.j), 0) + 1;
  const terrainDe = (id?: number) => (saison.terrains ?? []).find((t) => (id != null ? t.id === id : t.defaut))?.nom ?? null;
  const lieuJournee = meta ? terrainDe(meta.terrainId) : null;
  const vueLigue = j != null ? vuesLigue.find((x) => x.j === j) : undefined;
  const derniereVue = [...vuesLigue].sort((a, b) => b.j - a.j)[0];
  const ligneOuverte = ligne != null ? saison.entries[ligne] : undefined;
  const dernierPas = history[history.length - 1];

  function ajouter(nom: string, equipe: string | null) {
    if (j == null) return;
    if (faire((s) => addEntry(s, newEntry(j, nom, equipe)), `${nom} sur la J${j}`)) haptique.ajout();
  }

  function placerSansPlace(nom: string) {
    if (j == null) return;
    faire((s) => addEntry(s, newEntry(j, nom, null)), `${nom} sur la J${j}`);
    const i = saisieStore.load().entries.findIndex((e) => e.j === j && e.player === nom && !e.extraTime);
    if (i >= 0) setLigne(i);
  }

  function placerLesVenus() {
    if (j == null || !proposition) return;
    if (faire((s) => poserEquipes(s, j, proposition, meta?.date), `Je viens posés sur la J${j}`)) {
      haptique.ajout();
      setMatchCourant(1);
    }
  }

  function ajouterUnMatch() {
    if (j == null) return;
    const fait = ajouterMatch(saisieStore.load(), j, {}, TERRAINS_MAX);
    if (commit(fait.saison, `Match ${fait.n} ajouté`)) {
      haptique.ajout();
      setMatchCourant(fait.n);
    }
  }

  return (
    <div className="shell flex flex-col gap-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+168px)] sm:max-w-[600px]">
      {/* En-tête : le retour, la synchro, la Ligue. */}
      <header className="flex items-center gap-2">
        <BoutonRetour />
        <h1 className="titre-lettrage flex-1 text-titre-m">SFL</h1>
        <PastilleSynchro onClick={() => setSynchro(true)} />
        <Link href="/admin/ligue" aria-label="Ligue" className="bouton-secondaire grid size-11 place-items-center">
          <Menu className="size-5" />
        </Link>
      </header>

      {/* La frise des journées. */}
      <div ref={frise} className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Journées">
        {triees.map((m) => {
          const actif = m.j === j;
          const defaut = verifierFeuille(saison, m.j).some((e) => e.r !== "I5" || estBrouillon(m));
          return (
            <button
              key={m.j}
              type="button"
              role="tab"
              aria-selected={actif}
              aria-current={actif}
              onClick={() => {
                haptique.choix();
                setChoix(m.j);
                setMatchCourant(1);
              }}
              className={cn(
                "relative flex h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-[18px] px-2.5",
                actif ? "bg-foreground text-background" : "text-encre-3",
                estBrouillon(m) && !actif && "border border-dashed border-foreground/35"
              )}
            >
              <span className="font-display text-titre-m leading-none">J{m.j}</span>
              <span className="mono-label h-3 text-micro leading-3">{estBrouillon(m) ? "○" : defaut ? "!" : ""}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-current={j == null}
          onClick={() => {
            haptique.choix();
            setChoix(null);
            setPreparer(true);
          }}
          className={cn(
            "flex h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-[18px] border-[1.5px] border-dashed px-2.5",
            j == null ? "border-foreground text-foreground" : "border-foreground/30 text-encre-3"
          )}
          aria-label={`Préparer la J${aPreparer}`}
        >
          <span className="font-display text-titre-m leading-none">J{aPreparer}</span>
          <span className="mono-label h-3 text-micro leading-3">+</span>
        </button>
      </div>

      {/* La journée. */}
      {meta && j != null ? (
        <section
          className={cn(
            "flex flex-col gap-5 rounded-[28px] p-4 transition-[border-color,background-color] duration-200",
            etat === "brouillon" ? "border-[1.5px] border-dashed border-foreground/30" : "glass"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <PastilleEtat etat={etat} suffixe={etat === "brouillon" && meta.publiee ? `en ligne à ${heureDe(meta.publiee.le)}` : etat === "en-ligne" ? heureDe(meta.publiee?.le) : null} />
            <Segmente
              taille="sm"
              label="Vue"
              options={[
                { id: "admin" as const, libelle: "Admin" },
                { id: "joueurs" as const, libelle: "Joueurs" },
              ]}
              valeur={vue}
              onChange={setVue}
              className="w-[168px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-display mr-1 text-affiche leading-[0.9]">J{j}</span>
            <Pastille onClick={() => setQuandOu(null)}>Dim {meta.date}</Pastille>
            <Pastille onClick={() => setQuandOu(null)} pointille={!meta.heure}>
              {meta.heure ?? "Heure"}
            </Pastille>
            <Pastille onClick={() => setQuandOu(null)} pointille={!lieuJournee}>
              {lieuJournee ?? "Lieu"}
            </Pastille>
            {meta.sflTime && <Pastille onClick={() => setQuandOu(null)}>SFL Time</Pastille>}
          </div>

          {vue === "joueurs" ? (
            vueLigue ? (
              <CarteJournee journee={vueLigue} />
            ) : (
              <div className="flex flex-col gap-3">
                <Etiquette>La ligue voit{derniereVue ? ` · J${derniereVue.j}` : ""}</Etiquette>
                {derniereVue ? <CarteJournee journee={derniereVue} /> : <p className="mono-label py-8 text-center text-encre-3">Rien</p>}
              </div>
            )
          ) : (
            <>
              {convocationDuJour && (etat === "brouillon" || etat === "en-ligne") && (
                <BlocConvocation presence={presence} matchs={Math.max(1, matchs.length)} onOuvrir={() => setConvocation(true)} />
              )}

              <BlocMatchs
                saison={saison}
                j={j}
                matchs={matchs}
                courant={matchCourant}
                onCourant={setMatchCourant}
                onPlus={(equipe) => setAjouterA(equipe)}
                onCarte={setLigne}
                // Pas de match de plus une fois le coup d'envoi passé : c'est ainsi
                // qu'étaient nés les matchs 5 et 6 de la J3, déjà jouée (28/10).
                onAjouterMatch={etat === "brouillon" || etat === "en-ligne" ? ajouterUnMatch : undefined}
                onReglerMatch={(n) => setQuandOu(n)}
                onArbitre={(n) => setArbitre(n)}
                arbitre={(n) => declares[n - 1]?.arbitre ?? null}
                ecarts={ecarts}
                direct={etat === "en-direct" || etat === "terminee"}
                heureJournee={meta.heure}
                lieu={(m) => terrainDe(m.lieuId ?? meta.terrainId)}
                feuille={(n) => {
                  const m = declares[n - 1];
                  const f = m ? direct.feuilleDe(m.equipes) : null;
                  return m && f
                    ? { libelle: `Feuille · ${f.preneur_nom ?? "libre"}`, ouverte: !f.fin, score: scoreDeLaFeuille(saison, j, m.equipes, f.compteurs) }
                    : null;
                }}
                onFeuille={setFeuilleOuverte}
              />
              {matchs.length > 0 && matchs.every((m) => !m.noirs.length && !m.blancs.length) === false && (
                <p className="mono-label text-encre-3">{compteursEnMots(saison, j)}</p>
              )}
              {matchs[matchCourant - 1] && !matchs[matchCourant - 1].noirs.length && !matchs[matchCourant - 1].blancs.length && (
                <button
                  type="button"
                  onClick={() => {
                    const m = matchs[matchCourant - 1];
                    if (faire((s) => retirerMatchVide(s, j, m.m.equipes), `Match ${m.n} retiré`)) setMatchCourant(1);
                  }}
                  className="bouton-discret mono-label self-center px-3 py-2"
                >
                  Retirer le match {matchCourant}
                </button>
              )}

              {proposition && (etat === "brouillon" || etat === "en-ligne") && (
                <button type="button" onClick={placerLesVenus} className="bouton-secondaire h-11 self-center px-5 text-ligne font-semibold">
                  Placer les {sansPlace.length || joueursPoses(proposition)} Je viens
                </button>
              )}

              {(horsCamps.length > 0 || sansPlace.length > 0) && (
                <section className="flex flex-col gap-2">
                  <Etiquette>Remplaçants · {horsCamps.length + sansPlace.length}</Etiquette>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                    {horsCamps.map(({ e, i }) => (
                      <button key={`l${i}`} type="button" onClick={() => setLigne(i)} className="flex shrink-0 flex-col items-center gap-1">
                        <CarteDe name={e.player} size={FORMAT_CARTE.petite} inerte />
                        <span className="mono-label max-w-[72px] truncate text-micro text-encre-2">{e.statut === "Présent" ? e.player.split(" ")[0] : e.statut}</span>
                      </button>
                    ))}
                    {sansPlace.map((nom) => (
                      <button key={`v${nom}`} type="button" onClick={() => placerSansPlace(nom)} className="flex shrink-0 flex-col items-center gap-1 opacity-70">
                        <span className="rounded-[13px] border-[1.5px] border-dashed border-foreground/40 p-[2px]">
                          <CarteDe name={nom} size={FORMAT_CARTE.petite} inerte />
                        </span>
                        <span className="mono-label max-w-[72px] truncate text-micro text-encre-2">{nom.split(" ")[0]}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <Etiquette>Outils</Etiquette>
                <div className="flex flex-wrap gap-1.5">
                  <Pastille onClick={() => setConsulter(true)}>Feuille{ecarts.length ? ` · ${ecarts.length} !` : ""}</Pastille>
                  <Pastille onClick={() => setEnDirect(true)}>Saisie</Pastille>
                  <Pastille onClick={() => setVotes(true)}>Votes</Pastille>
                  <Pastille onClick={() => setPoints(true)}>Points</Pastille>
                  <Link href="/admin/tableau?onglet=grille" className="mono-label inline-flex h-9 shrink-0 items-center rounded-full bg-secondary px-3.5 text-encre-2">
                    Grille
                  </Link>
                </div>
              </section>
            </>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setPreparer(true)}
          className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-[28px] border-[1.5px] border-dashed border-foreground/30"
        >
          <span className="font-display text-[64px] leading-none text-encre-3">J{aPreparer}</span>
          <span className="mono-label text-encre-3">À préparer</span>
        </button>
      )}

      {/* Le geste du moment, sous le pouce. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/50 bg-background/95 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] backdrop-blur-xl">
        <div className="shell flex flex-col gap-2 pt-3 sm:max-w-[600px]">
          {geste.t === "preparer" || geste.t === "apres" ? (
            <button type="button" onClick={() => setPreparer(true)} className="bouton-principal h-12 text-lecture font-semibold">
              Préparer la J{geste.t === "apres" ? geste.suivante.j : geste.j} · dim {geste.t === "apres" ? geste.suivante.date : geste.date}
            </button>
          ) : geste.t === "corriger" ? (
            <button type="button" onClick={() => setPublier(true)} className="bouton-secondaire h-12 text-lecture font-semibold">
              {geste.ecarts.length} à corriger
            </button>
          ) : geste.t === "publier" ? (
            <button type="button" onClick={() => setPublier(true)} className="bouton-principal h-12 text-lecture font-semibold">
              Publier pour tout le monde
            </button>
          ) : geste.t === "en-ligne" ? (
            <div className="flex items-center gap-2">
              <span className="mono-label flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-background">
                ● En ligne{geste.le ? ` · ${heureDe(geste.le)}` : ""}
              </span>
              <button type="button" onClick={() => setRemettre(true)} className="bouton-discret h-12 px-3 text-ligne font-semibold">
                Remettre en brouillon
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEnDirect(true)} className="bouton-principal h-12 text-lecture font-semibold">
              Direct · Match {geste.match}
              {geste.heure ? ` · ${geste.heure}` : ""}
            </button>
          )}
          <div className="flex items-center justify-between">
            <button type="button" onClick={undo} disabled={!history.length} aria-label="Annuler" className="bouton-discret flex h-10 items-center gap-1.5 px-3 disabled:opacity-30">
              <Undo2 className="size-4" />
              <span className="mono-label max-w-[150px] truncate">{dernierPas?.label ?? ""}</span>
            </button>
            <button type="button" onClick={redo} disabled={!future.length} aria-label="Rétablir" className="bouton-discret flex h-10 items-center px-3 disabled:opacity-30">
              <Redo2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Les feuilles. */}
      <FeuillePreparer
        key={`prep-${preparer}`}
        open={preparer}
        onOpenChange={setPreparer}
        saison={saison}
        viennent={presence.presents.length}
        equipesConvocation={presence.teams}
        convocation={{ jour: presence.jour, venus: presence.ordreDesVenus }}
        par={par}
        faire={faire}
        onOuverte={(n) => {
          setChoix(n);
          setMatchCourant(1);
          setVue("admin");
        }}
      />
      {meta && j != null && (
        <>
          <FeuilleQuandOu
            key={`qo-${j}-${quandOu}`}
            open={quandOu !== false}
            onOpenChange={(o) => !o && setQuandOu(false)}
            saison={saison}
            j={j}
            matchs={declares}
            focus={quandOu === false ? null : quandOu}
            faire={faire}
            onJeter={() =>
              setConfirmation({
                titre: `Jeter le brouillon de la J${j} ?`,
                action: "Jeter",
                faire: () => {
                  if (!dejaPubliee(meta) && commit(jeterBrouillon(saisieStore.load(), j), `J${j} jetée`, { jeter: j })) {
                    setQuandOu(false);
                    setChoix(undefined);
                  }
                },
              })
            }
            onSupprimer={() =>
              setConfirmation({
                titre: `Supprimer la J${j} ?`,
                action: "Supprimer",
                faire: () => {
                  supprimer({ genre: "journee", j }, `J${j} supprimée`, { jeter: j });
                  setQuandOu(false);
                  setChoix(undefined);
                },
              })
            }
          />
          <FeuilleLigne
            saison={saison}
            index={ligneOuverte && ligneOuverte.j === j ? ligne : null}
            equipes={equipes}
            mvpAuto={mvpAutomatique(saison, j)}
            places={places}
            onClose={() => {
              setLigne(null);
              if (retourFeuille) {
                setRetourFeuille(false);
                setConsulter(true);
              }
            }}
            faire={faire}
            onRetirer={(index, l) =>
              setConfirmation({
                titre: `Retirer ${l.player} de la J${j} ?`,
                action: "Retirer",
                faire: () => {
                  supprimer({ genre: "ligne", ligne: l, index }, `${l.player} retiré de la J${j}`);
                  setLigne(null);
                },
              })
            }
          />
          <FeuilleConsulter
            open={consulter}
            onOpenChange={setConsulter}
            saison={saison}
            j={j}
            matchs={matchs}
            onLigne={(i) => {
              setConsulter(false);
              setRetourFeuille(true);
              setLigne(i);
            }}
          />
          <FeuillePublier key={`pub-${publier}`} open={publier} onOpenChange={setPublier} saison={saison} j={j} par={par} faire={faire} />
          <FeuilleRemettre key={`rem-${remettre}`} open={remettre} onOpenChange={setRemettre} saison={saison} j={j} par={par} faire={faire} />
          <FeuilleDirect open={enDirect} onOpenChange={setEnDirect} saison={saison} j={j} matchs={matchs} commit={commit} faire={faire} direct={direct} />
          {feuilleOuverte != null && declares[feuilleOuverte - 1] && (
            <FeuilleDuMatch
              open
              onOpenChange={(o) => !o && setFeuilleOuverte(null)}
              saison={saison}
              j={j}
              equipes={declares[feuilleOuverte - 1].equipes}
              label={`Match ${feuilleOuverte}`}
              direct={direct}
              mode="admin"
            />
          )}
          <FeuilleArbitre
            open={arbitre != null}
            onOpenChange={(o) => !o && setArbitre(null)}
            saison={saison}
            j={j}
            n={arbitre ?? 1}
            match={arbitre != null ? declares[arbitre - 1] : undefined}
            brouillon={estBrouillon(meta)}
            faire={faire}
          />
          <ChoisirJoueurs
            open={ajouterA !== false}
            onOpenChange={(o) => !o && setAjouterA(false)}
            saison={saison}
            titre={ajouterA ? `${ajouterA.replace(/ (\d+)$/, " · Match $1")}` : `Ajouter à la J${j}`}
            places={places}
            viens={viens}
            suspendus={suspendusPour(saison, j)}
            onLever={(nom) =>
              setConfirmation({
                titre: `Lever la suspension de ${nom} pour la J${j} ?`,
                action: "Lever",
                faire: () => {
                  if (faire((s) => leverSuspension(s, nom, j, par, new Date()), `Suspension de ${nom} levée`)) haptique.sceau();
                },
              })
            }
            onChoisir={(nom) => ajouter(nom, ajouterA || null)}
          />
        </>
      )}
      <FeuilleConvocation open={convocation} onOpenChange={setConvocation} presence={presence} />
      <Feuille open={synchro} onOpenChange={setSynchro} titre="Synchro">
        <Synchro saison={saison} nu />
      </Feuille>
      <Feuille open={votes} onOpenChange={setVotes} titre="Votes" haute>
        <ResultatsVotes key={j ?? 0} j={j ?? undefined} />
      </Feuille>
      <Feuille open={points} onOpenChange={setPoints} titre="Points" haute>
        <DetailPoints saison={saison} />
      </Feuille>
      <Confirmer confirmation={confirmation} onFermer={() => setConfirmation(null)} />
    </div>
  );
}
