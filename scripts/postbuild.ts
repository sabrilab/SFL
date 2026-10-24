// Postbuild — exécuté après chaque `npm run build` réussi (donc à chaque
// déploiement Vercel qui a construit). En production seulement : pose la
// version qui part en ligne dans public.mises_en_ligne, d'où Admin →
// Activité tire ses repères « App » sous les courbes de croissance
// (lib/sfl/mises-en-ligne.ts). Sabri, 24/10 : « voir rapidement les actions
// qui ont été faites à ce moment-là de la part de l'application ».
//
// Le titre est celui du commit, donc de la PR fusionnée (« Parrainage : … »).
// Un commit qui ne touche pas l'app (docs, outils) n'est pas noté. Le
// prébuild a déjà migré le schéma : la table existe.
//
// N'échoue JAMAIS le build : sans base joignable, il le dit et s'arrête.

import { execFileSync } from "node:child_process";
import { noterMiseEnLigne } from "../src/lib/server/migrate";
import { decouperCommit, TOUCHE_L_APP } from "../src/lib/sfl/mises-en-ligne";

/** Les fichiers du commit (contre son premier parent) ; null si git ne le sait pas (clone trop court). */
function fichiers(sha: string): string[] | null {
  try {
    return execFileSync("git", ["diff", "--name-only", `${sha}~1`, sha], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

async function noter(): Promise<string> {
  if (process.env.VERCEL_ENV !== "production") return "hors production — rien à noter";
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  const { titre, pr } = decouperCommit(process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "");
  if (!sha || !titre) return "commit sans titre — rien à noter";
  const touche = fichiers(sha);
  if (touche && !touche.some((f) => TOUCHE_L_APP.test(f))) return "rien de l'app dans ce commit — pas de repère";
  const r = await noterMiseEnLigne({ sha, titre, pr });
  return {
    notee: `notée ✓ (${sha.slice(0, 7)}${pr ? `, #${pr}` : ""})`,
    deja: "déjà notée ✓",
    "not-configured": "base non configurée — sautée",
    error: `impossible (${r.message}) — le build reste bon`,
  }[r.status];
}

noter()
  .then((m) => console.log(`[mises en ligne] ${m}`))
  .catch((e) => console.log(`[mises en ligne] imprévu (${e}) — le build reste bon`));
