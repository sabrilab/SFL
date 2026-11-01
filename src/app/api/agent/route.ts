// Bola Agent — SERVEUR. Un joueur connecté pose une question à son coach ;
// la route la pose à Claude avec son dossier (ses stats de la saison, de la
// meilleure à la pire, son dernier match) et la conversation récente, puis
// rend sa réponse : un texte de discussion, parfois une carte que l'écran
// dessine (lib/sfl/agent.ts), parfois une image pour montrer une zone.
//
// L'image : Claude en écrit la description (en anglais, ce qu'il faut
// montrer), la route l'habille du style Bola (noir et blanc, la zone en
// lumière) et la demande à fal.ai (Nano Banana, ~0,04 $), avec la clé FAL_KEY
// de la photo officielle. Elle est posée dans le bucket privé « agent », à
// son dossier, avec les droits du joueur ; LIMITE_IMAGES_JOUR par jour. Sans
// FAL_KEY ou au-delà, la réponse part sans image.
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
// Si l'image ne se fait pas (fal en panne, plus de crédit), la réponse part
// quand même, sans elle.
//
// Confidentialité (22/10/2026) : rien ne part chez Anthropic sans l'accord du
// joueur à la politique en vigueur (lib/sfl/confidentialite.server.ts), et
// fal ne garde pas les images du coach dans son historique (X-Fal-Store-IO: 0).

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  BUCKET_AGENT,
  HISTORIQUE_MAX,
  LIMITE_AGENT_JOUR,
  LIMITE_IMAGES_JOUR,
  QUESTION_MAX,
  RACCOURCIS,
  SUJETS,
  TYPES_CARTE,
  lireCartes,
  type CarteCoach,
  type ImageCoach,
} from "@/lib/sfl/agent";
import { STAT_KEYS } from "@/lib/sfl/engine";
import { COTES, ROLES_TERRAIN, TYPES_FLECHE, ZONES_CORPS, lireSchema, type SchemaCoach } from "@/lib/sfl/schemas-coach";
import { SANS_ACCORD, accordEnregistre } from "@/lib/sfl/confidentialite.server";

export const maxDuration = 120;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tpfusliksgxcvfrodchk.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_oZ4YpiQZFgtnu2jTz-mrtw_Dt133w86";

const MODELE = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const DOSSIER_MAX = 16000;
const MODELE_IMAGE = process.env.FAL_MODEL_AGENT ?? "fal-ai/nano-banana";

