// Le totem de l'Algérie : le fennec (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 :
// « Je veux que le Fennec soit le plus stylé possible »). Jamais nommé sur la carte.
//
// La pose : assis de trois quarts (le corps tourné vers la gauche), la tête
// de face, les oreilles en couronne : la pose « assis, la tête de face » des
// blasons. Les proportions d'un fennec assis : la tête fait 22 % de la
// hauteur, les oreilles 1,7 fois la hauteur de la tête, leur base la moitié
// de leur longueur, le bord extérieur bombé, la pointe arrondie ; le crâne
// file dans le bord extérieur des oreilles, le front est étroit ; de grandes
// amandes sombres serties d'argent, un reflet en arc ; le larmier, un trait
// du coin de l'œil au coin de la bouche ; un museau effilé ; un poitrail,
// deux pattes avant fines, la cuisse repliée (une silhouette en poire) ; la
// queue, un cylindre touffu qui s'effile, passe devant les pieds et épouse
// le dedans de l'anneau de la fibule ; son bout brun-noir entre dans
// l'argent en mèches. Trois poses essayées : assis de trois quarts (gardée),
// assis de face (trop raide, le corps en bouteille), couché en sphinx (trop
// bas dans l'anneau, la tête trop loin de la lune).
//
// Le traitement : un bijou d'Aït Yenni.
//   · l'argent : chaque plaque a son dégradé, qui suit son volume, une
//     lumière sur ses bords hauts et gauches, une ombre sur les bas et
//     droits ; le pelage sable est sablé (de fines piqûres), le blanc est
//     poli ; quelques brillances posées à la main ;
//   · l'émail : le creux des oreilles en corail cloisonné (trois alvéoles,
//     un glacis), une couronne de triangles sur le front et une frise sur le
//     dessus de la queue (les dents vertes, le corail entre elles) ; les
//     yeux, les larmiers, la truffe et le bout de la queue en brun-noir ;
//   · un cabochon de corail serti au poitrail, son grènetis, trois
//     pendeloques (des losanges d'émail, une perle de corail) ;
//   · le contour en fil torsadé ; un grènetis fin (rayon 1,5 à 1,8, tous les
//     6 ou 7), ton sur ton, au bord des oreilles, autour du cabochon et de
//     la lune, et en couture entre le plastron et le flanc ;
//   · la ciselure : la fourrure du dos, de la cuisse et des joues, les
//     mèches de la queue, toutes dans le même sens ;
//   · la patine : de fines rayures tirées de la graine (une par joueur),
//     jamais sur le visage, à 0,3 au plus ; la silhouette ne change jamais.
// Ni or, ni bleu (l'émail bleu des bijoux kabyles est le cobalt réservé), ni
// rouge laqué : le corail reste orangé, le même que celui du skin
// (algerie.tsx). Jamais en vert, blanc et rouge.
//
// Les couches :
//   · « dos » : tout, la boîte posée en (72, 226) à l'échelle 1 (le repère
//     de la carte, décalé) ; la lune est sertie en haut de l'anneau de la
//     fibule (cx 512, cy 366, d 110), entre les oreilles, à 65 au-dessus du
//     front : son chaton (le fond, le collet, le grènetis) est dessiné ici,
//     la lune elle-même par totem.tsx, par-dessus, sans rosace (rosace: false) ;
//   · « face-portrait » : un poinçon d'orfèvre dans le coin bas gauche du
//     portrait, 130 de large : la tête seule, en relief (la moitié gauche
//     dans la lumière, la droite dans l'ombre), dans un cartouche en creux
//     qui la suit ; les pointes des oreilles à y 845, loin du visage, même
//     sur un selfie serré ;
//   · rien dans le cadre de la face, rien devant la lune.
//
// Les tracés sont cuits ici depuis des ancres posées à la main (des béziers
// aux tangentes choisies) ; le fil torsadé et les grènetis sont posés le
// long de ces tracés, une fois, au chargement.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

// La tête et les oreilles : le crâne file dans le bord extérieur des oreilles, le front étroit.
const TETE =
  "M440 260C431 260 429.6 263.2 421 266C398.3 238 348.5 181.9 310 142C278.9 109.8 244.8 64.9 218 44" +
  "C205.4 34.1 198.9 25.3 190 24C181.1 22.7 182 58 182 74C182 107.4 181.1 141.3 188 174" +
  "C194.7 205.4 201.4 237.4 216 266C227.4 288.5 245.1 307.3 262 326C270.4 335.3 289.4 331.4 296 342" +
  "C301.1 350.1 306.3 358.6 308 368C309.7 377.6 313.9 386.8 319 395C325.5 405.4 336.1 412.8 346 420" +
  "C357.9 428.7 371.8 434.9 386 439C403.6 444 416 449 440 449C464 449 476.4 444 494 439" +
  "C508.2 434.9 522.1 428.7 534 420C543.9 412.8 554.5 405.4 561 395C566.1 386.8 570.3 377.6 572 368" +
  "C573.7 358.6 578.9 350.1 584 342C590.6 331.4 609.6 335.3 618 326C634.9 307.3 652.6 288.5 664 266" +
  "C678.6 237.4 685.3 205.4 692 174C698.9 141.3 698 107.4 698 74C698 58 698.9 22.7 690 24" +
  "C681.1 25.3 674.6 34.1 662 44C635.2 64.9 601.1 109.8 570 142C531.5 181.9 481.7 238 459 266" +
  "C450.4 263.2 449 260 440 260Z";
// Le creux des oreilles (l'émail de corail), sous la lisière de fourrure du crâne.
const CREUX =
  "M406 282C372.5 244.8 341.2 193.9 304 154C276.3 124.3 251.2 85.6 224 62C214.9 54.1 205.6 43.1 200 41" +
  "C194.4 38.9 194 62 194 74C194 106.1 194.3 138.6 201 170C206.8 197.4 214.7 224.8 227 250" +
  "C236.7 269.8 254.6 287.1 268 302C277.9 300.6 308.3 299.2 328 295C343.3 291.8 359.1 290.8 374 286" +
  "C384.2 282.7 423.4 301.3 406 282ZM474 282C507.5 244.8 538.8 193.9 576 154" +
  "C603.7 124.3 628.8 85.6 656 62C665.1 54.1 674.4 43.1 680 41C685.6 38.9 686 62 686 74" +
  "C686 106.1 685.7 138.6 679 170C673.2 197.4 665.3 224.8 653 250C643.3 269.8 625.4 287.1 612 302" +
  "C602.1 300.6 571.7 299.2 552 295C536.7 291.8 520.9 290.8 506 286C495.8 282.7 456.6 301.3 474 282Z";
// Les deux fils d'argent qui cloisonnent l'émail de chaque oreille.
const CLOISONS =
  "M386 286C360.5 253.3 337.5 218.7 312 186C287.4 154.5 264.6 121.5 240 90C230.7 78.1 216.5 70.1 209 57" +
  "M332 295C318.4 267.2 284.6 252.3 272 224C258.3 193.2 233 167 226 134C221.6 113.5 203.5 96.9 202 76" +
  "M494 286C519.5 253.3 542.5 218.7 568 186C592.6 154.5 615.4 121.5 640 90C649.3 78.1 663.5 70.1 671 57" +
  "M548 295C561.6 267.2 595.4 252.3 608 224C621.7 193.2 647 167 654 134C658.4 113.5 676.5 96.9 678 76";
// L'alvéole médiane de chaque oreille, d'un corail plus clair.
const MEDIANE =
  "M386 286C361.4 254.5 337.5 218.7 312 186C287.4 154.5 264.6 121.5 240 90C230.7 78.1 214 65.7 209 57" +
  "C208 55.3 201.9 74 202 76C202.7 86 221.6 113.5 226 134C233 167 258.3 193.2 272 224" +
  "C284.6 252.3 318.8 268 332 295C335.5 302.2 350.2 291.9 358 290C365.8 288.1 390.9 292.3 386 286Z" +
  "M494 286C518.6 254.5 542.5 218.7 568 186C592.6 154.5 615.4 121.5 640 90C649.3 78.1 666 65.7 671 57" +
  "C672 55.3 678.1 74 678 76C677.3 86 658.4 113.5 654 134C647 167 621.7 193.2 608 224" +
  "C595.4 252.3 561.2 268 548 295C544.5 302.2 529.8 291.9 522 290C514.2 288.1 489.1 292.3 494 286Z";
// Le glacis de l'émail des oreilles : un trait de lumière dans chaque creux.
const GLACIS =
  "M212 74C218.9 93 216.5 114.1 220 134C223.5 154.1 225 174.8 232 194M668 74" +
  "C661.1 93 663.5 114.1 660 134C656.5 154.1 655 174.8 648 194";
// Les longs poils blancs du bord intérieur des oreilles, en fils d'argent.
const POILS =
  "M402 280C391 267.7 380.3 255 368 244C357.3 234.3 344 228.1 332 220M400 280" +
  "C387.1 270.7 373.8 262 360 254C346.1 246 328.9 246 314 240M396 282C382 275.2 366.7 271.3 352 266" +
  "C335.6 260 317.1 263.6 300 260M390 284C376.2 280.6 362.1 278 348 276C334.8 274.1 321.3 278 308 278" +
  "M404 274C396.5 258.7 387 244.4 378 230C370.7 218.4 366.8 204.5 358 194M478 280" +
  "C489 267.7 499.7 255 512 244C522.7 234.3 536 228.1 548 220M480 280C492.9 270.7 506.2 262 520 254" +
  "C533.9 246 551.1 246 566 240M484 282C498 275.2 513.3 271.3 528 266C544.4 260 562.9 263.6 580 260" +
  "M490 284C503.8 280.6 517.9 278 532 276C545.2 274.1 558.7 278 572 278M476 274" +
  "C483.5 258.7 493 244.4 502 230C509.3 218.4 513.2 204.5 522 194";
