// Les matières des joueurs (bola-app#26, lot 4) : le footballeur Ch38 garde ses textures et sa tenue teintée par le code
// (personnage.js, habiller : maillot noir ou blanc, TOUJOURS par la couleur du code) ; on change seulement la façon dont
// la lumière de la salle s'y pose. Aucune texture ni passe en plus : quelques lignes dans les shaders standard de three
// (onBeforeCompile), une clé de programme versionnée par matière (à changer à chaque modification du shader).
//
//   tissu    : le velouté d'un maillot de sport (sheen bon marché) : la lumière ambiante de la salle remonte sur les
//              bords du tissu, vus de biais — un maillot noir n'est plus un trou noir, un blanc reste mat (rugosité 0,88).
//   peau     : un éclairage enveloppé (la lumière « passe » un peu le terminateur, comme sous la peau) sur la seule part
//              diffuse, une pointe de chaud dans les ombres propres ; reflets plus larges et plus faibles (rugosité 0,62,
//              reflet de la salle à 0,45) : le visage n'a plus l'air verni.
//   cheveux  : mats (rugosité 0,95, reflet de la salle à 0,2), sans éclat plastique.
//   crampons : du synthétique un peu satiné (rugosité 0,5).
import * as THREE from 'three';

const PHYS = THREE.ShaderChunk.lights_physical_pars_fragment;
const LIGNE_DIFFUS = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );';
// l'éclairage enveloppé (wrap 0,45) sur la diffuse seule, et le chaud au terminateur
const PEAU = PHYS.includes(LIGNE_DIFFUS)
  ? PHYS.replace(LIGNE_DIFFUS, `{ float nlB = dot( geometryNormal, directLight.direction );
      float enveloppe = saturate( ( nlB + 0.45 ) / 1.45 ), terminateur = max( 0.0, enveloppe - saturate( nlB ) );
      reflectedLight.directDiffuse += directLight.color * BRDF_Lambert( material.diffuseContribution ) * ( enveloppe + terminateur * vec3( 0.35, 0.08, 0.02 ) ); }`)
  : null;

export const MATIERES = {
  tissu: { roughness: 0.88, env: 0.5, cle: 'bola-jeu-tissu-v1' },
  peau: { roughness: 0.62, env: 0.45, cle: 'bola-jeu-peau-v2' },
  cheveux: { roughness: 0.95, env: 0.2, cle: 'bola-jeu-cheveux-v1' },
  crampons: { roughness: 0.5, env: 0.6, cle: 'bola-jeu-crampons-v1' },
};

/** Pose la matière `genre` sur un MeshStandardMaterial (cloné par l'appelant). */
export function matiere(m, genre) {
  const M = MATIERES[genre];
  if (!M || !m.isMeshStandardMaterial) return m;
  m.roughness = M.roughness; m.envMapIntensity = M.env;
  if (genre === 'tissu') {
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if defined( RE_IndirectDiffuse )
        { float frB = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), 3.0 );
          reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( mix( vec3( 0.32 ), diffuseColor.rgb, 0.35 ) ) * frB; }
        #endif`);
    };
  } else if (genre === 'peau' && PEAU) {
    m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <lights_physical_pars_fragment>', PEAU); };
  } else return m;
  m.customProgramCacheKey = () => M.cle;
  m.needsUpdate = true;
  return m;
}
