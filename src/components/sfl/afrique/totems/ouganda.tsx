// Le totem de l'Ouganda (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// La grue royale couronnée (Balearica regulorum gibbericeps, celle de
// l'Ouganda ; la sélection, ce sont les Cranes), debout, de profil, tournée
// vers la lune. La couronne : un éventail large et dense de soies fines et
// raides, de longueurs inégales, un peu torses, enracinées derrière le
// coussin de velours noir du front, leur pied brun-gris ; la joue nue
// blanche et sa plaque rouge, le fanon rouge sous le menton, l'œil pâle, le
// bec court. Le cou en S léger, qui s'élargit vers la poitrine sous les
// plumes lancéolées pâles ; le corps un peu incliné, le grand panneau blanc
// de l'aile qui en suit la courbe, le noir des rémiges dessous, et les
// tertiaires roux-châtaigne, de longues plumes pointues et séparées qui
// tombent en cascade sur la queue. Les longues pattes noires : le tibia nu,
// l'articulation au tiers du haut, le tarse, et le pied, trois doigts étalés
// vers l'avant et le long pouce derrière (celui qui lui permet de percher).
//
// Elle est cousue dans le tissu d'écorce (../ouganda.tsx) : chaque partie
// est une pièce rapportée d'une autre teinte (le gris est une écorce fumée,
// le blanc une pièce pâle, chaque tertiaire une pièce roux-châtaigne), qui
// garde les stries du maillet et que tiennent de petits points de surjet
// irréguliers de fibre claire ; les plumes lancéolées ont leur nervure au
// point avant ; la couronne, ce sont de longues piqûres de fibre de paille,
// une par soie ; les pattes, un cordon noir couché, tenu par des points en
// travers.
//   · au dos : le héros, debout à gauche, les pieds sur la couture qui
//     devient le sol ; la lune et sa vannerie montées en haut à droite
//     (LUNE_OUGANDA, que le skin lit), devant son bec ;
//   · à la face : sa tête et sa couronne brodées dans le coin bas gauche du
//     portrait, à droite de l'équerre : la joue blanche et le velours remplis,
//     les soies en longues piqûres claires.
// Les tracés sont posés à la main (points, puis béziers ; les soies, un
// éventail réglé à la main) ; la graine ne sert qu'aux stries de l'écorce.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune et la vannerie, montées à droite, devant le bec de la grue (le skin, ../ouganda.tsx, les lit). */
export const LUNE_OUGANDA = { cx: 786, cy: 300, d: 150 } as const;

// <tracés>
/** La grande pièce grise : le cou en S léger, la tête, le dos incliné, la queue, le ventre, la poitrine. */
const CORPS =
  "M478 214C477.4 217.9 478 231.5 476 240C473.9 249 469.3 257.3 466 266C462 276.7 456.7 286.9 454 298C451.3 309.1 449.3 320.6 450 332C450.7 343.6 455.6 354.6 458 366C460.3 376.6 467.5 387.7 464 398C460 409.6 448.2 417.3 438 424C426.5 431.5 413.1 435.8 400 440C383.7 445.2 366.6 447.7 350 452C333.2 456.4 316.4 460.3 300 466C283.6 471.7 267.5 478.2 252 486C238.1 493 224.5 500.7 212 510C201 518.2 185.7 533.1 182 538C179.3 541.7 171.3 555.9 170 566C169.2 572.3 173.5 582.6 176 584C181.1 586.8 201.4 587.6 214 590C229.4 592.9 244.5 597.7 260 600C276.5 602.4 293.3 604.3 310 604C326.8 603.7 343.7 602 360 598C376.6 593.9 392.8 587.8 408 580C423 572.3 437.4 563.2 450 552C461.7 541.6 471.6 529.2 480 516C488.4 502.9 494.7 488.6 500 474C504.7 461.1 509.7 447.7 510 434C510.3 420.4 506 407 502 394C498 380.9 489.5 369.3 486 356C482.8 343.7 481.3 330.7 482 318C482.6 306.4 486.1 295 490 284C493.5 274.2 499.8 265.6 504 256C507.1 248.9 510.8 237.3 512 234C512.6 232.2 514.2 222.7 516 222C520.5 220.3 537.4 221.3 548 220C554.1 219.3 566 216 566 216C566 216 553 208.7 546 206C538.9 203.3 527.2 201.2 524 200C521.5 199.1 513.9 193.1 508 192C502.7 191 497 192.1 492 194C488 195.5 484.4 198.5 482 202C479.6 205.5 478.3 212.1 478 214Z";