// Le blanc du bas du visage : sous les yeux, les joues, le menton (l'argent poli).
const BLANC =
  "M440 351.6C435 351.6 426.9 357.8 419.8 358.3C410.8 359 402.1 363.3 393 363.3" +
  "C382.4 363.3 374.8 351.6 366.1 346.5C356 347.2 343.7 342.7 332.5 343.2" +
  "C322.3 343.5 304.8 340.3 302.2 346.5C299.1 354.3 306 361 307.3 368.4C309 378 313.8 386.9 319 395.2" +
  "C325.5 405.7 336 413.2 345.9 420.4C357.8 429.1 372 434.8 386.2 438.9C403.8 444 418.2 449 440 449" +
  "C461.8 449 476.2 444 493.8 438.9C508 434.8 522.2 429.1 534.1 420.4C544 413.2 554.5 405.7 561 395.2" +
  "C566.2 386.9 571 378 572.7 368.4C574 361 580.9 354.3 577.8 346.5C575.2 340.3 557.7 343.5 547.5 343.2" +
  "C536.3 342.7 524 347.2 513.9 346.5C505.2 351.6 497.6 363.3 487 363.3" +
  "C477.9 363.3 469.2 359 460.2 358.3C453.1 357.8 445 351.6 440 351.6Z";
// Les yeux en amande ; le coin intérieur descend vers le museau.
const YEUX =
  "M420.7 357.4C414 350 417.5 341.1 411.4 336.4C405.5 331.7 400.6 322.7 393 323" +
  "C386.1 323.3 379.1 325.2 372.8 328C368.1 330.1 364 334.9 362.7 339.8" +
  "C361.3 345.5 367.8 350.8 372.8 353.2C379.7 356.6 387 360.3 394.6 360.8" +
  "C403.4 361.4 410.9 359.9 420.7 357.4C420.7 357.4 420.7 357.4 420.7 357.4ZM459.3 357.4" +
  "C466 350 462.5 341.1 468.6 336.4C474.5 331.7 479.4 322.7 487 323C493.9 323.3 500.9 325.2 507.2 328" +
  "C511.9 330.1 516 334.9 517.3 339.8C518.7 345.5 512.2 350.8 507.2 353.2" +
  "C500.3 356.6 493 360.3 485.4 360.8C476.6 361.4 469.1 359.9 459.3 357.4" +
  "C459.3 357.4 459.3 357.4 459.3 357.4Z";
// Le reflet en arc, sous la paupière du haut.
const REFLETS =
  "M384.6 333.1C383.4 331.1 387.8 329.6 389.6 328M495.4 333.1C496.6 331.1 492.2 329.6 490.4 328";
// Les larmiers : du coin intérieur de l'œil au coin de la bouche.
const LARMES =
  "M417.3 358.3C415.7 370 416.2 376.2 415.6 385.2C415 395.2 414.5 405.7 417.3 415.4" +
  "C417.3 415.4 421.5 414.6 421.5 414.6C420.1 404.6 421.2 395.5 421.5 386" +
  "C421.9 377.3 424 368.3 423.2 360C423.2 360 417.3 358.3 417.3 358.3ZM462.7 358.3" +
  "C464.3 370 463.8 376.2 464.4 385.2C465 395.2 465.5 405.7 462.7 415.4" +
  "C462.7 415.4 458.5 414.6 458.5 414.6C459.9 404.6 458.8 395.5 458.5 386" +
  "C458.1 377.3 456 368.3 456.8 360C456.8 360 462.7 358.3 462.7 358.3Z";
// L'arête du museau, le sable (argent satiné), et sa crête polie.
const ARETE =
  "M440 341.5C435 341.5 430.3 344.1 429.1 348.2C426.6 357 423.9 365.9 423.2 375.1" +
  "C422.7 381.8 423.6 388.8 425.7 395.2C427.2 399.9 433.3 398.6 440 398.6" +
  "C446.7 398.6 452.8 399.9 454.3 395.2C456.4 388.8 457.3 381.8 456.8 375.1" +
  "C456.1 365.9 453.4 357 450.9 348.2C449.7 344.1 445 341.5 440 341.5Z";
// La crête polie de l'arête.
const CRETE =
  "M440 360C440 366.1 440 372.3 440 378.4";
// La truffe.
const TRUFFE =
  "M440 392.7C432.4 392.7 432.3 394 427.4 395.2C424.1 396.1 425.3 398.6 424.9 401.1" +
  "C424 406.1 429.7 406.4 432.4 408.7C434.6 410.5 435.8 412.9 440 412.9" +
  "C444.2 412.9 445.4 410.5 447.6 408.7C450.3 406.4 456 406.1 455.1 401.1" +
  "C454.7 398.6 455.9 396.1 452.6 395.2C447.7 394 447.6 392.7 440 392.7Z";
// La bouche.
const BOUCHE =
  "M440 412.9C440 415.1 440 417.3 440 419.6M428.2 418.8C432 420.3 435.9 422.1 440 422.1" +
  "C444.1 422.1 448 420.3 451.8 418.8";
// Les vibrisses, en fils fins.
const VIBRISSES =
  "M421.5 405.3C414.7 404.6 408.2 400.9 401.4 401.1C394.1 401.4 386.7 400.4 379.5 402M422.4 411.2" +
  "C415.9 410.5 409.5 413.5 403 413.7C396.5 414 390.9 419.1 384.6 420.4M458.5 405.3" +
  "C465.3 404.6 471.8 400.9 478.6 401.1C485.9 401.4 493.3 400.4 500.5 402M457.6 411.2" +
  "C464.1 410.5 470.5 413.5 477 413.7C483.5 414 489.1 419.1 495.4 420.4";
// Le corps assis de trois quarts : la gorge, le poitrail, la patte proche, la croupe, le dos.
const CORPS =
  "M406 438C396.4 450.3 382.8 460 376 474C366.8 492.8 360.9 513.3 358 534" +
  "C355.2 553.9 352.4 573.9 352 594C351.5 620.7 351.5 647.3 352 674C352.4 696.7 349.3 730.1 348 742" +
  "C346.7 753.9 346 783.3 346 804C346 851.5 440.5 814 488 814C532.1 814 576.6 805.1 618 790" +
  "C641.1 781.6 662 762.4 672 740C678.7 725 691.7 710.4 690 694C688.2 676.6 680.6 660.2 674 644" +
  "C664.4 620.2 651.6 597.8 638 576C622.7 551.5 607 527.3 590 504C575.5 484 574.4 454.6 556 438" +
  "C540.3 423.8 515 421.1 494 424C464.6 428.1 424.3 414.6 406 438Z";
// Le plastron blanc, de la gorge au poitrail.
const PLASTRON =
  "M410 440C394.5 446.9 383.5 462.7 376 478C367.5 495.4 362 514.7 360 534C358 552.6 356 571.4 358 590" +
  "C359.1 600.9 367.2 614.1 378 616C390 618.1 403.1 615.3 414 610C427.3 603.5 434.9 587.9 440 574" +
  "C446.7 555.6 456 537.5 458 518C460 498.9 475.3 480.9 472 462C470 450.9 459.3 438 448 438" +
  "C435.3 438 421.6 434.8 410 440Z";
// La patte avant proche (le poignet à 80 du sol, le pied sous la queue).
const PATTE_PROCHE =
  "M358 564C356.4 594 354 624 354 654C354 683.4 350.3 730.1 349 742C347.7 753.9 348 783.3 348 804" +
  "C348 817.3 374.7 804.5 388 804C406.3 803.4 385.7 759 386 749C386.3 739 389 699 389 674" +
  "C389 647.3 390.6 620.3 386 594C384 582.5 379 568 368 564C364.9 562.9 358.2 560.7 358 564Z";
// La patte avant lointaine.
const PATTE_LOIN =
  "M394 600C402.1 600.6 414.2 600.4 417 608C424.5 628.7 421.2 652 422 674C422.8 696 423 718 423 740" +
  "C423 761.3 421.7 782.7 421 804C420.6 814.3 400.3 804.4 390 804C366.7 803.2 389 757.3 389 734" +
  "C389 707.3 390.9 680.7 390 654C389.4 636 376 598.7 394 600Z";
// La cuisse repliée, sa masse ovale.
const CUISSE =
  "M650 586C621.5 595.3 590.8 584.5 570 602C551.4 617.6 532.7 636.7 526 660" +
  "C519 684.3 510.9 708.8 510 734C509.2 756.2 508.9 780.7 520 800C536.4 828.4 587.2 803.2 618 792" +
  "C641.9 783.3 663.6 763.3 674 740C683.2 719.3 693.2 696.4 690 674C687.1 653.1 683.6 630.1 670 614" +
  "C662.6 605.2 669 579.8 650 586Z";
// La croupe, devant la base de la queue (la cuisse repasse devant elle).
const CROUPE =
  "M618 676C611.5 692 604.6 708.7 604 726C603.5 740.1 609.3 754.9 618 766" +
  "C626.3 776.6 639.7 782.5 652 788L748 854L748 676Z";