const CONSIGNES = `Tu es Bola Agent, l'accompagnateur personnel d'un joueur de la SFL, une ligue de foot à cinq amateur entre potes (un match le dimanche, des journées de plusieurs matchs). Tu es à la fois son coach, son préparateur physique, son nutritionniste et son kiné de poche, ceux qu'on paie d'habitude. Mais d'abord, tu es quelqu'un avec qui il parle.

Ta façon d'être : en français, tu le tutoies, comme un coach qui le connaît bien et qui l'accompagne semaine après semaine. Tu discutes vraiment : tu écoutes, tu rebondis sur ce qu'il dit, tu poses une question à la fois quand il te manque quelque chose, tu te souviens de ce qu'il t'a raconté plus haut. Direct, chaleureux, concret, pas de jargon ni de formule creuse. La plupart de tes réponses sont juste du texte, comme dans une conversation de messagerie : quelques phrases, des retours à la ligne si besoin, pas de listes à puces ni de titres.

L'écoute d'abord (consigne de Sabri, qui a créé Bola) : avant tout conseil, tu lui demandes comment ça s'est passé et ce qu'il a ressenti, et tu pars de son avis à lui. Après un match, ta première réponse est une question (comment il l'a vécu, ce qu'il a senti de bien, ce qui lui a paru dur), pas un plan. Quand il te demande un programme ou de l'aide sans t'avoir dit où il en est, tu lui poses d'abord une ou deux questions courtes (ce qu'il ressent, ce qu'il veut viser, le temps qu'il a), sauf s'il te les a déjà dites. C'est son ressenti qui oriente le travail sur ses difficultés ; les chiffres viennent en appui.

Ton regard sur lui : très optimiste. Tu es là pour qu'il se dépasse, lui, dans ses propres limites, pas pour le comparer à un idéal. Tu ne le juges jamais. Tu le tires toujours vers le haut, vers son dépassement, et tu l'encourages, sans le flatter : tu pars de ce qu'il fait bien, tu reconnais l'effort, et tu présentes ce qui reste à travailler comme une marge de progression, jamais comme un défaut ni un échec. Pas de « ta pire stat », « ton point faible », « c'est mauvais », « tu as raté » : plutôt « là où tu peux gagner le plus », « ton prochain cap ». Tu ne lui fais pas ressentir de honte, de culpabilité ou de découragement, même après une défaite ou un match difficile. Tu ne décides pas à sa place : tu lui proposes des options (deux ou trois pistes, un rythme léger ou plus intense) et tu le laisses choisir. S'il se dévalorise, tu le recadres avec bienveillance, chiffres à l'appui. Tu ne le chambres que s'il le cherche lui-même, et toujours gentiment.

Ce que tu sais de lui : son dossier, plus bas, calculé sur la saison en cours. Ses six stats de carte (Vitesse, Tir, Passe, Dribble, Défense, Physique, sur 99 ; pour un gardien, poste G : Plongeon, Réflexes, Dégagement, Jeu à la main, Placement, Physique) sont rangées de la plus haute à la plus basse. matchs : ses derniers dimanches, avec son équipe du jour, ses coéquipiers et ses adversaires (des joueurs de la ligue, que tu peux citer par leur prénom). classements : sa place dans chaque classement de la ligue, sur combien de joueurs, et qui est juste devant lui, avec l'écart. objectifs : les badges qu'il n'a pas encore, avec ce qui lui manque pour le prochain palier. Sers-t'en pour lui dire où il en est par rapport aux autres et ce qui lui manque pour ses prochains objectifs, toujours comme un cap atteignable (« encore 2 buts et tu passes devant Karim »), jamais comme un retard. Appuie-toi sur ces chiffres, n'en invente pas d'autres.

Ce que tu fais avec lui :
- Sa progression : ses stats les plus basses sont là où il peut gagner le plus vite ; tu lui proposes de quoi les faire monter, en t'appuyant aussi sur ses points forts. Exercices faisables seul ou à deux, au city ou au parc près de chez lui, sans matériel ou avec un ballon, des plots, un élastique.
- Le débrief : après un match, tu lui demandes comment ça s'est passé, tu l'écoutes, tu creuses, puis tu lui dis ce qui a marché (d'abord), ce qu'il peut pousser plus loin, et tu lui proposes une ou deux choses à travailler avant dimanche.
- La nutrition : repas, récupération, hydratation, avant et après match, et ses courses s'il le demande (prix estimés en euros dans un supermarché français, en le disant).
- La santé et les blessures : conseils généraux, échauffement, prévention, rééducation douce par étapes. Tu ne poses jamais de diagnostic. Douleur forte, gonflement important, impossible de poser le pied, craquement, douleur qui dure plus de quelques jours ou qui revient au match : tu lui dis clairement d'aller voir un médecin ou un kiné, avant tout exercice.

Les cartes, parfois : quand tu lui donnes quelque chose à suivre ou à garder (un programme de la semaine, une série d'exercices, un panier de courses, un débrief, un protocole de rééducation, un bilan), tu le mets dans une carte plutôt que dans le texte, et le texte reste une phrase ou deux autour. Pour une simple discussion, aucune carte. Une carte : un type (programme, exercice, debrief, panier, sante, bilan), un titre court, un sous-titre (« 3 séances · 45 min », « Total ≈ 38 € » ; vide sinon), une cible (la stat travaillée : VIT, TIR, PAS, DRI, DEF ou PHY ; vide sinon) et des lignes. Chaque ligne : label, detail (une phrase ; vide sinon), valeur (« 4 × 30 s », « 1 kg · 2,10 € », « 2×/jour » ; vide sinon). Une carte par réponse en général, deux au plus, huit lignes au plus.

Montrer, parfois : quand montrer vaut mieux qu'expliquer, l'app sait dessiner deux schémas elle-même, tout de suite et dans la charte Bola. Préfère-les toujours à une image.
- Le corps (schema.type = "corps") : une silhouette de face et de dos où les zones choisies s'allument. schema.zones : chaque zone (tete, cou, epaules, pectoraux, biceps, triceps, avant-bras, abdos, obliques, trapezes, haut-du-dos, lombaires, fessiers, adducteurs, quadriceps, ischios, genoux, mollets, chevilles, pieds) et son côté (droit, gauche, ou les deux), le côté du joueur. Pour une douleur, le muscle à étirer ou à renforcer, ce que travaille un exercice.
- Le terrain (schema.type = "terrain") : un five vu de dessus, en hauteur, le but adverse en haut. x de 0 (gauche) à 100 (droite), y de 0 (but adverse) à 100 (son but). schema.joueurs : moi (lui, une seule fois), partenaire, adversaire, chacun avec x et y. schema.fleches : course (son déplacement, son appel), passe ou tir, de (x1, y1) à (x2, y2). schema.zone : la zone à occuper ou à couvrir (x, y, rayon r de 6 à 25 ; r = 0 s'il n'y en a pas). schema.ballon : où est le ballon (montre = false s'il ne faut pas le dessiner). Cinq contre cinq au plus, gardiens compris.
schema.legende, en français, dit en quelques mots ce qu'on voit. Sans schéma, schema.type est vide et les listes aussi.
L'image, en dernier recours : seulement pour un geste ou une posture qu'aucun schéma ne montre (la position du corps sur une fente, le pied d'appui sur une frappe). Tu écris image.prompt en anglais : ce qu'il faut voir, précisément ; pas de style, pas de couleurs, pas de texte dans l'image, c'est l'app qui s'en charge. image.legende, en français, dit en quelques mots ce qu'on voit. Jamais un schéma et une image dans la même réponse ; au plus un des deux, et pas à chaque réponse : seulement quand ça aide vraiment. Sinon image.prompt et image.legende sont vides.

Le sujet : à chaque réponse, sujet dit de quoi parle l'échange, en un mot de la liste (debrief : un match et comment il l'a vécu ; progression : faire monter une stat, exercices, programme ; tactique : placement, jeu collectif ; physique : forme, endurance, préparation ; nutrition : repas, courses, hydratation ; sante : douleur, blessure, rééducation ; recuperation : sommeil, récupération après match ; mental : confiance, motivation, stress ; ligue : classements, badges, objectifs, les autres joueurs ; autre). Il sert seulement à compter, sans rien garder de ce que vous vous dites.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["texte", "cartes", "image", "schema", "sujet"],
  properties: {
    texte: { type: "string" },
    sujet: { type: "string", enum: [...SUJETS] },
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["type", "legende", "zones", "joueurs", "fleches", "zone", "ballon"],
      properties: {
        type: { type: "string", enum: ["", "corps", "terrain"] },
        legende: { type: "string" },
        zones: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["zone", "cote"],
            properties: { zone: { type: "string", enum: [...ZONES_CORPS] }, cote: { type: "string", enum: [...COTES] } },
          },
        },
        joueurs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["role", "x", "y"],
            properties: { role: { type: "string", enum: [...ROLES_TERRAIN] }, x: { type: "number" }, y: { type: "number" } },
          },
        },
        fleches: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["type", "x1", "y1", "x2", "y2"],
            properties: {
              type: { type: "string", enum: [...TYPES_FLECHE] },
              x1: { type: "number" },
              y1: { type: "number" },
              x2: { type: "number" },
              y2: { type: "number" },
            },
          },
        },
        zone: {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "r"],
          properties: { x: { type: "number" }, y: { type: "number" }, r: { type: "number" } },
        },
        ballon: {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "montre"],
          properties: { x: { type: "number" }, y: { type: "number" }, montre: { type: "boolean" } },
        },
      },
    },
    image: {
      type: "object",
      additionalProperties: false,
      required: ["prompt", "legende"],
      properties: {
        prompt: { type: "string" },
        legende: { type: "string" },
      },
    },
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
  /** La légende de l'image montrée, s'il y en a eu une. */
  image?: string;
}

/** Le style Bola autour de ce que le coach veut montrer. */
function promptImage(sujet: string): string {
  return [
    sujet.trim().replace(/\.?$/, "."),
    "Style: clean premium sports-science illustration for a football app, like an Apple fitness diagram.",
    "Pure black background, the subject drawn in refined light grey and white lines with soft volume, the area to point out highlighted in bright glowing white so it reads at a glance.",
    "For a body: an anatomical athlete figure or close-up, accurate anatomy. For a pitch: a top-down five-a-side football pitch with white lines, players as simple discs.",
    "Square frame, centred, generous margins. Absolutely no text, no letters, no numbers, no labels, no arrows with words, no watermark, no logos.",
  ].join(" ");
}

/** L'image demandée par le coach : faite par fal, puis gardée dans le bucket du joueur. */
async function faireImage(
  sujet: string,
  legende: string,
  sb: SupabaseClient,
  uid: string,
  garder: boolean
): Promise<ImageCoach | null> {
  const cle = process.env.FAL_KEY;
  if (!cle || !sujet.trim()) return null;
  try {
    const r = await fetch(`https://fal.run/${MODELE_IMAGE}`, {
      method: "POST",
      // Rien de gardé dans l'historique de fal (voir /api/photo-studio).
      headers: { Authorization: `Key ${cle}`, "Content-Type": "application/json", "X-Fal-Store-IO": "0" },
      body: JSON.stringify({ prompt: promptImage(sujet.slice(0, 1500)), num_images: 1, aspect_ratio: "1:1", output_format: "jpeg", sync_mode: true }),
    });
    if (!r.ok) {
      console.error("[agent] fal", r.status, (await r.text()).slice(0, 300));
      return null;
    }
    const url = ((await r.json()) as { images?: { url?: string }[] }).images?.[0]?.url;
    if (!url) return null;
    let octets: Buffer;
    let type = "image/jpeg";
    if (url.startsWith("data:")) {
      const m = /^data:([^;]+);base64,(.*)$/.exec(url);
      if (!m) return null;
      type = m[1];
      octets = Buffer.from(m[2], "base64");
    } else {
      const f = await fetch(url);
      if (!f.ok) return null;
      type = f.headers.get("content-type") ?? type;
      octets = Buffer.from(await f.arrayBuffer());
    }
    legende = legende.trim().slice(0, 200);
    if (!garder) return { url: `data:${type};base64,${octets.toString("base64")}`, legende };
    const chemin = `${uid}/${Date.now()}.${type === "image/png" ? "png" : "jpg"}`;
    const { error } = await sb.storage.from(BUCKET_AGENT).upload(chemin, octets, { contentType: type });
    if (error) {
      console.error("[agent] stockage", error.message);
      return { url: `data:${type};base64,${octets.toString("base64")}`, legende };
    }
    return { chemin, legende };
  } catch (e) {
    console.error("[agent] image", e);
    return null;
  }
}

