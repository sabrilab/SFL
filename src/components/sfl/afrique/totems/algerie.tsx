// Le totem de l'Algérie : le fennec (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 :
// « Je veux que le Fennec soit le plus stylé possible »). Jamais nommé sur la carte.
//
// La pose : assis de trois quarts (le corps tourné vers la gauche), la tête
// de face, les oreilles en couronne : la pose « assis, la tête de face » des
// blasons. Les proportions d'un fennec assis : la tête fait 22 % de la
// hauteur, les oreilles 1,7 fois la hauteur de la tête, leur base la moitié
// de leur longueur, le bord extérieur bombé, la pointe arrondie ; le crâne
// file dans le bord extérieur des oreilles, le front est étroit ; de grandes
// amandes sombres serties d'argent, un reflet en arc ; le visage d'un renard,
// pas d'un chaton : sous la fourrure de la joue, le bord rentre vers un
// museau long et effilé, le menton étroit ; les larmiers, courts, effilés,
// brun-roux, partent du coin intérieur de l'œil et s'écartent vers la joue en
// descendant, bien au-dessus de la lèvre, courte et droite. Le corps : le
// poitrail étroit et haut, le garrot, le dos qui retombe en courbe jusqu'à
// la croupe, une cuisse ronde mais menue ; deux pattes avant de renard, la
// lointaine (la droite du fennec) à gauche, plus haut sur le sol, dans
// l'ombre franche du poitrail, la proche devant : l'avant-bras qui s'affine,
// le carpe et son coussinet, le métacarpe qui avance un peu, le pied ovale et
// velu. Deux vides se lisent dans la silhouette : sous le ventre, entre les
// pattes avant et la cuisse, et entre les pieds et la queue. La queue, ronde
// et touffue, sort de sous la croupe, passe devant le pied arrière, sous les
// pieds avant, et remonte en épousant le dedans de l'anneau de la fibule ;
// son contour est fait de mèches (des écailles de fourrure qui pointent vers
// le bout), sa fourrure ciselée en arêtes de poisson ; son bout brun-noir
// entre dans l'argent en mèches effilées. Trois poses essayées : assis de
// trois quarts (gardée), assis de face (trop raide, le corps en bouteille),
// couché en sphinx (trop bas dans l'anneau, la tête trop loin de la lune).
//
// Le traitement : un bijou d'Aït Yenni.
//   · l'argent : chaque plaque a son dégradé, qui suit son volume, une
//     lumière sur ses bords hauts et gauches, une ombre sur les bas et
//     droits ; le pelage sable est sablé (de fines piqûres), le blanc est
//     poli ; quelques brillances posées à la main ;
//   · l'émail : le creux des oreilles en corail cloisonné (trois alvéoles,
//     un glacis), une couronne de triangles sur le front (les dents vertes,
//     le corail entre elles) ; les yeux, la truffe et le bout de la queue en
//     brun-noir, les larmiers en brun-roux ;
//   · un cabochon de corail serti au poitrail, son grènetis, trois
//     pendeloques (des losanges d'émail, une perle de corail) : deux bijoux
//     sur le fennec, pas plus (la couronne et la fibule), l'argent fait le
//     reste ;
//   · le contour en fil torsadé ; un grènetis fin (rayon 1,5 à 1,8, tous les
//     6 ou 7), ton sur ton, au bord des oreilles, autour du cabochon et de
//     la lune, et en couture entre le plastron et le flanc ;
//   · la ciselure : la fourrure du garrot, du dos, de la cuisse et des joues,
//     les mèches de la queue, toutes dans le sens du poil ;
//   · la patine : de fines rayures tirées de la graine (une par joueur), sur
//     l'argent sablé seulement (le dos, la cuisse, la queue), jamais sur le
//     plastron poli, les pattes ni le visage ; la silhouette ne change jamais.
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
// long de ces tracés, une fois, au chargement. L'ordre : le corps, la patte
// lointaine (l'ombre du poitrail portée sur elle), le plastron, la patte
// proche, la queue, puis la croupe qui repasse devant la base de la queue
// (CROUPE : au-dessus du bas de la cuisse), la tête.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

// La tête et les oreilles : le crâne file dans le bord extérieur des oreilles, le front étroit.
const TETE =
  "M440 260C431 260 429.6 263.2 421 266C398.3 238 348.5 181.9 310 142C278.9 109.8 244.8 64.9 218 44" +
  "C205.4 34.1 198.9 25.3 190 24C181.1 22.7 182 58 182 74C182 107.4 181.1 141.3 188 174" +
  "C194.7 205.4 201.4 237.4 216 266C227.4 288.5 245.1 307.3 262 326C269.6 334.4 283 339.3 288 348" +
  "C293 356.7 299.6 364.3 302 374C303.9 381.8 307.5 391.4 312 398C319.8 409.6 334.8 418.4 348 426" +
  "C362 434.1 376 441.9 390 450C399.3 455.4 408.5 462.9 418 466C425.6 468.5 430 472 440 472" +
  "C450 472 454.4 468.5 462 466C471.5 462.9 480.7 455.4 490 450C504 441.9 518 434.1 532 426" +
  "C545.2 418.4 560.2 409.6 568 398C572.5 391.4 576.1 381.8 578 374C580.4 364.3 587 356.7 592 348" +
  "C597 339.3 610.4 334.4 618 326C634.9 307.3 652.6 288.5 664 266C678.6 237.4 685.3 205.4 692 174" +
  "C698.9 141.3 698 107.4 698 74C698 58 698.9 22.7 690 24C681.1 25.3 674.6 34.1 662 44" +
  "C635.2 64.9 601.1 109.8 570 142C531.5 181.9 481.7 238 459 266C450.4 263.2 449 260 440 260Z";
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
  "M440 351C434 351 427 357.5 420 358C411.1 358.6 402.9 364 394 364C383.8 364 376.7 353 368 348" +
  "C358 348.7 345.4 342.6 334 343C320.6 343.5 297.5 340.8 294 348C290.5 355.2 299.6 364.3 302 374" +
  "C303.9 381.8 307.5 391.4 312 398C319.8 409.6 334.8 418.4 348 426C362 434.1 376 441.9 390 450" +
  "C399.3 455.4 408.5 462.9 418 466C425.6 468.5 430 472 440 472C450 472 454.4 468.5 462 466" +
  "C471.5 462.9 480.7 455.4 490 450C504 441.9 518 434.1 532 426C545.2 418.4 560.2 409.6 568 398" +
  "C572.5 391.4 576.1 381.8 578 374C580.4 364.3 589.5 355.2 586 348C582.5 340.8 559.4 343.5 546 343" +
  "C534.6 342.6 522 348.7 512 348C503.3 353 496.2 364 486 364C477.1 364 468.9 358.6 460 358" +
  "C453 357.5 446 351 440 351Z";