// Le bord de la cuisse sur la queue.
const CROUPE_FIL =
  "M618 676C611.5 692 604.6 708.7 604 726C603.5 740.1 609.3 754.9 618 766" +
  "C626.3 776.6 639.7 782.5 652 788";
// La queue : un cylindre touffu qui suit le dedans de l'anneau, devant les pieds.
const QUEUE =
  "M665.6 737.6C658 745.2 656 757.6 647.7 764.4C636.2 773.9 626.5 785.7 613.8 793.6" +
  "C597.4 803.7 580.9 814.1 563 821.3C543.1 829.2 522.3 835.4 501.2 839.4" +
  "C480.1 843.3 458.5 844.5 437 844.3C415.7 844.1 394.4 840.3 373.4 836" +
  "C352.6 831.8 333 822.6 313.4 814.4C295.9 807.1 282.4 792.6 266.4 782.4" +
  "C252.5 773.4 241.7 760.2 230.9 747.6C221.6 736.8 213.2 725.1 206.5 712.5" +
  "C200.7 701.7 196 690.1 193.8 678C191.8 667.3 194.2 656.2 194 645.3" +
  "C193.8 637.6 187.9 624.3 192.4 622.2C197 620.2 198.8 635.1 203.8 639.9" +
  "C210.5 646.4 219.6 649.9 226.9 655.7C234.8 661.8 241.9 669.1 249.4 675.6" +
  "C258 683 266.2 690.9 275.3 697.7C285.5 705.3 296.6 711.8 307.3 718.7" +
  "C319.3 726.4 333.5 729.7 346.6 735.2C360.9 741.2 376.4 744.4 391.6 747.6" +
  "C406.8 750.7 422.4 752.2 437.9 752.3C453.4 752.5 469 751.8 484.3 749" +
  "C499.7 746.1 515.7 744.6 530.2 738.8C543.8 733.4 559.6 733.5 572 725.8" +
  "C582.1 719.6 596.2 720.6 605.4 713C612.6 707.1 625.1 710.2 631.6 703.6" +
  "C642.9 692.3 676.9 726.3 665.6 737.6Z";
// Le bout brun-noir de la queue, qui entre dans l'argent en mèches effilées (coupé par la queue).
const BOUT =
  "M272.5 686.7C275.1 689.7 296.2 718 296.2 718C296.2 718 263.1 698.1 265.2 701.4" +
  "C267.4 704.8 307.9 736.4 307.9 736.4C307.9 736.4 258.7 704.5 254.9 703.6" +
  "C251 702.6 278.9 729 278.9 729C278.9 729 251.2 710.8 253.9 713.8C256.5 716.8 304.7 758 304.7 758" +
  "C304.7 758 247.5 716.2 243.6 715.2C239.8 714.1 274.1 749.6 274.1 749.6" +
  "C274.1 749.6 240.2 722.8 242.5 726.1C244.7 729.5 289.7 773.1 289.7 773.1" +
  "C289.7 773.1 236.2 728.1 232.4 726.8C228.7 725.4 258.3 761.8 258.3 761.8" +
  "C258.3 761.8 229.6 734.5 231.5 738C233.4 741.5 268 779.8 268 779.8C268 779.8 220.3 745.1 217.8 742" +
  "C215.2 738.9 186.9 697.9 181.1 672.4C176.6 652.8 171.3 623.1 188.3 612.6" +
  "C202.8 603.6 217.1 630.9 229.9 642.1C245.3 655.7 269.9 683.6 272.5 686.7Z";
// Les mèches de la queue : des brins le long de l'axe, de la base vers la pointe, un seul sens.
const MECHES =
  "M610.1 718.7L600.7 723.4L591.9 728.9L582.5 733.2L572.8 736.8L563.1 740.2L553.7 743.8L544.6 748" +
  "L535.3 751.7L525.8 754.8L516.2 757.3L506.4 759.4L496.6 761.1L486.8 762.3L477 763.3L467.1 763.8" +
  "L457.3 763.9L447.5 763.6L437.8 762.8M592.3 738.7L582.6 743.1L572.8 747.1L563 751L553.5 755.2" +
  "L544 759.4L534.3 763.1L524.4 766.3L514.4 769.1L504.3 771.5L494.1 773.5L483.9 775.1L473.7 776.3" +
  "L463.4 777.1L453.1 777.5L442.8 777.3L432.5 776.8L422.3 775.8L412.1 774.4L402.1 772.6L392.1 770.6" +
  "M578.2 756.7L568.2 761L558.2 765.3L548.3 769.6L538.1 773.4L527.9 776.8L517.5 779.8L507 782.3" +
  "L496.4 784.5L485.8 786.2L475.1 787.7L464.4 788.7L453.7 789.3L442.9 789.4L432.2 789.1L421.5 788.3" +
  "L410.8 787.1L400.2 785.5L389.7 783.5L379.2 781.2L368.9 778.5M614.2 750.8L604.4 756.7L594.5 762.3" +
  "L584.3 767.5L574 772.3L563.6 776.7L553.1 781.1L542.5 785L531.8 788.5L520.9 791.5L509.9 794.2" +
  "L498.9 796.4L487.8 798.2L476.7 799.7L465.5 800.8L454.3 801.5L443 801.7L431.8 801.4L420.6 800.8" +
  "L409.5 799.7L398.3 798.2L387.3 796.3L376.4 793.9L365.5 791.1L354.8 787.8L344.2 784.2L333.8 780.2" +
  "M600.4 771.9L590.1 777.7L579.4 782.9L568.5 787.4L557.6 791.8L546.5 795.8L535.4 799.3L524.1 802.5" +
  "L512.7 805.3L501.2 807.6L489.7 809.4L478.1 811L466.5 812.1L454.8 812.8L443.2 813.1L431.5 813" +
  "L419.8 812.5L408.2 811.6L396.6 810.1L385.1 808.2L373.7 805.8L362.4 802.9L351.2 799.6M635.5 759.1" +
  "L625.5 766.2L615.3 772.9L605.2 779.6L594.8 786L583.9 791.6L572.7 796.3L561.4 800.8L550 804.9" +
  "L538.5 808.8L526.9 812.2L515.2 815.2L503.3 817.8L491.4 819.9L479.5 821.7L467.4 823.1L455.4 824.1" +
  "L443.3 824.7L431.2 824.8L419 824.5L406.9 823.8L394.8 822.5L382.8 820.6M620.4 780.4L610 787.5" +
  "L599.4 794.2L588.2 799.9L576.6 804.6L564.8 809L553.1 813.2L541.2 817.1L529.3 820.6L517.3 823.9" +
  "L505.2 826.7L492.9 829.1L480.7 831.2L468.3 833L455.9 834.4L443.4 835.4L430.8 835.9L418.2 836" +
  "M462.6 768.3L452.7 769.3L442.7 770L432.7 770.3L422.7 770.1L412.7 769.5L402.7 768.6L392.7 767.3" +
  "L382.7 765.7L372.9 763.6L363.1 761.1L353.5 758L344 754.4L334.8 750.3L325.7 746L316.6 741.6" +
  "L307.7 736.8L299.1 731.5L290.8 725.7L283 719.3L275.2 712.9L267.3 706.6M432.4 781.6L421.9 781.3" +
  "L411.5 780.5L401.1 779.4L390.7 777.9L380.4 776.1L370.1 773.8L360 771.1L350 768L340.1 764.3" +
  "L330.5 760.1L321 755.7L311.6 750.9L302.4 745.8L293.5 740.3L284.8 734.2L276.7 727.7L268.6 721" +
  "L260.7 714.1L253 707L245.7 699.5L239 691.5M443 795.6L432 795.4L421 794.8L410.1 793.8L399.2 792.3" +
  "L388.4 790.5L377.7 788.2L367 785.5L356.5 782.4L346.1 778.8L335.9 774.9L325.9 770.4L316.1 765.6" +
  "L306.5 760.4L297.1 754.8L287.9 748.8L279.1 742.5L270.5 735.8L262.3 728.7L254.3 721.3L246.7 713.6" +
  "L239.4 705.6L232.5 697.3L226 688.7L219.8 679.8M408.7 806.5L397.4 804.7L386.2 802.4L375.1 799.7" +
  "L364.1 796.5L353.2 793L342.5 789.1L332 784.9L321.6 780.1L311.6 774.8L301.8 769.1L292.2 763.1" +
  "L282.9 756.8L273.7 750.2L264.9 743.2L256.5 735.7L248.6 727.8L241 719.5L233.7 711.1L226.5 702.6" +
  "L220.2 693.4M443.2 821.4L431.3 820.7L419.4 819.6L407.5 818L395.8 816L384.1 813.4L372.7 810.3" +
  "L361.3 806.9L350.1 803.1L339.1 799L328.1 794.6L317.4 789.7L307 784.2L296.9 778.2L287.1 771.8" +
  "L277.5 765.1L268 758.3L258.8 751.2L250.2 743.4L242.2 734.9L234.7 726.1M480.5 830.3L468.1 830.8" +
  "L455.7 830.9L443.3 830.5L431 829.7L418.8 828.5L406.6 826.8L394.5 824.8L382.5 822.1L370.7 819.1" +
  "L359 815.6L347.4 811.9L335.9 807.9L324.5 803.6L313.4 798.9L302.6 793.3L292.1 787.1L282 780.5" +
  "L272 773.6L262.2 766.7";
