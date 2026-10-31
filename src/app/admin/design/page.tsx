"use client";

// Admin → Design : le design system de Bola, en vrai (Sabri, le 30/10 :
// « une espèce d'outil qui nous permet de faire des mises à jour sur le
// design, d'éditer là-dessus avant de publier partout »).
//
// La page montre chaque réglage de app/tokens.css (couleurs, gris du texte,
// tailles, arrondis) et les composants communs (boutons, étiquettes, titres,
// tuiles, feuilles, retour, champs), dans le mode où est l'app ; la bascule
// en haut passe de l'un à l'autre. Elle est réservée à l'admin.
//
// Le mode essai : chaque réglage se change ici (pipette, curseur, valeur) et
// l'app entière le prend aussitôt, sur ce téléphone seulement
// (lib/ds/essai.ts, components/ds/essai-design.tsx). On navigue dans l'app
// pour le voir partout ; une pilule en haut rappelle qu'un essai est en cours.
// « Copier le résumé » donne ce qui change, de quoi à quoi : c'est ce qu'on
// reporte dans tokens.css, puis aperçu, puis mise en ligne sur le OK de Sabri.

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { ChevronRight, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { useModeClair } from "@/hooks/use-mode-clair";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  REGLAGES,
  arreterEssai,
  changeAvecLeMode,
  ecouterEssai,
  ecrireEssai,
  lireEssai,
  nombreDeChangements,
  resume,
  valeursDuFichier,
  type Essai,
  type Famille,
  type Mode,
  type Reglage,
} from "@/lib/ds/essai";

const TONS = [
  { ton: "", nom: "Argent", geste: "Voir" },
  { ton: "bouton--vert", nom: "Vert", geste: "Je viens" },
  { ton: "bouton--or", nom: "Or", geste: "Ma carte" },
  { ton: "bouton--mauve", nom: "Mauve", geste: "Partager" },
  { ton: "bouton--braise", nom: "Braise", geste: "Il manque 2" },
  { ton: "bouton--rouge", nom: "Rouge", geste: "Annuler" },
];

const GRIS = [
  { classe: "text-encre", nom: "Encre", part: "100 %", role: "Les noms, les titres" },
  { classe: "text-encre-2", nom: "Second", part: "70 %", role: "Le texte d'une fiche" },
  { classe: "text-encre-3", nom: "Étiquette", part: "45 %", role: "Les étiquettes, les sous-lignes" },
  { classe: "text-encre-4", nom: "Éteint", part: "30 %", role: "Ce qui n'est pas encore là" },
];

const TITRES: Record<Famille, string> = {
  couleur: "Couleurs",
  taille: "Tailles de texte",
  arrondi: "Arrondis",
};

type Fichier = Record<Mode, Record<string, string>>;