/** Le panneau blanc des couvertures de l'aile, qui suit la courbe du corps. */
const BLANC =
  "M452 452C448.1 449.2 430.7 448 420 448C405.3 448 390.6 449.8 376 452C359.2 454.5 342.4 457.6 326 462C309.7 466.3 293.7 471.7 278 478C263.6 483.8 249.4 490.2 236 498C225.3 504.2 207.3 514.6 206 520C205.1 523.7 220.1 529.4 228 532C240.9 536.2 254.5 538.5 268 540C283.9 541.8 300 542.7 316 542C332.8 541.3 349.6 539.4 366 536C381.7 532.7 397.2 528.3 412 522C424.1 516.9 436.1 510.7 446 502C453.2 495.6 460.9 487.5 462 478C463.1 468.8 455.4 454.4 452 452Z";
/** Le noir des rémiges, sous le blanc. */
const NOIR =
  "M400 528C397.3 520.8 366.9 537.1 350 540C332.2 543.1 314.1 545 296 546C278.7 547 261.3 547.1 244 546C230.5 545.1 202.8 534.1 204 540C205.3 546.6 231.4 552.7 246 556C263.7 560 281.9 562 300 562C318.8 562 338.2 562 356 556C372.5 550.4 402.7 535.3 400 528Z";
/** Les tertiaires : de longues plumes pointues, séparées, qui tombent en cascade sur la queue. */
const TERTIAIRES =
  "M322 500C322 500 295 507 282 512C266.9 517.7 251.9 523.9 238 532C224.4 539.9 211.3 549 200 560C189.1 570.6 172 596 172 596C172 596 200.2 584.4 214 578C228.9 571.1 243.4 563.5 258 556C272.1 548.8 288.1 544.4 300 534C310.2 525.1 322 500 322 500ZM300 512C300 512 271.5 521.6 258 528C243.4 534.9 228.9 542.3 216 552C204 561.1 193.3 572.1 184 584C174.5 596.3 160 624 160 624C160 624 186.7 608.1 200 600C214.1 591.4 228.1 582.8 242 574C256.7 564.8 274.1 558.7 286 546C294.4 537 300 512 300 512ZM282 524C282 524 256.1 536.4 244 544C230.7 552.4 217.5 561.2 206 572C195.3 582.1 185.5 593.4 178 606C170 619.6 160 650 160 650C160 650 182.2 628.2 194 618C206.2 607.5 219.2 597.8 232 588C245.2 577.8 261.7 571.1 272 558C279.3 548.7 282 524 282 524ZM268 538C268 538 245.7 552.9 236 562C225.6 571.7 215.8 582.2 208 594C200.3 605.7 194.2 618.6 190 632C185.5 646.2 182 676 182 676C182 676 200.3 650.4 210 638C219 626.4 228.5 615.2 238 604C247.2 593.2 260.1 584.9 266 572C270.7 561.7 268 538 268 538ZM262 554C262 554 247.9 573.5 242 584C235.9 594.9 229.9 606.1 226 618C221.8 630.9 219 644.4 218 658C217 672.6 220 702 220 702C220 702 232 674 238 660C243.4 647.4 248.4 634.6 254 622C259.1 610.6 268.5 600.4 270 588C271.4 576.4 262 554 262 554Z";
/** Les plumes lancéolées du bas du cou, sur la poitrine. */
const LANCES =
  "M488 376C488 376 494.1 398.5 496 410C498.1 423.2 500.3 436.6 500 450C499.7 464.1 494 492 494 492C494 492 488 465.4 486 452C484 438.7 481.6 425.4 482 412C482.3 399.8 488 376 488 376ZM480 394C480 394 484.7 419.2 486 432C487.4 445.9 489 460 488 474C487 488.2 480 516 480 516C480 516 475.3 489.4 474 476C472.6 461.4 470.9 446.6 472 432C472.9 419.1 480 394 480 394ZM470 410C470 410 473.4 436.6 474 450C474.7 464.7 475.7 479.4 474 494C472.3 508.3 464 536 464 536C464 536 460.3 508.1 460 494C459.7 479.3 460.3 464.6 462 450C463.6 436.5 470 410 470 410ZM460 424C460 424 462.3 452 462 466C461.7 480.1 460.7 494.2 458 508C455.3 521.7 446 548 446 548C446 548 445 520 446 506C447 491.9 449.6 477.9 452 464C454.3 450.6 460 424 460 424Z";
/** Leur nervure, au point avant. */
const NERVURES =
  "M488 376L491 431L494 492M480 394L480 453L480 516M470 410L468 472L464 536M460 424L455 486L446 548";
