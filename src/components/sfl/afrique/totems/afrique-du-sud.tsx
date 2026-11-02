// Le totem de l'Afrique du Sud (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le springbok (Antidorcas marsupialis), l'animal national, saisi dans le
// bond qui lui donne son nom (spring, sauter ; bok, l'antilope) : le
// « pronk », où il saute sur place, les quatre pieds quittant le sol ensemble.
// Le dos en voûte, un cran au garrot (le sommet des épaules), le cou fin à
// sa base qui plonge, la tête basse ; les quatre pattes raides et serrées
// sous lui, ramenées en faisceau, les sabots groupés, et pourtant
// articulées : la cuisse, le jarret pointé en arrière, le genou, le boulet ;
// le ventre presque à plat (le coude à la hauteur du grasset, en plein
// bond). La crête de poils blancs ouverte sur l'échine : un éventail de
// longs poils couchés vers la croupe ; le miroir blanc de la fesse, la
// queue à pointe noire. La tête en coin, à la mesure du corps (celle d'une
// antilope, pas d'un oiseau) : le chanfrein fauve, la face blanche, l'œil
// sombre cerné d'un filet de chaux, la raie brun-rouge de l'œil à la
// commissure ; l'oreille longue et étroite couchée le long du cou ; les
// cornes en lyre, fines, qui montent, partent en arrière, puis dont la
// pointe revient en avant, annelées sur les deux tiers du bas. La bande
// brun-rouge du flanc, tout le long du bas du tronc, du coude au devant de
// la cuisse, entre le fauve cannelle du dos et le blanc du ventre. Ni le
// bond allongé ni la tête de l'emblème du rugby.
//
// Il est peint comme un mur ndebele (../afrique-du-sud.tsx), à la règle :
// rien que des segments droits, un cerne de suie d'épaisseur constante,
// doublé dedans d'un filet de chaux, puis les champs remplis des terres
// d'avant les pigments du commerce (le fauve cannelle, la terre brun-rouge,
// la chaux) ; la bande du flanc devient une frise de losanges de chaux au
// cœur noir ; la crête, un éventail de chaux posé dans le fauve, cerné d'un
// filet fin, ses poils tirés à la règle (rien ne déborde sur le mur).
//   · au dos : le héros, centré, en plein bond sous la lune et le couvercle
//     de panier d'ilala, plus petit et monté en haut (LUNE_AFRIQUE_DU_SUD, que
//     le skin lit) ; son ombre, un aplat de suie loin sous les sabots, ne
//     touche pas le bandeau du logotype ;
//   · à la face : le springbok entier, petit, cerné de suie et de chaux sur
//     le portrait, dans le coin bas gauche, à droite de l'équerre du coin.
// Les tracés sont posés à la main, point par point ; la graine ne sert à rien
// ici.

import type { PropsTotem, TotemNation } from "../types";

/** La lune et le panier d'ilala, montés au-dessus du springbok (le skin, ../afrique-du-sud.tsx, les lit). */
export const LUNE_AFRIQUE_DU_SUD = { cx: 512, cy: 318, d: 140 } as const;

// <tracés>
/** Le corps, la tête et les pattes proches, d'un seul cerne : la voûte du dos, le cou qui plonge, la tête basse, l'avant-bras, le genou, le canon, le boulet ; la cuisse, le jarret. */
const CORPS =
  "M26 118L42 84L66 66L104 50L148 42L192 45L226 56L248 59L260 71L294 104L328 138L364.4 161.8L377.2 171.9L386.5 186.8L389.3 195.5L399.4 217.7L408.2 238.1L413 252L412.8 259.9L409.3 264.7L403.4 265.8L397.7 262.8L393.8 262.7L388.4 258.3L377.2 244.5L363 230.1L350.2 219.9L341.3 209.9L337.3 199.4L338.3 188.5L342.2 178.2L332 184L306 164L284 148L270 176L269 200L263 222L249 270L245 282L239 296L223 338L223 350L217 364L216 380L199 378L202 364L206 350L213 296L219 282L227 238L232 194L208 187L182 182L158 176L153 184L147 208L138 234L131 254L137 270L166 332L169 345L174 360L180 378L163 380L159 366L154 352L124 286L114 271L105 256L90 238L70 215L52 191L39 166L31 140Z";
