// Le tableau des touches du jeu Bola (bola-app#26, lot 3) : la seule source, lue par l'écran des touches
// (src/app/jouer/manettes.tsx) et par le banc (tools/jeu-banc-manettes.ts, qui vérifie chaque ligne sur la vraie
// simulation et l'exporte en Markdown). La disposition est celle des jeux de foot de rue console, Xbox et PlayStation
// (convention de genre, voulue par Sabri) ; le clavier et le pouce suivent la même logique. Rien d'autre n'est repris
// de ces jeux : ni nom, ni visuel, ni menu.
//
// Une ligne : { id, partie ('attaque' | 'gestes' | 'defense' | 'jeu'), action, xbox, ps, clavier, pouce, attendu }.
// Les noms des boutons sont ceux de la manette (A B X Y, LB RB LT RT, LS RS = sticks, R3 = stick droit cliqué ;
// ✕ ○ □ △, L1 R1 L2 R2) ; « RS ↑ » est un coup sec du stick droit, relatif au cap du joueur (↑ devant lui, ↓ derrière,
// ←/→ ses côtés) ; « ◠ » un quart de cercle de devant vers un côté, « ◡◠ » un demi-cercle, « RS ↓ tenu » un maintenu. attendu : le type
// d'action de la simulation que la ligne doit produire (le banc le vérifie), ou null pour une commande continue.
//
// Le clavier : flèches = stick gauche, Maj = RT, D = A, S = B, F = Y, Espace (ou E) = X, Q = LB, R = RB, C = LT,
// U = R3, I J K L = stick droit, relatives au joueur comme les gestes (I devant lui, K derrière, J sa gauche, L sa
// droite ; deux touches enchaînées font un quart de cercle, trois un demi-cercle), Échap ou P = pause. (Ni Ctrl ni Alt : Ctrl + W ferme l'onglet, Alt ouvre le menu.)
// Le pouce : un doigt, le stick qui naît sous lui (courir, loin = sprint), toucher = passe, coup sec = frappe ; un
// second doigt posé dans le bas de l'écran est le stick droit (mêmes motifs) et, touché sans bouger, R3.

export const BOUTONS_CLAVIER = {
  A: 'D', B: 'S', X: 'Espace', Y: 'F', LB: 'Q', RB: 'R', LT: 'C', RT: 'Maj', R3: 'U', RS: 'I J K L', LS: 'flèches', MENU: 'Échap',
};