/** Le coussin de velours noir du front. */
const VELOURS =
  "M482 202C480.9 199.7 484.8 190.7 488 186C491 181.7 495.1 177.9 500 176C504.4 174.3 509.5 174.6 514 176C518.6 177.4 523.2 180.1 526 184C528.9 187.9 530.2 195.8 530 198C529.9 199.1 526.4 202.2 524 202C518.3 201.5 513.6 196.8 508 196C503.3 195.4 498.6 196.9 494 198C489.9 198.9 482.8 203.7 482 202Z";
/** La joue nue, blanche, et sa plaque rouge au-dessus. */
const JOUE =
  "M480 208C482.3 204.9 486.2 202.7 490 202C494 201.3 498.4 202.2 502 204C505.4 205.7 508.6 208.5 510 212C511.5 215.7 511.4 220.2 510 224C508.5 228 505.7 231.8 502 234C498.5 236.1 493.9 237.2 490 236C486.4 234.9 484.1 231.1 482 228C480 225 478.4 221.6 478 218C477.7 214.6 478 210.7 480 208Z";
const ROUGE =
  "M480 208C480 208 484.7 201.8 488 200C491 198.3 494.7 197.3 498 198C501.8 198.8 508 204 508 204C508 204 501.3 204.5 498 205C494.6 205.5 491.4 206.4 488 207C485.3 207.4 480 208 480 208Z";
/** Le fanon rouge sous le menton. */
const FANON =
  "M512 226C513.7 225.4 516.9 232.3 518 236C519.6 241.1 520.4 246.6 520 252C519.7 256.8 518.7 262 516 266C514.3 268.5 510.3 271.9 508 270C504.3 266.9 504.3 260.8 504 256C503.6 250.6 504.6 245.2 506 240C507.3 235.1 509.8 226.7 512 226Z";
/** Le bec, court. */
const BEC =
  "M524 200C524 200 538.9 203.3 546 206C553 208.7 566 216 566 216C566 216 554.1 219.1 548 220C540.7 221.1 526 222 526 222C526 222 524 200 524 200Z";
/** Les pattes : le tibia nu, l'articulation au tiers du haut, le tarse ; la lointaine, puis la proche. */
const PATTE_LOIN =
  "M300 596C300 596 299 632 298 650C297 666.7 296 683.4 294 700C293.3 705.5 290.2 713.5 290 716C289.9 718.1 291.6 725.3 292 730C294.2 753.3 296 776.7 298 800C300 823.3 302.3 846.6 304 870C305.6 892.6 308 927.8 308 938C308 940.2 304 952 304 952C304 952 296 952 296 952C296 952 296.2 940.1 296 938C295.3 927.8 292 892.7 290 870C288 846.7 285.7 823.4 284 800C282.3 776.7 281.1 753.3 280 730C279.8 725.3 279.7 718.1 280 716C280.3 713.5 283.3 705.5 284 700C286 683.4 287.4 666.7 288 650C288.7 632 288 596 288 596C288 596 300 596 300 596Z";
const PATTE =
  "M350 600C350 600 350.3 633.3 350 650C349.7 666.7 349.3 683.4 348 700C347.6 704.8 345.1 711.9 345 714C344.9 716.1 346.5 723.3 347 728C349.5 752 351.8 776 354 800C356.1 823.3 358.3 846.6 360 870C361.7 893.3 364 929.5 364 940C364 942.2 360 954 360 954C360 954 350 954 350 954C350 954 350.1 942.1 350 940C349.2 929.5 346 893.3 344 870C342 846.7 339.6 823.4 338 800C336.3 776 335.1 752 334 728C333.8 723.3 333.8 716.1 334 714C334.2 711.9 336.7 704.8 337 700C338 683.4 337.8 666.7 338 650C338.2 633.3 338 600 338 600C338 600 350 600 350 600Z";
/** Les doigts : trois vers l'avant, étalés, le pouce vers l'arrière. */
const DOIGTS_LOIN =
  "M300 947.5C300 947.5 315.6 948.3 323.4 949.3C332.5 950.4 350.4 953.8 350.4 953.8C350.4 953.8 332.4 956 323.4 956.5C315.6 956.9 300 956.5 300 956.5C300 956.5 300 947.5 300 947.5ZM300 949.3C300 949.3 312 953.5 318 955.6C325.2 958 339.6 962.8 339.6 962.8C339.6 962.8 323.9 962.2 316.2 961C310.1 960.1 298.2 956.5 298.2 956.5C298.2 956.5 300 949.3 300 949.3ZM300 947.5C300 947.5 310.8 945.8 316.2 945.7C322.8 945.5 336 946.6 336 946.6C336 946.6 322.8 949.8 316.2 951.1C310.8 952.2 300 953.8 300 953.8C300 953.8 300 947.5 300 947.5ZM300 949.3C300 949.3 290.4 950.3 285.6 951.1C279.6 952.1 267.6 954.7 267.6 954.7C267.6 954.7 280.8 956.1 287.4 956.5C291.6 956.7 300 956.5 300 956.5C300 956.5 300 949.3 300 949.3Z";