/** Les pattes lointaines, serrées contre les proches. */
const LOIN =
  "M267 182L252 216L238 264L234 276L228 290L212 332L212 344L206 358L205 374L188 372L191 358L195 344L202 290L208 276L216 232L221 188L213 188ZM172 164L165 178L159 202L150 228L143 248L149 264L178 326L181 339L186 354L192 372L175 374L171 360L166 346L136 280L126 265L117 250L102 232L82 209L92 220L112 164Z";
/** Les sabots, groupés. */
const SABOTS =
  "M199.6 365L217.1 365L216.5 380L199 380ZM161.4 365L178.4 365L180 380L163 380ZM188.6 359L206.1 359L205.5 374L188 374ZM173.4 359L190.4 359L192 374L175 374Z";
/** La queue blanche, et sa pointe noire. */
const QUEUE =
  "M31 116L22 136L18 156L28 158L32 140L40 122Z";
const POINTE =
  "M18 156L15 172L27 172L28 158Z";
/** La crête dorsale ouverte : un éventail de longs poils blancs couchés vers l'arrière, posé dans le fauve le long de l'échine, cerné d'un filet fin. */
const CRETE =
  "M65.3 78.3L70.8 75.8L76.2 73.3L81.7 70.9L87.2 68.4L92.6 65.9L98.1 63.5L103.6 61L106.4 59.7L112.3 58.6L118.2 57.5L124.1 56.5L130 55.4L135.9 54.3L141.8 53.3L147.7 52.2L151.3 52.3L157.3 52.8L163.3 53.3L169.3 53.8L175.2 54.3L181.2 54.8L187.2 55.3L193.2 55.8L192.8 59.8L186.7 60.7L180.5 63.4L174.3 66L168 68.4L161.8 70.6L155.7 72.6L149.5 74.3L152 75.6L146.4 78.1L140.6 80.2L134.8 81.8L129 83L123 83.8L117 84.1L110.8 84L113.1 82L106.8 82.7L100.4 83.1L93.8 83.2L87.2 83.1L80.5 82.8L73.7 82.4L66.9 81.9Z";
const POILS_CRETE =
  "M84.8 82.5L70.3 77.1M96.9 82.7L75.7 74.7M108.7 82.1L82.1 71.8M111.8 83.6L90.3 68.1M122.9 83.3L98.5 64.4M133.8 81.6L105.6 60.9M144.4 78.4L117.4 58.7M146.5 74.5L130.2 56.4M157.8 71.5L145 53.7M169.1 67.5L157.2 53.8M180.5 62.9L173.2 55.1";
/** Le blanc du ventre. */
const VENTRE =
  "M232 194L208 187L182 182L158 176L148 175L149.3 162.1L160.6 163.3L184.8 169.3L211 174.4L235.6 181.5Z";
/** La bande du flanc, du coude au grasset, qui suit la ligne du ventre. */
const BANDE =
  "M235.6 181.5L211 174.4L184.8 169.3L160.6 163.3L149.3 162.1L140 160L136 148L141 140L158 147L182 153L208 158L237 162Z";
/** Ses losanges de chaux, et leur cœur noir. */
const LOSANGES =
  "M220.5 171.4L213.1 164.1L203.8 168.6L211.2 175.9ZM196.9 167.4L189.7 159.9L180.2 164.2L187.4 171.7ZM173.3 162.8L166.8 154.7L157 158.1L163.5 166.2Z";
const COEURS =
  "M215.1 170.5L212.5 167.9L209.2 169.5L211.8 172.2ZM191.5 166.4L189 163.6L185.6 165.2L188.1 168ZM168 161.3L165.8 158.4L162.3 159.7L164.6 162.6Z";
/** Le miroir blanc de la fesse, qui descend en culotte le long de l'arrière de la cuisse jusqu'au jarret. */
const MIROIR =
  "M18 106L22 140L30 168L44 194L62 220L84 246L104 268L118 256L105 232L89 209L73 185L61 161L55 135L53 106Z";
/** La face blanche, sous le chanfrein fauve. */
const FACE =
  "M364.6 185L373.3 202.9L387 222.9L396.8 242.7L403.1 256.9L405.9 265.5L403.4 265.8L397.7 262.8L393.8 262.7L388.4 258.3L377.2 244.5L363 230.1L350.2 219.9L341.3 209.9L337.3 199.4L338.3 188.5L342.2 178.2L354.1 178.5Z";
/** La raie brun-rouge, de l'œil à la commissure. */
const RAIE =
  "M376.5 195.7L385.4 205.7L402.7 263.6L395.8 262.8L373.5 205.4Z";
/** L'œil. */
const OEIL =
  "M374.8 192.9L384.3 196.7L387 207.3L377 203.8Z";