// La couronne du front : les dents d'émail vert.
const COURONNE_VERT =
  "M406.7 295.9L411.7 304.4L416.6 293.2ZM418 293.2L423 302.2L428 291.5ZM429.4 291.5L434.3 301.1" +
  "L439.3 291ZM440.7 291L445.7 301.1L450.6 291.5ZM452 291.5L457 302.2L462 293.2ZM463.4 293.2" +
  "L468.3 304.4L473.3 295.9Z";
// La couronne du front : les dents de corail, entre elles.
const COURONNE_CORAIL =
  "M413.9 304.4L417.3 295.2L420.8 302.2ZM425.2 302.2L428.7 293.5L432.1 301.1ZM436.5 301.1L440 293" +
  "L443.5 301.1ZM447.9 301.1L451.3 293.5L454.8 302.2ZM459.2 302.2L462.7 295.2L466.1 304.4Z";
// Les deux fils d'argent de la couronne.
const COURONNE_FIL =
  "M405 294.7L408.4 293.8L411.8 292.9L415.2 292.2L418.6 291.5L422 291L425.4 290.5L428.8 290.1" +
  "L432.2 289.9L435.6 289.7L439 289.6L442.4 289.6L445.8 289.7L449.2 290L452.6 290.3L456 290.7" +
  "L459.4 291.2L462.8 291.8L466.2 292.5L469.6 293.3L473 294.2M405 307.5L408.4 306.6L411.8 305.7" +
  "L415.2 305L418.6 304.3L422 303.8L425.4 303.3L428.8 302.9L432.2 302.7L435.6 302.5L439 302.4" +
  "L442.4 302.4L445.8 302.5L449.2 302.8L452.6 303.1L456 303.5L459.4 304L462.8 304.6L466.2 305.3" +
  "L469.6 306.1L473 307";
// Le fond du chaton, sous la lune (la lune elle-même est posée par totem.tsx).
const LUNE_FOND =
  "M384.5 140a55.5 55.5 0 1 0 111 0a55.5 55.5 0 1 0 -111 0";
// Le collet d'argent du chaton.
const LUNE_COLLET =
  "M377.5 140a62.5 62.5 0 1 0 125 0a62.5 62.5 0 1 0 -125 0M385 140a55 55 0 1 0 110 0a55 55 0 1 0 -110 0";
// Le fil qui borde le chaton.
const LUNE_FIL =
  "M369 140a71 71 0 1 0 142 0a71 71 0 1 0 -142 0";
// Le collet du cabochon du poitrail.
const CABOCHON_COLLET =
  "M382.5 498A13.5 17.5 0 1 0 409.5 498A13.5 17.5 0 1 0 382.5 498Z";
// Le cabochon de corail du poitrail.
const CABOCHON =
  "M386.5 498A9.5 13.5 0 1 0 405.5 498A9.5 13.5 0 1 0 386.5 498Z";
// La frise d'émail vert le long du dessus de la queue.
const FRISE_QUEUE =
  "M597.2 719.9L597.9 730.3L587.3 724.9ZM586.2 725.4L586.3 735.6L575.4 728.8ZM574.2 729.2L574.2 739.8" +
  "L563.4 731.9ZM562.2 732.2L562.2 743.6L551.8 735.2ZM550.7 735.6L550.7 748L541 739.7ZM539.9 740.1" +
  "L539.3 752.5L529.9 743.6ZM528.8 743.9L527.7 756.4L518.7 746.8ZM517.6 747.1L516 759.6L507.4 749.5Z" +
  "M506.3 749.7L504.1 762.3L496 751.7ZM494.9 751.9L492.2 764.5L484.6 753.6ZM483.5 753.7L480.2 766.3" +
  "L473.2 755.2ZM472.1 755.3L468.2 767.8L461.8 756.3ZM460.6 756.4L456.2 768.7L450.3 756.9ZM449.1 756.9" +
  "L444.1 769L438.8 757ZM437.6 756.9L432.1 768.7L427.3 756.5ZM426.1 756.4L420 767.9L415.8 755.4Z" +
  "M414.7 755.3L408.1 766.5L404.4 754ZM403.3 753.9L396.2 764.8L393.1 752.4ZM391.9 752.2L384.3 762.7" +
  "L381.7 750.4ZM380.6 750.2L372.5 760.1L370.5 747.9ZM369.3 747.6L360.8 757L359.3 744.7ZM358.3 744.3" +
  "L349.4 753.1L348.5 740.7ZM347.4 740.2L338.2 748.4L337.8 736.2ZM336.8 735.8L327.1 743.6L327 731.9Z" +
  "M326 731.5L316.1 738.7L316.3 727.4ZM315.2 726.9L305.2 733.2L305.8 722.2Z";
// Le fil d'argent sous la frise de la queue.
const FRISE_FIL =
  "M607 727.4L602.5 730.1L597.8 732.8L593.1 735.1L588.2 737.2L583.2 739.1L578.2 740.9L573.2 742.6" +
  "L568.3 744.3L563.3 745.9L558.5 747.7L553.7 749.6L549 751.6L544.3 753.5L539.5 755.3L534.7 757" +
  "L529.8 758.5L525 760L520.1 761.3L515.2 762.6L510.2 763.7L505.3 764.8L500.3 765.8L495.3 766.7" +
  "L490.3 767.6L485.4 768.3L480.4 769.1L475.4 769.8L470.4 770.3L465.4 770.8L460.3 771.2L455.3 771.5" +
  "L450.3 771.6L445.2 771.7L440.2 771.7L435.2 771.6L430.1 771.4L425.1 771.1L420.1 770.7L415.1 770.2" +
  "L410.1 769.6L405.1 768.9L400.2 768.2L395.2 767.4L390.3 766.6L385.3 765.7L380.4 764.7L375.5 763.6" +
  "L370.6 762.4L365.7 761.1L360.9 759.7L356.1 758.2L351.3 756.5L346.6 754.8L341.9 752.8L337.3 750.8" +
  "L332.7 748.8L328.1 746.8L323.5 744.7L318.9 742.6L314.3 740.5L309.8 738.2L305.3 735.8L300.9 733.4" +
  "L296.6 730.7";
// Les anneaux des pendeloques.
const PEND_ANNEAUX =
  "M382.7 522.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0" +
  "M393.7 528.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0" +
  "M404.7 522.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0";
// Les losanges des pendeloques.
const PEND_LOSANGES =
  "M385 525.6L389.6 532.6L385 539.6L380.4 532.6ZM396 531.6L400.6 538.6L396 545.6L391.4 538.6ZM407 525.6" +
  "L411.6 532.6L407 539.6L402.4 532.6Z";
// Le point de corail de chaque pendeloque.
const PEND_CORAIL =
  "M383.5 532.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M394.5 538.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" +
  "M405.5 532.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0";
// La perle de corail au bas de chaque pendeloque.
const PEND_PERLES =
  "M383 542.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M394 548.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" +
  "M405 542.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0";
// La couture entre le plastron blanc et le flanc (le grènetis y est posé).
const COUTURE =
  "M470 458C466.7 476.7 462.3 495.2 460 514C457.7 532.6 451 550.6 444 568C438.3 582.2 428.7 595 418 606";
// Le dedans du bord extérieur des oreilles (le grènetis y est posé).
const BORD_OREILLES =
  "M190 87C190 95.6 189.9 104.2 190.1 112.9C190.3 121.4 190.5 129.9 191.2 138.4" +
  "C191.9 146.8 192.8 155.2 194.1 163.5C195.5 171.9 197.5 180.2 199.3 188.5" +
  "C201.2 196.9 203 205.2 205.3 213.5C207.5 221.6 209.8 229.8 212.7 237.7" +
  "C215.5 245.6 218.6 253.4 222.3 260.8C226.1 268.1 230.4 275.2 235.1 281.9" +
  "C240 288.8 245.7 295.1 250.9 301.6M690 87C690 95.6 690.1 104.2 689.9 112.9" +
  "C689.7 121.4 689.5 129.9 688.8 138.4C688.1 146.8 687.2 155.2 685.9 163.5" +
  "C684.5 171.9 682.5 180.2 680.7 188.5C678.8 196.9 677 205.2 674.7 213.5" +
  "C672.5 221.6 670.2 229.8 667.3 237.7C664.5 245.6 661.4 253.4 657.7 260.8" +
  "C653.9 268.1 649.6 275.2 644.9 281.9C640 288.8 634.3 295.1 629.1 301.6";
// La ciselure : le dos, la cuisse, le poitrail.
const CISELURE =
  "M540 474C551.9 489.3 566.1 502.7 578 518C589.7 533 601.3 548.2 612 564M549 469" +
  "C560.9 484.3 575.1 497.7 587 513C598.7 528 610.3 543.2 621 559M558 464" +
  "C569.9 479.3 584.1 492.7 596 508C607.7 523 619.3 538.2 630 554M632 606" +
  "C619.1 611.7 602.8 610.9 592 620C581.1 629.1 570.7 639.5 564 652M639 615" +
  "C626.1 620.7 609.8 619.9 599 629C588.1 638.1 577.7 648.5 571 661M646 624" +
  "C633.1 629.7 616.8 628.9 606 638C595.1 647.1 584.7 657.5 578 670M666 674" +
  "C657.6 682.1 641.2 678.8 634 688C626 698.2 616 707.7 612 720M672 683C663.6 691.1 647.2 687.8 640 697" +
  "C632 707.2 622 716.7 618 729M678 692C669.6 700.1 653.2 696.8 646 706C638 716.2 628 725.7 624 738" +
  "M628 764C617.2 757.8 604.3 776.2 592 774C579.5 771.8 566.7 771.1 554 772M628 756" +
  "C617.2 749.8 604.3 768.2 592 766C579.5 763.8 566.7 763.1 554 764";