// Les yeux en amande ; le coin intérieur descend vers le museau.
const YEUX =
  "M420.7 357.4C414 350 417 343 411.4 339C405.6 334.8 400.1 328 393 328" +
  "C386.2 328.1 379.2 329 372.8 331.4C368.7 332.9 362.9 332.6 361 337.3" +
  "C358.9 342.7 366.9 347.6 372 349.9C379.2 353.1 386.7 356 394.6 356.6" +
  "C403.3 357.2 410.9 359.9 420.7 357.4C420.7 357.4 420.7 357.4 420.7 357.4ZM459.3 357.4" +
  "C466 350 463 343 468.6 339C474.4 334.8 479.9 328 487 328C493.8 328.1 500.8 329 507.2 331.4" +
  "C511.3 332.9 517.1 332.6 519 337.3C521.1 342.7 513.1 347.6 508 349.9" +
  "C500.8 353.1 493.3 356 485.4 356.6C476.7 357.2 469.1 359.9 459.3 357.4" +
  "C459.3 357.4 459.3 357.4 459.3 357.4Z";
// Le reflet en arc, sous la paupière du haut.
const REFLETS =
  "M384.6 335.6C383.4 333.7 387.8 332.4 389.6 331M495.4 335.6C496.6 333.7 492.2 332.4 490.4 331";
// Les larmiers : du coin intérieur de l'œil au coin de la bouche.
const LARMES =
  "M423 359C422.2 367 423.8 373.1 422.5 380C421.2 386.8 419.4 393.5 417 400" +
  "C414.8 405.9 409.1 412.6 407 416C407 416 411.6 404.1 413.6 398C415.7 391.6 415.9 384.7 416.6 378" +
  "C417.2 372 418.1 368 417.8 360C417.8 360 423 359 423 359ZM457 359C457.8 367 456.2 373.1 457.5 380" +
  "C458.8 386.8 460.6 393.5 463 400C465.2 405.9 470.9 412.6 473 416C473 416 468.4 404.1 466.4 398" +
  "C464.3 391.6 464.1 384.7 463.4 378C462.8 372 461.9 368 462.2 360C462.2 360 457 359 457 359Z";
// L'arête du museau, le sable (argent satiné), et sa crête polie.
const ARETE =
  "M440 344C434 344 430.6 347 429 351C425.6 359.4 425.3 368.9 425 378C424.7 385.3 425.2 392.7 426 400" +
  "C426.7 406.6 432 414 440 414C448 414 453.3 406.6 454 400C454.8 392.7 455.3 385.3 455 378" +
  "C454.7 368.9 454.4 359.4 451 351C449.4 347 446 344 440 344Z";
// La crête polie de l'arête.
const CRETE =
  "M440 362C440 372 440 382 440 392";
// La truffe.
const TRUFFE =
  "M440 410C432 410 431.9 411.8 427 413C423.1 414 424.5 417 424 420C423.1 424.9 428.3 425.7 431 428" +
  "C433.5 430.1 435 432 440 432C445 432 446.5 430.1 449 428C451.7 425.7 456.9 424.9 456 420" +
  "C455.5 417 456.9 414 453 413C448.1 411.8 448 410 440 410Z";
// La bouche.
const BOUCHE =
  "M440 432C440 435 440 438 440 441M431 441.5C437 441.5 443 441.5 449 441.5";
// Les vibrisses, en fils fins.
const VIBRISSES =
  "M425 424C416.5 423.1 408.5 418.7 400 419C391.3 419.3 382.5 419.2 374 421M426 431" +
  "C418 430.2 410.1 433.7 402 434C394.2 434.3 387.6 440.4 380 442M455 424" +
  "C463.5 423.1 471.5 418.7 480 419C488.7 419.3 497.5 419.2 506 421M454 431" +
  "C462 430.2 469.9 433.7 478 434C485.8 434.3 492.4 440.4 500 442";
