"use client";

// Création d'une convocation : jour, date, heure, lieu. La publication clôt
// automatiquement la convocation précédente (une seule ouverte à la fois).

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Convocation } from "@/lib/sfl/saisie/types";

type ConvocationInfo = Pick<Convocation, "jour" | "date" | "heure" | "lieu">;

export function ConvocationSheet({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (info: ConvocationInfo) => void;
}) {
  const [info, setInfo] = useState<ConvocationInfo>({
    jour: "Dimanche",
    date: "",
    heure: "13h00",
    lieu: "Terrain extérieur — 5 vs 5",
  });
  const valid = info.date.trim() !== "" && info.heure.trim() !== "" && info.lieu.trim() !== "";

  const field = (label: string, key: keyof ConvocationInfo, placeholder: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <Input
        value={info[key]}
        placeholder={placeholder}
        onChange={(e) => setInfo((p) => ({ ...p, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="px-1">
          <SheetTitle className="text-xl">Nouvelle convocation</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-1 pb-8">
          <div className="grid grid-cols-2 gap-3">
            {field("Jour", "jour", "Dimanche")}
            {field("Date", "date", "26 juillet")}
            {field("Heure", "heure", "13h00")}
            {field("Lieu", "lieu", "Terrain…")}
          </div>
          <p className="text-xs text-muted-foreground">
            Publier remplace la convocation ouverte précédente. Les joueurs répondent depuis
            l&apos;accueil de l&apos;app ; leurs confirmations pré-remplissent la journée.
          </p>
          <Button disabled={!valid} onClick={() => valid && onCreate(info)} className="font-semibold">
            <Send className="mr-1.5 size-4" /> Publier la convocation
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