const DOIGTS =
  "M355 949C355 949 372.4 949.9 381 951C391.1 952.3 411 956 411 956C411 956 391 958.5 381 959C372.3 959.5 355 959 355 959C355 959 355 949 355 949ZM355 951C355 951 368.3 955.7 375 958C383 960.7 399 966 399 966C399 966 381.6 965.3 373 964C366.2 963 353 959 353 959C353 959 355 951 355 951ZM355 949C355 949 367 947.2 373 947C380.3 946.8 395 948 395 948C395 948 380.4 951.5 373 953C367 954.2 355 956 355 956C355 956 355 949 355 949ZM355 951C355 951 344.3 952.1 339 953C332.3 954.1 319 957 319 957C319 957 333.6 958.6 341 959C345.7 959.3 355 959 355 959C355 959 355 951 355 951Z";
/** La couronne : 72 soies fines, de longueurs variées, un peu torses, en éventail derrière le velours. */
const SOIES =
  "M480.2 187.9C463 204.9 439.3 212.2 424 225.8M477.6 189.1C450 203.9 424.8 222.8 401.4 235.8M476.9 189C453.4 198.5 433.9 215 414.1 223.8M477.6 188.2C450.7 200.6 424.9 215 402 225.8M477.2 187.9C450.5 198.2 425.4 211.9 402.7 221M478.2 187.1C451 199.1 422.7 208.1 399.4 218.1M475.9 187.5C444.8 194.1 417.1 210.1 390.8 216.7M477.4 186.5C450.5 194.5 423.6 202.4 400.6 209.2M477.2 186.2C448.2 193.1 419.4 200.7 394.6 206.7M478.8 185.5C448.3 195.5 415.7 195.9 389.3 203.6M478 185.3C442.6 192.8 406.5 195.3 376.1 201.3M476 185.1C440.8 186.7 406.3 194.4 376.2 196.4M477 184.6C447.3 186.5 417.6 188.7 392.1 190.4M478 184.2C440.6 187.3 403.2 184.7 371.2 186.8M475.2 183.8C439.2 179 403 184.9 372.1 181.8M478.5 183.5C445.4 184.7 412.8 177.4 384.5 177.6M476.3 183C439 177.3 401.3 175.9 369.2 171.5M477.6 182.7C444.5 178.9 411.7 172 383.3 168.4M476.8 182.2C442.1 174.5 406.9 169 377.1 162.6M478.3 182.1C445.9 176.7 414.9 165.3 387.3 160.1M477.1 181.4C441.6 170.6 405.8 161.1 375.3 152M477.9 181.3C444.1 171 411.2 158 382.2 149M478.2 181C443.6 169.1 410.3 153.8 380.8 143.3M479.5 181.1C446.3 171.2 417.5 151.2 389.5 141.7M478.8 180.4C449.3 168.3 422.3 151.3 397.3 140.4M479 180.2C448.3 166 420.4 146.5 394.4 133.9M476.7 178.4C448.5 156.5 414.7 143.8 390 125.9M478.5 179C452.9 162 427.4 144.9 405.4 130.3M479.9 179.5C451.8 163 428.7 139.7 405.2 124.9M479.7 178.9C451.1 158.6 425.8 134.2 401.6 116.4M479.7 178.5C448.2 152.8 419.2 124.4 392.5 102.1M480.7 178.9C450.6 155.4 427.3 124.7 402.1 103.8M478.8 176.5C457.7 149.9 430.7 129 412 106.8M480.9 178.2C455.6 153.8 435.9 124.3 414.8 102.8M479.6 176C461.2 148.5 436.9 125.7 420.6 102.5M480 175.8C460.5 144.6 435.3 117.6 418.1 91.4M481.3 177C457.7 143.9 436.8 109.1 416.9 80.5M482.1 177.6C458.5 145.1 442.4 108.2 422.9 80M481 174.9C466.7 142.3 445.3 113.6 432.3 86M481.7 175.3C466.2 140.3 447 107 433.4 77.1M482.8 176.8C465.8 144.3 454.8 109.3 440.8 81.2M482.4 174.8C469.9 137.1 452.6 101.2 441.4 69M483.2 175.7C471.6 142.7 461 109.4 451.2 81.1M483.2 174.4C476.3 142.5 463.8 112.3 457.3 85.2M484 175.9C473.8 140.3 467.4 103.8 459 73.2M484 174C479.4 136.4 467.7 100.1 463.1 68M484.5 174.1C481.9 141.4 473.2 109.6 470.4 81.6M484.9 173.5C484.7 138.5 475.3 104.6 474.2 74.8M485.4 174.6C484.3 143.6 480.9 112.7 479.7 86.2M485.8 173.9C487.7 143.3 483.1 112.8 484 86.5M486.2 175.1C486.8 143 487.8 110.9 488.4 83.4M486.6 175.6C487.4 145.4 491.4 115.4 492.4 89.6M486.9 175.8C489.3 139.5 495.9 103.7 498.4 72.7M487.3 175.7C491.1 142.2 498.5 109.3 502.1 80.7M487.4 177C489.7 144.8 502.5 114.7 505.5 87.3M488.2 175.2C497 140.4 505.3 105.4 512.8 75.6M488.6 175C498.5 144.5 506.3 113.4 514.5 87.2M489.5 173.8C503 147.2 506.3 117.1 516.8 94M489.6 174.9C502 147.7 510.5 118.9 520.7 95.4M489.3 176.5C499.1 149.8 513.3 125 522.2 102.4M490.8 174.4C506.8 151.1 513.6 123.2 526.4 102.7M490.5 175.9C504.1 152.6 516.2 128.6 527.7 108.6M489.9 177.5C504.1 148.2 525.5 123.1 538.3 98.4M491.2 176.2C506.2 155.5 519.4 133.5 532 115.6M490.2 178.3C502 155 522.9 138.5 533.9 119.2M492.8 175.6C511.9 158.6 522.6 134.8 538.1 119.6M491.4 177.9C508.9 155.1 530.3 135.7 545.7 116.5M491.2 178.7C506.3 157.9 528 143.5 541.7 126.3M493.7 176.7C515 161.4 529.9 139.4 547.5 125.6M492.5 178.3C510.8 161.3 530.5 146 546.3 131.6M491.5 179.6C508.1 160.9 531.6 151 546.5 135.9M493.7 178.4C514.4 164.7 533.4 148.7 551 136.8";
