// Bola Agent — SERVEUR. Un joueur connecté pose une question à son coach ;
// la route la pose à Claude avec son dossier (ses stats de la saison, de la
// meilleure à la pire, son dernier match) et la conversation récente, puis
// rend un texte court et des cartes que l'écran dessine (lib/sfl/agent.ts).
//
// La clé (ANTHROPIC_API_KEY) ne quitte jamais le serveur : elle n'existe que
// dans les variables du projet Vercel, posées par Sabri. Sans elle, GET répond
// { pret: false } et l'écran garde le champ fermé.
//
// Le crédit est celui de Sabri : chaque question est notée dans la table
// agent_messages (avec la réponse) et un joueur s'arrête à LIMITE_AGENT_JOUR
// questions sur 24 h. Sans la table (aperçus Vercel, que le schéma ne migre
// pas), la conversation n'est pas gardée et rien n'est compté.
//
// Modèle : Claude Opus 5.5 (le plus récent), effort bas : c'est une
// conversation, pas un problème difficile. ANTHROPIC_MODEL le change.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  HISTORIQUE_MAX,
  LIMITE_AGENT_JOUR,
  QUESTION_MAX,
  TYPES_CARTE,
  lireCartes,
  type CarteCoach,
} from "@/lib/sfl/agent";
import { STAT_KEYS } from "@/lib/sfl/engine";

export const maxDuration = 90;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const DOSSIER_MAX = 8000;

