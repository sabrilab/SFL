"use client";

// La page d'une équipe de Bola Team (Sabri, 24/10 : « cette équipe a une
// page sur Bola. Cette page-là donne lieu à un profil d'équipe qui peut
// accueillir une couverture faite justement en IA aussi, avec les joueurs
// présents de cette équipe, leur maillot et leur blason »). On y arrive par
// l'équipe d'un joueur, sous son nom (equipe/equipe-du-joueur.tsx), par la
// page Team (mon équipe, les autres équipes) et par le championnat.
//
// De haut en bas, comme le profil d'un joueur :
//   · la couverture (equipe/couverture.tsx) : celle que le capitaine a
//     créée avec le studio, sinon le haut du maillot de l'équipe en plein
//     cadre ; au capitaine et au vice, « Couverture » pour la créer
//     (equipe/fiche-couverture.tsx) ;
//   · l'écusson posé à cheval sur la couverture, le nom de l'équipe dans le
//     lettrage de la Map, sa ville et son état, sa place au championnat ;
//   · ses chiffres de la saison en Anton (rang, points, joués, différence)
//     et sa forme ;
//   · l'effectif : la carte de chaque joueur au format moyen (la hiérarchie
//     des cartes, mini-carte.tsx), capitaine et vice d'abord, ses buts et
//     ses passes de la saison ; la toucher ouvre la carte en grand ;
//   · le maillot et l'écusson en grand, leurs trois couleurs (le capitaine
//     les retouche d'ici, equipe/editeur-blason.tsx) ;
//   · le prochain match, les derniers matchs, les buteurs et les passeurs
//     de l'équipe.
// Une équipe en formation reste cachée aux autres (doc 04 §6) ; ses joueurs
// voient sa page. Sur tablette et ordinateur, la couverture sur toute la
// largeur, puis deux colonnes au nombre d'or. En aperçu, le monde de
// démonstration quand il est demandé (?apercu=1 sur la page Team).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, ChevronLeft, Pencil } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Chiffre } from "@/components/sfl/profil-joueur";
import { Nom } from "@/components/sfl/nom";
import { RangMetal } from "@/components/sfl/rang-metal";
import { CouvertureEquipe } from "@/components/sfl/equipe/couverture";
import { Ecusson, EcussonVide } from "@/components/sfl/equipe/ecusson";
import { NOM_ROLE } from "@/components/sfl/equipe/equipe-du-joueur";
import { FicheBlason } from "@/components/sfl/equipe/editeur-blason";
import { FicheCouverture } from "@/components/sfl/equipe/fiche-couverture";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { useEquipes, visible } from "@/hooks/use-equipes";
import { signalerEquipe } from "@/hooks/use-mon-equipe";
import { useSession } from "@/hooks/use-session";
import { EMBLEMES, FORMES, MOTIFS, blasonParDefaut, libelleCouleur } from "@/lib/sfl/blason";
import { championnat, periodeSaison, saisonEnCours, type MatchTeam, type Res } from "@/lib/sfl/championnat-team";
import { MAX_EQUIPE, MIN_EQUIPE, active, enCours, lireChampionnat, listerDefis, signataires, type Defi, type EquipeTeam } from "@/lib/sfl/equipes";
import { demoChampionnat } from "@/lib/sfl/equipes-demo";
import { libelleJour } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";
const rangFr = (n: number) => (n === 1 ? "1er" : `${n}e`);
const meme = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const COULEUR_RES: Record<Res, string> = { V: "bg-[#16924A]", N: "bg-[#9AA0A6]", D: "bg-[#D3212C]" };

type Championnat = { equipes: EquipeTeam[]; matchs: MatchTeam[]; maintenant?: Date };

function Titre({ children, droite }: { children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-titre-fort font-extrabold tracking-tight">{children}</h2>
      {droite}
    </div>
  );
}

function Pastille({ r, taille = 18 }: { r: Res; taille?: number }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full font-black text-white", COULEUR_RES[r])}
      style={{ width: taille, height: taille, fontSize: taille * 0.5 }}
    >
      {r}
    </span>
  );
}