/** Leur pied, brun-gris. */
const RACINES =
  "M480.2 187.9L470.6 194.4M477.6 189.1L464.7 197.1M476.9 189L466.2 195M477.6 188.2L464.7 194.6M477.2 187.9L464.5 193.6M478.2 187.1L464.8 192.4M475.9 187.5L461.4 192.5M477.4 186.5L464.3 190.4M477.2 186.2L463.1 189.7M478.8 185.5L463.6 188.5M478 185.3L460.7 188M476 185.1L459 187M477 184.6L462.6 185.6M478 184.2L459.8 184.6M475.2 183.8L457.7 183.5M478.5 183.5L462.5 182.5M476.3 183L458.1 181M477.6 182.7L461.6 180.3M476.8 182.2L459.8 178.9M478.3 182.1L462.8 178.4M477.1 181.4L459.8 176.4M477.9 181.3L461.7 175.8M478.2 181L461.6 174.6M479.5 181.1L464.2 174.4M478.8 180.4L464.9 173.6M479 180.2L464.6 172.3M476.7 178.4L462 169.5M478.5 179L466.1 170.7M479.9 179.5L467.2 170.2M479.7 178.9L466.4 168.3M479.7 178.5L464.9 165.5M480.7 178.9L467.4 166.2M478.8 176.5L467.4 164.6M480.9 178.2L469.7 165.4M479.6 176L469.5 163.5M480 175.8L469.4 161.4M481.3 177L470.4 160.6M482.1 177.6L472 161M481 174.9L472.7 159.8M481.7 175.3L473.5 158.6M482.8 176.8L475.7 160.5M482.4 174.8L475.5 156.8M483.2 175.7L477.7 159.6M483.2 174.4L478.8 159.2M484 175.9L479.8 158.5M484 174L480.5 156M484.5 174.1L482.1 158.3M484.9 173.5L483 156.7M485.4 174.6L484.4 159.6M485.8 173.9L485.5 159M486.2 175.1L486.6 159.5M486.6 175.6L487.6 161M486.9 175.8L488.9 158.2M487.3 175.7L489.8 159.6M487.4 177L490.5 161.7M488.2 175.2L492.4 158.2M488.6 175L493 160.1M489.5 173.8L494.2 160.2M489.6 174.9L494.9 161.4M489.3 176.5L494.9 163.9M490.8 174.4L496.8 162.2M490.5 175.9L496.8 164.4M489.9 177.5L498.2 164.1M491.2 176.2L498.2 165.9M490.2 178.3L497.6 168.3M492.8 175.6L500.5 166M491.4 177.9L500.6 167.5M491.2 178.7L499.7 169.8M493.7 176.7L502.8 168M492.5 178.3L501.6 170.4M491.5 179.6L500.9 172.2M493.7 178.4L503.4 171.3";
