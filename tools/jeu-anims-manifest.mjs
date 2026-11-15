// Les clips Mixamo ajoutés au jeu /jouer par bola-app#26 (lot 1), par paquet. Lu par tools/jeu-anims.mjs.
//
// file : nom du FBX de la bibliothèque Mixamo de Sabri (sabrilab/mixamo-library, « Mixamo Animations/Liam@<file>.fbx »,
//        le même fichier que sabrilab/aeriea branche assets/mixamo-raw) ; les FBX ne sont JAMAIS copiés dans SFL : seul
//        le .pak brouillé l'est (licence Mixamo : intégré au jeu, pas redistribué).
// loop : boucle ; fps : images par seconde (30, 15 pour les clips lents : chutes, relevés, fêtes) ; mirror : symétrie
// gauche / droite ; root: 'keep' : le déplacement des hanches reste dans le clip (plongeons) ; from / to : rognage (s) ;
// hit : instant d'impact (vitesse maximale de hitBone, entre hitAfter et hitBefore), hitAt : instant d'impact imposé (s) ; unturn : le lacet du bassin
// est retiré et rendu à part (courbe turn) ; yaw : le corps entier tourné de cet angle autour de la verticale, sans
// toucher au root motion (le tacle glissé : la glissade sur le dos de « sprint_to_backslide », tournée d'un demi-tour,
// devient une glissade pieds devant) ; noRoot : pas de root motion (la simulation fait glisser le corps).
// Les paquets player, keeper et celeb (bola-game, tools/anims/manifest.mjs) ne sont pas réécrits : ils marchent.
const L = (file, x = {}) => ({ file, loop: true, ...x }), O = (file, x = {}) => ({ file, ...x });

export const PACKS = {
  player2: {
    // le tacle glissé : couché sur le dos, pieds devant, la jambe gauche tendue vers la balle ; la simulation glisse
    slide: O('sprint_to_backslide', { from: 0.3, to: 1.1, yaw: Math.PI, noRoot: true, hitAt: 0.55 }),
    // les relevés : du dos (après une glissade, un coup d'épaule, une chute en arrière) et du ventre
    getup_dos: O('getting_up (1)', { fps: 15 }),
    getup_ventre: O('stand_up (1)', { fps: 15 }),
    // les contrôles : amorti au pied (sur place), pied levé (balle haute), sombrero (balle levée), cuisse gauche
    trap: O('receive', { hitAt: 0.3 }),
    trap_l: O('receive', { hitAt: 0.3, mirror: true }),
    stall: O('stall_soccerball (2)', { hitAt: 0.35 }),
    stall_l: O('stall_soccerball', { hitAt: 0.35 }),
    kickup: O('kick_up_soccerball', { hitAt: 0.6 }),
    kickup_l: O('kick_up_soccerball', { hitAt: 0.6, mirror: true }),
    knee_l: O('kneeing_soccerball', { hit: true, hitBone: 'RightLeg', mirror: true }),
    head_std: O('header', { hitAt: 0.62 }),
    // les contacts : coups d'épaule reçus, déséquilibre en course, chutes
    hit_l: O('standing_react_large_from_left (1)'),
    hit_r: O('standing_react_large_from_right (2)'),
    stagger: O('shove_reaction (1)', { fps: 15 }),
    fall_side: O('shoulder_hit_and_fall', { fps: 15 }),
    fall_back: O('stumble_backwards', { fps: 15 }),
    fall_sweep: O('sweep_fall', { fps: 15 }),
    fall_trip: O('tripping (1)', { fps: 15 }),
    // départ, demi-tour sur place, feinte de corps
    start: O('two_cycle_sprint'),
    turn180_std: O('quick_180_turn', { unturn: true }),
    feint_r: O('standing_dodge_right'),
    feint_l: O('standing_dodge_right', { mirror: true }),
  },
  keeper2: {
    k_catch_std: O('goalkeeper_catch (1)'),
    k_high: O('goalkeeper_catch (2)'),
    // le plongeon bas : la parade couchée de goalkeeper_body_block, hanches gardées (1,7 m vers sa gauche ; miroir à droite)
    k_low_l: O('goalkeeper_body_block', { root: 'keep' }),
    k_low_r: O('goalkeeper_body_block', { root: 'keep', mirror: true }),
    k_pass: O('goalkeeper_pass', { fps: 15, hit: true, hitBone: 'RightFoot' }),
    k_roll: O('goalie_throw', { fps: 15, hit: true, hitBone: 'RightHand' }),
  },
  celeb2: {
    c_chest: O('standing_taunt_chest_thump', { fps: 15 }),
    c_thumbs: O('standing_thumbs_up', { fps: 15 }),
    c_victory: L('victory_idle (1)', { fps: 15 }),
    c_slide: O('sprint_to_backslide', { fps: 15 }),
  },
};
