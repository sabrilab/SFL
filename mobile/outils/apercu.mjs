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
/** Les scènes qui sont des feuilles natives, et l'écran dont elles partent. */
const FEUILLES = { fiche: 'jouer', rejoint: 'jouer', ouvrir: 'jouer', joueur: 'carte', hote: 'jouer', valider: 'jouer', equipeCreer: 'equipes', ami: 'carte' };

const SCENES = {
  async jouer(p) {
    await aller(p, '/');
  },
  async fiche(p) {
    await aller(p, '/');
    await p.getByText('CE SOIR').click();
    await p.waitForTimeout(1500);
    await deshabiller(p);
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
    await deshabiller(p);
  },
  async carte(p) {
    await aller(p, '/');
    await p.getByText('Ma carte', { exact: true }).first().click();
    await p.waitForTimeout(3500);
  },
  async joueur(p) {
    await aller(p, '/');
    await p.getByText('Ma carte', { exact: true }).first().click();
    await p.waitForTimeout(2500);
    await p.getByLabel('Carte de YACINE').first().click();
    await p.waitForTimeout(2200);
    await deshabiller(p);
  },
  /** L'hôte : ouvrir un match, composer, démarrer, marquer, terminer. */
  async hote(p) {
    await aller(p, '/');
    // Chaque passage repart d'une sauvegarde vide : sinon les matchs créés
    // par les passages précédents s'empilent dans la liste.
    await p.evaluate(() => localStorage.clear());
    await aller(p, '/');
    await p.getByText('OUVRIR', { exact: true }).click();
    await p.waitForTimeout(1200);
    await p.getByText('Ouvrir le match', { exact: true }).click();
    await p.waitForTimeout(1500);
    // le match créé est en tête de liste : « DEMAIN »
    await p.getByText('DEMAIN', { exact: true }).first().click();
    await p.waitForTimeout(2500);
    await p.getByLabel(/^YACINE/).first().click();
    await p.getByLabel(/^KADER/).first().click();
    await p.waitForTimeout(600);
    await p.getByText('Démarrer le match', { exact: true }).click();
    await p.waitForTimeout(800);
    await p.getByLabel('But de ILYES').first().click();
    await p.waitForTimeout(500);
    await p.getByText('Sans passe', { exact: true }).click();
    await p.getByLabel('But de YACINE').first().click();
    await p.waitForTimeout(500);
    await p.getByText('KADER', { exact: true }).first().click();  // la passe
    await p.waitForTimeout(600);
    await deshabiller(p);
  },
  /** Même chemin, jusqu'à la feuille à valider. */
  async valider(p) {
    await SCENES.hote(p);
    await p.getByText('Terminer le match', { exact: true }).click();
    await p.waitForTimeout(900);
  },
  /** Les équipes : l'invitation, puis la création, puis le classement avec la sienne. */
  async equipes(p) {
    await SCENES.ligue(p);
    await p.getByText('Équipes', { exact: true }).first().click();
    await p.waitForTimeout(1500);
  },
  async equipeCreer(p) {
    await aller(p, '/');
    await p.evaluate(() => localStorage.clear());
    await SCENES.equipes(p);
    await p.getByText('Monter une équipe', { exact: true }).click();
    await p.waitForTimeout(1800);
    await p.getByPlaceholder('Les Renards').fill('Les Loups de Saint-Denis');
    await p.getByText('Pointe', { exact: true }).click();
    await p.getByText('Diagonale', { exact: true }).click();
    for (const n of ['YACINE', 'KADER', 'NAIM', 'BENSOU']) {
      await p.getByLabel(new RegExp('^' + n)).first().click();
      await p.waitForTimeout(150);
    }
    await p.waitForTimeout(800);
    await deshabiller(p);
  },
  async equipeMonte(p) {
    await SCENES.equipeCreer(p);
    await p.getByText("Monter l'équipe", { exact: true }).click();
    await p.waitForTimeout(1600);
  },
  /** Le classement avec son équipe dedans (après equipeMonte). */
  async equipesAvec(p) {
    await SCENES.equipes(p);
  },
  /** Ajouter un ami depuis sa carte, puis le retrouver dans Ma carte. */
  async ami(p) {
    await aller(p, '/');
    await p.getByText('Ma carte', { exact: true }).first().click();
    await p.waitForTimeout(2500);
    await p.getByLabel('Carte de YACINE').first().click();
    await p.waitForTimeout(2000);
    await p.getByText('Ajouter en ami', { exact: true }).click();
    await p.waitForTimeout(700);
    await deshabiller(p);
  },
  async journal(p) {
    await SCENES.ligue(p);
    await p.getByText('Matchs', { exact: true }).first().click();
    await p.waitForTimeout(1200);
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

/**
 * L'habillage iOS de l'aperçu.
 *
 * Le rendu web place la barre d'onglets en haut et ne réserve pas la place des
 * barres système : deux différences qui n'existent que sur le web et qui
 * faussent le jugement. On les corrige VERS la vérité — la barre redescend en
 * bas sous forme de capsule, et l'écran réserve l'encoche et la barre d'accueil,
 * comme sur un iPhone.
 *
 * On ne corrige rien d'autre : ce qui reste à l'écran est ce que le code produit.
 */
async function habiller(p) {
  await p.addStyleTag({
    content: `
      /* La barre d'onglets : en bas, en capsule, comme sur l'appareil. */
      [role="tablist"][class*="navigationMenuRoot"] {
        position: fixed !important;
        top: auto !important; bottom: 26px !important;
        left: 50% !important; transform: translateX(-50%) !important;
        width: calc(100% - 52px) !important;
        display: flex !important; justify-content: space-between !important;
        gap: 2px !important; padding: 5px !important;
        background: rgba(18,21,25,0.82) !important;
        backdrop-filter: blur(26px) saturate(170%) !important;
        border: 1px solid rgba(255,255,255,0.16) !important;
        border-radius: 999px !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 30px rgba(0,0,0,0.55) !important;
        z-index: 9000 !important;
      }
      [role="tablist"][class*="navigationMenuRoot"] [role="tab"] {
        flex: 1 !important; border-radius: 999px !important; height: 34px !important;
      }
      [role="tablist"][class*="navigationMenuRoot"] [role="tab"][aria-selected="true"],
      [role="tablist"][class*="navigationMenuRoot"] [role="tab"][data-state="active"] {
        background: #EFEFEC !important;
      }
      [role="tablist"][class*="navigationMenuRoot"] [role="tab"][aria-selected="true"] *,
      [role="tablist"][class*="navigationMenuRoot"] [role="tab"][data-state="active"] * {
        color: #0A0B0D !important;
      }
      /* La place de l'encoche, que le web ne réserve pas. */
      [class*="nativeTabsContainer"] { padding-top: 54px !important; box-sizing: border-box !important; }
      #apercu-systeme {
        position: fixed; top: 0; left: 0; right: 0; height: 54px; z-index: 9500;
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 30px 0; font: 600 15px -apple-system, system-ui, sans-serif;
        color: #F4F5F2; pointer-events: none;
      }
      #apercu-ile {
        position: fixed; top: 11px; left: 50%; transform: translateX(-50%);
        width: 124px; height: 35px; border-radius: 999px; background: #000;
        z-index: 9600; pointer-events: none;
      }
      #apercu-accueil {
        position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%);
        width: 138px; height: 5px; border-radius: 999px;
        background: rgba(244,245,242,0.65); z-index: 9700; pointer-events: none;
      }
    `,
  });
  await p.evaluate(() => {
    if (document.getElementById('apercu-systeme')) return;
    const barre = document.createElement('div');
    barre.id = 'apercu-systeme';
    barre.innerHTML =
      '<span>19:42</span><span style="display:flex;gap:6px;align-items:center;opacity:.9">' +
      '<svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/>' +
      '<rect x="4.5" y="5" width="3" height="6" rx="1" fill="currentColor"/>' +
      '<rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/>' +
      '<rect x="13.5" y="0" width="3" height="11" rx="1" fill="currentColor" opacity=".4"/></svg>' +
      '<svg width="25" height="12" viewBox="0 0 25 12"><rect x=".5" y=".5" width="21" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".5"/>' +
      '<rect x="2" y="2" width="15" height="8" rx="2" fill="currentColor"/>' +
      '<path d="M23 4v4a2.6 2.6 0 0 0 0-4z" fill="currentColor" opacity=".5"/></svg></span>';
    const ile = document.createElement('div');
    ile.id = 'apercu-ile';
    const accueil = document.createElement('div');
    accueil.id = 'apercu-accueil';
    document.body.append(barre, ile, accueil);
  });
  await p.waitForTimeout(400);
}

async function deshabiller(p) {
  await p.evaluate(() => {
    ['apercu-systeme', 'apercu-ile', 'apercu-accueil'].forEach((id) =>
      document.getElementById(id)?.remove());
  });
  await p.waitForTimeout(200);
}

async function aller(p, route) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  // Le premier rendu attend les polices embarquées ; sans cette pause, la
  // capture montre un écran vide et on croit à tort que l'écran est cassé.
  await p.waitForTimeout(2200);
  await habiller(p);
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

// Le rendu web de Skia charge CanvasKit depuis un CDN ; derrière un proxy
// d'entreprise le certificat n'est pas reconnu par Chromium. C'est un outil
// de développement : on accepte le certificat plutôt que d'échouer en silence.
const navigateur = await chromium.launch({
  executablePath: cheminChromium(),
  args: ['--ignore-certificate-errors'],
});
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
// d'œil si l'app tient debout plutôt que de les ouvrir une par une. Les
// feuilles sont recomposées sur l'écran d'où elles sortent — deux captures
// réelles superposées, comme iOS les empile.
const planche = path.join(SORTIE, 'planche.html');
const cadre = (n) => {
  const dessous = FEUILLES[n];
  const pile = dessous
    ? `<img src="${dessous}.png" class="ecran">
       <div class="voile"></div>
       <img src="${n}.png" class="ecran feuille">`
    : `<img src="${n}.png" class="ecran">`;
  return `<figure><div class="tel">${pile}</div><figcaption>${n}</figcaption></figure>`;
};
writeFileSync(
  planche,
  `<html><body style="margin:0;background:#08090B;color:#F4F5F2;
    font:12px -apple-system,system-ui,sans-serif;padding:16px">
   <style>
     .grille{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
     figure{margin:0}
     .tel{position:relative;aspect-ratio:393/852;border-radius:44px;overflow:hidden;
          background:#08090B;border:1px solid rgba(255,255,255,.12);
          box-shadow:0 0 0 7px #17181C,0 24px 50px rgba(0,0,0,.7)}
     .ecran{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
     .voile{position:absolute;inset:0;background:rgba(2,3,5,.55)}
     .feuille{top:7%;height:93%;border-radius:30px 30px 0 0;object-fit:cover;object-position:top}
     figcaption{padding:8px 2px 0;opacity:.55}
   </style>
   <div class="grille">` +
    aJouer.map(cadre).join('') +
    `</div></body></html>`,
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