// Les brillances de l'argent, posées à la main.
const BRILLANCES =
  "M190 74C176.7 74.8 188.9 100.7 189.4 114.1C190 128.8 191.3 143.6 193.5 158.2" +
  "C195.5 171.6 188.5 199.8 202 198C215.4 196.2 198.1 171.2 196.5 157.8" +
  "C194.9 143.2 193.7 128.6 192.6 113.9C191.5 100.6 203.3 73.2 190 74ZM640 74" +
  "C632 67.3 625.5 89 618.8 97C610.8 106.4 586.6 118.1 596 126C605.4 134 613.3 108.4 621.2 99" +
  "C628 91.1 648 80.7 640 74ZM428 267C428 271 436 265.3 440 265.3C444 265.3 452 271 452 267" +
  "C452 262.8 444.2 262.7 440 262.7C435.8 262.7 428 262.8 428 267ZM554 470" +
  "C546.8 476 567.1 483.5 573.1 490.8C579.8 498.9 583.9 522.7 592 516" +
  "C600.2 509.3 581.7 497.4 574.9 489.2C568.9 481.9 561.3 464 554 470ZM584 610" +
  "C576.9 603.3 565.6 617.8 558.8 624.9C551.7 632.4 536.5 644.9 544 652" +
  "C551.3 659 554.2 634.4 561.2 627.1C567.7 620.2 590.9 616.6 584 610ZM432 443" +
  "C432.2 444.7 435.4 442.4 437.1 442.2C438.7 442 442.2 443.6 442 442" +
  "C441.8 440.2 438.7 439.6 436.9 439.8C434.9 440 431.8 441.1 432 443Z";
// Le poinçon : le cartouche, en creux, qui suit la tête.
const P_CARTOUCHE =
  "M440 455.3C422.7 455.3 399.8 443.3 385.3 429.4C341.2 386.7 308.2 333.9 267.2 288.2" +
  "C218.1 233.8 142.8 162.2 108.8 135.6C93 123.2 74.2 116 57 115.4C39.7 114.9 41.6 141.5 39.7 158.6" +
  "C37.5 178.7 44.4 216.2 45.4 245C47.3 297.2 50 350 62.7 400.6C74.4 447.5 91.8 493.3 114.6 535.9" +
  "C131.7 568.2 155.5 596.4 177.9 625.2C190.6 641.3 208.3 654.9 215.4 674.2" +
  "C222.6 694.2 230.3 714 235.5 734.6C240.7 755.5 256.3 772.8 270.1 789.4" +
  "C287.8 810.4 318.8 815.4 345 823.9C375.5 833.9 399.7 838.3 440 838.3" +
  "C480.3 838.3 504.5 833.9 535 823.9C561.2 815.4 592.2 810.4 609.9 789.4" +
  "C623.7 772.8 639.3 755.5 644.5 734.6C649.7 714 657.4 694.2 664.6 674.2" +
  "C671.7 654.9 689.4 641.3 702.1 625.2C724.5 596.4 748.3 568.2 765.4 535.9" +
  "C788.2 493.3 805.6 447.5 817.3 400.6C830 350 832.7 297.2 834.6 245" +
  "C835.6 216.2 842.5 178.7 840.3 158.6C838.4 141.5 840.3 114.9 823 115.4" +
  "C805.8 116 787 123.2 771.2 135.6C737.2 162.2 661.9 233.8 612.8 288.2" +
  "C571.8 333.9 538.8 386.7 494.7 429.4C480.2 443.3 457.3 455.3 440 455.3Z";
// Le poinçon : la tête en relief.
const P_TETE =
  "M440 495.6C427 495.6 425 500.2 412.6 504.2C380 463.9 308.2 383.1 252.8 325.7" +
  "C208 279.3 158.9 214.7 120.3 184.6C102.2 170.3 92.8 157.6 80 155.8C67.2 153.9 68.5 204.7 68.5 227.8" +
  "C68.5 275.9 67.2 324.7 77.1 371.8C86.8 417 96.4 463.1 117.4 504.2" +
  "C133.9 536.6 159.3 563.7 183.7 590.6C195.8 604 223.1 598.4 232.6 613.7" +
  "C240 625.3 247.5 637.6 249.9 651.1C252.4 664.9 258.4 678.2 265.8 690C275.1 705 290.4 715.6 304.6 726" +
  "C321.8 738.5 341.8 747.5 362.2 753.4C387.6 760.6 405.4 767.8 440 767.8" +
  "C474.6 767.8 492.4 760.6 517.8 753.4C538.2 747.5 558.2 738.5 575.4 726" +
  "C589.6 715.6 604.9 705 614.2 690C621.6 678.2 627.6 664.9 630.1 651.1" +
  "C632.5 637.6 640 625.3 647.4 613.7C656.9 598.4 684.2 604 696.3 590.6" +
  "C720.7 563.7 746.1 536.6 762.6 504.2C783.6 463.1 793.2 417 802.9 371.8" +
  "C812.8 324.7 811.5 275.9 811.5 227.8C811.5 204.7 812.8 153.9 800 155.8" +
  "C787.2 157.6 777.8 170.3 759.7 184.6C721.1 214.7 672 279.3 627.2 325.7" +
  "C571.8 383.1 500 463.9 467.4 504.2C455 500.2 453 495.6 440 495.6Z";
// Le poinçon : le creux des oreilles.
const P_CREUX =
  "M391 527.3C342.8 473.7 297.7 400.4 244.2 343C204.3 300.2 168.1 244.5 129 210.5" +
  "C115.9 199.1 102.5 183.3 94.4 180.2C86.3 177.2 85.8 210.5 85.8 227.8C85.8 274 86.2 320.8 95.8 366" +
  "C104.2 405.5 115.6 444.9 133.3 481.2C147.2 509.7 173 534.6 192.3 556.1" +
  "C206.6 554.1 250.4 552 278.7 546C300.8 541.4 323.5 540 345 533C359.6 528.3 416.1 555.1 391 527.3Z" +
  "M489 527.3C537.2 473.7 582.3 400.4 635.8 343C675.7 300.2 711.9 244.5 751 210.5" +
  "C764.1 199.1 777.5 183.3 785.6 180.2C793.7 177.2 794.2 210.5 794.2 227.8" +
  "C794.2 274 793.8 320.8 784.2 366C775.8 405.5 764.4 444.9 746.7 481.2" +
  "C732.8 509.7 707 534.6 687.7 556.1C673.4 554.1 629.6 552 601.3 546C579.2 541.4 556.5 540 535 533" +
  "C520.4 528.3 463.9 555.1 489 527.3Z";
// Le poinçon : les yeux.
const P_YEUX =
  "M412.2 635.9C402.6 625.2 407.6 612.4 398.8 605.6C390.3 598.8 383.3 585.9 372.3 586.3" +
  "C362.4 586.8 352.3 589.5 343.2 593.5C336.5 596.5 330.6 603.5 328.7 610.5" +
  "C326.7 618.7 336 626.4 343.2 629.8C353.2 634.7 363.7 640 374.6 640.8" +
  "C387.3 641.6 398.1 639.5 412.2 635.9C412.2 635.9 412.2 635.9 412.2 635.9ZM467.8 635.9" +
  "C477.4 625.2 472.4 612.4 481.2 605.6C489.7 598.8 496.7 585.9 507.7 586.3" +
  "C517.6 586.8 527.7 589.5 536.8 593.5C543.5 596.5 549.4 603.5 551.3 610.5" +
  "C553.3 618.7 544 626.4 536.8 629.8C526.8 634.7 516.3 640 505.4 640.8" +
  "C492.7 641.6 481.9 639.5 467.8 635.9C467.8 635.9 467.8 635.9 467.8 635.9Z";
// Le poinçon : la truffe.
const P_TRUFFE =
  "M440 686.7C429.1 686.7 428.9 688.6 421.9 690.3C417.1 691.6 418.8 695.2 418.3 698.8" +
  "C417 706 425.2 706.4 429.1 709.7C432.2 712.3 434 715.8 440 715.8C446 715.8 447.8 712.3 450.9 709.7" +
  "C454.8 706.4 463 706 461.7 698.8C461.2 695.2 462.9 691.6 458.1 690.3" +
  "C451.1 688.6 450.9 686.7 440 686.7Z";
// Le poinçon : l'arête du museau, du front à la truffe (la ligne qui partage la lumière et l'ombre).
const P_ARETE =
  "M440 515.8C440 563.7 440 611.8 440 659.8C440 688.6 440 717.4 440 746.2";
// Le sablé : les piqûres.
const SABLE_SOMBRE =
  "M0.9 2.2a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0M5.7 1.1a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0" +
  "M2.6 6.9a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0M8.2 5.6a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0" +
  "M4.7 4.2a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0M8.9 9.8a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0" +
  "M0.5 9.4a0.8 0.8 0 1 0 1.5 0a0.8 0.8 0 1 0 -1.5 0";
