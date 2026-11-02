// Le totem de l'Afrique du Sud (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le springbok (Antidorcas marsupialis), l'animal national, saisi dans le
// bond qui lui donne son nom (spring, sauter ; bok, l'antilope) : le
// « pronk », où il saute sur place, les quatre pieds quittant le sol ensemble.
// Le dos en voûte, le cou fin qui plonge, la tête basse ; les quatre pattes
// raides et serrées sous lui, ramenées en faisceau, les sabots groupés, et
// pourtant articulées : la cuisse, le jarret pointé en arrière, le genou, le
// boulet. La crête de poils blancs ouverte sur la croupe ; le miroir blanc
// de la fesse, la queue à pointe noire. La tête courte en coin : le
// chanfrein fauve, la face blanche, la raie brun-rouge de l'œil à la
// commissure ; l'oreille longue et étroite couchée le long du cou ; les
// cornes en lyre, qui montent, partent en arrière, puis dont la pointe
// revient en avant, annelées sur les deux tiers du bas. La bande brun-rouge
// du flanc, du coude au grasset, qui épouse la ligne du ventre, entre le
// fauve cannelle du dos et le blanc du ventre. Ni le bond allongé ni la tête
// de l'emblème du rugby.
//
// Il est peint comme un mur ndebele (../afrique-du-sud.tsx), à la règle :
// rien que des segments droits, un cerne de suie d'épaisseur constante,
// doublé dedans d'un filet de chaux, puis les champs remplis des terres
// d'avant les pigments du commerce (le fauve cannelle, la terre brun-rouge,
// la chaux) ; la bande du flanc devient une frise de losanges de chaux au
// cœur noir, la crête une frange de dents de chaux ; deux traits de
// construction, comme sur le mur, disent la cuisse et l'épaule.
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
  "M26 118L42 84L66 66L104 50L148 42L192 45L228 57L257 72L294 106L328 138L362.1 163.2L371.4 170.6L378.2 181.4L380.3 187.7L387.5 203.9L394 218.7L397.5 228.8L397.3 234.6L394.7 238.1L390.5 238.8L386.4 236.7L383.5 236.6L379.6 233.4L371.4 223.4L361.1 212.9L351.8 205.5L345.3 198.2L342.4 190.6L343.1 182.6L346 175.1L332 184L304 167L277 156L268 180L269 200L263 222L249 270L245 282L239 296L223 338L223 350L217 364L216 380L199 378L202 364L206 350L213 296L219 282L227 242L230 213L208 193L180 177L156 168L153 184L147 208L138 234L131 254L137 270L166 332L169 345L174 360L180 378L163 380L159 366L154 352L124 286L114 271L105 256L90 238L70 215L52 191L39 166L31 140Z";
/** Les pattes lointaines, serrées contre les proches. */
const LOIN =
  "M267 182L252 216L238 264L234 276L228 290L212 332L212 344L206 358L205 374L188 372L191 358L195 344L202 290L208 276L216 236L219 207L213 188ZM170 156L165 178L159 202L150 228L143 248L149 264L178 326L181 339L186 354L192 372L175 374L171 360L166 346L136 280L126 265L117 250L102 232L82 209L92 220L112 164Z";
/** Les sabots, groupés. */
const SABOTS =
  "M199.6 365L217.1 365L216.5 380L199 380ZM161.4 365L178.4 365L180 380L163 380ZM188.6 359L206.1 359L205.5 374L188 374ZM173.4 359L190.4 359L192 374L175 374Z";
/** La queue blanche, et sa pointe noire. */
const QUEUE =
  "M31 116L22 136L18 156L28 158L32 140L40 122Z";
const POINTE =
  "M18 156L15 172L27 172L28 158Z";
/** La crête dorsale ouverte : une frange de dents de chaux, de la croupe au milieu du dos. */
const CRETE =
  "M55.3 86L69.9 73L106.2 57.7L148.5 50L189.4 53L182.2 40.9L177.4 37.1L171.2 40.1L166.5 35.7L160.3 37.6L155.9 29L149.6 34L141 24.1L136.5 33.3L129.3 21.6L125.4 33.3L117.9 20.3L114.3 34L106.8 20.4L103.4 35.4L90.7 24.2L90.9 40.1L81.1 29.7L81.1 45.3L72 36.5L71.7 51.1L63.5 44.5L62.4 57.6L52.5 57L54 67.9L48 68.5L47.7 77.4Z";
/** Le blanc du ventre. */
const VENTRE =
  "M240 216L230 213L208 193L180 177L156 168L148 167L149.9 152.1L160.5 153.7L186.5 163.5L216.8 180.8L238.8 200.8L244.3 201.6Z";
/** La bande du flanc, du coude au grasset, qui suit la ligne du ventre. */
const BANDE =
  "M244.3 201.6L238.8 200.8L216.8 180.8L186.5 163.5L160.5 153.7L149.9 152.1L152.7 129.3L167.3 131.7L196.5 142.8L230.2 162.2L252.2 182.1L250.9 179.6Z";
/** Ses losanges de chaux, et leur cœur noir. */
const LOSANGES =
  "M242.9 189.1L240.2 177.9L228.8 176.3L231.5 187.5ZM223.7 171.6L218.7 161.2L207.2 162.1L212.2 172.5ZM201.1 158.7L196.1 148.3L184.6 149.2L189.6 159.6ZM177.6 147.9L171 138.4L159.8 141.1L166.4 150.6Z";