/** L'oreille, longue et étroite, couchée le long du cou, et son dedans blanc. */
const OREILLE =
  "M381 179.9L377.9 148.1L340.8 101.2L354.6 152.3L367.2 170.4Z";
const OREILLE_IN =
  "M373.7 166.3L372.1 149.2L346 113.6L359.5 151.8Z";
/** La corne proche, en lyre : elle monte, part en arrière, puis sa pointe revient en avant. */
const CORNE =
  "M379.5 182.8L391.5 154.4L391.8 122.2L380.9 96.4L366.9 79.9L364 62.1L373.3 49.7L375.3 51L367.8 62.8L371.5 77.4L386.6 92.9L399.9 120.5L401.4 156L391.2 187.1Z";
/** La corne lointaine. */
const CORNE_LOIN =
  "M371.2 186L383.1 157.5L383.2 125.1L372.2 99.3L358.1 82.8L355.1 65.1L364.3 52.7L366.3 54L358.7 65.8L362.3 80.5L377.3 96.1L390.5 123.6L391.9 158.9L381.5 189.9Z";
/** Les anneaux, sur les deux tiers du bas. */
const ANNEAUX =
  "M383.5 177.9L391.4 180.8M386.4 170.9L393.8 173.7M389.2 164L396.2 166.6M392 157L398.6 159.5M393.1 151L399.7 150.9M393.1 143.5L399.4 143.4M393.2 136L399.1 135.9M393.2 128.5L398.7 128.4M393.3 122.1L398.1 119.9M390.4 115.2L394.8 113.2M387.4 108.3L391.5 106.4M384.5 101.4L388.3 99.6M381.6 95.2L384.4 92.6";
// </tracés>

const CHAUX = "#f2eee4";
const SUIE = "#171513";
/** Le fauve cannelle du dos (teinte 27°, saturation 0,40) ; les pattes lointaines, plus sombres. */
const FAUVE = "#ba895e";
const FAUVE_LOIN = "#8e6142";
const TERRE = "#8c5534";
/** Le cerne : constant partout ; le filet de chaux qui le double, dedans. */
const CERNE = 7;
const FILET = 2.8;

/** Le dos : le springbok peint, cerné de suie, doublé de chaux. */
function Springbok({ id }: { id: string }) {
  const champ = { stroke: SUIE, strokeWidth: CERNE * 0.72, strokeLinejoin: "miter" as const, strokeMiterlimit: 4 };
  return (
    <g>
      <defs>
        <clipPath id={`zc-${id}`}>
          <path d={CORPS} />
        </clipPath>
      </defs>
      {/* Son ombre, un aplat de suie loin sous les sabots groupés : il est en l'air */}
      <path d="M122 390L154 386L230 386L258 390L230 394L154 394Z" fill={SUIE} opacity={0.16} />
      {/* Les pattes lointaines, la corne de derrière, la queue */}
      <path d={LOIN} fill={FAUVE_LOIN} {...champ} />
      <path d={CORNE_LOIN} fill="#3b2e26" stroke={SUIE} strokeWidth={1.5} strokeLinejoin="miter" />
      <path d={QUEUE} fill={CHAUX} {...champ} />
      <path d={POINTE} fill={SUIE} />
      {/* Le corps : le fauve, puis les champs, le filet de chaux dans le cerne */}
      <path d={CORPS} fill={FAUVE} />
      <g clipPath={`url(#zc-${id})`}>
        <path d={VENTRE + MIROIR} fill={CHAUX} {...champ} />
        <path d={BANDE} fill={TERRE} {...champ} />
        <path d={LOSANGES} fill={CHAUX} stroke={SUIE} strokeWidth={2.2} strokeLinejoin="miter" />
        <path d={COEURS} fill={SUIE} />
        {/* La crête : l'éventail de poils blancs le long de l'échine, cerné d'un filet fin ; ses poils couchés vers la croupe */}
        <path d={CRETE} fill={CHAUX} stroke={SUIE} strokeWidth={1.6} strokeLinejoin="miter" strokeMiterlimit={4} />
        <path d={POILS_CRETE} fill="none" stroke={SUIE} strokeWidth={1.2} strokeLinecap="butt" />
        <path d={FACE} fill={CHAUX} {...champ} strokeWidth={CERNE * 0.5} />
        <path d={RAIE} fill={TERRE} />
        <path d={CORPS} fill="none" stroke={CHAUX} strokeWidth={CERNE + 2 * FILET} />
      </g>
      <path d={CORPS} fill="none" stroke={SUIE} strokeWidth={CERNE} strokeLinejoin="miter" strokeMiterlimit={4} />
      <path d={OREILLE} fill={FAUVE} {...champ} strokeWidth={CERNE * 0.55} />
      <path d={OREILLE_IN} fill={CHAUX} />
      <path d={CORNE} fill={SUIE} stroke={SUIE} strokeWidth={1.5} strokeLinejoin="miter" />
      <path d={ANNEAUX} fill="none" stroke={CHAUX} strokeWidth={1.6} />
      <path d={SABOTS} fill={SUIE} />
      {/* L'œil, cerné d'un filet de chaux : il se lit contre le cerne et la raie */}
      <path d={OEIL} fill={SUIE} stroke={CHAUX} strokeWidth={2.2} strokeLinejoin="miter" />
    </g>
  );
}