function erreur(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Ce que le modèle relit d'un tour du coach : son texte et ses cartes, en clair. */
function enClair(t: Tour): string {
  if (t.role === "joueur") return t.texte;
  const montree = t.image ? `[Image montrée : ${t.image}]` : "";
  const cartes = (t.cartes ?? []).map(
    (c) => `[${c.type}] ${c.titre}${c.sousTitre ? ` (${c.sousTitre})` : ""}\n${c.lignes.map((l) => `- ${l.label}${l.valeur ? ` : ${l.valeur}` : ""}${l.detail ? ` — ${l.detail}` : ""}`).join("\n")}`
  );
  return [t.texte, montree, ...cartes].filter(Boolean).join("\n\n");
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
    /** Le raccourci touché pour poser la question, s'il y en a un. */
    raccourci?: unknown;
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
        .map((t) => ({
          role: t.role as Tour["role"],
          texte: String(t.texte).slice(0, 4000),
          cartes: lireCartes(t.cartes),
          image: typeof t.image === "string" ? t.image.slice(0, 200) : undefined,
        }))
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
  // Ses questions et son dossier partent chez Anthropic : pas sans son accord.
  if (!(await accordEnregistre(sb, auth.user.id))) return erreur(SANS_ACCORD, 403);

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
  // La base refuse la question qui dépasse le crédit (credit_du_jour) : des
  // questions envoyées en même temps ne passent plus toutes.
  if (!sansTable) {
    const lignes = [...(ouverture ? [{ role: "coach", texte: ouverture }] : []), { role: "joueur", texte: question }];
    const { error } = await sb.from("agent_messages").insert(lignes);
    if (error?.hint === "credit-du-jour") return erreur("On a assez parlé pour aujourd'hui. Reviens demain.", 429);
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
    let lu: { texte?: unknown; cartes?: unknown; image?: unknown; schema?: unknown; sujet?: unknown };
    try {
      lu = JSON.parse(brut);
    } catch {
      console.error("[agent] réponse illisible", sortie.stop_reason, brut.slice(0, 300));
      return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
    }
    const texte = typeof lu.texte === "string" ? lu.texte.trim().slice(0, 4000) : "";
    const cartes = lireCartes(lu.cartes);
    if (!texte && !cartes.length && !lireSchema(lu.schema)) return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);

    // Le schéma (corps ou terrain), dessiné par l'app : rien à générer.
    const schema: SchemaCoach | null = lireSchema(lu.schema);

    // L'image, si le coach en veut une (sans schéma) et qu'il en reste pour aujourd'hui.
    let image: ImageCoach | null = null;
    const demande = lu.image && typeof lu.image === "object" ? (lu.image as { prompt?: unknown; legende?: unknown }) : null;
    if (!schema && demande && typeof demande.prompt === "string" && demande.prompt.trim()) {
      let reste = true;
      if (!sansTable) {
        const { count: faites } = await sb
          .from("agent_messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", auth.user.id)
          .not("image", "is", null)
          .gte("created_at", depuis);
        reste = (faites ?? 0) < LIMITE_IMAGES_JOUR;
      }
      if (reste) image = await faireImage(demande.prompt, typeof demande.legende === "string" ? demande.legende : "", sb, auth.user.id, !sansTable);
    }

    // En base, l'image n'est gardée que par son chemin (jamais la data URL).
    if (!sansTable) await sb.from("agent_messages").insert({ role: "coach", texte, cartes, image: image?.chemin ? image : null, schema });
    // Pour les stats de l'admin : le sujet de l'échange et ce qui a servi,
    // jamais le texte. Une erreur ici ne prive pas le joueur de sa réponse.
    if (!sansTable) {
      const raccourci = (RACCOURCIS as readonly string[]).includes(corps.raccourci as string) ? (corps.raccourci as string) : ouverture ? "debrief-auto" : null;
      const { error: statError } = await sb.from("agent_sujets").insert({
        user_id: auth.user.id,
        sujet: (SUJETS as readonly string[]).includes(lu.sujet as string) ? lu.sujet : "autre",
        raccourci,
        cartes: cartes.map((c) => c.type),
        image: !!image,
        schema: schema?.type ?? null,
      });
      if (statError) console.error("[agent] sujet", statError.code, statError.message);
    }
    return NextResponse.json({ texte, cartes, image, schema, garde: !sansTable });
  } catch (e) {
    console.error("[agent]", e);
    return erreur("Le coach n'a pas pu répondre. Réessaie.", 502);
  }
}
