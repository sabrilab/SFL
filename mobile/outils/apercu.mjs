/**
 * L'aperçu de l'app, pour pouvoir la regarder sans téléphone.
 *
 * Le serveur de développement d'Expo sert aussi l'app en web (react-native-web).
 * Ce script ouvre cette version dans un navigateur sans fenêtre, joue une suite
 * de scènes — ouvrir une fiche, rejoindre, répondre à la convocation… — et
 * enregistre une capture de chacune, plus une planche contact.
 *
 * Ce n'est PAS le rendu iOS. Trois choses diffèrent et c'est à retenir en
 * regardant les images :
 *   - la barre d'onglets native passe en haut et recouvre le titre (en vrai
 *     elle est en bas et ne recouvre rien) ;
 *   - le verre du système devient une surface opaque ;
 *   - les feuilles natives deviennent des pages entières.
 * Tout le reste — mise en page, typographie, couleurs, textes, comportement —
 * est fidèle, et c'est ce qu'on vient vérifier ici.
 *
 * Usage :
 *   npx expo start --web --port 8081     # dans un terminal, laissé tourner
 *   node outils/apercu.mjs               # dans un autre, autant de fois qu'on veut
 *   node outils/apercu.mjs jouer ligue   # ou seulement certaines scènes
 *
 * Le rafraîchissement d'Expo étant automatique, il n'y a rien à reconstruire
 * entre deux modifications : on réexécute ce script, c'est tout.
 */
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const BASE = process.env.APERCU_URL ?? 'http://localhost:8081';
const SORTIE = path.resolve('.apercu');
/** iPhone 16 : la taille de référence de la DA. */
const ECRAN = { width: 393, height: 852 };

const require_ = createRequire(import.meta.url);
async function chargerPlaywright() {
  const pistes = [
    'playwright',
    'playwright-core',
    '/opt/node22/lib/node_modules/playwright/index.mjs',
  ];
  for (const p of pistes) {
    try {
      return p.startsWith('/') ? await import(p) : require_(p);
    } catch {
      /* on essaie la suivante */
    }
  }
  throw new Error(
    "Playwright est introuvable. Installe-le avec `npm i -D playwright` " +
      "puis `npx playwright install chromium`.",
  );
}

/** Chromium peut être fourni par le système plutôt que par Playwright. */
function cheminChromium() {
  const dossier = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!dossier) return undefined;
  try {
    const trouve = readdirSync(dossier).find((d) => d.startsWith('chromium-'));
    return trouve ? path.join(dossier, trouve, 'chrome-linux', 'chrome') : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Les scènes. Chacune part de l'écran d'accueil et joue un parcours réel :
 * on vérifie ce que l'utilisateur voit, pas ce que le code prétend afficher.
 */
const SCENES = {
  async jouer(p) {
    await aller(p, '/');
  },
  async fiche(p) {
    await aller(p, '/');
    await p.getByText('CE SOIR').click();
    await p.waitForTimeout(1500);
  },
  async rejoint(p) {
    await aller(p, '/');
    await p.getByText('CE SOIR').click();
    await p.waitForTimeout(1200);
    await p.getByText(/^Rejoindre/).first().click();
    await p.waitForTimeout(1500);
  },
  async ouvrir(p) {
    await aller(p, '/');
    await p.getByText('OUVRIR', { exact: true }).click();
    await p.waitForTimeout(1500);
  },
  async carte(p) {
    await aller(p, '/');
    await p.getByText('Ma carte', { exact: true }).first().click();
    await p.waitForTimeout(1500);
  },
  async ligue(p) {
    await aller(p, '/');
    await p.getByText('Ligue', { exact: true }).first().click();
    await p.waitForTimeout(1500);
  },
  async classement(p) {
    await SCENES.ligue(p);
    await p.getByText('Classement', { exact: true }).first().click();
    await p.waitForTimeout(900);
  },
  async matchs(p) {
    await SCENES.ligue(p);
    await p.getByText('Matchs', { exact: true }).first().click();
    await p.waitForTimeout(900);
  },
};

async function aller(p, route) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  // Le premier rendu attend les polices embarquées ; sans cette pause, la
  // capture montre un écran vide et on croit à tort que l'écran est cassé.
  await p.waitForTimeout(2200);
}

const demandees = process.argv.slice(2);
const aJouer = demandees.length
  ? demandees.filter((n) => n in SCENES)
  : Object.keys(SCENES);

if (demandees.length && aJouer.length !== demandees.length) {
  const inconnues = demandees.filter((n) => !(n in SCENES));
  console.error(`Scènes inconnues : ${inconnues.join(', ')}`);
  console.error(`Disponibles : ${Object.keys(SCENES).join(', ')}`);
  process.exit(1);
}

const { chromium } = await chargerPlaywright();
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch({ executablePath: cheminChromium() });
const page = await navigateur.newPage({ viewport: ECRAN, deviceScaleFactor: 2 });
page.setDefaultTimeout(8000);

const soucis = [];
page.on('pageerror', (e) => soucis.push(`${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') soucis.push(m.text().slice(0, 200));
});

for (const nom of aJouer) {
  try {
    await SCENES[nom](page);
    await page.screenshot({ path: path.join(SORTIE, `${nom}.png`) });
    console.log(`✓ ${nom}`);
  } catch (e) {
    console.log(`✗ ${nom} — ${e.message.split('\n')[0]}`);
  }
}

// La planche contact : toutes les scènes côte à côte, pour juger d'un coup
// d'œil si l'app tient debout plutôt que de les ouvrir une par une.
const planche = path.join(SORTIE, 'planche.html');
writeFileSync(
  planche,
  `<html><body style="margin:0;background:#08090B;color:#F4F5F2;font:12px system-ui;
   display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px">` +
    aJouer
      .map(
        (n) =>
          `<div><img src="${n}.png" style="width:100%;border-radius:10px;display:block">
           <div style="padding:5px 2px;opacity:.6">${n}</div></div>`,
      )
      .join('') +
    `</body></html>`,
);
const pp = await navigateur.newPage({ viewport: { width: 1200, height: 900 } });
await pp.goto('file://' + planche);
await pp.waitForTimeout(700);
await pp.screenshot({ path: path.join(SORTIE, 'planche.png'), fullPage: true });

await navigateur.close();

console.log(`\nCaptures : ${SORTIE}`);
if (soucis.length) {
  console.log('\nRemontées du navigateur :');
  [...new Set(soucis)].slice(0, 8).forEach((s) => console.log('  -', s));
} else {
  console.log('Aucune erreur remontée par le navigateur.');
}
