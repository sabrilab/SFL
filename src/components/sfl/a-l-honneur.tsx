"use client";

// À l'honneur — le haut de la vue Journée de la Ligue : les joueurs d'abord,
// en cartes, dans de petites sections de foot (calcul : lib/sfl/a-l-honneur).
// Demande de Sabri, 18/10 : la Ligue est l'endroit où l'on vient voir ce
// qu'on a gagné, ce que les autres ont gagné, et ce qui va tomber. Ça se voit
// aux cartes et aux badges, rien ne l'explique.
//
// Trois tailles de carte, au nombre d'or : la grande (l'homme du dimanche),
// la moyenne = grande ÷ φ (badges décrochés, le duo), la petite = moyenne ÷ φ
// (l'équipe type, ceux qui montent, ceux qui sont dans la surface). Toucher
// une carte l'ouvre en grand. Une section sans rien à montrer ne s'affiche pas.

import { useMemo } from "react";
import { Badge3D, Objet3D, OBJET_PALIER } from "@/components/sfl/badge-3d";
import { EMBLEMES } from "@/components/sfl/emblemes";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { honneurDe } from "@/lib/sfl/a-l-honneur";
import type { Player } from "@/lib/sfl/engine";
import { metal, NOM_METAL, quantite, TROPHEES } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

const PHI = (1 + Math.sqrt(5)) / 2;
/** La carte fait 254 px × size de large. */
const LARGEUR = 254;
const GRANDE = 0.85;
const MOYENNE = GRANDE / PHI;
const PETITE = MOYENNE / PHI;

const DEF = Object.fromEntries(TROPHEES.map((t) => [t.id, t]));

function Titre({ children, j }: { children: string; j?: number }) {
  return (
    <h2 className="mb-[var(--fib-13)] px-1 text-[17px] font-bold tracking-tight">
      {children}
      {j != null && <span className="text-foreground/40"> · J{j}</span>}
    </h2>
  );
}