const COEURS =
  "M238.4 185L237.5 181L233.3 180.4L234.2 184.5ZM218.4 168.6L216.6 164.8L212.5 165.2L214.2 168.9ZM195.8 155.6L194.1 151.8L189.9 152.2L191.7 156ZM171.8 145.7L169.5 142.3L165.5 143.3L167.8 146.7Z";
/** Le miroir blanc de la fesse, qui descend en culotte le long de l'arrière de la cuisse jusqu'au jarret. */
const MIROIR =
  "M18 106L22 140L30 168L44 194L62 220L84 246L104 268L118 256L105 232L89 209L73 185L61 161L55 135L53 106Z";
/** Les traits de construction : le devant de la cuisse, l'arrière de l'épaule. */
const TRAITS =
  "M156 168L140 140L118 116L92 100M244 156L249 130L252 100";
/** La face blanche, sous le chanfrein fauve. */
const FACE =
  "M362.3 180.1L368.5 193.1L378.6 207.6L385.7 222L390.3 232.4L392.3 238.7L390.5 238.8L386.4 236.7L383.5 236.6L379.6 233.4L371.4 223.4L361.1 212.9L351.8 205.5L345.3 198.2L342.4 190.6L343.1 182.6L346 175.1L354.6 175.4Z";
/** La raie brun-rouge, de l'œil à la commissure. */
const RAIE =
  "M370.9 187.9L377.4 195.2L390 237.3L384.9 236.7L368.7 194.9Z";
/** L'œil. */
const OEIL =
  "M370.1 182.7L376.4 185.4L378.2 192.7L371.5 190.3Z";
/** L'oreille, longue et étroite, couchée le long du cou, et son dedans blanc. */
const OREILLE =
  "M374.1 176.4L371.9 153.3L345 119.2L355 156.3L364.1 169.5Z";
const OREILLE_IN =
  "M368.9 166.5L367.7 154L348.7 128.2L358.5 156Z";
/** La corne proche, en lyre : elle monte, part en arrière, puis sa pointe revient en avant. */
const CORNE =
  "M372.1 178.1L382 154.7L382.3 128.3L373.4 107.1L361.9 93.4L359.5 78.5L367.2 68.1L369.2 69.5L363 79.1L366.1 91L378.6 103.8L389.7 126.7L391 156.2L382.6 182Z";
/** La corne lointaine. */
const CORNE_LOIN =
  "M363.9 181.4L373.6 157.8L373.8 131.2L364.7 109.9L353.1 96.3L350.6 81.5L358.2 71.1L360.2 72.5L353.9 82.1L356.9 94.1L369.3 107L380.3 129.8L381.4 159.1L372.9 184.7Z";
/** Les anneaux, sur les deux tiers du bas. */
const ANNEAUX =
  "M376 173.1L383 175.7M378.8 166.2L385.3 168.6M381.6 159.2L387.8 161.5M383.4 153.3L389.5 153.2M383.5 145.8L389.2 145.7M383.6 138.3L388.9 138.2M383.6 130.8L388.5 130.7M382.2 124.5L386.3 122.7M379.3 117.6L383.1 115.9M376.3 110.7L379.8 109.1";
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
      {/* Les pattes lointaines, la corne de derrière, la queue, la crête ouverte */}
      <path d={LOIN} fill={FAUVE_LOIN} {...champ} />
      <path d={CORNE_LOIN} fill="#3b2e26" stroke={SUIE} strokeWidth={1.5} strokeLinejoin="miter" />
      <path d={QUEUE} fill={CHAUX} {...champ} />
      <path d={POINTE} fill={SUIE} />
      <path d={CRETE} fill={CHAUX} {...champ} strokeWidth={CERNE * 0.55} />
      {/* Le corps : le fauve, puis les champs, le filet de chaux dans le cerne */}
      <path d={CORPS} fill={FAUVE} />
      <g clipPath={`url(#zc-${id})`}>
        <path d={VENTRE + MIROIR} fill={CHAUX} {...champ} />
        <path d={BANDE} fill={TERRE} {...champ} />
        <path d={LOSANGES} fill={CHAUX} stroke={SUIE} strokeWidth={2.2} strokeLinejoin="miter" />
        <path d={COEURS} fill={SUIE} />
        <path d={TRAITS} fill="none" {...champ} />
        <path d={FACE} fill={CHAUX} {...champ} strokeWidth={CERNE * 0.5} />
        <path d={RAIE} fill={TERRE} />
        <path d={CORPS} fill="none" stroke={CHAUX} strokeWidth={CERNE + 2 * FILET} />
      </g>
      <path d={CORPS} fill="none" stroke={SUIE} strokeWidth={CERNE} strokeLinejoin="miter" strokeMiterlimit={4} />
      <path d={OREILLE} fill={FAUVE} {...champ} strokeWidth={CERNE * 0.55} />
      <path d={OREILLE_IN} fill={CHAUX} />
      <path d={CORNE} fill={SUIE} stroke={SUIE} strokeWidth={1.5} strokeLinejoin="miter" />
      <path d={ANNEAUX} fill="none" stroke={CHAUX} strokeWidth={1.6} />
      <path d={OEIL + SABOTS} fill={SUIE} />
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
  quoi: "Le springbok en plein pronk, le dos en voûte, la tête basse, les quatre pattes raides ramenées en faisceau, la crête blanche ouverte : peint à la règle comme un mur ndebele, un cerne de suie constant doublé de chaux, le fauve cannelle, la terre et la chaux, la bande du flanc en frise de losanges ; entier et cerné de même dans le coin du portrait.",
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
