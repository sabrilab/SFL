"use client";

// Une conversation privée, sa page (/messages/<lui>) : ouverte depuis la
// liste des messages, le bouton « Écrire » d'une carte ou d'un profil, ou la
// notification d'un message. Tout est dans components/sfl/messages/conversation.tsx.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Conversation } from "@/components/sfl/messages/conversation";
import { nomDeId } from "@/lib/sfl/comptes";
import { DEMO_PRIVES, filDemoPrive } from "@/lib/sfl/messages-prives";
import { supabase } from "@/lib/supabase";

export default function ConversationPage() {
  const avec = decodeURIComponent(String(useParams<{ avec: string }>().avec ?? ""));
  const demo = useMemo(
    () =>
      DEMO_PRIVES && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "prives"
        ? filDemoPrive(avec)
        : null,
    [avec]
  );
  // Son nom : le cache des comptes de la ligue, sinon la base (un joueur Bola).
  const [nom, setNom] = useState(() => (demo ? avec : (nomDeId(avec) ?? "")));
  useEffect(() => {
    if (demo || nom) return;
    let vivant = true;
    void (async () => {
      const { data } = await supabase().from("profiles").select("name").eq("id", avec).maybeSingle();
      if (vivant && data) setNom((data as { name: string }).name);
    })();
    return () => {
      vivant = false;
    };
  }, [avec, demo, nom]);

  return <Conversation key={avec} avec={avec} nom={nom} demo={demo} />;
}
