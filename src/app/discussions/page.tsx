// Section Discussions — les canaux du vestiaire, façon Discord.
// Verrouillée : le chat exige les comptes joueurs et le temps réel (Supabase).
// On montre l'aperçu pour donner envie, sans y donner accès.

import { Hash, Megaphone, Shirt } from "lucide-react";
import { Locked } from "@/components/sfl/locked";

const CHANNELS = [
  {
    icon: Shirt,
    name: "Le vestiaire",
    last: "Karim : Dimanche on remet ça. Il me manque deux joueurs…",
    unread: 3,
  },
  {
    icon: Hash,
    name: "Ligue générale",
    last: "Sofiane : la reprise de volée à la 88e 🔥",
    unread: 12,
  },
  {
    icon: Megaphone,
    name: "Annonces",
    last: "Convocation J9 — dimanche 16 août, 13h00",
    unread: 1,
  },
];

export default function Discussions() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight">Discussions</h1>
        <p className="text-sm text-muted-foreground">
          Les canaux de la ligue — en privé, par équipe, ou tous ensemble.
        </p>
      </div>

      <Locked
        label="Bientôt"
        note="La discussion ouvrira avec les comptes joueurs : chacun devra récupérer son profil pour écrire au vestiaire."
      >
        <div className="flex flex-col gap-2.5">
          {CHANNELS.map((c) => (
            <div key={c.name} className="flex items-center gap-3.5 rounded-3xl bg-card p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/10">
                <c.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{c.name}</span>
                <span className="block truncate text-[13px] text-muted-foreground">{c.last}</span>
              </span>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {c.unread}
              </span>
            </div>
          ))}
          <div className="rounded-3xl bg-card p-4">
            <div className="h-10 rounded-full bg-foreground/8 px-4 text-[14px] leading-10 text-muted-foreground">
              Balance ton avis…
            </div>
          </div>
        </div>
      </Locked>
    </div>
  );
}
