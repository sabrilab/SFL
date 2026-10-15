// Repli des couleurs transparentes pour les navigateurs sans color-mix().
//
// Tailwind v4 écrit `bg-foreground/10` en color-mix(), et pour les
// navigateurs qui ne le connaissent pas (Chrome < 111, Safari < 16.2…) il
// laisse un repli : la couleur PLEINE, faute de pouvoir calculer la
// transparence d'une variable. Résultat chez eux : des fonds blancs opaques,
// et le texte blanc posé dessus disparaît.
//
// Ce plugin réécrit ces replis en rgb(var(--x-rgb) / alpha) — une syntaxe
// connue depuis 2019 — et ajoute à côté de chaque couleur de thème en
// hexadécimal sa version en canaux (`--foreground-rgb: 244 245 242`).

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function canaux(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

function dansSupports(noeud) {
  for (let p = noeud.parent; p; p = p.parent) if (p.type === "atrule" && p.name === "supports") return true;
  return false;
}

module.exports = () => ({
  postcssPlugin: "repli-opacite",
  OnceExit(root) {
    // 1 · Les couleurs de thème : hexadécimales dans TOUTES leurs définitions.
    const vues = new Map();
    root.walkDecls(/^--[a-z0-9-]+$/, (d) => {
      if (d.prop.endsWith("-rgb")) return;
      const hex = HEX.test(d.value.trim());
      vues.set(d.prop, (vues.get(d.prop) ?? true) && hex);
    });
    const sures = new Set([...vues].filter(([, ok]) => ok).map(([p]) => p.slice(2)));
    root.walkDecls(/^--[a-z0-9-]+$/, (d) => {
      if (sures.has(d.prop.slice(2))) d.cloneAfter({ prop: `${d.prop}-rgb`, value: canaux(d.value.trim()) });
    });

    // 2 · Les replis pleins des utilitaires à opacité. L'optimiseur fusionne
    // les règles aux replis identiques : `.text-foreground` et
    // `.text-foreground\/15` finissent dans la même règle. On la sépare donc
    // par opacité, sélecteur par sélecteur, pour ne jamais rendre
    // transparente la couleur pleine qui partage la règle.
    root.walkRules((r) => {
      if (dansSupports(r)) return;
      const groupes = new Map();
      for (const sel of r.selectors) {
        const m = sel.match(/\\\/(\\\[)?([0-9]+(?:\\\.[0-9]+)?)(\\\])?/);
        let alpha = null;
        if (m) {
          const n = parseFloat(m[2].replace(/\\/g, ""));
          const a = m[1] ? n : n / 100;
          if (a >= 0 && a <= 1) alpha = a;
        }
        if (!groupes.has(alpha)) groupes.set(alpha, []);
        groupes.get(alpha).push(sel);
      }
      if (groupes.size === 1 && groupes.has(null)) return;
      for (const [alpha, sels] of groupes) {
        if (alpha === null) continue;
        const copie = r.cloneBefore({ selectors: sels });
        copie.walkDecls((d) => {
          const v = d.value.trim().match(/^var\(--([a-z0-9-]+)\)$/);
          if (v && sures.has(v[1])) d.value = `rgb(var(--${v[1]}-rgb) / ${alpha})`;
        });
      }
      if (groupes.has(null)) r.selectors = groupes.get(null);
      else r.remove();
    });
  },
});
module.exports.postcss = true;