// Le corps assis de trois quarts : la gorge, le poitrail étroit et haut, le ventre, la cuisse, la croupe, le dos qui retombe en courbe, le garrot.
const CORPS =
  "M396 414C387.3 430.4 373.7 444.4 368 462C364.2 473.8 354.3 483.7 353 496C351.9 506 349.3 516 350 526" +
  "C350.8 536.8 350.9 548.4 356 558C360.9 567.2 368.8 575.1 378 580C391.9 587.4 408.4 588.4 424 590" +
  "C441.4 591.8 458.6 595.4 476 596C490.1 596.5 505 594.7 518 600C528.5 604.3 539 611.8 544 622" +
  "C550.3 634.9 552.5 649.7 554 664C556.1 683.9 556 704 556 724C556 737.4 548.4 757.3 560 764" +
  "C579.6 775.3 606 771.5 628 766C642 762.5 656.4 754.2 664 742C669.4 733.4 675.2 722 676 714" +
  "C676.8 706 682.4 690.2 682 678C681.5 663.9 680.8 649.3 676 636C672 625.1 666.7 614.6 662 604" +
  "C657.6 594.2 652.6 584.5 650 574C647.3 563.2 645.2 551.9 640 542C635.1 532.8 630.6 523.4 626 514" +
  "C623.4 508.6 618.8 503.9 618 498C616.9 490.3 611.2 483.8 606 478C600.9 472.4 595.1 466.6 588 464" +
  "C579.3 460.8 571.3 454.6 562 454C548.5 453.1 537.5 439.1 524 440C504.2 441.4 487.1 414.9 468 420" +
  "C444.7 426.2 407.3 392.7 396 414Z";
// Le plastron blanc, de la gorge au poitrail, entre les pattes avant.
const PLASTRON =
  "M406 438C392 446.1 374 453 368 468C363.9 478.2 355.5 487.1 354 498C352.7 507.3 350.3 516.6 351 526" +
  "C351.8 536.9 352.5 548.5 358 558C363.2 567 371 574.8 380 580C388.4 584.9 398.3 588 408 588" +
  "C418.5 588 429.7 579.6 434 570C439.2 558.2 446.2 546.8 448 534C449.7 521.7 457.1 510.4 458 498" +
  "C458.8 486.2 470.9 475.5 468 464C465.5 453.9 458.4 440 448 440C434 440 418.1 431 406 438Z";
// La patte avant proche : l'avant-bras qui s'affine, le carpe, le métacarpe qui avance, le pied ovale et velu.
const PATTE_PROCHE =
  "M388 546C386.4 557.3 384.4 568.6 384 580C383.5 594.7 385.5 609.3 386 624" +
  "C386.5 637.4 389.5 650.6 390 664C390.3 671.7 393.6 679 393 687C392.6 693 390.4 702.5 388 708" +
  "C385.6 713.5 381.9 718 379 722C376.1 726 372.8 731.1 372 735C371.2 738.9 372.4 742.6 375 744" +
  "C377.6 745.4 380.7 741.9 382 744C383.3 741.9 385 747 388 747C391 747 393.7 742.9 395 745" +
  "C396.3 742.9 399 747 402 747C405 747 407.7 742.9 409 745C410.3 742.9 413 746 416 746" +
  "C419 746 420.9 743.6 424 741C427.1 738.4 427.7 736 428 732C428.3 727 426.5 724.8 425 720" +
  "C423.5 715.2 418.5 717 419 712C419.4 708 424.9 703.7 426.5 700C428.1 696.3 425.7 692.8 424.5 689" +
  "C422.6 683.3 424.7 669.6 424 660C423.1 646.6 431.9 633.4 430 620C428.3 608.1 443.3 598 442 586" +
  "C441 576.1 451.3 567.9 452 558C452.7 547.8 451.4 536.6 446 528C441.4 520.6 432.6 515.2 424 514" +
  "C415.6 512.8 406.6 516.8 400 522C393 527.5 389.2 537.1 388 546Z";
// La patte avant lointaine, plus haut sur le sol, dans l'ombre du poitrail.
const PATTE_LOIN =
  "M349 544C348.4 560 346.3 576 346 592C345.7 606.7 347.5 621.3 348 636C348.4 647.4 351.3 662 351 670" +
  "C350.8 676 349.2 684.4 347 690C344.8 695.6 341.9 700 339 704C336.1 708 332 712.1 331 716" +
  "C330 719.9 330.4 722.5 333 724C335.6 725.5 338.7 722.9 340 725C341.3 722.9 343 728 346 728" +
  "C349 728 351.7 723.9 353 726C354.3 723.9 357 728 360 728C363 728 366.5 727 370 725" +
  "C373.5 723 375.2 720.9 376 717C377 712.1 376.2 709.9 375 705C373.8 700.1 369.5 701 370 696" +
  "C370.4 692 374.9 688.7 376.5 685C378.1 681.3 375.7 678.8 374.5 675C372.6 669.3 374.4 654.3 374 644" +
  "C373.5 629.3 378 614.7 377 600C375.9 584.6 385.7 569.2 383 554C380.9 542.4 349.4 532.2 349 544Z";
// Les doigts des pieds avant : un trait ciselé qui monte de chaque creux.
const DOIGTS =
  "M340 725C340.1 722.3 341 719.7 341 717M353 726C353.1 723.3 353 720.7 353 718M382 744" +
  "C382.1 741 383 738 383 735M395 745C395.1 742 395 739 395 736M409 745C409.1 742 408 739 408 736" +
  "M334 706C332.7 709 331.3 712 330 715M341 708C340 711.3 339 714.7 338 718M374 704" +
  "C375 707.3 376 710.7 377 714M378 724C376.7 727 375.3 730 374 733M385 725" +
  "C384.3 728.3 383.7 731.7 383 735M424 722C425 725.3 426 728.7 427 732M419 724" +
  "C419.3 727.3 419.7 730.7 420 734";
// La cuisse repliée, sa masse ovale (plus petite d'un cinquième).
const CUISSE =
  "M640 592C616.2 595.3 602.2 600.1 588 612C574 623.8 562.4 640.2 558 658C554 674.2 554.8 691.4 556 708" +
  "C557 721.7 562.8 735.8 572 746C583.2 758.4 603.4 761.7 620 760C635.5 758.4 653.2 750 660 736" +
  "C667.8 720.1 678.6 703.7 678 686C677.3 665.6 678.6 642.1 666 626C657.2 614.8 655.8 589.8 640 592Z";