// Le sablé : leur lumière.
const SABLE_CLAIR =
  "M6.5 5.2a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0M0.3 4.1a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0" +
  "M8.2 9.9a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0M2.8 8.6a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0" +
  "M10.3 7.2a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0M3.5 1.8a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0" +
  "M6.1 1.4a0.6 0.6 0 1 0 1.2 0a0.6 0.6 0 1 0 -1.2 0";
// Les poils des joues, ciselés sur le blanc.
const JOUES_POILS =
  "M342 364C339.7 370.4 333.2 375.2 332 382C330.8 388.9 326 395 326 402M348 378" +
  "C345.8 384.2 341.1 389.5 340 396C338.8 402.6 338 409.3 338 416M358 390" +
  "C355.9 395.8 355.1 401.9 354 408C353 413.9 356 420 356 426M538 364C540.3 370.4 546.8 375.2 548 382" +
  "C549.2 388.9 554 395 554 402M532 378C534.2 384.2 538.9 389.5 540 396C541.2 402.6 542 409.3 542 416" +
  "M522 390C524.1 395.8 524.9 401.9 526 408C527 413.9 524 420 524 426";

/* ------------------- Les ornements, posés le long des tracés ------------------- */

type Pt = [number, number];
type Cubique = [Pt, Pt, Pt, Pt];

/** Les segments cubiques d'un tracé fait de M, C et Z (ceux de ce fichier). */
function cubiques(d: string): Cubique[][] {
  const sous: Cubique[][] = [];
  let cur: Cubique[] = [];
  let debut: Pt = [0, 0];
  let der: Pt = [0, 0];
  const re = /([MCZ])([^MCZ]*)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    const n = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if (m[1] === "M") {
      cur = [];
      sous.push(cur);
      debut = der = [n[0], n[1]];
    } else if (m[1] === "C") {
      for (let i = 0; i + 5 < n.length; i += 6) {
        const c: Cubique = [der, [n[i], n[i + 1]], [n[i + 2], n[i + 3]], [n[i + 4], n[i + 5]]];
        cur.push(c);
        der = c[3];
      }
    } else if (der[0] !== debut[0] || der[1] !== debut[1]) {
      cur.push([der, der, debut, debut]);
      der = debut;
    }
  }
  return sous;
}

const surCubique = (c: Cubique, t: number): Pt => {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, e = 3 * u * t * t, g = t * t * t;
  return [a * c[0][0] + b * c[1][0] + e * c[2][0] + g * c[3][0], a * c[0][1] + b * c[1][1] + e * c[2][1] + g * c[3][1]];
};

/** Des jalons tous les `pas` le long d'un tracé : [x, y, angle de la tangente]. */
function jalons(d: string, pas: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const sc of cubiques(d)) {
    const ligne: Pt[] = [];
    for (const c of sc) for (let i = ligne.length ? 1 : 0; i <= 24; i++) ligne.push(surCubique(c, i / 24));
    let reste = pas / 2;
    for (let i = 1; i < ligne.length; i++) {
      const [x0, y0] = ligne[i - 1];
      const [x1, y1] = ligne[i];
      const l = Math.hypot(x1 - x0, y1 - y0);
      const a = Math.atan2(y1 - y0, x1 - x0);
      for (; reste <= l; reste += pas) out.push([x0 + ((x1 - x0) * reste) / l, y0 + ((y1 - y0) * reste) / l, a]);
      reste -= l;
    }
  }
  return out;
}

const rond = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
/** Le fil torsadé : les traits obliques d'une torsade de largeur w, tous les `pas`, le long du tracé. */
const torsade = (d: string, pas: number, w: number) =>
  jalons(d, pas)
    .map(([x, y, t]) => {
      const dx = Math.cos(t + 1.05) * w * 0.62, dy = Math.sin(t + 1.05) * w * 0.62;
      return `M${f(x - dx)} ${f(y - dy)}L${f(x + dx)} ${f(y + dy)}`;
    })
    .join("");
/** Un grènetis : des perles de rayon r tous les `pas`, le long du tracé. */
const perles = (d: string, pas: number, r: number) => jalons(d, pas).map(([x, y]) => rond(x, y, r)).join("");
/** Un grènetis en ellipse (n perles). */
const perlesEnOvale = (cx: number, cy: number, rx: number, ry: number, n: number, r: number) =>
  Array.from({ length: n }, (_, i) => rond(cx + Math.cos((i / n) * 2 * Math.PI) * rx, cy + Math.sin((i / n) * 2 * Math.PI) * ry, r)).join("");

// Calculés une fois, au chargement : le fil torsadé du contour, les grènetis.
const TORSADE_TETE = torsade(TETE, 4, 4.6);
const TORSADE_CORPS = torsade(CORPS, 4, 4.6);
const TORSADE_QUEUE = torsade(QUEUE, 4, 4.6);
const GRENETIS = perles(BORD_OREILLES, 6.5, 1.8);
const GRENETIS_COUTURE = perles(COUTURE, 6.2, 1.5);
const LUNE_GRENETIS = perlesEnOvale(440, 140, 67, 67, 64, 1.8);
const CABOCHON_GRENETIS = perlesEnOvale(396, 498, 17, 21, 22, 1.5);

// L'argent d'Aït Yenni, l'émail de corail, de vert et de brun-noir.
const ARGENT = { blanc: "#fbfbfb", clair: "#e6e8ea", moyen: "#c3c7cb", sombre: "#969ba1", trait: "#6b7076", fil: "#8c9197", torsade: "rgba(44,48,54,0.55)" };
const CORAIL = { clair: "#e8a184", moyen: "#c8704f", fonce: "#7e4130" };
const VERT = { clair: "#5d9a7c", fonce: "#245a45" };

const deja = new Map<number, string>();
/** La patine : de fines rayures dans l'argent, tirées de la graine, jamais sur le visage. */
function patine(graine: number): string {
  const v = deja.get(graine);
  if (v !== undefined) return v;
  const rnd = alea(graine ^ 0xfe22ec);
  let d = "";
  for (let i = 0; i < 60 && d.length < 1400; i++) {
    const x = 190 + rnd() * 560, y = 60 + rnd() * 800, a = -0.4 + rnd() * 0.9, l = 8 + rnd() * 26;
    if (x > 290 && x < 590 && y > 300 && y < 500) continue;
    d += `M${f(x)} ${f(y)}l${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}`;
  }
  if (deja.size > 64) deja.clear();
  deja.set(graine, d);
  return d;
}

/** Le relief d'une plaque d'argent : une lumière sur ses bords hauts et gauches, une ombre sur les bas et droits. */
function Relief({ d, clip, force = 1 }: { d: string; clip: string; force?: number }) {
  return (
    <g clipPath={clip}>
      <path d={d} fill="none" stroke={`rgba(255,255,255,${0.78 * force})`} strokeWidth={6} strokeLinejoin="round" transform="translate(3 3.5)" />
      <path d={d} fill="none" stroke={`rgba(48,52,58,${0.3 * force})`} strokeWidth={7} strokeLinejoin="round" transform="translate(-3 -3.5)" />
    </g>
  );
}

/**
 * La face : un poinçon d'orfèvre dans le coin bas gauche du portrait. La tête du fennec, entière, en relief
 * dans un cartouche en creux qui la suit : la lumière vient d'en haut à gauche ; la moitié gauche de la
 * tête est éclairée, la droite dans l'ombre ; le creux des oreilles, les yeux et la truffe sont enfoncés.
 * Sans teinte : sur la photo, du blanc et du noir transparents ; sur les rayures, l'encre de la carte.
 */
function Poincon({ id, photo, encre }: { id: string; photo: boolean; encre: string }) {
  const k = (s: string) => `${s}-${id}`;
  const u = (s: string) => `url(#${s}-${id})`;
  const lum = (a: number) => `rgba(255,255,255,${photo ? a * 0.62 : a})`;
  const omb = (a: number) => (photo ? `rgba(0,0,0,${a * 1.3})` : `rgba(${encre},${a})`);
  return (
    <g>
      <defs>
        <clipPath id={k("pc")}>
          <path d={P_CARTOUCHE} />
        </clipPath>
        <clipPath id={k("pt")}>
          <path d={P_TETE} />
        </clipPath>
        <clipPath id={k("po")}>
          <path d={P_CREUX} />
        </clipPath>
      </defs>
      {/* Le champ, en creux : l'ombre sur le bord haut et gauche, la lumière sur le bas et droit */}
      <path d={P_CARTOUCHE} fill={omb(0.07)} />
      <g clipPath={u("pc")}>
        <path d={P_CARTOUCHE} fill="none" stroke={omb(0.34)} strokeWidth={30} strokeLinejoin="round" transform="translate(13 15)" />
        <path d={P_CARTOUCHE} fill="none" stroke={lum(0.85)} strokeWidth={26} strokeLinejoin="round" transform="translate(-12 -14)" />
      </g>
      {/* La tête en relief */}
      <path d={P_TETE} fill={lum(0.42)} />
      <g clipPath={u("pt")}>
        <path d="M0 0H440V880H0Z" fill={lum(0.3)} />
        <path d="M440 0H880V880H440Z" fill={omb(0.12)} />
        <path d={P_TETE} fill="none" stroke={lum(0.95)} strokeWidth={26} strokeLinejoin="round" transform="translate(12 14)" />
        <path d={P_TETE} fill="none" stroke={omb(0.4)} strokeWidth={28} strokeLinejoin="round" transform="translate(-12 -14)" />
        <path d={P_ARETE} fill="none" stroke={omb(0.2)} strokeWidth={10} strokeLinecap="round" transform="translate(6 0)" />
        {/* Le creux des oreilles, enfoncé : son bord haut dans l'ombre */}
        <path d={P_CREUX} fill={omb(0.12)} />
        <g clipPath={u("po")}>
          <path d={P_CREUX} fill="none" stroke={omb(0.36)} strokeWidth={24} strokeLinejoin="round" transform="translate(10 12)" />
          <path d={P_CREUX} fill="none" stroke={lum(0.7)} strokeWidth={18} strokeLinejoin="round" transform="translate(-9 -10)" />
        </g>
        <path d={P_YEUX} fill={omb(0.5)} />
        <path d={P_YEUX} fill="none" stroke={lum(0.8)} strokeWidth={8} strokeLinejoin="round" transform="translate(-4 -5)" />
        <path d={P_TRUFFE} fill={omb(0.55)} />
      </g>
    </g>
  );
}