/** Les points de surjet de fibre claire, petits et irréguliers, qui tiennent le panneau blanc rapporté sur l'aile. */
const SURJET =
  "M448.5 452.9L452.2 448.5M432.2 450.7L434.7 446.4M420 450.8L422.9 445.6M407.3 451.2L409.7 445.7M392.9 453.5L396.4 447.3M382.4 454.2L384.9 448.1M367.6 456.4L370 450.6M354.9 458.6L357.1 452.4M341.3 461.2L343.2 455.1M328.8 464.1L330.4 458M316.4 467.1L317.3 460.8M300.9 472.7L302.6 465.7M289.7 476.4L290.7 468.9M274 480.8L273.7 474.8M258.4 488.7L258.3 481.1M241.7 495.3L241.2 488.7M223.8 495L220.4 488.5M192.3 507.6L186.9 509.7M199.9 516L193.7 519.5M209.5 522.2L204.5 526.6M224.1 528.2L219.7 532.2M234.4 531.4L230.4 535.5M243.5 534.2L240.5 539M258.2 536.8L255.5 541.7M274.3 538.4L271.1 543.6M288.7 539L284.7 545.4M303.2 540.2L300.3 545.9M315.7 541L314 546.3M331 539.9L328.8 545.5M342.1 538.6L340 545.9M358.6 538.3L358.1 543.4M372.9 535.2L371.9 541.7M385.5 533.5L386 539M401.9 529.6L402.4 535.5M415.2 526.5L417.2 532.4M432.7 518.1L435.4 524.6M449.7 511.1L454.7 516.2M464.9 497.1L471.5 499.3M466.6 483.7L472.8 483.9M465.8 468.2L471.9 465.7";
/** Le tuyau de chaque tertiaire, au point avant. */
const TUYAUX =
  "M322 500L248 544L207 569M300 512L229 563L192 592M282 524L219 580L186 612M268 538L223 599L200 635M262 554L240 620L228 659";
/** Les points de couchure qui tiennent le cordon noir des pattes. */
const COUCHURE =
  "M285 645.5L301 651.5M281 696.1L297 702.1M277 713.7L293 719.7M277 728L295 734M281 798.5L301 804.5M287 867.1L307 873.1M335 646.3L353 652.3M334 697.1L351 703.1M331 712.5L348 718.5M331 724.1L350 730.1M335 796.3L357 802.3M341 866.3L363 872.3";
// </tracés>

const IVOIRE = "244,232,208";
const FUMEE = "34,20,14";
/** L'écorce fumée du corps, le gris pâle des plumes lancéolées. */
const GRIS = "#6c625c";
const GRIS_PALE = "#a49488";
/** Les tertiaires : un roux-châtaigne (teinte 18°, saturation 0,43), loin de l'or. */
const CHATAIGNE = "#9a5a3e";
/** La paille des soies (teinte 42°, saturation 0,37) et leur pied brun-gris. */
const PAILLE = "#d8c9a6";
const RACINE = "#7a6a5c";
const OEIL = { x: 503, y: 211 };

const deja = new Map<string, { claires: string; sombres: string }>();
/** Les stries du maillet sur les pièces : de courtes fibres presque horizontales, propres à la graine. */
function stries(graine: number) {
  const cle = `st:${graine}`;
  const v = deja.get(cle);
  if (v) return v;
  const rnd = alea(graine ^ 0x6c7a4e);
  let claires = "";
  let sombres = "";
  for (let y = 180 + rnd() * 4; y < 720; y += 3 + rnd() * 5) {
    for (let x = 150 + rnd() * 30; x < 560; ) {
      const l = 18 + rnd() * 90;
      const dy = (rnd() - 0.5) * 2.4;
      const d = `M${f(x)} ${f(y)}L${f(x + l)} ${f(y + dy)}`;
      if (rnd() < 0.42) claires += d;
      else sombres += d;
      x += l + 4 + rnd() * 22;
    }
  }
  const r = { claires, sombres };
  if (deja.size > 32) deja.clear();
  deja.set(cle, r);
  return r;
}