export const TOUCHES = [
  // ── attaque ──
  { id: 'courir', partie: 'attaque', action: 'Courir', xbox: 'LS', ps: 'LS', clavier: 'flèches', pouce: 'glisser', attendu: null },
  { id: 'sprint', partie: 'attaque', action: 'Sprint', xbox: 'RT', ps: 'R2', clavier: 'Maj', pouce: 'glisser loin', attendu: null },
  { id: 'proteger', partie: 'attaque', action: 'Protéger la balle', xbox: 'LT', ps: 'L2', clavier: 'C', pouce: '—', attendu: null },
  { id: 'serre', partie: 'attaque', action: 'Conduite serrée', xbox: 'LT + LS', ps: 'L2 + LS', clavier: 'C + flèches', pouce: '—', attendu: null },
  { id: 'passe', partie: 'attaque', action: 'Passe', xbox: 'A', ps: '✕', clavier: 'D', pouce: 'toucher', attendu: 'passe' },
  { id: 'tendue', partie: 'attaque', action: 'Passe tendue', xbox: 'RB + A', ps: 'R1 + ✕', clavier: 'R + D', pouce: '—', attendu: 'passe' },
  { id: 'uneDeux', partie: 'attaque', action: 'Une-deux', xbox: 'LB + A', ps: 'L1 + ✕', clavier: 'Q + D', pouce: '—', attendu: 'passe' },
  { id: 'lob', partie: 'attaque', action: 'Passe lobée', xbox: 'B', ps: '○', clavier: 'S', pouce: '—', attendu: 'lob' },
  { id: 'centre', partie: 'attaque', action: 'Centre', xbox: 'B sur un côté', ps: '○ sur un côté', clavier: 'S sur un côté', pouce: '—', attendu: 'centre' },
  { id: 'profondeur', partie: 'attaque', action: 'Passe en profondeur', xbox: 'Y', ps: '△', clavier: 'F', pouce: '—', attendu: 'profondeur' },
  { id: 'frappe', partie: 'attaque', action: 'Frappe', xbox: 'X', ps: '□', clavier: 'Espace', pouce: 'coup sec vers le but', attendu: 'frappe' },
  { id: 'finesse', partie: 'attaque', action: 'Frappe brossée', xbox: 'RB + X', ps: 'R1 + □', clavier: 'R + Espace', pouce: '—', attendu: 'finesse' },
  { id: 'exterieur', partie: 'attaque', action: 'Frappe extérieur', xbox: 'LT + X', ps: 'L2 + □', clavier: 'C + Espace', pouce: '—', attendu: 'exterieur' },
  { id: 'pique', partie: 'attaque', action: 'Piqué', xbox: 'LB + X', ps: 'L1 + □', clavier: 'Q + Espace', pouce: '—', attendu: 'lobFrappe' },
  { id: 'ras', partie: 'attaque', action: 'Frappe à ras de terre', xbox: 'LB + RB + X', ps: 'L1 + R1 + □', clavier: 'Q + R + Espace', pouce: '—', attendu: 'frappe' },
  { id: 'feinteFrappe', partie: 'attaque', action: 'Feinte de frappe', xbox: 'X puis A', ps: '□ puis ✕', clavier: 'Espace puis D', pouce: '—', attendu: 'feinteFrappe' },
  { id: 'semelle', partie: 'attaque', action: 'Semelle', xbox: 'R3', ps: 'R3', clavier: 'U', pouce: 'toucher à deux doigts', attendu: 'semelle' },
  { id: 'jongle', partie: 'attaque', action: 'Jongler', xbox: 'LB + RB tenus', ps: 'L1 + R1 tenus', clavier: 'Q + R tenus', pouce: '—', attendu: 'jongle' },
  { id: 'changerA', partie: 'attaque', action: 'Changer (balle libre)', xbox: 'LB', ps: 'L1', clavier: 'Q', pouce: 'automatique', attendu: 'changer' },
  // ── gestes au stick droit (balle au pied) ──
  { id: 'crochet', partie: 'gestes', action: 'Crochet', xbox: 'RS ←/→', ps: 'RS ←/→', clavier: 'J / L', pouce: '2e doigt ←/→', attendu: 'crochet' },
  { id: 'crochetCourt', partie: 'gestes', action: 'Crochet court', xbox: 'LT + RS ←/→', ps: 'L2 + RS ←/→', clavier: 'C + J / L', pouce: '—', attendu: 'crochet' },
  { id: 'feinte', partie: 'gestes', action: 'Feinte de corps', xbox: 'RS ←/→ arrêté', ps: 'RS ←/→ arrêté', clavier: 'J / L arrêté', pouce: '2e doigt ←/→ arrêté', attendu: 'feinte' },
  { id: 'passement', partie: 'gestes', action: 'Passement', xbox: 'RS ◠', ps: 'RS ◠', clavier: 'I puis J / L', pouce: '2e doigt ◠', attendu: 'passement' },
  { id: 'doublePassement', partie: 'gestes', action: 'Double passement', xbox: 'LT + RS ◠', ps: 'L2 + RS ◠', clavier: 'C + I puis J / L', pouce: '—', attendu: 'passement' },
  { id: 'roulette', partie: 'gestes', action: 'Roulette', xbox: 'RS ◡◠', ps: 'RS ◡◠', clavier: 'K puis J puis I', pouce: '2e doigt ◡◠', attendu: 'roulette' },
  { id: 'talonnade', partie: 'gestes', action: 'Talonnade', xbox: 'RS ↓', ps: 'RS ↓', clavier: 'K', pouce: '2e doigt ↓', attendu: 'talonnade' },
  { id: 'tirerArriere', partie: 'gestes', action: 'Tirer en arrière', xbox: 'RS ↓ tenu', ps: 'RS ↓ tenu', clavier: 'K tenu', pouce: '2e doigt ↓ tenu', attendu: 'tirerArriere' },
  { id: 'pousser', partie: 'gestes', action: 'Pousser devant', xbox: 'RS ↑', ps: 'RS ↑', clavier: 'I', pouce: '2e doigt ↑', attendu: 'pousser' },
  { id: 'petitPont', partie: 'gestes', action: 'Petit pont', xbox: 'RS ↑ collé', ps: 'RS ↑ collé', clavier: 'I collé', pouce: '2e doigt ↑ collé', attendu: 'petitPont' },
  { id: 'sombrero', partie: 'gestes', action: 'Sombrero', xbox: 'R3 + RS ↑', ps: 'R3 + RS ↑', clavier: 'U + I', pouce: '—', attendu: 'sombrero' },
  // ── défense ──
  { id: 'contenir', partie: 'defense', action: 'Contenir', xbox: 'LT', ps: 'L2', clavier: 'C', pouce: '—', attendu: null },
  { id: 'presser', partie: 'defense', action: 'Presser', xbox: 'A tenu', ps: '✕ tenu', clavier: 'D tenu', pouce: 'glisser', attendu: null },
  { id: 'renfort', partie: 'defense', action: 'Pressing d\'un coéquipier', xbox: 'RB tenu', ps: 'R1 tenu', clavier: 'R tenu', pouce: '—', attendu: null },
  { id: 'tacle', partie: 'defense', action: 'Tacle debout', xbox: 'B', ps: '○', clavier: 'S', pouce: 'toucher', attendu: 'tacle' },
  { id: 'epaule', partie: 'defense', action: 'Épaule, tirage', xbox: 'B tenu', ps: '○ tenu', clavier: 'S tenu', pouce: '—', attendu: null },
  { id: 'tacleGlisse', partie: 'defense', action: 'Tacle glissé', xbox: 'X', ps: '□', clavier: 'Espace', pouce: 'coup sec', attendu: 'tacle' },
  { id: 'sortie', partie: 'defense', action: 'Sortie du gardien', xbox: 'Y tenu', ps: '△ tenu', clavier: 'F tenu', pouce: '—', attendu: null },
  { id: 'changer', partie: 'defense', action: 'Changer de joueur', xbox: 'LB', ps: 'L1', clavier: 'Q', pouce: 'automatique', attendu: 'changer' },
  { id: 'choisir', partie: 'defense', action: 'Prendre celui de ce côté', xbox: 'RS', ps: 'RS', clavier: 'I J K L', pouce: '—', attendu: 'changer' },
  // ── le jeu ──
  { id: 'pause', partie: 'jeu', action: 'Pause', xbox: 'Menu', ps: 'Options', clavier: 'Échap', pouce: 'toucher le voile', attendu: null },
  { id: 'touches', partie: 'jeu', action: 'Les touches', xbox: 'Vue', ps: 'Share', clavier: '—', pouce: '—', attendu: null },
];

export const PARTIES = [
  { id: 'attaque', titre: 'Attaque' },
  { id: 'gestes', titre: 'Gestes' },
  { id: 'defense', titre: 'Défense' },
];

/** Le tableau en Markdown (pour le compte rendu). */
export function touchesMarkdown() {
  const titres = { attaque: 'Attaque', gestes: 'Gestes au stick droit (balle au pied, relatifs au cap du joueur)', defense: 'Défense', jeu: 'Le jeu' };
  const out = [];
  for (const p of ['attaque', 'gestes', 'defense', 'jeu']) {
    out.push(`### ${titres[p]}`, '', '| Action | Xbox | PlayStation | Clavier | Pouce |', '|---|---|---|---|---|');
    for (const t of TOUCHES.filter((x) => x.partie === p)) out.push(`| ${t.action} | ${t.xbox} | ${t.ps} | ${t.clavier} | ${t.pouce} |`);
    out.push('');
  }
  return out.join('\n');
}