const CONSIGNES = `Tu es Bola Agent, le coach personnel d'un joueur de la SFL, une ligue de foot à cinq amateur entre potes (un match le dimanche, des journées de plusieurs matchs). Tu es à la fois son coach sportif, son préparateur physique, son nutritionniste et son kiné de poche, ceux qu'on paie d'habitude.

Ta façon de parler : en français, tu le tutoies, comme un coach de terrain qui le connaît. Direct, chaleureux, concret. Pas de jargon, pas de formule creuse, pas de flatterie. Le texte de ta réponse tient en une à trois phrases ; tout ce qui est une liste (exercices, séances, courses, points du débrief) va dans des cartes.

Ce que tu sais de lui : son dossier, plus bas, calculé sur la saison en cours. Ses six stats de carte (Vitesse, Tir, Passe, Dribble, Défense, Physique, sur 99) sont rangées de la meilleure à la pire. Appuie-toi sur ces chiffres, n'en invente pas d'autres. S'il manque une info utile (son âge, son matériel, ses horaires, son budget, une douleur), demande-la en une question.

Ce que tu fais :
- Points faibles : pars de ses stats les plus basses et donne-lui de quoi les travailler. Exercices faisables seul ou à deux, au city ou au parc près de chez lui, sans matériel ou avec un ballon, des plots, un élastique. Un programme, c'est des séances datées dans la semaine (« Lundi », « Mercredi »…) avec durée, séries, répétitions, récupération.
- Débrief : après un match, demande comment ça s'est passé, écoute, puis rends un débrief : ce qui a marché, ce qui a coincé, une chose à travailler avant dimanche.
- Nutrition : repas, récupération, hydratation, avant et après match. Quand il demande ses courses, fais un panier précis (produit, quantité, prix estimé en euros dans un supermarché français) avec le total estimé en sous-titre ; dis que les prix sont estimés.
- Santé et blessures : conseils généraux, échauffement, prévention, rééducation douce par étapes (exercices, fréquence par jour, quand passer à l'étape suivante). Tu ne poses jamais de diagnostic. Douleur forte, gonflement important, impossible de poser le pied, craquement, douleur qui dure plus de quelques jours ou qui revient au match : tu lui dis clairement d'aller voir un médecin ou un kiné, avant tout exercice.

Les cartes : chaque carte a un type (programme, exercice, debrief, panier, sante, bilan), un titre court, un sous-titre (« 3 séances · 45 min », « Total ≈ 38 € » ; vide sinon), une cible (la stat travaillée : VIT, TIR, PAS, DRI, DEF ou PHY ; vide sinon) et des lignes. Chaque ligne : label (le nom de l'exercice, du produit, du point), detail (la consigne en une phrase ; vide sinon), valeur (« 4 × 30 s », « 1 kg · 2,10 € », « 2×/jour » ; vide sinon). Au plus deux cartes par réponse, au plus huit lignes par carte. Pas de carte pour une simple discussion.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["texte", "cartes"],
  properties: {
    texte: { type: "string" },
    cartes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "titre", "sousTitre", "cible", "lignes"],
        properties: {
          type: { type: "string", enum: [...TYPES_CARTE] },
          titre: { type: "string" },
          sousTitre: { type: "string" },
          cible: { type: "string", enum: [...STAT_KEYS, ""] },
          lignes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "detail", "valeur"],
              properties: {
                label: { type: "string" },
                detail: { type: "string" },
                valeur: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

interface Tour {
  role: "joueur" | "coach";
  texte: string;
  cartes?: CarteCoach[];
}

function erreur(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Ce que le modèle relit d'un tour du coach : son texte et ses cartes, en clair. */
function enClair(t: Tour): string {
  if (t.role === "joueur" || !t.cartes?.length) return t.texte;
  const cartes = t.cartes.map(
    (c) => `[${c.type}] ${c.titre}${c.sousTitre ? ` (${c.sousTitre})` : ""}\n${c.lignes.map((l) => `- ${l.label}${l.valeur ? ` : ${l.valeur}` : ""}${l.detail ? ` — ${l.detail}` : ""}`).join("\n")}`
  );
  return [t.texte, ...cartes].filter(Boolean).join("\n\n");
}

/** La conversation pour l'API : commence par le joueur, alterne, finit par sa question. */
function messagesPour(historique: Tour[], question: string) {
  const tours = [...historique, { role: "joueur" as const, texte: question }];
  while (tours.length && tours[0].role !== "joueur") tours.shift();
  const sortie: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of tours) {
    const role = t.role === "joueur" ? "user" : "assistant";
    const texte = enClair(t).trim();
    if (!texte) continue;
    const prec = sortie[sortie.length - 1];
    if (prec?.role === role) prec.content += `\n\n${texte}`;
    else sortie.push({ role, content: texte });
  }
  return sortie;
}

export async function GET() {
  return NextResponse.json({ pret: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  const cle = process.env.ANTHROPIC_API_KEY;
  if (!cle) return erreur("Bola Agent n'est pas encore branché.", 503);

  const corps = (await req.json().catch(() => ({}))) as {
    accessToken?: string;
    question?: unknown;
    dossier?: unknown;
    historique?: unknown;
    /** La question d'ouverture du coach après un match, pas encore gardée. */
    ouverture?: unknown;
  };
  if (!corps.accessToken) return erreur("Session requise.", 401);
  const question = typeof corps.question === "string" ? corps.question.trim() : "";
  if (!question || question.length > QUESTION_MAX) return erreur("Question vide ou trop longue.", 400);
  const dossier = JSON.stringify(corps.dossier ?? {});
  if (dossier.length > DOSSIER_MAX) return erreur("Dossier trop long.", 400);
  const historique: Tour[] = Array.isArray(corps.historique)
    ? corps.historique
        .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
        .filter((t) => (t.role === "joueur" || t.role === "coach") && typeof t.texte === "string")
        .slice(-HISTORIQUE_MAX)
        .map((t) => ({ role: t.role as Tour["role"], texte: String(t.texte).slice(0, 4000), cartes: lireCartes(t.cartes) }))
    : [];

  // L'appelant : un joueur accepté, avec ses propres droits (RLS).
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${corps.accessToken}` } },
  });
  const { data: auth, error: authError } = await sb.auth.getUser(corps.accessToken);
  if (authError || !auth.user) return erreur("Session invalide.", 401);
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", auth.user.id).maybeSingle();
  if (!profil?.valide) return erreur("Ton compte attend d'être accepté.", 403);

  // Le crédit : LIMITE_AGENT_JOUR questions sur 24 h glissantes.
  const depuis = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: compteError } = await sb
    .from("agent_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .eq("role", "joueur")
    .gte("created_at", depuis);
  // 42P01 : la table n'existe pas (aperçu sans migration) ; on répond sans garder.
  const sansTable = compteError?.code === "42P01" || compteError?.code === "PGRST205";
  if (compteError && !sansTable) return erreur("Bola Agent indisponible pour l'instant.", 503);
  if ((count ?? 0) >= LIMITE_AGENT_JOUR) return erreur("On a assez parlé pour aujourd'hui. Reviens demain.", 429);
  // Notée AVANT l'appel : deux questions simultanées comptent toutes les deux.
  const ouverture = typeof corps.ouverture === "string" ? corps.ouverture.trim().slice(0, 300) : "";
  if (!sansTable) {
    const lignes = [...(ouverture ? [{ role: "coach", texte: ouverture }] : []), { role: "joueur", texte: question }];
    const { error } = await sb.from("agent_messages").insert(lignes);
    if (error) return erreur("Bola Agent indisponible pour l'instant.", 503);
  }

  const contexte = [
    `Aujourd'hui : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })}.`,
    `Dossier du joueur (JSON) :\n${dossier}`,
    ouverture ? "Tu viens de lui demander comment s'était passé son dernier match (dossier.dernierMatch) : sa réponse arrive." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": cle,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELE,
        max_tokens: 8000,
        // Les consignes ne changent pas d'une question à l'autre : en cache.
        system: [
          { type: "text", text: CONSIGNES, cache_control: { type: "ephemeral" } },
          { type: "text", text: contexte },
        ],
        messages: messagesPour(ouverture ? [...historique, { role: "coach", texte: ouverture }] : historique, question),
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        fallbacks: "default",
      }),
    });
    if (!r.ok) {
      console.error("[agent] anthropic", r.status, (await r.text()).slice(0, 500));
      return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
    }
    const sortie = (await r.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (sortie.stop_reason === "refusal") return erreur("Le coach ne peut pas répondre à ça.", 422);
    const brut = sortie.content?.find((b) => b.type === "text")?.text ?? "";
    let lu: { texte?: unknown; cartes?: unknown };
    try {
      lu = JSON.parse(brut);
    } catch {
      console.error("[agent] réponse illisible", sortie.stop_reason, brut.slice(0, 300));
      return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
    }
    const texte = typeof lu.texte === "string" ? lu.texte.trim().slice(0, 4000) : "";
    const cartes = lireCartes(lu.cartes);
    if (!texte && !cartes.length) return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
    if (!sansTable) await sb.from("agent_messages").insert({ role: "coach", texte, cartes });
    return NextResponse.json({ texte, cartes, garde: !sansTable });
  } catch (e) {
    console.error("[agent]", e);
    return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
  }
}
