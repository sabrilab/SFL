#!/usr/bin/env node
// Bola 27 (bola-app#33) : sert en local le site construit par construire.mjs, pour l'essayer avant de le publier.
// Un serveur de fichiers de Node, sans dépendance : les mêmes règles que le futur projet Vercel (vercel.json) :
// un dossier sert son index.html (/ et /jouer), les en-têtes de sécurité de l'app, les fichiers à empreinte de
// /bola27/ gardés en cache, le reste revalidé. Il n'écoute que sur 127.0.0.1.
//
//   node tools/bola27/servir.mjs [--dossier out/bola27] [--port 3957]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : defaut;
};
const DOSSIER = resolve(process.cwd(), option("--dossier", join(RACINE, "out", "bola27")));
const PORT = Number(option("--port", "3957"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".pak": "application/octet-stream",
};

if (!existsSync(join(DOSSIER, "index.html"))) {
  console.error(`Bola 27 : rien à servir dans ${DOSSIER} (lancer d'abord node tools/bola27/construire.mjs).`);
  process.exit(1);
}

function fichier(url) {
  let chemin;
  try {
    chemin = decodeURIComponent(new URL(url, "http://local").pathname);
  } catch {
    return null;
  }
  const f = normalize(join(DOSSIER, chemin));
  if (f !== DOSSIER && !f.startsWith(DOSSIER + sep)) return null; // pas de sortie du dossier
  if (existsSync(f) && statSync(f).isFile()) return f;
  const index = join(f, "index.html");
  if (existsSync(index)) return index;
  return null;
}

createServer((req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const f = fichier(req.url ?? "/");
  if (!f) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Introuvable\n");
    return;
  }
  const empreinte = f.startsWith(join(DOSSIER, "bola27") + sep);
  res.writeHead(200, {
    "Content-Type": TYPES[extname(f)] ?? "application/octet-stream",
    "Content-Length": statSync(f).size,
    "Cache-Control": empreinte ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(f).pipe(res);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Bola 27 : ${DOSSIER} servi sur http://127.0.0.1:${PORT}/`);
});