// La croupe, devant la base de la queue (la cuisse repasse devant elle).
const CROUPE =
  "M554 726C556.5 736.1 564.6 745.4 574 750C588.6 757.1 605.9 759.7 622 758" +
  "C637.5 756.4 652 745.9 662 734C671.4 722.8 678 708.5 680 694L718 674L718 654L528 654L528 726Z";
// Le bord de la cuisse sur la queue.
const CROUPE_FIL =
  "M554 726C556.5 736.1 564.6 745.4 574 750C588.6 757.1 605.9 759.7 622 758" +
  "C637.5 756.4 652 745.9 662 734C671.4 722.8 678 708.5 680 694";
// La queue : un cylindre touffu qui suit le dedans de l'anneau, sous les pieds avant, son contour à mèches.
const QUEUE =
  "M668.7 710.8C658.1 722.9 653.4 755.7 650.4 755.4C645 763.8 610.1 798.2 602.2 802.6" +
  "C597.8 805 571.9 815 569.1 813.8C561.3 820.1 525.8 836.1 517 837.9C512 838.8 489.4 840.2 487 838.4" +
  "C477.9 842.5 433.9 848.2 424.9 847.6C419.9 847.2 395.1 841.4 393.3 839" +
  "C383.4 840.4 344.8 834.3 336.3 831.2C331.6 829.4 311.9 818 310.8 815.2" +
  "C300.9 814 268.6 802.6 261.2 797.5C257.1 794.6 242.8 780.3 242.4 777.3" +
  "C233 773.8 211.2 763 205.2 756.3C201.9 752.5 195.9 738 196.1 735C187.6 729.8 167.5 715.6 163 707.9" +
  "C160.4 703.5 158.3 687.5 159 684.6C151.6 677.8 140 663.5 137 655.1" +
  "C135.4 650.4 139.4 635.9 140.7 633.2C134.5 625.3 137.4 596.5 135.9 587.6" +
  "C135 582.7 155.9 562.7 164.7 549.5C169.7 542.1 170.4 526.1 177.4 525.8" +
  "C184.4 525.4 184.5 540.8 190.7 546C199.6 553.4 218.9 558.3 221.5 562.6" +
  "C226.2 570.3 229 575.8 229.6 585.8C232.3 587 239.8 590 243 593.8C248.9 600.6 241.9 610.1 244.1 619.9" +
  "C247 620.6 252 626.3 256 629.4C263 635 255.9 652.4 260 661.6C263 661.8 267.5 668.7 271.9 671" +
  "C279.9 675.2 276.5 695.9 282.2 704.1C285.2 703.7 292.7 712.4 297.5 713.7" +
  "C306.2 716 313.1 738.3 320.4 745.1C323.2 744.1 338.3 750.5 343.3 750.6" +
  "C352.3 750.6 375.5 765 384.3 769.7C386.8 768.1 409.5 770.4 414.2 768.8" +
  "C422.8 765.9 461.6 772.6 471.5 774.2C473.3 771.8 495.7 767.3 499.7 764.2" +
  "C506.8 758.7 545.7 751.9 555.6 750.2C556.5 747.3 615.4 711.2 638.5 684.5" +
  "C647.2 674.5 677.4 700.7 668.7 710.8Z";
// Le bout brun-noir de la queue, qui entre dans l'argent en mèches effilées (coupé par la queue).
const BOUT =
  "M234 565.5C233.8 569.5 221.4 591.2 218.8 592.5C216.1 593.9 207.6 577.2 203.9 580.6" +
  "C200.1 583.9 203.2 608.9 200.2 609.1C197.2 609.2 187.5 582 182.5 581.5" +
  "C177.5 581 178.6 605.2 176 606.7C173.4 608.1 166.6 589.1 162.9 592.5" +
  "C159.2 595.8 158.7 624.4 155.8 624.7C152.8 625.1 127.6 601.5 126.1 596.7" +
  "C124.5 592 127.7 569.2 134 557.4C145.1 536.5 153.7 504.3 177.2 500.8" +
  "C197.8 497.8 208.1 528.8 221.8 544.4C227.2 550.5 234.3 561.5 234 565.5Z";