function Dessin({ couche, tons, graine, photo, id }: PropsTotem) {
  if (couche === "face-portrait") return <Poincon id={id} photo={photo} encre={tons.encre} />;
  if (couche !== "dos") return null;
  const u = (k: string) => `url(#${k}-${id})`;
  const k = (s: string) => `${s}-${id}`;
  const encre = (a: number) => `rgba(${tons.encre},${a})`;
  const rayures = patine(graine);
  const ligne = "rgba(62,66,72,0.5)";
  return (
    <g>
      <defs>
        <linearGradient id={k("ft")} gradientUnits="userSpaceOnUse" x1={228} y1={34} x2={628} y2={494}>
          <stop offset={0} stopColor="#f3f4f5" />
          <stop offset={0.5} stopColor="#c2c6cb" />
          <stop offset={1} stopColor="#8e939a" />
        </linearGradient>
        <linearGradient id={k("ff")} gradientUnits="userSpaceOnUse" x1={388} y1={280} x2={488} y2={414}>
          <stop offset={0} stopColor="#d3d7da" />
          <stop offset={1} stopColor="#b1b6bb" />
        </linearGradient>
        <linearGradient id={k("fw")} gradientUnits="userSpaceOnUse" x1={0} y1={334} x2={0} y2={454}>
          <stop offset={0} stopColor="#f3f4f5" stopOpacity={0} />
          <stop offset={0.34} stopColor="#f3f4f5" stopOpacity={0.95} />
          <stop offset={1} stopColor="#dde0e3" />
        </linearGradient>
        <linearGradient id={k("fb")} gradientUnits="userSpaceOnUse" x1={348} y1={474} x2={488} y2={674}>
          <stop offset={0} stopColor="#fdfdfd" />
          <stop offset={1} stopColor="#e1e4e6" />
        </linearGradient>
        <linearGradient id={k("fc")} gradientUnits="userSpaceOnUse" x1={368} y1={474} x2={688} y2={814}>
          <stop offset={0} stopColor="#e8eaec" />
          <stop offset={0.55} stopColor="#b6bbc0" />
          <stop offset={1} stopColor="#868b92" />
        </linearGradient>
        <radialGradient id={k("fk")} gradientUnits="userSpaceOnUse" cx={580} cy={610} r={210}>
          <stop offset={0} stopColor="#f4f5f6" />
          <stop offset={0.55} stopColor="#c3c7cc" />
          <stop offset={1} stopColor="#8b9096" />
        </radialGradient>
        <linearGradient id={k("fl")} gradientUnits="userSpaceOnUse" x1={348} y1={0} x2={430} y2={0}>
          <stop offset={0} stopColor="#fbfbfc" />
          <stop offset={1} stopColor="#d2d5d8" />
        </linearGradient>
        <linearGradient id={k("fo")} gradientUnits="userSpaceOnUse" x1={0} y1={650} x2={0} y2={780}>
          <stop offset={0} stopColor="#b9bdc2" />
          <stop offset={1} stopColor="#a4a9ae" />
        </linearGradient>
        <linearGradient id={k("fd")} gradientUnits="userSpaceOnUse" x1={388} y1={0} x2={430} y2={0}>
          <stop offset={0} stopColor="#dadde0" />
          <stop offset={1} stopColor="#b4b9be" />
        </linearGradient>
        <radialGradient id={k("fq")} gradientUnits="userSpaceOnUse" cx={440} cy={512} r={345}>
          <stop offset={0.7} stopColor="#f5f6f7" />
          <stop offset={0.85} stopColor="#c8ccd1" />
          <stop offset={1} stopColor="#92979d" />
        </radialGradient>
        <linearGradient id={k("fe")} gradientUnits="userSpaceOnUse" x1={0} y1={44} x2={0} y2={354}>
          <stop offset={0} stopColor={CORAIL.clair} />
          <stop offset={0.6} stopColor={CORAIL.moyen} />
          <stop offset={1} stopColor={CORAIL.fonce} />
        </linearGradient>
        <linearGradient id={k("fm")} gradientUnits="userSpaceOnUse" x1={0} y1={44} x2={0} y2={354}>
          <stop offset={0} stopColor="#f3bea6" />
          <stop offset={1} stopColor="#d38767" />
        </linearGradient>
        <linearGradient id={k("fv")} x1={0} y1={0} x2={0} y2={1}>
          <stop offset={0} stopColor={VERT.clair} />
          <stop offset={1} stopColor={VERT.fonce} />
        </linearGradient>
        <radialGradient id={k("fn")} cx={0.4} cy={0.3} r={0.8}>
          <stop offset={0} stopColor="#4b3a2f" />
          <stop offset={1} stopColor="#1c130e" />
        </radialGradient>
        <linearGradient id={k("fa")} x1={0} y1={0} x2={1} y2={1}>
          <stop offset={0} stopColor="#f6f7f8" />
          <stop offset={0.5} stopColor="#c6cace" />
          <stop offset={1} stopColor="#8f949a" />
        </linearGradient>
        <radialGradient id={k("fn2")} cx={0.4} cy={0.35} r={0.75}>
          <stop offset={0} stopColor="#f7f3ea" />
          <stop offset={1} stopColor="#e3dccd" />
        </radialGradient>
        <radialGradient id={k("fk2")} cx={0.38} cy={0.34} r={0.75}>
          <stop offset={0} stopColor={CORAIL.clair} />
          <stop offset={0.55} stopColor={CORAIL.moyen} />
          <stop offset={1} stopColor={CORAIL.fonce} />
        </radialGradient>
        <radialGradient id={k("fs")} cx={0.5} cy={0.5} r={0.5}>
          <stop offset={0} stopColor={`rgb(${tons.encre})`} stopOpacity={0.22} />
          <stop offset={1} stopColor={`rgb(${tons.encre})`} stopOpacity={0} />
        </radialGradient>
        <pattern id={k("sb")} patternUnits="userSpaceOnUse" width={11} height={11}>
          <path d={SABLE_SOMBRE} fill="rgba(52,56,62,0.2)" />
          <path d={SABLE_CLAIR} fill="rgba(255,255,255,0.55)" />
        </pattern>
        <clipPath id={k("cq")}>
          <path d={QUEUE} />
        </clipPath>
        <clipPath id={k("cr")}>
          <path d={CROUPE} />
        </clipPath>
        <clipPath id={k("cc")}>
          <path d={CORPS} />
        </clipPath>
        <clipPath id={k("ck")}>
          <path d={CUISSE} />
        </clipPath>
        <clipPath id={k("cp")}>
          <path d={PATTE_PROCHE} />
        </clipPath>
        <clipPath id={k("ch")}>
          <path d={TETE} />
        </clipPath>
        <clipPath id={k("ct")}>
          <path d={TETE + CORPS + QUEUE} />
        </clipPath>
      </defs>
      {/* L'ombre de contact sous la queue */}
      <ellipse cx={440} cy={846} rx={290} ry={24} fill={u("fs")} />
      {/* Le chaton de la lune, serti dans l'anneau de la fibule */}
      <path d={LUNE_FOND} fill={u("fn2")} />
      <path d={LUNE_COLLET} fill={u("fa")} fillRule="evenodd" stroke={ARGENT.trait} strokeWidth={1} />
      <path d={LUNE_GRENETIS} fill="rgba(255,255,255,0.95)" />
      <path d={LUNE_FIL} fill="none" stroke={ARGENT.fil} strokeWidth={1.6} />
      {/* Le corps : le dos et la croupe, la cuisse, les pattes, le plastron */}
      <path d={CORPS} fill={u("fc")} />
      <path d={CORPS} fill={u("sb")} />
      <g clipPath={u("cc")}>
        <path d={CUISSE} fill={u("fk")} />
        <path d={CUISSE} fill={u("sb")} opacity={0.8} />
      </g>
      <path d={PATTE_LOIN} fill={u("fd")} stroke={ligne} strokeWidth={1.2} />
      <path d={PATTE_LOIN} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2.4} clipPath={u("cc")} />
      <path d={PATTE_PROCHE} fill={u("fl")} stroke={ligne} strokeWidth={1.2} />
      <path d={PATTE_PROCHE + CUISSE} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2.4} clipPath={u("cc")} />
      <path d={PATTE_PROCHE + CUISSE} fill="none" stroke="rgba(62,66,72,0.45)" strokeWidth={0.9} transform="translate(1.1 1.3)" clipPath={u("cc")} />
      <path d={PLASTRON} fill={u("fb")} />
      <path d={PLASTRON} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2.4} clipPath={u("cc")} />
      <path d={PLASTRON} fill="none" stroke="rgba(62,66,72,0.45)" strokeWidth={0.9} transform="translate(1.1 1.3)" clipPath={u("cc")} />
      <path d={PEND_ANNEAUX} fill="none" stroke={ARGENT.fil} strokeWidth={1.1} />
      <path d={PEND_LOSANGES} fill={u("fv")} stroke={ARGENT.clair} strokeWidth={1} strokeLinejoin="round" />
      <path d={PEND_CORAIL} fill={CORAIL.clair} />
      <path d={PEND_PERLES} fill={CORAIL.moyen} stroke="rgba(62,66,72,0.4)" strokeWidth={0.4} />
      <path d={CABOCHON_GRENETIS} fill="rgba(255,255,255,0.95)" />
      <path d={CABOCHON_COLLET} fill={u("fa")} stroke={ARGENT.trait} strokeWidth={0.9} />
      <path d={CABOCHON} fill={u("fk2")} stroke="rgba(62,66,72,0.5)" strokeWidth={0.8} />
      <Relief d={CORPS} clip={u("cc")} />
      <g clipPath={u("cc")}>
        <Relief d={CUISSE} clip={u("ck")} force={0.8} />
      </g>
      <Relief d={PATTE_PROCHE} clip={u("cp")} force={0.7} />
      <path d={CISELURE} fill="none" stroke="rgba(62,66,72,0.42)" strokeWidth={1.2} strokeLinecap="round" />
      <path d={CISELURE} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.9} strokeLinecap="round" transform="translate(-0.9 -1.1)" />
      <path d={GRENETIS_COUTURE} fill="rgba(255,255,255,0.95)" />
      <path d={CORPS} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_CORPS} stroke={ARGENT.torsade} strokeWidth={1.1} />
      {/* La queue, devant les pieds ; la croupe repasse devant sa base */}
      <path d={QUEUE} fill={u("fq")} />
      <g clipPath={u("cq")}>
        <path d={MECHES} fill="none" stroke={ligne} strokeWidth={1.5} strokeLinecap="round" />
        <path d={MECHES} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1} strokeLinecap="round" transform="translate(-1.1 -1.3)" />
        <path d={QUEUE} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={6} transform="translate(2 4)" />
        <path d={QUEUE} fill="none" stroke="rgba(48,52,58,0.3)" strokeWidth={7} transform="translate(-2 -4)" />
        <path d={FRISE_FIL} fill="none" stroke={ARGENT.clair} strokeWidth={1.8} />
        <path d={FRISE_QUEUE} fill={u("fv")} stroke={ARGENT.clair} strokeWidth={1.1} strokeLinejoin="round" />
        <path d={BOUT} fill={u("fn")} />
        <path d={BOUT} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      </g>
      <path d={QUEUE} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_QUEUE} stroke={ARGENT.torsade} strokeWidth={1.1} />
      <g clipPath={u("cr")}>
        <g clipPath={u("cc")}>
          <path d={CORPS} fill={u("fc")} />
          <path d={CUISSE} fill={u("fk")} />
          <path d={CISELURE} fill="none" stroke="rgba(62,66,72,0.42)" strokeWidth={1.2} strokeLinecap="round" />
          <path d={CISELURE} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.9} strokeLinecap="round" transform="translate(-0.9 -1.1)" />
        </g>
        <path d={CORPS} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} />
        <path d={TORSADE_CORPS} stroke={ARGENT.torsade} strokeWidth={1.1} />
      </g>
      <path d={CROUPE_FIL} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2.2} strokeLinecap="round" clipPath={u("cc")} />
      <path d={CROUPE_FIL} fill="none" stroke="rgba(62,66,72,0.5)" strokeWidth={1} strokeLinecap="round" transform="translate(1.2 1.2)" clipPath={u("cc")} />
      {/* La tête et les oreilles */}
      <path d={TETE} fill={u("ft")} />
      <path d={TETE} fill={u("sb")} />
      <Relief d={TETE} clip={u("ch")} />
      <path d={CREUX} fill={u("fe")} />
      <path d={MEDIANE} fill={u("fm")} />
      <path d={GLACIS} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth={5} strokeLinecap="round" />
      <path d={CLOISONS} fill="none" stroke={ARGENT.clair} strokeWidth={3.6} strokeLinecap="round" />
      <path d={CLOISONS} fill="none" stroke="rgba(70,74,80,0.55)" strokeWidth={0.9} strokeLinecap="round" transform="translate(1 1.2)" />
      <path d={POILS} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.7} strokeLinecap="round" />
      <path d={CREUX} fill="none" stroke={ARGENT.clair} strokeWidth={4} />
      <path d={CREUX} fill="none" stroke={ARGENT.trait} strokeWidth={1.1} />
      <path d={BLANC} fill={u("fw")} />
      <path d={JOUES_POILS} fill="none" stroke="rgba(62,66,72,0.28)" strokeWidth={1} strokeLinecap="round" />
      <path d={COURONNE_FIL} fill="none" stroke={ARGENT.clair} strokeWidth={1.8} strokeLinecap="round" />
      <path d={COURONNE_VERT} fill={u("fv")} stroke={ARGENT.clair} strokeWidth={1.1} strokeLinejoin="round" />
      <path d={COURONNE_CORAIL} fill={CORAIL.moyen} stroke={ARGENT.clair} strokeWidth={1.1} strokeLinejoin="round" />
      <path d={ARETE} fill={u("ff")} />
      <path d={ARETE} fill={u("sb")} />
      <path d={CRETE} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2} strokeLinecap="round" />
      <path d={LARMES} fill={u("fn")} />
      <path d={YEUX} fill={u("fn")} stroke={ARGENT.clair} strokeWidth={2.6} />
      <path d={REFLETS} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth={2.6} strokeLinecap="round" />
      <path d={TRUFFE} fill={u("fn")} />
      <path d={BOUCHE} fill="none" stroke={encre(0.7)} strokeWidth={2} strokeLinecap="round" />
      <path d={VIBRISSES} fill="none" stroke="rgba(62,66,72,0.4)" strokeWidth={1} strokeLinecap="round" />
      <path d={GRENETIS} fill="rgba(255,255,255,0.92)" />
      <path d={TETE} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_TETE} stroke={ARGENT.torsade} strokeWidth={1.1} />
      <path d={BRILLANCES} fill="rgba(255,255,255,0.92)" />
      {/* La patine */}
      <g clipPath={u("ct")}>
        <path d={rayures} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeLinecap="round" />
        <path d={rayures} fill="none" stroke="rgba(70,74,80,0.12)" strokeWidth={1} strokeLinecap="round" transform="translate(0.8 1.1)" />
      </g>
    </g>
  );
}