/** Une rangée de cartes qui défile sur téléphone, qui passe à la ligne sur ordinateur. */
function Rangee({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 flex snap-x gap-[var(--fib-13)] overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

function Nom({ nom, moi, className }: { nom: string; moi: boolean; className?: string }) {
  return <span className={cn("block max-w-full truncate font-semibold", moi && "text-primary", className)}>{nom}</span>;
}

// Les postes d'attaque devant, puis le milieu, la défense, le gardien.
function rangPoste(poste: string): number {
  const p = poste.toUpperCase();
  if (/^(AT|AD|AG|BU)/.test(p)) return 0;
  if (/^(MC|MO|MD|MDC|MOC)/.test(p)) return 1;
  if (/^G$/.test(p)) return 3;
  return 2;
}

export function ALHonneur({ j }: { j: number }) {
  const { saison, players } = useSeason();
  const { player: moi } = useMyPlayer();
  const h = useMemo(() => honneurDe(saison, j, moi.name), [saison, j, moi.name]);
  const parNom = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const carte = (nom: string): Player | undefined => parNom.get(nom);

  const mvp = h.mvp.filter((m) => carte(m.nom));
  const decroches = h.decroches.filter((d) => carte(d.nom));
  const equipe = h.equipeType
    .map((e) => ({ ...e, p: carte(e.nom) }))
    .filter((e): e is typeof e & { p: Player } => !!e.p)
    .sort((a, b) => rangPoste(a.p.poste) - rangPoste(b.p.poste));
  const montent = h.montent.filter((m) => carte(m.nom));
  const surface = h.surface.filter((s) => carte(s.nom));
  const duo = h.duo && carte(h.duo.passeur) && carte(h.duo.buteur) ? h.duo : null;

  if (!mvp.length && !decroches.length && equipe.length < 5 && !montent.length && !surface.length && !duo) return null;

  const largeurMoyenne = LARGEUR * MOYENNE;
  const largeurPetite = LARGEUR * PETITE;

  return (
    <div className="flex flex-col gap-[var(--fib-34)]">
      {/* L'homme du dimanche — la grande carte, seule au centre. */}
      {mvp.length > 0 && (
        <section>
          <Titre j={j}>{mvp.length > 1 ? "Les hommes du dimanche" : "L'homme du dimanche"}</Titre>
          <div className="flex items-end justify-center gap-[var(--fib-21)]">
            {mvp.map((m) => {
              const p = carte(m.nom)!;
              const size = mvp.length > 1 ? MOYENNE : GRANDE;
              const ligne = [m.buts && quantite(DEF.buts, m.buts), m.passes && quantite(DEF.passes, m.passes)].filter(Boolean).join(" · ");
              return (
                <div key={m.nom} className="flex min-w-0 flex-col items-center gap-[var(--fib-8)]">
                  <MiniCarte player={p} size={size} detail={`MVP · J${j}${ligne ? ` · ${ligne}` : ""}`} />
                  <Nom nom={m.nom} moi={m.nom === moi.name} className={mvp.length > 1 ? "text-[15px]" : "text-[20px] tracking-tight"} />
                  {ligne && <span className="mono-label -mt-1 text-foreground/40">{ligne}</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Ils ont décroché — la carte, et le badge tombé ce dimanche posé dessus. */}
      {decroches.length > 0 && (
        <section>
          <Titre>Ils ont décroché</Titre>
          <Rangee>
            {decroches.map((d) => {
              const def = DEF[d.id];
              const m = metal(d.palier)!;
              const seuil = def.paliers[d.palier - 1];
              return (
                <div key={`${d.nom}-${d.id}`} className="flex shrink-0 snap-start flex-col items-center gap-[var(--fib-8)]" style={{ width: largeurMoyenne + 13 }}>
                  <div className="relative">
                    <MiniCarte player={carte(d.nom)!} size={MOYENNE} detail={`${def.nom} · ${NOM_METAL[m]} · ${quantite(def, seuil)}`} />
                    <span className="pointer-events-none absolute" style={{ right: -13, bottom: -8 }}>
                      <Badge3D badge={{ famille: "palier", id: d.id, palier: d.palier }} largeur={largeurMoyenne / (PHI * PHI)} />
                    </span>
                  </div>
                  <Nom nom={d.nom} moi={d.nom === moi.name} className="text-[13px]" />
                  <span className="mono-label -mt-1 text-foreground/40">
                    {NOM_METAL[m]} · {quantite(def, seuil)}
                  </span>
                </div>
              );
            })}
          </Rangee>
        </section>
      )}

      {/* L'équipe type — les cinq du jour, sur le terrain : deux devant, trois derrière. */}
      {equipe.length === 5 && (
        <section>
          <Titre>L&apos;équipe type</Titre>
          <div className="relative overflow-hidden rounded-[26px] bg-[#0f1a12] px-[var(--fib-13)] py-[var(--fib-21)] dark:bg-[#0c140e]">
            {/* Le tracé du terrain, à la craie. */}
            <svg aria-hidden viewBox="0 0 100 140" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-white/[0.13]">
              <g fill="none" stroke="currentColor" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
                <rect x="4" y="4" width="92" height="132" rx="2" />
                <line x1="4" y1="70" x2="96" y2="70" />
                <circle cx="50" cy="70" r="11" />
                <rect x="28" y="4" width="44" height="17" />
                <rect x="28" y="119" width="44" height="17" />
              </g>
            </svg>
            <div className="relative flex flex-col items-center gap-[var(--fib-13)]">
              {[equipe.slice(0, 2), equipe.slice(2)].map((ligne, i) => (
                <div key={i} className="flex justify-center gap-[var(--fib-21)]">
                  {ligne.map((e) => (
                    <div key={e.nom} className="flex flex-col items-center gap-1" style={{ width: largeurPetite + 8 }}>
                      <MiniCarte player={e.p} size={PETITE} detail={`Équipe type · J${j} · ${e.pp} pts`} />
                      <Nom nom={e.nom} moi={e.nom === moi.name} className="text-[11.5px] text-white" />
                      <span className="mono-label -mt-0.5 text-[8.5px] text-white/45 tabular-nums">{e.pp} pts</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Le duo — la passe et le but, épaule contre épaule. */}
      {duo && (
        <section>
          <Titre>Le duo</Titre>
          <div className="flex items-center justify-center">
            {[
              { nom: duo.passeur, role: quantite(DEF.passes, duo.n) },
              { nom: duo.buteur, role: quantite(DEF.buts, duo.n) },
            ].map((x, i) => (
              <div key={x.nom} className={cn("flex flex-col items-center gap-[var(--fib-8)]", i === 1 && "-ml-[var(--fib-8)]")} style={{ width: largeurMoyenne + 21 }}>
                <span className={cn("block transition-transform", i === 0 ? "-rotate-3" : "rotate-3")}>
                  <MiniCarte player={carte(x.nom)!} size={MOYENNE} detail={`Le duo · J${j}`} />
                </span>
                <Nom nom={x.nom} moi={x.nom === moi.name} className="text-[13px]" />
                <span className="mono-label -mt-1 text-foreground/40">{x.role}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ils montent — au classement Pépite, depuis le dimanche d'avant. */}
      {montent.length > 0 && (
        <section>
          <Titre>Ils montent</Titre>
          <Rangee>
            {montent.map((m) => (
              <div key={m.nom} className="flex shrink-0 snap-start flex-col items-center gap-1" style={{ width: largeurPetite + 13 }}>
                <MiniCarte player={carte(m.nom)!} size={PETITE} detail={`${m.rang}e · ▲ ${m.gain}`} />
                <Nom nom={m.nom} moi={m.nom === moi.name} className="text-[12px]" />
                <span className="mono-label -mt-0.5 text-primary tabular-nums">▲ {m.gain}</span>
                <span className="mono-label -mt-1 text-[8.5px] text-foreground/40 tabular-nums">{m.rang}e</span>
              </div>
            ))}
          </Rangee>
        </section>
      )}

      {/* Dans la surface — à un pas du prochain badge, qui attend en verre. */}
      {surface.length > 0 && (
        <section>
          <Titre>Dans la surface</Titre>
          <Rangee>
            {surface.map((s) => {
              const def = DEF[s.id];
              const Embleme = EMBLEMES[s.id];
              const moiMeme = s.nom === moi.name;
              return (
                <div
                  key={`${s.nom}-${s.id}`}
                  className={cn(
                    "glass-soft flex shrink-0 snap-start items-center gap-[var(--fib-8)] rounded-[21px] py-[var(--fib-8)] pr-[var(--fib-13)] pl-[var(--fib-8)]",
                    moiMeme && "ring-1 ring-primary/60"
                  )}
                >
                  <MiniCarte player={carte(s.nom)!} size={PETITE} detail={`${def.nom} · encore ${quantite(def, s.reste)}`} />
                  <div className="flex flex-col items-center gap-1">
                    <Objet3D objet={OBJET_PALIER[s.id]} matiere="fantome" taille={largeurPetite / PHI} embleme={Embleme} />
                    <Nom nom={s.nom} moi={moiMeme} className="max-w-[84px] text-center text-[12px]" />
                    <span className="mono-label -mt-0.5 text-foreground/40">{quantite(def, s.reste)}</span>
                  </div>
                </div>
              );
            })}
          </Rangee>
        </section>
      )}
    </div>
  );
}
