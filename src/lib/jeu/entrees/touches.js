// Le tableau des touches du jeu Bola (bola-app#26, lot 3 ; refait par bola-app#32, lot A) : la seule source, lue par
// l'écran des touches (src/app/jouer/touches.tsx), par le panneau du match (bola-app#32, lot C) et par les bancs
// (tools/jeu-banc-manettes.ts vérifie chaque ligne sur la vraie simulation et l'exporte en Markdown ;
// tools/jeu-mesures.ts y lit le bouton de la passe et de la frappe).
//
// La disposition (bola-app#32) : celle de Sabri (retour du 18/11, 21:09, et celui de 21:19 pour L1 et R2 :
// ✕ passe, ○ frappe, □ centre, △ profondeur, R1 + ✕ passe puissante, L1 + ○ piqué, L1 + △ profondeur lobée,
// L1 + □ centre lobé, R2 + ○ frappe selon la balle, R2 tenu sprint, L1 seul sans la balle changer ; en défense □ tacle,
// ○ récupérer du pied et prendre la balle libre) ; ce qu'il ne cite pas suit la disposition standard des jeux de foot
// console (R1 + ○ enroulée, L2 + ○ extérieur, R1 + □ centre tendu, R1 + △ profondeur appuyée, L1 + ✕ une-deux, ○ puis
// ✕ feinte de frappe, L2 protéger / contenir, L1 + R1 jongler, R3 semelle, stick droit gestes). Le clavier et le pouce
// suivent la même logique. Rien d'autre n'est repris de ces jeux : ni nom, ni visuel, ni menu.
//
// Une ligne : { id, partie ('attaque' | 'libre' | 'gestes' | 'defense' | 'jeu'), action, xbox, ps, clavier, pouce,
// attendu, geste }. id est aussi la `commande` que portent les actions de la simulation (le rendu y lit le geste à
// jouer, bola-app#32 lot A2) ; geste : le geste attendu à l'écran. Les noms des boutons sont ceux de la manette (A B X Y,
// LB RB LT RT, LS RS = sticks, R3 = stick droit cliqué ; ✕ ○ □ △, L1 R1 L2 R2) ; « RS ↑ » est un coup sec du stick
// droit, relatif au cap du joueur (↑ devant lui, ↓ derrière, ←/→ ses côtés) ; « ◠ » un quart de cercle de devant vers un
// côté, « ◡◠ » un demi-cercle, « RS ↓ tenu » un maintenu. attendu : le type d'action de la simulation que la ligne doit
// produire (le banc le vérifie), ou null pour une commande continue. Tenir ○, ✕, □ ou △ charge (jauge, flèche) ; un
// appui bref part tout de suite.
//
// Le clavier : flèches = stick gauche, Maj = R2, D = ✕, Espace (ou E) = ○, S = □, F = △, Q = L1, R = R1, C = L2,
// U = R3, I J K L = stick droit, relatives au joueur comme les gestes (I devant lui, K derrière, J sa gauche, L sa
// droite ; deux touches enchaînées font un quart de cercle, trois un demi-cercle), Échap ou P = pause. (Ni Ctrl ni Alt :
// Ctrl + W ferme l'onglet, Alt ouvre le menu.) D et Espace gardent la passe et la frappe de #27 ; en défense, S tacle et
// Espace récupère (#27 : Espace tacle glissé, S tacle debout).
// Le pouce : un doigt, le stick qui naît sous lui (courir, loin = sprint), toucher = passe (balle libre : la prendre ;
// en défense : récupérer), coup sec vers le but = frappe (en défense : tacle) ; un second doigt posé dans le bas de
// l'écran est le stick droit (mêmes motifs) et, touché sans bouger, R3.

export const BOUTONS_CLAVIER = {
  A: 'D', B: 'Espace', X: 'S', Y: 'F', LB: 'Q', RB: 'R', LT: 'C', RT: 'Maj', R3: 'U', RS: 'I J K L', LS: 'flèches', MENU: 'Échap',
};