const totem: TotemNation = {
  nation: "dz",
  animal: "fennec",
  quoi: "Le fennec assis de trois quarts, la tête de face, les oreilles en couronne, la queue dans le creux de l'anneau : un bijou d'argent d'Aït Yenni (corail cloisonné, couronne de triangles, cabochon et pendeloques, fil torsadé, grènetis, sablé et poli), la lune sertie entre ses oreilles ; à la face, un poinçon d'orfèvre.",
  sources: [
    { titre: "San Diego Zoo, fiche du fennec : ses caractéristiques (oreilles, pelage, queue)", url: "https://ielc.libguides.com/sdzg/factsheets/fennec-fox/characteristics" },
    { titre: "Smithsonian's National Zoo, le fennec", url: "https://www.nationalzoo.si.edu/animals/fennec-fox" },
    { titre: "PBS Nature, fiche du fennec", url: "https://www.pbs.org/wnet/nature/blog/fennec-fox-fact-sheet" },
    { titre: "National Geographic, le fennec", url: "https://www.nationalgeographic.com/animals/mammals/f/fennec-fox/" },
    { titre: "Smarthistory, les fibules kabyles d'Aït Yenni (argent, émail cloisonné, corail)", url: "https://smarthistory.org/?p=80936" },
    { titre: "Musée du quai Branly, fibule d'Aït Yenni perlée, à pendeloques losangiques émaillées", url: "https://m.quaibranly.fr/en/explore-collections/base/Work/action/show/notice/302366-fibule" },
    { titre: "Proantic, bracelet de Beni Yenni en argent, corail et émail cloisonné", url: "https://proantic.com/en/1358578-beni-yenni-bracelet-in-kabyle-berber-silver-coral-and-cloisonne-enamel-19th-century.htm.html" },
    { titre: "Silver Collection, les poinçons de l'argent et de l'orfèvre (France)", url: "https://www.silvercollection.it/hallmarksFRA.html" },
  ],
  dessine: true,
  boite: { w: 880, h: 880 },
  pose: {
    // La lune sertie dans l'anneau, sans la rosace guillochée (son halo brouillait l'argent entre les oreilles).
    dos: { x: 72, y: 226, echelle: 1, devant: true, lune: { cx: 512, cy: 366, d: 110 }, rosace: false },
    // Le poinçon : 130 de large dans le coin bas gauche du portrait, les pointes des oreilles à y 845.
    face: { portrait: { x: 124, y: 826, echelle: 0.148 } },
  },
  Dessin,
};

export default totem;
