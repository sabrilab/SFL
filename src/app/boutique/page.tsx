// Section Boutique — récompenses réelles payables en points, drops limités.
// Verrouillée : décision de l'admin, on ne l'ouvre pas encore (paiements,
// stocks et échelle de points à définir). L'aperçu montre l'intention.

import { Locked } from "@/components/sfl/locked";

const DROPS = [
  { tag: "MAILLOT", name: "Maillot SFL · domicile", note: "Floqué à ton nom et ton numéro", pts: "2 900 pts" },
  { tag: "SURVÊT", name: "Survêt club · veste + bas", note: "Édition Sunday Five League", pts: "4 400 pts" },
  { tag: "MONTRE", name: "Montre SFL · série verte", note: "Cadran noir mat · 200 pièces", pts: "6 300 pts" },
];

export default function Boutique() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight">Boutique</h1>
        <p className="text-sm text-muted-foreground">
          Maillots, survêts, montres — payables avec les points gagnés sur le terrain.
        </p>
      </div>

      <Locked
        label="Bientôt"
        note="La boutique ouvrira plus tard : les prix en points, les stocks et les drops sont encore à caler."
      >
        <div className="flex flex-col gap-2.5">
          {DROPS.map((d) => (
            <div key={d.name} className="flex items-center gap-4 rounded-3xl bg-card p-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-foreground/10 text-[10px] font-bold tracking-widest text-muted-foreground">
                {d.tag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{d.name}</span>
                <span className="block text-[13px] text-muted-foreground">{d.note}</span>
              </span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums">{d.pts}</span>
            </div>
          ))}
          <div className="rounded-3xl bg-card p-4 text-center text-[13px] font-semibold text-muted-foreground">
            Drop de la semaine · chaque dimanche
          </div>
        </div>
      </Locked>
    </div>
  );
}