// Les mèches de la queue : des brins en arêtes de poisson, de l'axe vers le bord et vers le bout.
const MECHES =
  "M592.7 762.9L584.4 764.8L576.1 766.3L567.9 767.9L560 769.8L552.4 772L545 774.6M568.7 768L559.6 769.4" +
  "L550.6 770.5L541.7 771.7L533.1 773.1L524.7 774.8L516.4 777M544.8 770.5L535 771.4L525.4 772.1" +
  "L515.9 772.8L506.6 773.7L497.4 774.7L488.3 776M528.4 793.3L519.8 792.8L511.3 792.2L502.9 791.6" +
  "L494.8 791.3L486.8 791.5L479 792.2M503.7 791.9L494.5 790.9L485.4 789.6L476.5 788.5L467.8 787.6" +
  "L459.2 787.1L450.6 787.1M479.8 788.1L470.1 786.4L460.5 784.6L451.1 782.8L441.9 781.2L432.8 780" +
  "L423.7 779.3M458.4 806.4L450.1 803.6L442 800.8L434.1 798.2L426.3 796L418.5 794.3L410.7 793.2" +
  "M434.8 798.8L426.1 795.5L417.5 792.1L409.2 788.9L400.9 786L392.7 783.5L384.4 781.6M412.5 789.3" +
  "L403.4 785.4L394.6 781.4L385.9 777.5L377.3 773.8L368.7 770.4L360.2 767.3M387.3 802.2L379.9 797.5" +
  "L372.7 792.9L365.7 788.4L358.6 784.2L351.5 780.6L344.3 777.5M366.2 789.1L358.6 783.6L351.2 778.2" +
  "L343.9 773L336.6 768L329.3 763.5L321.8 759.5M346.9 774.2L339.2 768.1L331.6 761.9L324.2 755.9" +
  "L317.2 749.6L310.6 742.7L304.2 735.9M319.6 780.3L313.6 773.9L308.1 767.1L302.8 760.3L297.5 753.7" +
  "L292.2 747.6L286.7 742M303.1 761.2L297.7 753.1L292.7 744.8L287.8 736.8L282.8 729.4L277.9 722.2" +
  "L273.2 715.1M290.2 739L285.2 730L280.7 721L276.9 711.5L273.6 702L270.2 693.1L266.2 685.1M262.5 738.9" +
  "L259.5 730L256.9 721L254.5 712.3L251.9 704.1L248.8 696.8L245.1 690.3M254.5 713.3L252.4 703.4" +
  "L250.3 693.9L248.3 684.8L246.4 676L244.3 667.6L241.7 660M249.9 687.5L248.5 677.1L247.7 666.7" +
  "L247.2 656.6L246.2 647.3L244.2 639L241.6 631.3M220.9 683.7L220.9 674.1L221.2 664.7L221.1 655.9" +
  "L220.6 647.7L219.4 640.1L217.4 633.2M622.6 744.7L618 752.3L613.1 759.7L607.7 766.8L601.9 773.3" +
  "L595.4 779.1L588.2 783.8M608.1 766L601.9 773.9L595.3 781.5L588.1 788.3L580.3 794.4L572.1 799.8" +
  "L563.4 804.3M591.3 786.4L583.2 793.9L574.6 801.1L565.7 807.7L556.2 813.6L546.3 818.7L536 822.7" +
  "M562.5 784L556.1 790.2L549.5 796.1L542.4 801.4L535 806.1L527.2 809.9L519 812.6M542.9 800.7" +
  "L534.9 806.7L526.6 812.2L517.9 817.1L508.8 821.1L499.5 824.2L489.9 826.4M521.5 816.1L511.7 821.4" +
  "L501.7 826.2L491.3 830.4L480.7 833.8L469.8 836.3L458.8 837.6M493.9 806.1L486.2 810.6L478.2 814.6" +
  "L470.1 818.1L461.8 820.8L453.2 822.6L444.7 823.2M470.8 817.6L461.5 821.4L452.1 824.7L442.5 827.4" +
  "L432.7 829.1L422.8 829.9L413 829.6M446.2 827.3L435.4 830.1L424.5 832.4L413.4 834L402.3 834.6" +
  "L391.2 834.2L380.2 832.7M421.8 810.5L413.2 813L404.6 815.1L395.8 816.5L387.1 817.1L378.4 816.7" +
  "L369.9 815.3M396.6 816.1L386.7 817.6L376.8 818.5L366.8 818.8L356.9 818L347.2 816.3L337.8 813.5" +
  "M370.4 819.6L359.3 819.7L348.2 819.2L337.1 817.8L326.2 815.6L315.6 812.4L305.4 808.2M350.8 797.1" +
  "L342 797.4L333.1 797.2L324.4 796.4L315.8 794.8L307.5 792.2L299.8 788.5M325.2 796.2L315.3 795.2" +
  "L305.5 793.6L296 791L286.6 788L277.4 784.4L268.7 779.8M299.3 792.9L288.5 790.2L277.6 787.5" +
  "L266.8 784.3L256.3 780.1L246.9 774.3L238.1 767.5M286.4 765.2L277.8 763.4L269.2 761.3L261 758.4" +
  "L253.4 754.4L246.2 749.8L239.7 744.4M261.9 758.4L252.8 754.8L243.7 751L234.6 746.9L226 742" +
  "L218.2 736.1L211.7 728.8M237.4 749.3L227.1 744.8L217.1 739.7L207.9 733.5L199.1 726.7L190.7 719.5" +
  "L183.1 711.4M235.6 715.6L227.6 712.1L219.7 708.4L212.1 704.1L205 699.2L198.8 693.5L193.8 686.8" +
  "M213 704.2L204.2 699.5L195.5 694.4L187.5 688.6L180.5 681.7L174.6 674.1L169.9 665.8";
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
  "M360.5 482A13.5 17.5 0 1 0 387.5 482A13.5 17.5 0 1 0 360.5 482Z";
// Le cabochon de corail du poitrail.
const CABOCHON =
  "M364.5 482A9.5 13.5 0 1 0 383.5 482A9.5 13.5 0 1 0 364.5 482Z";
// Les anneaux des pendeloques.
const PEND_ANNEAUX =
  "M360.7 506.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0" +
  "M371.7 512.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0" +
  "M382.7 506.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0";
// Les losanges des pendeloques.
const PEND_LOSANGES =
  "M363 509.6L367.6 516.6L363 523.6L358.4 516.6ZM374 515.6L378.6 522.6L374 529.6L369.4 522.6ZM385 509.6" +
  "L389.6 516.6L385 523.6L380.4 516.6Z";
// Le point de corail de chaque pendeloque.
const PEND_CORAIL =
  "M361.5 516.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M372.5 522.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" +
  "M383.5 516.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0";
// La perle de corail au bas de chaque pendeloque.
const PEND_PERLES =
  "M361 526.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M372 532.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" +
  "M383 526.2a2 2 0 1 0 4 0a2 2 0 1 0 -4 0";