/** Le dos : la grue cousue, pièce après pièce. */
function Grue({ id, graine }: { id: string; graine: number }) {
  const ivoire = (a: number) => `rgba(${IVOIRE},${a})`;
  const st = stries(graine);
  const ombre = "rgba(30,10,4,0.5)";
  return (
    <g>
      <defs>
        <clipPath id={`gc-${id}`}>
          <path d={CORPS} />
        </clipPath>
        <clipPath id={`gb-${id}`}>
          <path d={BLANC + TERTIAIRES} />
        </clipPath>
        <linearGradient id={`gv-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#3a2418" />
          <stop offset="0.5" stopColor={`rgb(${FUMEE})`} />
          <stop offset="1" stopColor="#120a06" />
        </linearGradient>
      </defs>

      {/* Les ombres des pièces sur l'écorce */}
      <path d={CORPS + PATTE + PATTE_LOIN + TERTIAIRES} fill={ombre} transform="translate(3 4.5)" />
      <path d={SOIES} fill="none" stroke="rgba(30,10,4,0.4)" strokeWidth={2.2} strokeLinecap="round" transform="translate(1.4 2)" />

      {/* La couronne : une longue piqûre de fibre de paille par soie, leur pied brun-gris */}
      <path d={SOIES} fill="none" stroke={PAILLE} strokeWidth={1.9} strokeLinecap="round" />
      <path d={SOIES} fill="none" stroke="rgba(255,248,230,0.45)" strokeWidth={0.7} strokeLinecap="round" transform="translate(-0.5 -0.6)" />
      <path d={RACINES} fill="none" stroke={RACINE} strokeWidth={1.5} strokeLinecap="round" />

      {/* Les pattes : un cordon noir couché, tenu par des points en travers ; les doigts */}
      <path d={PATTE_LOIN + DOIGTS_LOIN} fill="#2a1c14" />
      <path d={PATTE + DOIGTS} fill={`rgb(${FUMEE})`} />
      <path d={COUCHURE} fill="none" stroke={ivoire(0.45)} strokeWidth={1.3} strokeLinecap="round" />

      {/* Les tertiaires d'abord (elles tombent sur la queue), puis la grande pièce grise */}
      <path d={CORPS} fill={GRIS} />
      <g clipPath={`url(#gc-${id})`}>
        <path d={st.sombres} fill="none" stroke="rgba(20,10,6,0.16)" strokeWidth={1.2} />
        <path d={st.claires} fill="none" stroke="rgba(230,214,190,0.08)" strokeWidth={1} />
      </g>
      {/* Les pièces rapportées : le noir des rémiges, le blanc de l'aile, les tertiaires */}
      <path d={NOIR} fill={`rgb(${FUMEE})`} />
      <path d={BLANC + TERTIAIRES} fill={ombre} transform="translate(2.5 3.5)" />
      <path d={BLANC} fill="#efe2c6" />
      <path d={TERTIAIRES} fill={CHATAIGNE} stroke="rgba(40,16,6,0.6)" strokeWidth={1.3} />
      <path d={TERTIAIRES} fill="none" stroke="rgba(214,150,110,0.35)" strokeWidth={1} transform="translate(-0.8 -1)" />
      <g clipPath={`url(#gb-${id})`}>
        <path d={st.sombres} fill="none" stroke="rgba(60,30,14,0.16)" strokeWidth={1.3} />
      </g>
      {/* Le cou et la tête : un point avant fin, de fibre claire, le long du bord ; le surjet des pièces */}
      <path d={CORPS} fill="none" stroke={ivoire(0.4)} strokeWidth={1.2} strokeDasharray="3.5 5.5" strokeLinecap="round" />
      <path d={SURJET} fill="none" stroke={ombre} strokeWidth={2.2} strokeLinecap="round" transform="translate(0.7 1.1)" />
      <path d={SURJET} fill="none" stroke={ivoire(0.86)} strokeWidth={1.4} strokeLinecap="round" />
      <path d={TUYAUX} fill="none" stroke={ivoire(0.62)} strokeWidth={1.2} strokeDasharray="4 4" strokeLinecap="round" />

      {/* Les plumes lancéolées, pâles, et leur nervure au point avant */}
      <path d={LANCES} fill={ombre} transform="translate(2 3)" />
      <path d={LANCES} fill={GRIS_PALE} stroke="rgba(40,24,16,0.5)" strokeWidth={1} />
      <path d={NERVURES} fill="none" stroke={ivoire(0.7)} strokeWidth={1.3} strokeDasharray="5 4" strokeLinecap="round" />

      {/* La tête : le velours, la joue, sa plaque rouge, le fanon, le bec, l'œil */}
      <path d={VELOURS + BEC} fill={`url(#gv-${id})`} />
      <path d={JOUE} fill="#f4e9d2" />
      <path d={ROUGE} fill="#9c5236" />
      <path d={FANON} fill="#8a4a32" />
      <path d={JOUE + FANON} fill="none" stroke={ivoire(0.6)} strokeWidth={1} strokeDasharray="2.6 2.6" />
      <circle cx={OEIL.x} cy={OEIL.y} r={4.2} fill="#d5dedb" stroke={`rgb(${FUMEE})`} strokeWidth={1.6} />
      <circle cx={OEIL.x + 0.6} cy={OEIL.y} r={1.6} fill={`rgb(${FUMEE})`} />
    </g>
  );
}

/**
 * La face : la tête et la couronne brodées dans le coin bas gauche du
 * portrait, à droite de l'équerre : les soies en longues piqûres claires, la
 * joue blanche et le velours remplis, la plaque rouge, le bec, l'œil, le cou
 * au point avant qui s'efface vers le bas. Dans la boîte, la tête est
 * grandie (TETE) ; la pose la ramène au coin.
 */
const TETE = "translate(-966 -12) scale(2.63)";
function Broderie({ id, photo }: { id: string; photo: boolean }) {
  const fil = (a: number) => `rgba(${IVOIRE},${a * (photo ? 1 : 0.88)})`;
  const ombre = `rgba(16,6,2,${photo ? 0.5 : 0.4})`;
  return (
    <g transform={TETE} mask={`url(#gm-${id})`}>
      <defs>
        <linearGradient id={`gd-${id}`} x1="0" y1={200} x2="0" y2={330} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={`gm-${id}`} maskUnits="userSpaceOnUse" x={340} y={30} width={260} height={320}>
          <rect x={340} y={30} width={260} height={320} fill={`url(#gd-${id})`} />
        </mask>
      </defs>
      <path d={SOIES} fill="none" stroke={ombre} strokeWidth={1.9} strokeLinecap="round" transform="translate(0.6 0.8)" />
      <path d={SOIES} fill="none" stroke={fil(0.78)} strokeWidth={1.4} strokeLinecap="round" />
      <path d={CORPS} fill={`rgba(${FUMEE},${photo ? 0.22 : 0.16})`} />
      <path d={CORPS} fill="none" stroke={ombre} strokeWidth={2} strokeDasharray="4.4 3" transform="translate(0.6 0.8)" />
      <path d={CORPS} fill="none" stroke={fil(0.72)} strokeWidth={1.4} strokeDasharray="4.4 3" />
      <path d={VELOURS + BEC} fill={`rgba(${FUMEE},0.86)`} stroke={fil(0.5)} strokeWidth={0.8} />
      <path d={JOUE} fill={fil(0.92)} />
      <path d={ROUGE + FANON} fill="rgba(156,82,54,0.85)" />
      <circle cx={OEIL.x} cy={OEIL.y} r={2.6} fill={`rgba(${FUMEE},0.9)`} />
    </g>
  );
}

function Dessin({ couche, graine, photo, id }: PropsTotem) {
  if (couche === "dos") return <Grue id={id} graine={graine} />;
  if (couche === "face-portrait") return <Broderie id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "ug",
  animal: "grue royale couronnée",
  quoi: "La grue royale couronnée debout, le cou en S léger, tournée vers la lune : cousue en pièces d'écorce rapportées (le gris fumé au point avant, le blanc de l'aile au petit surjet irrégulier, les tertiaires roux-châtaigne en cascade), la couronne en 72 longues piqûres de paille ; brodée dans le coin du portrait.",
  sources: [
    { titre: "Oiseaux.net, la grue royale (Balearica regulorum) : couronne, joues, plumage", url: "https://oiseaux.net/birds/grey.crowned.crane.html" },
    { titre: "BirdForum Opus, Grey Crowned Crane : la sous-espèce gibbericeps (Ouganda, Kenya), le rouge des joues", url: "https://www.birdforum.net/opus/Grey_Crowned_Crane" },
    { titre: "Pierre Wildlife, Balearica regulorum gibbericeps (photos de référence)", url: "https://www.pierrewildlife.com/searchspecies/192-2/gruiformes/cranes/balearicaregulorumgibbericeps/" },
    { titre: "International Crane Foundation, la grue royale couronnée : le long pouce qui lui permet de percher", url: "https://savingcranes.org/?p=2792" },
    { titre: "MAA Cambridge, étoffe d'écorce faite de deux pièces cousues de fibre de plantain claire", url: "https://collections.maa.cam.ac.uk/objects/525312" },
    { titre: "Selvedge, coussin en patchwork d'écorce d'Ouganda (Mekeka Designs)", url: "https://selvedge.org/products/uganda-mekeka-designs-barkcloth-patchwork-pillow" },
  ],
  dessine: true,
  boite: { w: 800, h: 970 },
  pose: {
    // Debout à gauche, grande, à 80 au moins du bord : les pieds (y 958 dans la boîte) sur la couture du
    // sol, à 1146 ; le haut de la couronne vers y 70.
    dos: { x: -110, y: -4, echelle: 1.2, devant: true, lune: LUNE_OUGANDA },
    // La tête et la couronne, dans le coin bas gauche du portrait, à droite de l'équerre (x 72–112, y 912–952).
    face: { portrait: { x: 126, y: 740, echelle: 0.3 } },
  },
  Dessin,
};

export default totem;