export default function PageEquipe() {
  const { id: brut } = useParams<{ id: string }>();
  const id = /^\d+$/.test(brut) ? Number(brut) : -1;
  const router = useRouter();
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const { me } = useMyPlayer();
  const { allPlayers } = useSeason();
  const { equipes, charge, demo } = useEquipes();
  const [champReel, setChampReel] = useState<Championnat | null>(null);
  const [defis, setDefis] = useState<Defi[]>([]);
  const [couverture, setCouverture] = useState(false);
  const [blasonOuvert, setBlasonOuvert] = useState(false);

  useEffect(() => {
    if (!connecte || demo) return;
    let fini = false;
    Promise.all([lireChampionnat().catch(() => null), listerDefis().catch(() => [])]).then(([c, d]) => {
      if (fini) return;
      setChampReel(c);
      setDefis(d);
    });
    return () => {
      fini = true;
    };
  }, [connecte, demo]);

  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const champ: Championnat | null = useMemo(() => (demo ? demoChampionnat(noms, me) : champReel), [demo, noms, me, champReel]);

  const e = equipes.find((x) => x.id === id) ?? null;
  const montree = e && visible(e, me, demo) ? e : null;
  const moiDedans = montree?.membres.find((m) => m.statut === "membre" && meme(m.name, me)) ?? null;
  const dirigeant = !!moiDedans && moiDedans.role !== "membre";

  // La saison de l'équipe : sa ligne du classement, ses matchs, ses buteurs.
  const saison = useMemo(() => {
    if (!champ || !montree) return null;
    const now = champ.maintenant ?? new Date();
    const c = championnat(saisonEnCours(now), champ.equipes, champ.matchs, now);
    const n = c.divisionDe.get(montree.id);
    const d = c.divisions.find((x) => x.n === n) ?? null;
    const ligne = d?.lignes.find((l) => l.equipe === montree.id) ?? null;
    const matchs = c.matchs.filter((x) => x.etat.etat === "valide" && (x.m.de === montree.id || x.m.a === montree.id));
    return {
      numero: c.saison,
      division: d,
      ligne: ligne && ligne.j > 0 ? ligne : null,
      matchs,
      buteurs: c.buteurs.filter((x) => x.equipe === montree.id),
      passeurs: c.passeurs.filter((x) => x.equipe === montree.id),
      parId: new Map(champ.equipes.map((x) => [x.id, x])),
    };
  }, [champ, montree]);

  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push("/bola-team");
  };

  if (!charge) return null;
  if (!montree)
    return (
      <div className="mx-auto flex w-full max-w-[470px] flex-col items-center gap-4 px-5 pt-[var(--fib-55)] text-center">
        <EcussonVide taille={64} className="text-encre-4" />
        <p className="text-lecture text-muted-foreground">Équipe introuvable.</p>
        <Link href="/bola-team" className="bouton-secondaire px-5 py-2.5 text-ligne font-semibold">
          Bola Team
        </Link>
      </div>
    );

  const b = montree.blason ?? blasonParDefaut(montree.fond);
  const joueurs = signataires(montree);
  const stats = new Map<string, { buts: number; passes: number }>();
  for (const x of saison?.buteurs ?? []) stats.set(x.name.toLowerCase(), { buts: x.buts, passes: x.passes });
  for (const x of saison?.passeurs ?? []) stats.set(x.name.toLowerCase(), { buts: x.buts, passes: x.passes });
  const l = saison?.ligne ?? null;
  const place = saison?.division && l ? `${saison.division.nom} · ${rangFr(l.rang)} · ${l.pts} pt${l.pts > 1 ? "s" : ""}` : null;
  const prochain = demo
    ? null
    : (defis
        .filter((d) => d.statut === "accepte" && enCours(d) && (d.de === montree.id || d.a === montree.id))
        .sort((x, y) => `${x.jour} ${x.heure}`.localeCompare(`${y.jour} ${y.heure}`))[0] ?? null);
  const adversaire = (i: number) => saison?.parId.get(i) ?? equipes.find((x) => x.id === i) ?? null;
  const etat = [montree.ville, active(montree) ? "Active" : "En formation", `${joueurs.length} / ${active(montree) ? MAX_EQUIPE : MIN_EQUIPE}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="gabarit-ligue mx-auto flex w-full max-w-[470px] flex-col gap-[var(--fib-21)] px-5 pt-2 pb-8 sm:pt-6 md:pt-4 lg:pt-[var(--fib-34)]">
      <h1 className="sr-only">{montree.nom}</h1>
      <div className="flex items-center">
        <button type="button" onClick={retour} aria-label="Retour" className="bouton-discret -ml-2 grid size-[34px] shrink-0 place-items-center">
          <ChevronLeft className="size-5" />
        </button>
      </div>

      {/* La couverture, l'écusson à cheval dessus, puis le nom. */}
      <div className="flex flex-col items-center">
        <CouvertureEquipe equipe={montree} className="aspect-[16/9] w-full rounded-[28px] bg-card md:aspect-[21/8]">
          {dirigeant && (
            <button
              type="button"
              onClick={() => setCouverture(true)}
              className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-corps font-semibold text-white backdrop-blur-md transition-transform active:scale-95"
            >
              <Camera className="size-3.5" strokeWidth={2.4} />
              Couverture
            </button>
          )}
        </CouvertureEquipe>
        <div className="relative -mt-[56px] rounded-full">
          <Ecusson initiales={montree.initiales} fond={montree.fond} blason={montree.blason} taille={104} />
        </div>
        <div className="mt-[var(--fib-13)] flex w-full flex-col items-center gap-[var(--fib-8)] text-center">
          <p className="titre-lettrage text-nom leading-[0.95] break-words" aria-hidden>
            {montree.nom}
          </p>
          <p className="font-mono text-petit text-encre-3">{etat}</p>
          {place && (
            <Link href="/bola-team?vue=championnat" className="glass mt-[var(--fib-8)] rounded-full px-3.5 py-1.5 text-corps font-semibold">
              {place}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[var(--fib-34)] md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)]">
        <div className="flex min-w-0 flex-col gap-[var(--fib-34)]">
          {/* La saison en chiffres, et la forme. */}
          {saison && l && (
            <section className="flex flex-col gap-[var(--fib-13)]">
              <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
                <Chiffre valeur={rangFr(l.rang)} quoi={saison.division?.nom ?? "Rang"} />
                <Chiffre valeur={l.pts} quoi="Points" />
                <Chiffre valeur={l.j} quoi="Joués" />
                <Chiffre valeur={l.diff > 0 ? `+${l.diff}` : l.diff} quoi="Diff." />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="mono-label text-muted-foreground">
                  {l.g} V · {l.n} N · {l.p} D · {l.bp} – {l.bc}
                </span>
                <span className="flex gap-1">
                  {l.forme.map((r, i) => (
                    <Pastille key={i} r={r} />
                  ))}
                </span>
              </div>
            </section>
          )}

          {/* L'effectif. */}
          <section className="flex flex-col gap-[var(--fib-13)]">
            <Titre droite={<span className="font-mono text-petit font-bold text-encre-3 tabular-nums">{joueurs.length} / {MAX_EQUIPE}</span>}>
              Effectif
            </Titre>
            <div className="grid grid-cols-3 gap-x-2 gap-y-[var(--fib-21)] sm:grid-cols-4">
              {joueurs.map((m) => {
                const s = stats.get(m.name.toLowerCase());
                return (
                  <div key={m.id} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                    <CarteDe name={m.name} size={FORMAT_CARTE.moyenne} />
                    <span className="w-full truncate text-ligne leading-tight font-bold">
                      <Nom n={m.name} />
                    </span>
                    <span className="mono-label -mt-1 text-micro text-encre-3">
                      {m.role !== "membre" ? NOM_ROLE[m.role] : s ? `${s.buts} b · ${s.passes} pd` : NOM_ROLE.membre}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Le prochain match et les derniers. */}
          {(prochain || (saison && saison.matchs.length > 0)) && (
            <section className="flex flex-col gap-2">
              <Titre droite={saison && <span className="mono-label text-muted-foreground">{periodeSaison(saison.numero)}</span>}>
                Matchs
              </Titre>
              {prochain &&
                (() => {
                  const autre = adversaire(prochain.de === montree.id ? prochain.a : prochain.de);
                  return (
                    <div className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5">
                      {autre && <Ecusson initiales={autre.initiales} fond={autre.fond} blason={autre.blason} taille={34} />}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-lecture font-semibold">{autre?.nom ?? "Adversaire"}</span>
                        <span className="truncate text-corps text-muted-foreground">
                          {libelleJour(prochain.jour)} · {prochain.heure.slice(0, 5)} · {prochain.lieu}
                        </span>
                      </span>
                      <span className="mono-label shrink-0 text-foreground">À jouer</span>
                    </div>
                  );
                })()}
              {saison?.matchs.slice(0, 6).map(({ m, etat: em, compte }) => {
                if (em.etat !== "valide") return null;
                const chezNous = m.de === montree.id;
                const autre = adversaire(chezNous ? m.a : m.de);
                const pour = chezNous ? em.buts[0] : em.buts[1];
                const contre = chezNous ? em.buts[1] : em.buts[0];
                const r: Res = pour > contre ? "V" : pour === contre ? "N" : "D";
                return (
                  <Link
                    key={m.id}
                    href={autre ? `/bola-team/${autre.id}` : "#"}
                    className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5 transition-transform active:scale-[0.98]"
                  >
                    <Pastille r={r} taille={22} />
                    {autre && <Ecusson initiales={autre.initiales} fond={autre.fond} blason={autre.blason} taille={30} />}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-lecture font-semibold">{autre?.nom ?? "Adversaire"}</span>
                      <span className="mono-label text-encre-3">
                        {libelleJour(m.jour)}
                        {em.forfaitDe != null ? " · forfait" : !compte ? " · amical" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-titre-m leading-none tabular-nums" style={{ fontFamily: ANTON }}>
                      {pour} <span className="text-encre-4">–</span> {contre}
                    </span>
                  </Link>
                );
              })}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-[var(--fib-34)]">
          {/* Le maillot et l'écusson. */}
          <section className="flex flex-col gap-[var(--fib-13)]">
            <Titre
              droite={
                dirigeant && (
                  <button
                    type="button"
                    onClick={() => setBlasonOuvert(true)}
                    className="bouton-discret flex items-center gap-1.5 px-2.5 py-1 text-corps font-semibold text-muted-foreground"
                  >
                    <Pencil className="size-3.5" strokeWidth={2.4} />
                    Modifier
                  </button>
                )
              }
            >
              Maillot
            </Titre>
            <div className="flex flex-col items-center gap-[var(--fib-13)] rounded-[24px] bg-card px-4 pt-5 pb-4">
              <div className="flex items-end justify-center gap-[var(--fib-21)]">
                <Maillot initiales={montree.initiales} fond={montree.fond} blason={montree.blason} taille={168} />
                <Ecusson initiales={montree.initiales} fond={montree.fond} blason={montree.blason} taille={92} className="mb-4" />
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {b.couleurs.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5 rounded-full bg-background/60 py-1 pr-2.5 pl-1 text-corps font-semibold">
                    <span className="size-4 rounded-full border border-contraste/25" style={{ background: c }} />
                    {libelleCouleur(c)}
                  </span>
                ))}
              </div>
              <span className="mono-label text-muted-foreground">
                {[FORMES.find((f) => f.id === b.forme)?.label, MOTIFS.find((m) => m.id === b.motif)?.label, EMBLEMES.find((x) => x.id === b.embleme)?.label]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </section>

          {/* Les buteurs et les passeurs de l'équipe. */}
          {saison && (saison.buteurs.length > 0 || saison.passeurs.length > 0) && (
            <section className="flex flex-col gap-2">
              <Titre>Buteurs et passeurs</Titre>
              {[
                { liste: saison.buteurs, cle: "buts" as const, unite: "buts" },
                { liste: saison.passeurs, cle: "passes" as const, unite: "pd" },
              ].map(({ liste, cle, unite }) =>
                liste.slice(0, 3).map((x, i) => (
                  <div key={`${cle}-${x.joueur}`} className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2">
                    <RangMetal rang={i + 1} />
                    <CarteDe name={x.name} size={FORMAT_CARTE.petite} />
                    <span className="min-w-0 flex-1 truncate text-lecture font-semibold">
                      <Nom n={x.name} />
                    </span>
                    <span className="w-16 text-right text-titre-fort font-extrabold tabular-nums">
                      {x[cle]}
                      <span className="mono-label ml-1 text-encre-3">{unite}</span>
                    </span>
                  </div>
                ))
              )}
            </section>
          )}
        </div>
      </div>

      <FicheCouverture
        equipe={dirigeant ? montree : null}
        open={couverture}
        onOpenChange={setCouverture}
        apercu={demo}
        onPosee={signalerEquipe}
      />
      <FicheBlason
        equipe={dirigeant ? montree : null}
        open={blasonOuvert}
        onOpenChange={setBlasonOuvert}
        apercu={demo}
        onEnregistre={signalerEquipe}
      />
    </div>
  );
}