export const TOUCHES = [
  // ── attaque, balle au pied ──
  { id: 'courir', partie: 'attaque', action: 'Courir, la balle au pied', xbox: 'LS', ps: 'LS', clavier: 'flèches', pouce: 'glisser', attendu: null, geste: 'course qui suit le stick, balle aimantée devant le pied' },
  { id: 'sprint', partie: 'attaque', action: 'Sprint', xbox: 'RT tenu', ps: 'R2 tenu', clavier: 'Maj', pouce: 'glisser loin', attendu: null, geste: 'sprint, foulée longue, balle poussée à 0,8 m' },
  { id: 'proteger', partie: 'attaque', action: 'Protéger la balle', xbox: 'LT', ps: 'L2', clavier: 'C', pouce: '—', attendu: null, geste: 'dos au défenseur, bras écartés' },
  { id: 'serre', partie: 'attaque', action: 'Conduite serrée', xbox: 'LT + LS', ps: 'L2 + LS', clavier: 'C + flèches', pouce: '—', attendu: null, geste: 'petits pas, balle sous la semelle' },
  { id: 'passe', partie: 'attaque', action: 'Passe', xbox: 'A', ps: '✕', clavier: 'D', pouce: 'toucher', attendu: 'passe', geste: 'intérieur du pied, élan court' },
  { id: 'passePuissante', partie: 'attaque', action: 'Passe puissante', xbox: 'RB + A', ps: 'R1 + ✕', clavier: 'R + D', pouce: '—', attendu: 'passe', geste: 'élan plus long, cou-de-pied à plat, buste au-dessus' },
  { id: 'uneDeux', partie: 'attaque', action: 'Une-deux', xbox: 'LB + A', ps: 'L1 + ✕', clavier: 'Q + D', pouce: '—', attendu: 'passe', geste: 'passe intérieur puis départ en sprint' },
  { id: 'frappe', partie: 'attaque', action: 'Frappe', xbox: 'B', ps: '○', clavier: 'Espace', pouce: 'coup sec vers le but', attendu: 'frappe', geste: 'cou-de-pied, grand armé, appel de bras' },
  { id: 'finesse', partie: 'attaque', action: 'Frappe enroulée', xbox: 'RB + B', ps: 'R1 + ○', clavier: 'R + Espace', pouce: '—', attendu: 'finesse', geste: 'intérieur du pied, corps penché, pied qui enveloppe' },
  { id: 'pique', partie: 'attaque', action: 'Piqué', xbox: 'LB + B', ps: 'L1 + ○', clavier: 'Q + Espace', pouce: '—', attendu: 'lobFrappe', geste: 'pointe sous la balle, frappe courte, buste en arrière' },
  { id: 'ras', partie: 'attaque', action: 'Frappe forte à ras de terre (balle au sol)', xbox: 'RT + B', ps: 'R2 + ○', clavier: 'Maj + Espace', pouce: '—', attendu: 'frappe', geste: 'frappe sèche, buste au-dessus de la balle' },
  { id: 'acrobatique', partie: 'attaque', action: 'Frappe acrobatique (balle en l\'air)', xbox: 'RT + B', ps: 'R2 + ○', clavier: 'Maj + Espace', pouce: '—', attendu: 'frappe', geste: 'retournée dos au but, ciseau de côté, demi-volée devant' },
  { id: 'exterieur', partie: 'attaque', action: 'Frappe extérieur', xbox: 'LT + B', ps: 'L2 + ○', clavier: 'C + Espace', pouce: '—', attendu: 'exterieur', geste: 'extérieur du pied, jambe qui croise' },
  { id: 'feinteFrappe', partie: 'attaque', action: 'Feinte de frappe', xbox: 'B puis A', ps: '○ puis ✕', clavier: 'Espace puis D', pouce: '—', attendu: 'feinteFrappe', geste: 'élan arrêté avant l\'impact, la jambe passe au-dessus' },
  { id: 'frappeParfaite', partie: 'attaque', action: 'Frappe parfaite (au bon moment)', xbox: 'B puis B', ps: '○ puis ○', clavier: 'Espace puis Espace', pouce: '—', attendu: 'timing', geste: 'la même frappe, plus juste' },
  { id: 'centre', partie: 'attaque', action: 'Centre (passe lobée hors des côtés)', xbox: 'X', ps: '□', clavier: 'S', pouce: '—', attendu: 'centre', geste: 'cou-de-pied sous la balle, buste en arrière' },
  { id: 'centreLobe', partie: 'attaque', action: 'Centre lobé', xbox: 'LB + X', ps: 'L1 + □', clavier: 'Q + S', pouce: '—', attendu: 'centre', geste: 'buste très en arrière, trajectoire en cloche' },
  { id: 'centreTendu', partie: 'attaque', action: 'Centre tendu', xbox: 'RB + X', ps: 'R1 + □', clavier: 'R + S', pouce: '—', attendu: 'centre', geste: 'coup sec du cou-de-pied, buste droit' },
  { id: 'profondeur', partie: 'attaque', action: 'Passe en profondeur', xbox: 'Y', ps: '△', clavier: 'F', pouce: '—', attendu: 'profondeur', geste: 'intérieur du pied dans la course du receveur' },
  { id: 'profondeurLobee', partie: 'attaque', action: 'Profondeur lobée', xbox: 'LB + Y', ps: 'L1 + △', clavier: 'Q + F', pouce: '—', attendu: 'profondeur', geste: 'pied sous la balle, petit lob par-dessus la défense' },
  { id: 'profondeurTendue', partie: 'attaque', action: 'Profondeur appuyée', xbox: 'RB + Y', ps: 'R1 + △', clavier: 'R + F', pouce: '—', attendu: 'profondeur', geste: 'coup sec, balle rapide au sol' },
  { id: 'semelle', partie: 'attaque', action: 'Semelle', xbox: 'R3', ps: 'R3', clavier: 'U', pouce: 'toucher à deux doigts', attendu: 'semelle', geste: 'semelle posée sur la balle' },
  { id: 'jongle', partie: 'attaque', action: 'Jongler', xbox: 'LB + RB tenus', ps: 'L1 + R1 tenus', clavier: 'Q + R tenus', pouce: '—', attendu: 'jongle', geste: 'kick up répété' },
  // ── balle libre (personne ne l'a) ──
  { id: 'prendre', partie: 'libre', action: 'Prendre la balle', xbox: 'B', ps: '○', clavier: 'Espace', pouce: 'toucher', attendu: 'prendre', geste: 'pas d\'approche, amorti du pied' },
  { id: 'reprise', partie: 'libre', action: 'Reprise de volée', xbox: 'B en l\'air', ps: '○ en l\'air', clavier: 'Espace en l\'air', pouce: 'coup sec', attendu: null, geste: 'volée, ciseau ou tête selon la hauteur' },
  { id: 'changerA', partie: 'libre', action: 'Changer (vers le ballon)', xbox: 'LB', ps: 'L1', clavier: 'Q', pouce: 'automatique', attendu: 'changer', geste: null },
  // ── gestes au stick droit (balle au pied) ──
  { id: 'crochet', partie: 'gestes', action: 'Crochet', xbox: 'RS ←/→', ps: 'RS ←/→', clavier: 'J / L', pouce: '2e doigt ←/→', attendu: 'crochet', geste: 'extérieur du pied, virage sur l\'appui' },
  { id: 'crochetCourt', partie: 'gestes', action: 'Crochet court', xbox: 'LT + RS ←/→', ps: 'L2 + RS ←/→', clavier: 'C + J / L', pouce: '—', attendu: 'crochet', geste: 'crochet serré' },
  { id: 'feinte', partie: 'gestes', action: 'Feinte de corps', xbox: 'RS ←/→ arrêté', ps: 'RS ←/→ arrêté', clavier: 'J / L arrêté', pouce: '2e doigt ←/→ arrêté', attendu: 'feinte', geste: 'esquive du buste' },
  { id: 'passement', partie: 'gestes', action: 'Passement', xbox: 'RS ◠', ps: 'RS ◠', clavier: 'I puis J / L', pouce: '2e doigt ◠', attendu: 'passement', geste: 'le pied fait le tour de la balle' },
  { id: 'doublePassement', partie: 'gestes', action: 'Double passement', xbox: 'LT + RS ◠', ps: 'L2 + RS ◠', clavier: 'C + I puis J / L', pouce: '—', attendu: 'passement', geste: 'deux passements' },
  { id: 'roulette', partie: 'gestes', action: 'Roulette', xbox: 'RS ◡◠', ps: 'RS ◡◠', clavier: 'K puis J puis I', pouce: '2e doigt ◡◠', attendu: 'roulette', geste: 'roulette, semelle' },
  { id: 'talonnade', partie: 'gestes', action: 'Talonnade', xbox: 'RS ↓', ps: 'RS ↓', clavier: 'K', pouce: '2e doigt ↓', attendu: 'talonnade', geste: 'talon vers l\'arrière' },
  { id: 'tirerArriere', partie: 'gestes', action: 'Tirer en arrière', xbox: 'RS ↓ tenu', ps: 'RS ↓ tenu', clavier: 'K tenu', pouce: '2e doigt ↓ tenu', attendu: 'tirerArriere', geste: 'semelle qui ramène la balle' },
  { id: 'pousser', partie: 'gestes', action: 'Pousser devant', xbox: 'RS ↑', ps: 'RS ↑', clavier: 'I', pouce: '2e doigt ↑', attendu: 'pousser', geste: 'touche longue devant' },
  { id: 'petitPont', partie: 'gestes', action: 'Petit pont', xbox: 'RS ↑ collé', ps: 'RS ↑ collé', clavier: 'I collé', pouce: '2e doigt ↑ collé', attendu: 'petitPont', geste: 'balle entre les jambes' },
  { id: 'sombrero', partie: 'gestes', action: 'Sombrero', xbox: 'R3 + RS ↑', ps: 'R3 + RS ↑', clavier: 'U + I', pouce: '—', attendu: 'sombrero', geste: 'balle levée au-dessus du défenseur' },
  // ── défense ──
  { id: 'courirD', partie: 'defense', action: 'Courir, sprint', xbox: 'LS, RT tenu', ps: 'LS, R2 tenu', clavier: 'flèches, Maj', pouce: 'glisser', attendu: null, geste: null },
  { id: 'changer', partie: 'defense', action: 'Changer (vers le ballon)', xbox: 'LB', ps: 'L1', clavier: 'Q', pouce: 'automatique', attendu: 'changer', geste: null },
  { id: 'tacle', partie: 'defense', action: 'Tacle', xbox: 'X', ps: '□', clavier: 'S', pouce: 'coup sec', attendu: 'tacle', geste: 'glissade sur la hanche, pieds devant' },
  { id: 'recuperer', partie: 'defense', action: 'Récupérer du pied', xbox: 'B', ps: '○', clavier: 'Espace', pouce: 'toucher', attendu: 'tacle', geste: 'pied tendu vers la balle, debout' },
  { id: 'epaule', partie: 'defense', action: 'Épaule, tirage', xbox: 'B tenu', ps: '○ tenu', clavier: 'Espace tenu', pouce: '—', attendu: null, geste: 'épaule contre épaule ; dans le dos, le bras qui tire' },
  { id: 'contenir', partie: 'defense', action: 'Contenir', xbox: 'LT', ps: 'L2', clavier: 'C', pouce: '—', attendu: null, geste: 'pas chassés face au porteur' },
  { id: 'presser', partie: 'defense', action: 'Presser', xbox: 'A tenu', ps: '✕ tenu', clavier: 'D tenu', pouce: 'glisser', attendu: null, geste: null },
  { id: 'renfort', partie: 'defense', action: 'Pressing d\'un coéquipier', xbox: 'RB tenu', ps: 'R1 tenu', clavier: 'R tenu', pouce: '—', attendu: null, geste: null },
  { id: 'sortie', partie: 'defense', action: 'Sortie du gardien', xbox: 'Y tenu', ps: '△ tenu', clavier: 'F tenu', pouce: '—', attendu: null, geste: 'sortie du gardien, bras ouverts' },
  { id: 'choisir', partie: 'defense', action: 'Prendre celui de ce côté', xbox: 'RS', ps: 'RS', clavier: 'I J K L', pouce: '—', attendu: 'changer', geste: null },
  // ── le jeu ──
  { id: 'pause', partie: 'jeu', action: 'Pause', xbox: 'Menu', ps: 'Options', clavier: 'Échap', pouce: 'toucher le voile', attendu: null, geste: null },
  { id: 'touches', partie: 'jeu', action: 'Les touches', xbox: 'Vue', ps: 'Share', clavier: '—', pouce: '—', attendu: null, geste: null },
];

export const PARTIES = [
  { id: 'attaque', titre: 'Attaque' },
  { id: 'libre', titre: 'Balle libre' },
  { id: 'gestes', titre: 'Gestes' },
  { id: 'defense', titre: 'Défense' },
];

/** Le tableau en Markdown (pour le compte rendu). */
export function touchesMarkdown() {
  const titres = { attaque: 'Attaque, balle au pied', libre: 'Balle libre', gestes: 'Gestes au stick droit (balle au pied, relatifs au cap du joueur)', defense: 'Défense', jeu: 'Le jeu' };
  const out = [];
  for (const p of ['attaque', 'libre', 'gestes', 'defense', 'jeu']) {
    out.push(`### ${titres[p]}`, '', '| Action | Xbox | PlayStation | Clavier | Pouce |', '|---|---|---|---|---|');
    for (const t of TOUCHES.filter((x) => x.partie === p)) out.push(`| ${t.action} | ${t.xbox} | ${t.ps} | ${t.clavier} | ${t.pouce} |`);
    out.push('');
  }
  return out.join('\n');
}