/**
 * La face : le springbok entier, petit, sur le portrait : le cerne de suie
 * doublé de chaux (lisible sur une photo claire comme sur une sombre), la
 * bande du flanc et la face à peine teintées, les cornes et les sabots pleins.
 */
function Trait({ photo }: { photo: boolean }) {
  const k = photo ? 1 : 0.85;
  const cerne = (d: string, w: number) => (
    <>
      <path d={d} fill="none" stroke={`rgba(242,238,228,${0.78 * k})`} strokeWidth={w + 6} strokeLinejoin="miter" strokeMiterlimit={4} />
      <path d={d} fill="none" stroke={`rgba(23,21,19,${0.82 * k})`} strokeWidth={w} strokeLinejoin="miter" strokeMiterlimit={4} />
    </>
  );
  return (
    <g>
      <path d={LOIN} fill={`rgba(142,97,66,${0.42 * k})`} />
      <path d={CORPS} fill={`rgba(186,137,94,${0.3 * k})`} />
      <path d={BANDE} fill={`rgba(140,85,52,${0.55 * k})`} />
      {cerne(LOIN + CORPS + OREILLE, 7.5)}
      <path d={CORNE + CORNE_LOIN} fill={`rgba(23,21,19,${0.82 * k})`} stroke={`rgba(242,238,228,${0.7 * k})`} strokeWidth={3} />
      <path d={SABOTS + OEIL} fill={`rgba(23,21,19,${0.82 * k})`} />
    </g>
  );
}

function Dessin({ couche, photo, id }: PropsTotem) {
  if (couche === "dos") return <Springbok id={id} />;
  if (couche === "face-portrait") return <Trait photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "za",
  animal: "springbok",
  quoi: "Le springbok en plein pronk, le dos en voûte, un cran au garrot, la tête basse, les quatre pattes raides ramenées en faisceau, l'éventail blanc de la crête ouvert sur l'échine : peint à la règle comme un mur ndebele, un cerne de suie constant doublé de chaux, le fauve cannelle, la terre et la chaux, la bande du flanc en frise de losanges du coude à la cuisse ; entier et cerné de même dans le coin du portrait.",
  sources: [
    { titre: "Animal Diversity Web, Antidorcas marsupialis : le bond, la crête dorsale, les cornes, la robe", url: "https://animaldiversity.org/accounts/Antidorcas_marsupialis" },
    { titre: "Britannica, le springbok : le « pronking », la crête blanche, la bande du flanc", url: "https://www.britannica.com/animal/springbok-mammal" },
    { titre: "Wikipedia, le springbok : le pronk, les quatre pieds ensemble, le dos arqué, la tête basse", url: "https://en.wikipedia.org/wiki/Springbok" },
    { titre: "Navigate Namibia, le springbok", url: "https://namibian.org/nature-wildlife/mammals/antelope/springbok" },
    { titre: "WorldAtlas, le springbok : la face blanche, la raie de l'œil à la bouche", url: "https://animals.worldatlas.com/animals/springbok.html" },
  ],
  dessine: true,
  boite: { w: 420, h: 410 },
  pose: {
    // Centré sous la lune, en plein bond, sur presque toute la largeur du mur : les sabots vers y 1100,
    // son ombre vers 1115 (le filet du bandeau du logotype est à 1156).
    dos: { x: 186, y: 511, echelle: 1.55, devant: true, lune: LUNE_AFRIQUE_DU_SUD },
    // Entier, petit, dans le coin bas gauche du portrait, à droite de l'équerre (x 72–112, y 912–952).
    face: { portrait: { x: 116, y: 794, echelle: 0.44 } },
  },
  Dessin,
};

export default totem;
