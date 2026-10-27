"use client";

// La page d'accueil de Bola : ce que voit un visiteur sans compte sur
// getbola.app. Elle dit ce qu'est l'app en trois phrases, montre la carte,
// et porte un encart « Créer mon compte | Se connecter ».
//
// Sabri (27/10) : droit au but, sans la 3D du site de la marque ; on affine
// ensuite. Les titres reprennent les phrases du site (bola-site, copy.ts) :
// c'est le ballon qui parle.
//
// AuthGate ne la montre qu'à l'adresse « / » et hors de l'app installée :
// partout ailleurs, l'écran de connexion (login-screen.tsx) reste tel quel.

import { useState } from "react";
import Link from "next/link";
import { BolaCard } from "@/components/sfl/bola-card";
import { BoutonsSociaux } from "./boutons-sociaux";
import { FormulaireConnexion } from "./login-screen";
import { cn } from "@/lib/utils";

/** La carte de démonstration : celle d'un nouveau joueur, sans photo (note 75 au départ). */
const CARTE = {
  name: "Toi",
  position: "MC",
  overall: 75,
  stats: { VIT: 76, TIR: 73, PAS: 77, DRI: 75, DEF: 72, PHY: 74 },
};

const POINTS = [
  {
    titre: "Viens seul. Repars à dix.",
    texte: "La Map montre les matchs et les terrains autour de toi. Il manque un joueur ? Tu prends la place.",
  },
  {
    titre: "Crée ta carte.",
    texte: "Ta carte officielle, ta note, tes stats. Elle bouge avec tes buts, tes passes et tes titres.",
  },
  {
    titre: "Tu joues. Je retiens tout.",
    texte: "Feuilles de match, votes, classements, saisons : chaque match compte.",
  },
];

function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- svg de la marque, deux teintes */}
      <img src="/bola/logo-noir.svg" alt="Bola" className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- svg de la marque, deux teintes */}
      <img src="/bola/logo-blanc.svg" alt="Bola" className="hidden h-full w-auto dark:block" />
    </span>
  );
}

/** L'encart : s'inscrire ou se connecter, Google et Apple dans les deux (s'ils sont branchés). */
type Onglet = "inscription" | "connexion";

function Encart({ onglet, setOnglet }: { onglet: Onglet; setOnglet: (o: Onglet) => void }) {
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <section id="entrer" aria-label="Entrer dans Bola" className="glass-soft w-full rounded-[28px] p-4 md:p-5">
      <div role="tablist" aria-label="Entrer" className="glass flex gap-1 rounded-full p-1">
        {(
          [
            ["inscription", "Inscription"],
            ["connexion", "Connexion"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            onClick={() => {
              setOnglet(id);
              setErreur(null);
            }}
            className={cn(
              "flex-1 px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap",
              onglet === id ? "bouton-principal" : "bouton-discret text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === "inscription" ? (
        <div className="mt-4 flex flex-col gap-2.5">
          <Link
            href="/inscription"
            className="bouton-principal bouton--vert flex items-center justify-center py-4 text-[15px] font-bold"
          >
            Créer mon compte
          </Link>
          <BoutonsSociaux retour="/inscription" inscription onErreur={setErreur} />
          {erreur && (
            <p className="px-1 text-[12.5px] font-medium text-[#c8352b] dark:text-[#FF6B5E]">{erreur}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          <FormulaireConnexion error={erreur} setError={setErreur} />
          <BoutonsSociaux retour="/inscription" onErreur={setErreur} enLigne />
          <p className="px-1 pt-1 text-[12.5px] leading-snug text-foreground/40">
            Mot de passe oublié ? Un admin de la ligue peut t&apos;en donner un provisoire.
          </p>
        </div>
      )}
    </section>
  );
}

export function Landing() {
  const [onglet, setOnglet] = useState<Onglet>("inscription");
  const entrer = (o: Onglet) => {
    setOnglet(o);
    document.getElementById("entrer")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 pt-6 md:px-10 md:pt-8">
        <Logo className="h-[22px]" />
        <button
          type="button"
          onClick={() => entrer("connexion")}
          className="bouton-secondaire px-4 py-2 text-[13px] font-semibold"
        >
          Se connecter
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 md:px-10">
        <div className="grid items-center gap-10 pt-12 pb-16 md:grid-cols-[1fr_auto] md:gap-16 md:pt-20 md:pb-24">
          <div className="flex flex-col">
            <h1 className="titre-lettrage text-[44px] leading-[0.95] md:text-[72px]">
              Reviens
              <br />
              au ballon.
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-snug text-foreground/60 md:text-[18px]">
              Trouve un match près de chez toi. Joue. Ta carte de joueur garde tout.
            </p>
            <div className="mt-8 max-w-sm md:mt-10">
              <Encart onglet={onglet} setOnglet={setOnglet} />
            </div>
          </div>
          <div className="mx-auto [filter:drop-shadow(0_13px_21px_rgba(0,0,0,.16))] dark:[filter:drop-shadow(0_21px_34px_rgba(0,0,0,.45))]">
            <div className="md:hidden">
              <BolaCard {...CARTE} size={0.68} />
            </div>
            <div className="hidden md:block">
              <BolaCard {...CARTE} size={0.9} />
            </div>
          </div>
        </div>

        <ol className="grid gap-10 border-t border-contraste/8 py-14 md:grid-cols-3 md:gap-12 md:py-20">
          {POINTS.map((p, i) => (
            <li key={p.titre} className="flex flex-col">
              <span className="mono-label text-foreground/35">{String(i + 1).padStart(2, "0")}</span>
              <h2 className="titre-lettrage mt-3 text-[26px] leading-[1] md:text-[30px]">{p.titre}</h2>
              <p className="mt-3 text-[15px] leading-snug text-foreground/60">{p.texte}</p>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-start gap-6 border-t border-contraste/8 py-14 md:flex-row md:items-center md:justify-between md:py-20">
          <h2 className="titre-lettrage text-[32px] leading-[1] md:text-[44px]">À toi de jouer.</h2>
          <button
            type="button"
            onClick={() => entrer("inscription")}
            className="bouton-principal bouton--vert px-8 py-4 text-[15px] font-bold"
          >
            Créer mon compte
          </button>
        </div>
      </main>

      <footer className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-t border-contraste/8 px-6 py-8 md:px-10">
        <Logo className="h-[16px] opacity-60" />
        <Link href="/confidentialite" className="text-[12.5px] font-semibold text-foreground/45">
          Politique de confidentialité
        </Link>
      </footer>
    </div>
  );
}