export default function DesignPage() {
  const session = useSession();
  const clair = useModeClair();
  const mode: Mode = clair ? "clair" : "sombre";
  const { setTheme } = useTheme();
  const [fichier, setFichier] = useState<Fichier | null>(null);
  const [essai, setEssai] = useState<Essai>({ clair: {}, sombre: {}, commun: {} });
  const [feuille, setFeuille] = useState(false);
  const [interrupteur, setInterrupteur] = useState(true);

  useEffect(() => {
    Promise.resolve().then(() => {
      setFichier(valeursDuFichier());
      setEssai(lireEssai());
    });
    return ecouterEssai(setEssai);
  }, []);

  const changements = nombreDeChangements(essai);

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-corps text-encre-3">
        Cette page est réservée à l&apos;admin de la ligue.
      </div>
    );
  }

  const partDe = (r: Reglage) => (changeAvecLeMode(r) ? mode : "commun");
  const valeur = (r: Reglage) => essai[partDe(r)][r.nom] ?? fichier?.[mode][r.nom] ?? "";
  const change = (r: Reglage) => r.nom in essai[partDe(r)];
  const poser = (r: Reglage, v: string) => {
    const part = partDe(r);
    const suite = { ...essai, [part]: { ...essai[part] } };
    if (v === fichier?.[mode][r.nom]) delete suite[part][r.nom];
    else suite[part][r.nom] = v;
    ecrireEssai(suite);
  };
  const remettre = (r: Reglage) => {
    const part = partDe(r);
    const suite = { ...essai, [part]: { ...essai[part] } };
    delete suite[part][r.nom];
    ecrireEssai(suite);
  };

  async function copier() {
    if (!fichier) return;
    try {
      await navigator.clipboard.writeText(resume(essai, fichier));
      toast("Résumé copié", { description: "Colle-le dans le fil du design system." });
    } catch {
      toast("La copie n'a pas marché");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-9 px-4 pb-10">
      <header className="flex flex-col gap-4">
        <BoutonRetour />
        <div>
          <h1 className="titre-lettrage text-[34px] leading-none">Design</h1>
          <p className="mt-2 text-corps text-encre-3">
            Le design system de Bola, tel qu&apos;il est en ligne. Un réglage changé ici s&apos;essaie dans toute
            l&apos;app, sur ce téléphone seulement.
          </p>
        </div>
        <div className="flex gap-2">
          {(["clair", "sombre"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setTheme(m === "clair" ? "light" : "dark")}
              className={cn(
                mode === m ? "bouton-principal" : "bouton-secondaire",
                "flex h-10 flex-1 items-center justify-center text-[14px] font-semibold",
              )}
            >
              {m === "clair" ? "Clair" : "Sombre"}
            </button>
          ))}
        </div>
        {changements > 0 && (
          <div className="glass-soft flex flex-col gap-3 rounded-tuile p-4">
            <p className="text-lecture font-semibold">
              {changements} {changements > 1 ? "réglages essayés" : "réglage essayé"}
            </p>
            <p className="text-petit text-encre-3">
              Toute l&apos;app les prend sur ce téléphone. Les joueurs voient toujours la version en ligne.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copier}
                className="bouton-principal bouton--vert flex h-10 flex-1 items-center justify-center gap-2 text-[14px] font-semibold"
              >
                <Copy className="size-4" /> Copier le résumé
              </button>
              <button
                type="button"
                onClick={arreterEssai}
                className="bouton-secondaire bouton--rouge flex h-10 items-center justify-center gap-2 px-4 text-[14px] font-semibold"
              >
                <RotateCcw className="size-4" /> Tout remettre
              </button>
            </div>
          </div>
        )}
      </header>

      {(["couleur", "taille", "arrondi"] as const).map((famille) => (
        <section key={famille} className="flex flex-col gap-2">
          <Etiquette>{TITRES[famille]}</Etiquette>
          {famille === "couleur" && (
            <p className="px-1 pb-1 text-petit text-encre-3">
              Mode {mode} : chaque mode a ses couleurs. Les cartes, les écussons, les trophées et la Map gardent les
              leurs.
            </p>
          )}
          <div className="glass-soft divide-y divide-border overflow-hidden rounded-tuile">
            {REGLAGES.filter((r) => r.famille === famille).map((r) => (
              <LigneReglage
                key={r.nom}
                r={r}
                valeur={valeur(r)}
                change={change(r)}
                onChange={(v) => poser(r, v)}
                onRemettre={() => remettre(r)}
              />
            ))}
          </div>
          {famille === "couleur" && <Gris />}
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <Etiquette>Typographie</Etiquette>
        <div className="glass-soft flex flex-col gap-4 rounded-tuile p-4">
          <Specimen nom="Titre en lettrage" classe=".titre-lettrage · Inter 900">
            <span className="titre-lettrage text-[34px] leading-none">Dimanche</span>
          </Specimen>
          <Specimen nom="Chiffres" classe="font-display · Anton">
            <span className="font-display text-[44px] leading-none">J4 · 79</span>
          </Specimen>
          <Specimen nom="Étiquette" classe=".mono-label">
            <span className="mono-label text-encre-3">3 matchs ouverts</span>
          </Specimen>
          <Specimen nom="Texte" classe="Inter · semi-gras / gras">
            <span className="text-lecture font-semibold">Sunday Five League</span>
            <span className="block text-corps text-encre-2">Le texte courant d&apos;une fiche, en Inter.</span>
          </Specimen>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Etiquette>Boutons</Etiquette>
        <p className="px-1 text-petit text-encre-3">
          Trois rangs, un ton par famille de gestes. La braise ne sert qu&apos;au manque, le rouge à défaire.
        </p>
        <div className="glass-soft flex flex-col gap-4 rounded-tuile p-4">
          {(["bouton-principal", "bouton-secondaire", "bouton-discret"] as const).map((rang) => (
            <div key={rang} className="flex flex-col gap-2">
              <span className="text-legende font-semibold text-encre-3">
                {rang === "bouton-principal" ? "Principal" : rang === "bouton-secondaire" ? "Secondaire" : "Discret"}
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TONS.map((t) => (
                  <button
                    key={t.nom}
                    type="button"
                    className={cn(rang, t.ton, "flex h-11 items-center justify-center text-[14px] font-semibold")}
                  >
                    {t.geste}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <span className="text-legende font-semibold text-encre-3">Ronds et éteint</span>
            <div className="flex flex-wrap items-center gap-2">
              <BoutonRetour onRetour={() => undefined} titre="l'exemple" />
              <button type="button" aria-label="Envoyer" className="bouton-principal grid size-11 place-items-center">
                ↑
              </button>
              <button type="button" disabled className="bouton-principal flex h-11 items-center px-5 text-[14px] font-semibold">
                Éteint
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-champ bg-[#e9eae6] p-3">
            <span className="text-legende font-semibold text-[#5c5d59]">Sur la Map (pareil dans les deux modes)</span>
            <div className="flex items-center gap-2">
              <button type="button" className="bouton-encre bouton--vert flex h-11 items-center px-[18px] text-[15px] font-semibold">
                Ouvrir un match
              </button>
              <button type="button" aria-label="Recherche" className="bouton-givre grid size-10 place-items-center">
                ⌕
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Etiquette>Fiches et tuiles</Etiquette>
        <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-foreground/10">
            <ChevronRight className="size-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-lecture font-semibold">Tuile de verre</span>
            <span className="block text-petit text-encre-3">.glass : une rangée qui mène quelque part</span>
          </span>
          <ChevronRight className="size-4 text-encre-3" />
        </div>
        <div className="glass-soft flex flex-col gap-1 rounded-tuile p-4">
          <span className="mono-label text-encre-3">Fiche douce</span>
          <span className="text-titre font-bold tracking-tight">.glass-soft</span>
          <span className="text-corps text-encre-2">Une fiche posée sur la page, sans ombre.</span>
        </div>
        <div className="flex flex-col gap-1 rounded-tuile bg-card p-4">
          <span className="mono-label text-encre-3">Surface</span>
          <span className="text-titre font-bold tracking-tight">bg-card</span>
          <span className="text-corps text-encre-2">La surface pleine, pour une liste longue.</span>
        </div>
        <button
          type="button"
          onClick={() => setFeuille(true)}
          className="bouton-secondaire flex h-11 items-center justify-center text-[14px] font-semibold"
        >
          Ouvrir une feuille
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <Etiquette>Champs</Etiquette>
        <div className="glass-soft flex flex-col gap-4 rounded-tuile p-4">
          <Input placeholder="Ton prénom" />
          <label className="flex items-center justify-between gap-3">
            <span className="text-lecture font-semibold">Notifications</span>
            <Switch checked={interrupteur} onCheckedChange={setInterrupteur} />
          </label>
        </div>
      </section>

      <Sheet open={feuille} onOpenChange={setFeuille}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="text-titre-m font-bold tracking-tight">La feuille</SheetTitle>
            <SheetDescription>
              Elle monte du bas, sur le fond des feuilles, avec la poignée et la croix.
            </SheetDescription>
          </SheetHeader>
          <button
            type="button"
            onClick={() => setFeuille(false)}
            className="bouton-principal bouton--vert flex h-12 items-center justify-center text-[15px] font-semibold"
          >
            Continuer
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return <h2 className="mono-label px-1 text-encre-3">{children}</h2>;
}

function Specimen({ nom, classe, children }: { nom: string; classe: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3 text-legende text-encre-3">
        <span className="font-semibold">{nom}</span>
        <span className="font-mono">{classe}</span>
      </span>
      <div>{children}</div>
    </div>
  );
}

function Gris() {
  return (
    <div className="glass-soft mt-2 flex flex-col gap-2.5 rounded-tuile p-4">
      <span className="text-legende font-semibold text-encre-3">Les gris du texte (ils suivent l&apos;encre)</span>
      {GRIS.map((g) => (
        <div key={g.classe} className="flex items-baseline justify-between gap-3">
          <span className={cn("text-lecture font-semibold", g.classe)}>
            {g.nom} · {g.part}
          </span>
          <span className="text-petit text-encre-3">{g.role}</span>
        </div>
      ))}
    </div>
  );
}

/** En pixels, pour le curseur : « 1rem » vaut 16. */
function enPixels(v: string) {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return 0;
  return v.trim().endsWith("rem") ? n * 16 : n;
}

function hexa(v: string) {
  const m = v.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1];
  return h.length === 3 ? `#${h.split("").map((c) => c + c).join("")}` : `#${h}`;
}

function LigneReglage({
  r,
  valeur,
  change,
  onChange,
  onRemettre,
}: {
  r: Reglage;
  valeur: string;
  change: boolean;
  onChange: (v: string) => void;
  onRemettre: () => void;
}) {
  const [texte, setTexte] = useState(valeur);
  // La valeur affichée suit l'essai (remis à zéro ailleurs, autre onglet).
  const [suivie, setSuivie] = useState(valeur);
  if (suivie !== valeur) {
    setSuivie(valeur);
    setTexte(valeur);
  }
  const px = useMemo(() => enPixels(valeur), [valeur]);
  const h = hexa(valeur);

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <div className="flex items-center gap-3">
        <Apercu r={r} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-lecture font-semibold">{r.libelle}</span>
            {change && <span className="size-1.5 rounded-full bg-vert" aria-label="essayé" />}
          </span>
          <span className="block truncate text-petit text-encre-3">{r.role}</span>
        </span>
        {change && (
          <button type="button" onClick={onRemettre} aria-label={`Remettre ${r.libelle}`} className="bouton-discret p-1.5">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {r.famille === "couleur" ? (
          <input
            type="color"
            aria-label={`Couleur ${r.libelle}`}
            value={h ?? "#000000"}
            disabled={!h}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-petit border border-border bg-transparent p-0.5 disabled:opacity-30"
          />
        ) : (
          <input
            type="range"
            aria-label={`${r.libelle} en pixels`}
            min={r.famille === "taille" ? 7 : 0}
            max={r.famille === "taille" ? 64 : 40}
            step={r.famille === "taille" ? 0.5 : 1}
            value={px}
            onChange={(e) => onChange(`${e.target.value}px`)}
            className="min-w-0 flex-1 accent-[var(--foreground)]"
          />
        )}
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onBlur={() => texte.trim() && texte !== valeur && onChange(texte.trim())}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          spellCheck={false}
          className={cn(
            "h-9 rounded-petit border border-border bg-transparent px-2.5 font-mono text-[12px] outline-none focus:border-foreground/40",
            r.famille === "couleur" ? "min-w-0 flex-1" : "w-[76px] shrink-0",
          )}
        />
      </div>
    </div>
  );
}

function Apercu({ r }: { r: Reglage }) {
  if (r.famille === "couleur") {
    return (
      <span
        className="size-10 shrink-0 rounded-champ border border-border"
        style={{ background: `var(${r.nom})` }}
        aria-hidden
      />
    );
  }
  if (r.famille === "taille") {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center overflow-hidden font-semibold leading-none"
        style={{ fontSize: `min(var(${r.nom}), 30px)` }}
        aria-hidden
      >
        Aa
      </span>
    );
  }
  return (
    <span
      className="size-10 shrink-0 border-2 border-foreground/50 bg-foreground/5"
      style={{ borderRadius: `var(${r.nom})` }}
      aria-hidden
    />
  );
}