// La couture entre le plastron blanc et le flanc (le grènetis y est posé).
const COUTURE =
  "M469 464C467 475.5 461.6 486.4 460 498C458.6 507.8 452.4 516.4 450 526";
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
// La ciselure : le garrot, le dos, la cuisse.
const CISELURE =
  "M528 464C537.1 471.6 547.8 477.5 556 486C565.3 495.6 572.5 506.9 580 518M538 460" +
  "C547.1 467.6 557.8 473.5 566 482C575.3 491.6 582.5 502.9 590 514M548 456" +
  "C557.1 463.6 567.8 469.5 576 478C585.3 487.6 592.5 498.9 600 510M590 546" +
  "C598.6 559.8 610.4 571.6 618 586C625.1 599.4 633.8 612.1 640 626M599 540" +
  "C607.6 553.8 619.4 565.6 627 580C634.1 593.4 642.8 606.1 649 620M608 534" +
  "C616.6 547.8 628.4 559.6 636 574C643.1 587.4 651.8 600.1 658 614M640 620C629.7 626 616 627.1 608 636" +
  "C599.2 645.8 592.9 657.8 588 670M646 629C635.7 635 622 636.1 614 645C605.2 654.8 598.9 666.8 594 679" +
  "M652 638C641.7 644 628 645.1 620 654C611.2 663.8 604.9 675.8 600 688M664 658" +
  "C657.8 665.9 645 667.3 640 676C634.2 686.1 628.8 696.7 626 708M670 667C663.8 674.9 651 676.3 646 685" +
  "C640.2 695.1 634.8 705.7 632 717";
// Les brillances de l'argent, posées à la main.
const BRILLANCES =
  "M190 74C176.7 74.8 188.9 100.7 189.4 114.1C190 128.8 191.3 143.6 193.5 158.2" +
  "C195.5 171.6 188.5 199.8 202 198C215.4 196.2 198.1 171.2 196.5 157.8" +
  "C194.9 143.2 193.7 128.6 192.6 113.9C191.5 100.6 203.3 73.2 190 74ZM640 74" +
  "C632 67.3 625.5 89 618.8 97C610.8 106.4 586.6 118.1 596 126C605.4 134 613.3 108.4 621.2 99" +
  "C628 91.1 648 80.7 640 74ZM428 267C428 271 436 265.3 440 265.3C444 265.3 452 271 452 267" +
  "C452 262.8 444.2 262.7 440 262.7C435.8 262.7 428 262.8 428 267ZM568 450" +
  "C563.1 455.2 579.9 458 585.2 462.9C590 467.4 593.5 482.8 598 478C602.6 473.1 591.8 465.7 586.8 461.1" +
  "C581.5 456.2 573 444.7 568 450ZM660 606C651.7 608.2 666.5 622 668.7 630.3" +
  "C671.2 639.4 664.9 660.4 674 658C683.2 655.5 673.7 638.8 671.3 629.7C669 621.2 668.4 603.7 660 606Z" +
  "M604 616C598 610.4 588.8 623.2 583.1 629.2C577.1 635.6 563.6 646 570 652" +
  "C576.3 657.9 578.9 637.1 584.9 630.8C590.4 625 609.9 621.5 604 616ZM358 516" +
  "C351.9 516 354.8 527.9 354.8 534C354.8 540.1 351.9 552 358 552C364 552 357.2 540 357.2 534" +
  "C357.2 528 364 516 358 516Z";
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
  "C133.9 536.6 159.3 563.7 183.7 590.6C194.6 602.7 213.9 609.8 221.1 622.3" +
  "C228.3 634.8 237.8 645.8 241.3 659.8C244 671 249.2 684.8 255.7 694.3" +
  "C266.9 711 288.5 723.7 307.5 734.6C327.7 746.3 347.8 757.5 368 769.2" +
  "C381.4 777 394.6 787.8 408.3 792.2C419.3 795.8 425.6 800.9 440 800.9" +
  "C454.4 800.9 460.7 795.8 471.7 792.2C485.4 787.8 498.6 777 512 769.2" +
  "C532.2 757.5 552.3 746.3 572.5 734.6C591.5 723.7 613.1 711 624.3 694.3" +
  "C630.8 684.8 636 671 638.7 659.8C642.2 645.8 651.7 634.8 658.9 622.3" +
  "C666.1 609.8 685.4 602.7 696.3 590.6C720.7 563.7 746.1 536.6 762.6 504.2" +
  "C783.6 463.1 793.2 417 802.9 371.8C812.8 324.7 811.5 275.9 811.5 227.8" +
  "C811.5 204.7 812.8 153.9 800 155.8C787.2 157.6 777.8 170.3 759.7 184.6" +
  "C721.1 214.7 672 279.3 627.2 325.7C571.8 383.1 500 463.9 467.4 504.2C455 500.2 453 495.6 440 495.6Z";
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
  "M412.2 635.9C402.6 625.2 406.9 615.1 398.8 609.4C390.5 603.3 382.5 593.5 372.3 593.5" +
  "C362.5 593.7 352.4 595 343.2 598.4C337.3 600.6 329 600.1 326.2 606.9" +
  "C323.2 614.7 334.7 621.7 342.1 625.1C352.4 629.7 363.2 633.8 374.6 634.7" +
  "C387.2 635.6 398.1 639.5 412.2 635.9C412.2 635.9 412.2 635.9 412.2 635.9ZM467.8 635.9" +
  "C477.4 625.2 473.1 615.1 481.2 609.4C489.5 603.3 497.5 593.5 507.7 593.5" +
  "C517.5 593.7 527.6 595 536.8 598.4C542.7 600.6 551 600.1 553.8 606.9" +
  "C556.8 614.7 545.3 621.7 537.9 625.1C527.6 629.7 516.8 633.8 505.4 634.7" +
  "C492.8 635.6 481.9 639.5 467.8 635.9C467.8 635.9 467.8 635.9 467.8 635.9Z";
