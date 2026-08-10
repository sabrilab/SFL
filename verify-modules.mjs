import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-SFL/a7f32093-b03b-51f6-a731-aede9c060b8e/scratchpad/shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:3109/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(3000);

const targets = [
  ["m-dimanche", "Ton dimanche"],
  ["m-citation", "La phrase du dimanche"],
  ["m-projection", "Si tu gardes ce rythme"],
  ["m-quiz", "Le quiz de la journée"],
  ["m-facteurx", "Le facteur X"],
  ["m-jumeau", "Ton jumeau statistique"],
  ["m-evolution", "Ta carte dans le temps"],
  ["m-series", "Le mur des séries"],
  ["m-paires", "Alchimie"],
  ["m-mercato", "Le mercato imaginaire"],
  ["m-affiches", "Les affiches"],
  ["m-cinq", "Le cinq de la saison"],
  ["m-fairplay", "Fair-play"],
  ["m-meteo", "La météo de la ligue"],
  ["m-alternatif", "Le classement de la semaine"],
  ["m-prono", "Le pronostic"],
];
const missing = [];
for (const [name, text] of targets) {
  const loc = page.locator(`text=${text}`).first();
  if ((await loc.count()) === 0) { missing.push(text); continue; }
  await loc.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => document.getElementById("app-scroll")?.scrollBy(0, -90));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
console.log("MANQUANTS:", missing.length ? missing.join(" | ") : "aucun");
console.log("ERREURS JS:", errs.length ? errs.slice(0,3).join(" | ") : "aucune");
await browser.close();
