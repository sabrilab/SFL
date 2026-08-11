import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-SFL/a7f32093-b03b-51f6-a731-aede9c060b8e/scratchpad/shots";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const names = [["Abdel","abdel","pivot92"],["Adel","adel","sprint74"],["Adil","adil","gardien72"],
["Adil Maimouni","adilm","corner18"],["Anas","anas","lucarne31"],["Anis","anis","tacle40"],
["Ayman","ayman","volee55"],["Badis","badis","cage23"],["Bilal","bilal","arret66"],
["Franz","franz","duel12"],["Gaïl","gail","reprise88"],["Ilies","ilies","louche34"],
["Ilyes","ilyes","tacle17"],["Isma","isma","praline71"],["Kader","kader","roulette29"],
["Sosso Coach","sossoc","sombrero51"],["Yacine Ben","yacineb","pointu93"]];
await page.route("**/api/comptes", (route) =>
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ accounts: names.map(([name,user,password]) => ({name,user,password})) }) }));
await page.goto("http://localhost:3116/", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2000);
await page.fill('input[autocomplete="username"]', "ilyes");
await page.fill('input[autocomplete="current-password"]', "tacle17");
await page.click('button[type="submit"]');
await page.waitForTimeout(7000);
await page.goto("http://localhost:3116/admin/comptes", { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/comptes-fenetre.png` });
console.log("OK");
await browser.close();