// Le poinçon : la truffe.
const P_TRUFFE =
  "M440 711.6C428.5 711.6 428.3 714.2 421.3 715.9C415.7 717.4 417.7 721.7 417 726" +
  "C415.7 733.1 423.2 734.2 427 737.5C430.6 740.5 432.8 743.3 440 743.3" +
  "C447.2 743.3 449.4 740.5 453 737.5C456.8 734.2 464.3 733.1 463 726" +
  "C462.3 721.7 464.3 717.4 458.7 715.9C451.7 714.2 451.5 711.6 440 711.6Z";
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
  "M338 362C335.7 368.3 327.2 371.4 326 378C324.9 384.2 320 389.7 320 396M348 374" +
  "C345.7 380.4 339.2 385.2 338 392C337 397.9 336 404 336 410M360 384C357.9 389.8 357.1 395.9 356 402" +
  "C354.9 408.1 360 413.9 360 420M542 362C544.3 368.3 552.8 371.4 554 378C555.1 384.2 560 389.7 560 396" +
  "M532 374C534.3 380.4 540.8 385.2 542 392C543 397.9 544 404 544 410M520 384" +
  "C522.1 389.8 522.9 395.9 524 402C525.1 408.1 520 413.9 520 420";

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
const TORSADE_LOIN = torsade(PATTE_LOIN, 4, 4.6);
const TORSADE_PROCHE = torsade(PATTE_PROCHE, 4, 4.6);
const GRENETIS = perles(BORD_OREILLES, 6.5, 1.8);
const GRENETIS_COUTURE = perles(COUTURE, 6.2, 1.5);
const LUNE_GRENETIS = perlesEnOvale(440, 140, 67, 67, 64, 1.8);
const CABOCHON_GRENETIS = perlesEnOvale(374, 482, 17, 21, 22, 1.5);

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
        <linearGradient id={k("fl")} gradientUnits="userSpaceOnUse" x1={372} y1={0} x2={425} y2={0}>
          <stop offset={0} stopColor="#fbfbfc" />
          <stop offset={1} stopColor="#d2d5d8" />
        </linearGradient>
        <linearGradient id={k("fo")} gradientUnits="userSpaceOnUse" x1={0} y1={650} x2={0} y2={780}>
          <stop offset={0} stopColor="#b9bdc2" />
          <stop offset={1} stopColor="#a4a9ae" />
        </linearGradient>
        <linearGradient id={k("fd")} gradientUnits="userSpaceOnUse" x1={341} y1={0} x2={388} y2={0}>
          <stop offset={0} stopColor="#d2d6da" />
          <stop offset={1} stopColor="#a9afb5" />
        </linearGradient>
        <radialGradient id={k("fq")} gradientUnits="userSpaceOnUse" cx={440} cy={512} r={345}>
          <stop offset={0.72} stopColor="#cfd3d7" />
          <stop offset={0.81} stopColor="#f6f7f8" />
          <stop offset={0.9} stopColor="#c5c9ce" />
          <stop offset={1} stopColor="#8f949a" />
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
        <linearGradient id={k("fr")} gradientUnits="userSpaceOnUse" x1={0} y1={358} x2={0} y2={418}>
          <stop offset={0} stopColor="#6b3e2b" />
          <stop offset={1} stopColor="#a8714f" stopOpacity={0.85} />
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
        <radialGradient id={k("fp")} cx={0.5} cy={0.42} r={0.5}>
          <stop offset={0} stopColor="rgb(48,52,58)" stopOpacity={0.34} />
          <stop offset={1} stopColor="rgb(48,52,58)" stopOpacity={0} />
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
        <clipPath id={k("cl")}>
          <path d={PATTE_LOIN} />
        </clipPath>
        <clipPath id={k("hp")}>
          <path d={`M0 0H880V880H0Z${PLASTRON}`} clipRule="evenodd" />
        </clipPath>
        <clipPath id={k("hj")}>
          <path d={`M0 0H880V880H0Z${PATTE_LOIN}${PATTE_PROCHE}`} clipRule="evenodd" />
        </clipPath>
        <clipPath id={k("ch")}>
          <path d={TETE} />
        </clipPath>
        <clipPath id={k("cpat")}>
          <path d={CORPS + QUEUE} />
        </clipPath>
      </defs>
      {/* Le chaton de la lune, serti dans l'anneau de la fibule */}
      <path d={LUNE_FOND} fill={u("fn2")} />
      <path d={LUNE_COLLET} fill={u("fa")} fillRule="evenodd" stroke={ARGENT.trait} strokeWidth={1} />
      <path d={LUNE_GRENETIS} fill="rgba(255,255,255,0.95)" />
      <path d={LUNE_FIL} fill="none" stroke={ARGENT.fil} strokeWidth={1.6} />
      {/* Le corps : la gorge, le poitrail, le dos et le garrot, la cuisse */}
      <path d={CORPS} fill={u("fc")} />
      <path d={CORPS} fill={u("sb")} />
      <g clipPath={u("cc")}>
        <path d={CUISSE} fill={u("fk")} />
        <path d={CUISSE} fill={u("sb")} opacity={0.8} />
      </g>
      <Relief d={CORPS} clip={u("cc")} />
      <g clipPath={u("cc")}>
        <Relief d={CUISSE} clip={u("ck")} force={0.45} />
      </g>
      <path d={CISELURE} fill="none" stroke="rgba(62,66,72,0.42)" strokeWidth={1.2} strokeLinecap="round" />
      <path d={CISELURE} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.9} strokeLinecap="round" transform="translate(-0.9 -1.1)" />
      <path d={CORPS} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_CORPS} stroke={ARGENT.torsade} strokeWidth={1.1} />
      {/* La patte lointaine, dans l'ombre du poitrail : l'ombre franche qu'il porte sur elle, sous son bord */}
      <path d={PATTE_LOIN} fill={u("fd")} />
      <Relief d={PATTE_LOIN} clip={u("cl")} force={0.55} />
      <g clipPath={u("cl")}>
        <path d={PLASTRON} fill="rgba(48,52,58,0.42)" transform="translate(2 14)" />
        <path d={PLASTRON} fill="rgba(48,52,58,0.3)" transform="translate(1 7)" />
      </g>
      <path d={PATTE_LOIN} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_LOIN} stroke={ARGENT.torsade} strokeWidth={1.1} />
      {/* Le plastron, devant le haut de la patte lointaine */}
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
      <path d={GRENETIS_COUTURE} fill="rgba(255,255,255,0.95)" />
      {/* La patte proche, devant le poitrail ; ses doigts */}
      <path d={PATTE_PROCHE} fill={u("fl")} />
      <Relief d={PATTE_PROCHE} clip={u("cp")} force={0.7} />
      <path d={PATTE_PROCHE} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_PROCHE} stroke={ARGENT.torsade} strokeWidth={1.1} />
      <path d={DOIGTS} fill="none" stroke="rgba(62,66,72,0.5)" strokeWidth={1.4} strokeLinecap="round" />
      <path d={DOIGTS} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1} strokeLinecap="round" transform="translate(-1 -0.7)" />
      {/* La queue, sous les pieds avant, devant le pied arrière ; la croupe repasse devant sa base */}
      <path d={QUEUE} fill={u("fq")} />
      <g clipPath={u("cq")}>
        <path d={MECHES} fill="none" stroke={ligne} strokeWidth={1.4} strokeLinecap="round" />
        <path d={MECHES} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1} strokeLinecap="round" transform="translate(-1.1 -1.3)" />
        <path d={QUEUE} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={6} transform="translate(2 4)" />
        <path d={QUEUE} fill="none" stroke="rgba(48,52,58,0.3)" strokeWidth={7} transform="translate(-2 -4)" />
        <path d={BOUT} fill={u("fn")} />
        <path d={BOUT} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
      </g>
      <path d={QUEUE} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_QUEUE} stroke={ARGENT.torsade} strokeWidth={1.1} />
      <g clipPath={u("cr")}>
        <g clipPath={u("cc")}>
          <path d={CORPS} fill={u("fc")} />
          <path d={CORPS} fill={u("sb")} />
          <path d={CUISSE} fill={u("fk")} />
          <path d={CUISSE} fill={u("sb")} opacity={0.8} />
          <Relief d={CORPS} clip={u("cc")} />
          <Relief d={CUISSE} clip={u("ck")} force={0.45} />
          <path d={CISELURE} fill="none" stroke="rgba(62,66,72,0.42)" strokeWidth={1.2} strokeLinecap="round" />
          <path d={CISELURE} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={0.9} strokeLinecap="round" transform="translate(-0.9 -1.1)" />
        </g>
        <path d={CORPS} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} />
        <path d={TORSADE_CORPS} stroke={ARGENT.torsade} strokeWidth={1.1} />
      </g>
      <path d={CROUPE_FIL} fill="none" stroke={ARGENT.fil} strokeWidth={3.6} strokeLinecap="round" clipPath={u("cc")} />
      <path d={CROUPE_FIL} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={1.4} strokeLinecap="round" transform="translate(-0.8 -1)" clipPath={u("cc")} />
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
      <path d={LARMES} fill={u("fr")} />
      <path d={YEUX} fill={u("fn")} stroke={ARGENT.clair} strokeWidth={2.6} />
      <path d={REFLETS} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth={2.6} strokeLinecap="round" />
      <path d={TRUFFE} fill={u("fn")} />
      <path d={BOUCHE} fill="none" stroke={encre(0.7)} strokeWidth={1.8} strokeLinecap="round" />
      <path d={VIBRISSES} fill="none" stroke="rgba(62,66,72,0.4)" strokeWidth={1} strokeLinecap="round" />
      <path d={GRENETIS} fill="rgba(255,255,255,0.92)" />
      <path d={TETE} fill="none" stroke={ARGENT.fil} strokeWidth={4.6} strokeLinejoin="round" />
      <path d={TORSADE_TETE} stroke={ARGENT.torsade} strokeWidth={1.1} />
      <path d={BRILLANCES} fill="rgba(255,255,255,0.92)" />
      {/* La patine : sur l'argent sablé du dos, de la cuisse et de la queue seulement (ni le plastron, ni les pattes, ni le visage) */}
      <g clipPath={u("cpat")}>
        <g clipPath={u("hp")}>
          <g clipPath={u("hj")}>
            <path d={rayures} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeLinecap="round" />
            <path d={rayures} fill="none" stroke="rgba(70,74,80,0.12)" strokeWidth={1} strokeLinecap="round" transform="translate(0.8 1.1)" />
          </g>
        </g>
      </g>
    </g>
  );
}

const totem: TotemNation = {
  nation: "dz",
  animal: "fennec",
  quoi: "Le fennec assis de trois quarts, la tête de face, les oreilles en couronne, le poitrail haut, le garrot, les pattes fines au-dessus de sa queue touffue qui épouse l'anneau : un bijou d'argent d'Aït Yenni (corail cloisonné, couronne de triangles, cabochon et pendeloques, fil torsadé, grènetis, sablé et poli), la lune sertie entre ses oreilles ; à la face, un poinçon d'orfèvre.",
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
