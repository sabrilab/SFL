// Les mises en ligne de l'app : chaque version publiée en production, avec
// son titre (la première ligne de son commit) et le numéro de sa PR. Admin →
// Activité les pose en repères sous les courbes de croissance, avec les
// notifications et les journées (lib/sfl/reperes.ts). Sabri, 24/10 : « quand
// on voit la croissance, voir rapidement les actions qui ont été faites à ce
// moment-là de la part de l'application, pour qu'on comprenne encore la
// relation entre les choses ».
//
// Deux sources, que misesEnLigne() réunit :
//   · HISTORIQUE, plus bas : la branche de production jusqu'au 24/10/2026,
//     régénérée par tools/mises-en-ligne.ts ;
//   · la table mises_en_ligne, que chaque build de production réussi
//     complète (scripts/postbuild.ts) : rien à tenir à la main ensuite.
//
// Module pur, partagé par le build et la page admin.

export interface MiseEnLigne {
  /** Instant de la publication (ms). */
  le: number;
  /** « Parrainage : chaque joueur invite avec son lien ou son code… », sans le numéro de PR. */
  titre: string;
  pr: number | null;
  /** Le commit publié (au moins 7 caractères). */
  sha: string;
}

/**
 * Ce qui change l'app que les joueurs ouvrent : un commit qui ne touche que le
 * reste (docs, prototype mobile, outils) ne se voit pas, et n'est pas un repère.
 */
export const TOUCHE_L_APP = /^(src\/|public\/|supabase\/|scripts\/|next\.config\.ts$|package\.json$|vercel\.json$)/;

/**
 * Le titre et la PR d'un message de commit : sa première ligne, sans le
 * « (#143) » final ; pour une fusion « Merge pull request #17 from … », la
 * première ligne du corps, qui porte le titre de la PR. Une fusion de
 * branche sans titre ne donne rien.
 */
export function decouperCommit(message: string): { titre: string | null; pr: number | null } {
  const lignes = message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const premiere = lignes[0] ?? "";
  const fusion = /^Merge pull request #(\d+)/.exec(premiere);
  if (fusion) return { titre: lignes[1] ?? null, pr: Number(fusion[1]) };
  if (/^Merge (remote-tracking )?branch/.test(premiere)) return { titre: null, pr: null };
  const pr = /\s*\(#(\d+)\)$/.exec(premiere);
  return {
    titre: (pr ? premiere.slice(0, pr.index) : premiere).trim() || null,
    pr: pr ? Number(pr[1]) : null,
  };
}

/** « Parrainage : chaque joueur invite… » → le sujet, puis le reste ; sans « : », tout est sujet. */
export function sujetEtDetail(titre: string): { sujet: string; detail: string | null } {
  const i = titre.indexOf(" : ");
  if (i <= 0 || i > 60) return { sujet: titre, detail: null };
  const reste = titre.slice(i + 3).trim();
  return { sujet: titre.slice(0, i).trim(), detail: reste ? reste.charAt(0).toUpperCase() + reste.slice(1) : null };
}

/** L'historique et la table, sans doublon (un même commit vient parfois des deux), du plus ancien au plus récent. */
export function misesEnLigne(enBase: MiseEnLigne[]): MiseEnLigne[] {
  const parSha = new Map<string, MiseEnLigne>();
  const cle = (sha: string) => sha.slice(0, 7).toLowerCase();
  for (const [iso, sha, pr, titre] of HISTORIQUE) parSha.set(cle(sha), { le: Date.parse(iso), titre, pr, sha });
  // La table l'emporte : son heure est celle du build, pas celle du commit.
  for (const m of enBase) if (m.sha && m.titre) parSha.set(cle(m.sha), m);
  return [...parSha.values()].sort((a, b) => a.le - b.le);
}

type Ligne = [iso: string, sha: string, pr: number | null, titre: string];

// Généré par tools/mises-en-ligne.ts : ne pas modifier à la main.
const HISTORIQUE: Ligne[] = [
  // <historique>
  ["2026-08-04T00:04:30.000Z", "9b1d8f2", null, "Journée 7 et regénération complète de l'historique depuis le classeur"],
  ["2026-08-04T00:16:11.000Z", "63e30dd", null, "Roster : ajoute Isma et Sebovic, retire Chouaib et Hugo"],
  ["2026-08-04T00:47:20.000Z", "9a32888", null, "Roster complet : les 70 membres du classeur, joueurs sans match compris"],
  ["2026-08-09T22:01:58.000Z", "e2e38ea", null, "Journée 8, bonus extra time individuels et roster à jour (SFL_0908.xlsx)"],
  ["2026-08-09T23:43:25.000Z", "8c158d1", null, "Réorganisation en 4 sections (design Kickoff), fonctionnalités à venir grisées"],
  ["2026-08-09T23:52:59.000Z", "3db8f4a", null, "Cartes éditoriales : portage de la carte retenue du design Kickoff"],
  ["2026-08-10T00:07:31.000Z", "f4a3c94", null, "Onglet Ligue : scrollytelling bento du design Kickoff, vérifié à l'écran"],
  ["2026-08-10T00:15:22.000Z", "bf3991e", null, "Récap enrichi de modules narratifs et système Kickoff sur les pages"],
  ["2026-08-10T00:21:22.000Z", "a7f45e7", null, "Version sombre seule et moteur d'analyse de journée"],
  ["2026-08-10T00:29:19.000Z", "aff335a", null, "V1 : réplique à l'identique du design Kickoff"],
  ["2026-08-10T00:39:00.000Z", "d938ad8", null, "Carte : nom et pseudo au premier plan, au-dessus de la photo"],
  ["2026-08-10T00:51:30.000Z", "6cb20c7", null, "Feed : plus de cartes 3D et huit modules data visuels"],
  ["2026-08-10T00:59:40.000Z", "6304e70", null, "Profil : réplique de l'écran « PROFIL matte » du design Kickoff"],
  ["2026-08-10T01:09:15.000Z", "66e887e", null, "Feed : chaque journée s'ouvre, rideau GSAP et apparitions au scroll"],
  ["2026-08-10T02:03:31.000Z", "2c1f0a1", null, "Design de référence appliqué aux sections restantes"],
  ["2026-08-10T02:19:17.000Z", "c8a9267", null, "Feed : vingt nouveaux modules de données"],
  ["2026-08-10T16:45:32.000Z", "aa6b265", null, "Comptes joueurs, écran de connexion et tableau de présence"],
  ["2026-08-10T17:46:00.000Z", "86a39d8", null, "Supabase branché : auth serveur, présence partagée, installation guidée"],
  ["2026-08-10T18:16:29.000Z", "66c573e", null, "Installation Supabase automatisée : le serveur crée les comptes"],
  ["2026-08-10T18:33:43.000Z", "b659dc0", null, "Connexion : l'essai serveur est borné à cinq secondes"],
  ["2026-08-10T18:56:40.000Z", "71aa008", null, "Discussions : l'invitation de match répond pour de vrai"],
  ["2026-08-10T19:13:50.000Z", "c557595", null, "Emails, Google/Apple, gestionnaire d'activité et synthèse terrain"],
  ["2026-08-10T19:41:57.000Z", "b7c796e", null, "Migrations automatiques : le schéma s'applique tout seul"],
  ["2026-08-10T19:58:11.000Z", "5af6bfc", null, "Migration : reconnaît les variables de l'intégration Vercel × Supabase"],
  ["2026-08-10T20:11:35.000Z", "e63fb62", null, "Migration : essaie chaque adresse injectée, montre l'erreur exacte"],
  ["2026-08-10T20:15:50.000Z", "abe9385", null, "Migration : sslmode réécrit en no-verify sur les URLs de l'intégration"],
  ["2026-08-11T15:15:33.000Z", "3fa4638", null, "Page « Les accès » : une fenêtre par joueur, prête à envoyer"],
  ["2026-08-11T15:28:30.000Z", "92f2498", null, "Les accès : une fenêtre de code par joueur"],
  ["2026-08-11T15:33:48.000Z", "8e0240b", null, "En-tête : le compte connecté, sans choix de profil"],
  ["2026-08-11T16:04:38.000Z", "e812e26", null, "Recherche, Arène à trois onglets, profil resserré, activité approfondie"],
  ["2026-08-11T16:23:58.000Z", "45d5037", null, "Grille de prix des cartes et taux de la ligue"],
  ["2026-08-11T16:45:10.000Z", "471a92f", null, "Saisie : la grille du classeur, en mieux — et la feuille en direct"],
  ["2026-08-11T16:52:42.000Z", "11c094a", null, "Recoupage avec le classeur : J8, Sabri à 99, Miken, PP des lignes absentes"],
  ["2026-08-11T17:34:10.000Z", "5226739", null, "Feed : la « une » du dimanche et les cartes-journée sur terrain"],
  ["2026-08-11T17:41:08.000Z", "085209d", null, "Sabri : 99 partout, et invisible partout sauf chez lui"],
  ["2026-08-11T18:17:50.000Z", "4c63163", null, "Convocation automatique : le rythme de la semaine, sans l'admin"],
  ["2026-08-11T18:28:33.000Z", "f428e12", null, "Arène : les Ballons bleus (seconde monnaie) et la Composition 5v5"],
  ["2026-08-11T19:00:41.000Z", "0279c27", null, "La cérémonie des nouvelles cartes — animation et sound design"],
  ["2026-08-12T01:22:58.000Z", "5b542f8", null, "La saison passe par la base : corriger une fois, pour toute la ligue"],
  ["2026-08-12T01:35:57.000Z", "461cce2", null, "L'accueil : on arrive sur soi, le récap devient une carte qu'on ouvre"],
  ["2026-08-12T01:49:36.000Z", "f5c168a", null, "La une devient une vidéo, et la Ligue passe sous l'accueil"],
  ["2026-08-12T12:38:08.000Z", "580feac", null, "Le web : la page grandit avec l'écran, sans quitter le mobile d'abord"],
  ["2026-08-12T13:42:27.000Z", "2888459", null, "Le cache pouvait bloquer un appareil pour toujours — corrigé"],
  ["2026-08-12T14:10:34.000Z", "58a0848", null, "La boutique montre des produits, plus une grille de tarifs"],
  ["2026-08-12T14:50:53.000Z", "7edfb8e", null, "L'accueil tombait pour toute session serveur — canal temps réel dupliqué"],
  ["2026-08-12T15:19:34.000Z", "2f26c67", null, "La base se peuple toute seule — plus de boutons à presser pour l'admin"],
  ["2026-08-13T12:38:51.000Z", "fc254f4", null, "Le rôle admin de Sabri se répare tout seul — base et session"],
  ["2026-08-13T22:03:45.000Z", "074fc5a", null, "La note « Le Labo » est en ligne, et l'admin y accède depuis ses réglages"],
  ["2026-08-19T16:12:35.000Z", "e257363", null, "Un joueur ne pouvait pas se connecter, et les saisies disparaissaient"],
  ["2026-08-19T16:28:01.000Z", "c9a093b", null, "L'accueil dit enfin ce qu'on regarde : une vidéo, puis les journées"],
  ["2026-08-19T17:06:23.000Z", "97ab771", null, "On compose les équipes à la main, sans passer par le tirage"],
  ["2026-08-19T17:25:18.000Z", "9854298", null, "On voit enfin d'où viennent les points d'un joueur"],
  ["2026-08-19T17:44:14.000Z", "b3e3619", null, "Quand une sauvegarde n'atteint pas la base, ça se voit enfin"],
  ["2026-08-19T18:01:13.000Z", "d76fe80", null, "La session ne peut plus prétendre être vérifiée quand elle ne l'est plus"],
  ["2026-08-19T20:28:27.000Z", "2934c66", null, "Un tirage ne peut plus effacer une saisie que personne d'autre n'a"],
  ["2026-08-20T14:40:45.000Z", "f5f18ad", null, "Ajouter un joueur lui donne ses accès dans la foulée"],
  ["2026-08-20T15:53:02.000Z", "bda4a73", null, "L'espace admin et le classement lisaient deux saisons différentes"],
  ["2026-08-20T16:50:23.000Z", "ae1b05b", null, "Les joueurs ajoutés en cours de saison figurent dans « Les accès »"],
  ["2026-08-21T10:22:51.000Z", "b9f2022", null, "La messagerie existe : un salon pour la ligue, et des privés"],
  ["2026-08-21T13:44:22.000Z", "3be0583", null, "La messagerie dit pourquoi elle ne répond pas"],
  ["2026-08-21T22:38:03.000Z", "bc6aa2c", null, "« Les accès » part de l'effectif, plus des comptes existants"],
  ["2026-10-10T20:32:45.000Z", "3f10413", null, "Clôture de saison, archives et requalification des cartes"],
  ["2026-10-10T20:51:50.000Z", "4d5b45c", null, "Retire Discussions et Boutique de la navigation, grille des cartes lisible sur téléphone"],
  ["2026-10-10T21:13:37.000Z", "2934064", null, "Le récap de journée tient quand la saison n'a encore rien joué"],
  ["2026-10-10T21:25:23.000Z", "0f2a6e1", null, "En cours : la marque Bola et la Map sur le site"],
  ["2026-10-10T22:00:00.000Z", "024cafe", null, "Bola sur SFL eight : la Map en premier, la DA de l'app, stats à venir, recherche de joueurs"],
  ["2026-10-10T22:05:13.000Z", "9d6fc4c", null, "Onglets dans l'ordre de l'app Bola : Map, Ma carte, Ligue"],
  ["2026-10-10T22:19:19.000Z", "9f5bda0", null, "Chaque journée ajoutée apparaît sur la Map, avec son adresse"],
  ["2026-10-10T22:36:15.000Z", "d4d9732", null, "L'app s'ouvre sur la Map, en plein écran comme sur l'iPhone"],
  ["2026-10-10T22:40:36.000Z", "c099ece", null, "Adresse qui se complète pendant la frappe, une seule ligue : la SFL"],
  ["2026-10-10T22:45:07.000Z", "6346f2a", null, "La carte joueur passe au gris et blanc de Bola"],
  ["2026-10-10T22:52:55.000Z", "697dca8", null, "Vue satellite, épingle sur le terrain et itinéraire dans la Map"],
  ["2026-10-10T23:58:51.000Z", "747c8db", null, "Plus de Ballons, terrains bien visibles, la Ligue s'ouvre sur le récap"],
  ["2026-10-11T00:04:15.000Z", "b44741a", null, "Badges et cartes des joueurs qui se démarquent dans les classements"],
  ["2026-10-11T00:34:55.000Z", "b60a39a", null, "Connexion : dire pourquoi le serveur refuse, et réparer le mot de passe local"],
  ["2026-10-11T01:03:55.000Z", "eb28afd", null, "Plus de session locale qui coupe de la ligue sans le dire"],
  ["2026-10-11T15:08:58.000Z", "77cf619", null, "Photos partagées : la photo posée remplit la carte chez tout le monde"],
  ["2026-10-11T15:22:28.000Z", "025fa54", null, "Rétention : match joué sur la Map, dimanche suivant ouvert, badges, écarts"],
  ["2026-10-11T15:34:50.000Z", "f392e22", null, "Barre d'onglets façon iOS 26 (Liquid Glass)"],
  ["2026-10-11T15:40:28.000Z", "ba7ca19", null, "Recadrer sa photo, et les cartes des joueurs dans les classements"],
  ["2026-10-16T00:08:09.000Z", "990a86d", 7, "Une coupure réseau ne coupe plus un joueur de la ligue"],
  ["2026-10-16T17:17:48.000Z", "53c25ef", 4, "Inscription autonome : les joueurs créent leur compte"],
  ["2026-10-16T23:59:36.000Z", "ea64b8e", 6, "Carte joueur finale au nombre d'or, mini-stades noir et blanc et marbre"],
  ["2026-10-17T00:06:32.000Z", "3f94718", 3, "En-tête unique avec le logo BOLA partout, Ligue simplifiée, Wall of Fame"],
  ["2026-10-17T21:43:02.000Z", "54c10bb", 2, "Matchs : plusieurs terrains, MVP auto, matchs ouverts par les joueurs, dispos"],
  ["2026-10-17T21:49:21.000Z", "e396f41", 9, "Map : seulement les matchs à venir, sans les terrains enregistrés"],
  ["2026-10-17T21:57:06.000Z", "61d1550", 11, "Map : plein écran sur ordinateur, et un match touché sur le plan ouvre sa fiche"],
  ["2026-10-17T22:04:40.000Z", "a205ee5", 13, "Map : le match joué reste deux jours, badgé « Joué », et s'ouvre"],
  ["2026-10-17T22:21:30.000Z", "83aa481", 14, "Map : la feuille de match dans la fiche du match, et en image pour Snap"],
  ["2026-10-17T23:16:45.000Z", "845f065", 16, "Carte : la rare n'est plus affichée, seule la simple reste"],
  ["2026-10-17T23:16:58.000Z", "cd91cfa", 17, "Map : le plan vole jusqu'aux matchs, les stickers tombent, tout répond au doigt"],
  ["2026-10-17T23:18:11.000Z", "fccb558", 10, "Guide d'installation sur téléphone : sortir de Snapchat, puis ajouter Bola à l'écran d'accueil"],
  ["2026-10-17T23:30:40.000Z", "c176268", 19, "Ma carte : badges en deux familles, fin de saison et paliers"],
  ["2026-10-18T00:05:35.000Z", "983916b", 12, "Ligue : plus d'Accueil, tous les classements en direct, vote du jour en ligne"],
  ["2026-10-18T00:07:23.000Z", "726580f", 18, "Ma photo : « Photo officielle », un selfie devient une photo de studio au maillot Bola"],
  ["2026-10-18T00:10:06.000Z", "b2a86b2", 20, "Sécurité : un joueur ne peut plus se passer admin lui-même"],
  ["2026-10-18T00:19:58.000Z", "fa5c444", 21, "Ma carte : badge en verre sur la carte, au choix du joueur, et qui d'autre a chaque badge"],
  ["2026-10-18T01:17:44.000Z", "7de5986", 23, "Navigation : plus rien en haut, une seule barre d'onglets en bas"],
  ["2026-10-18T01:20:05.000Z", "a83eb00", 15, "Feuille de match : Noirs contre Blancs, terrain en 3D légère, fiche joueur au toucher d'une carte"],
  ["2026-10-18T01:45:52.000Z", "8832125", 22, "Ma carte : « Créer ma carte officielle », l'appareil photo guidé avec un ovale pour la tête"],
  ["2026-10-18T01:48:59.000Z", "48523cb", 25, "Feuille de match : le terrain 3D rendu comme la maquette validée"],
  ["2026-10-18T01:57:54.000Z", "d60cbb5", 26, "Feuille de match : le terrain en perspective aussi sur Safari et iPhone"],
  ["2026-10-18T01:59:24.000Z", "3fdcb32", 27, "App installée : les mises à jour arrivent toutes seules"],
  ["2026-10-18T02:05:24.000Z", "ac36145", 28, "Ma carte : badges reconnaissables d'un coup d'œil"],
  ["2026-10-18T02:58:13.000Z", "2dfba6c", 29, "Comptes : inscription avec Google et Apple, pseudo changeable tous les 30 jours"],
  ["2026-10-18T03:01:00.000Z", "185f343", 30, "Réglages : « Lier Google / Apple » caché tant que le fournisseur n'est pas activé"],
  ["2026-10-18T03:03:56.000Z", "6ed2ae9", 31, "Photo officielle : Seedream 5 Pro, plus belle et même visage"],
  ["2026-10-18T04:17:23.000Z", "dd3e647", 32, "Feuille de match : l'image partagée reprend le terrain de l'app"],
  ["2026-10-18T10:41:04.000Z", "2a05222", 33, "Ordinateur : Ma carte, Ligue et les fiches au nombre d'or"],
  ["2026-10-18T12:25:07.000Z", "1b8045b", 34, "Badges en 3D : objets de foot en chrome et verre irisé, symbole BOLA"],
  ["2026-10-18T13:36:52.000Z", "5f67af1", 35, "Ligue : les joueurs à l'honneur en scènes 3D"],
  ["2026-10-18T13:42:36.000Z", "d92dd6d", 36, "Badges plus ronds et polis au nombre d'or, cartes de joueur partout"],
  ["2026-10-18T13:57:23.000Z", "7ce5ca0", 39, "Badges : crampon remodelé, étoile sans rayures"],
  ["2026-10-18T14:36:06.000Z", "2b3e0e3", 38, "Invitation carte officielle et notifications sur le téléphone"],
  ["2026-10-18T15:38:29.000Z", "0a0ef6a", 37, "Cartes : la photo s'affiche tout de suite quand on ouvre la carte d'un joueur"],
  ["2026-10-18T15:43:06.000Z", "ad8be4a", 40, "Ligue : cartes jamais déformées ni coupées, et les cartes dans Matchs"],
  ["2026-10-18T16:42:08.000Z", "054b9fa", 41, "Ligue : « Ils ont décroché » en panneaux noir mat épurés"],
  ["2026-10-18T19:46:06.000Z", "2dd1fb5", 42, "Ma carte : la photo garde ses vraies couleurs sur la carte 3D"],
  ["2026-10-19T15:18:21.000Z", "a814db6", 43, "Activité & rétention : tout l'historique revient, pas seulement les derniers jours"],
  ["2026-10-19T16:51:13.000Z", "c6c15d2", 44, "Cartes 3D : la photo apparaît aussi sur iPhone"],
  ["2026-10-19T17:38:10.000Z", "fc1b36c", 45, "Identité : prénom, nom, pseudo et email confirmés par chaque joueur"],
  ["2026-10-19T17:41:49.000Z", "82a5937", 46, "Activité & rétention : courbes de croissance, cohortes et conclusions calculées"],
  ["2026-10-19T18:59:53.000Z", "32ef864", 49, "Vestiaire : la discussion de la ligue, dans l'onglet Ligue"],
  ["2026-10-19T19:02:25.000Z", "4163595", 50, "Base : la migration repasse (le pseudo des admins n'est plus réécrit)"],
  ["2026-10-19T19:26:30.000Z", "f4bce87", 48, "Map : le prochain match à la une, le match joué en retrait"],
  ["2026-10-19T19:43:45.000Z", "bacfb5b", 51, "Vestiaire : sa page plein écran dans la barre d'onglets, la loupe en haut"],
  ["2026-10-19T20:18:27.000Z", "e1c47db", 52, "Vestiaire : une notification par message, répondre, réagir, vocaux"],
  ["2026-10-19T20:37:22.000Z", "35a2045", 53, "Photo officielle : une séance photo pendant l'attente, et tous les drapeaux du monde"],
  ["2026-10-19T20:37:25.000Z", "24ab479", 47, "Recherche : le profil d'un joueur met en avant ses trophées et son parcours"],
  ["2026-10-19T20:55:37.000Z", "9a6eff8", 54, "Journées : « 12 participants déjà » au lieu de « Il manque 4 »"],
  ["2026-10-19T21:01:21.000Z", "95d935b", 55, "Vestiaire : pastille rouge des messages non lus, aussi sur l'icône de l'app"],
  ["2026-10-19T21:30:48.000Z", "d8cf790", 56, "Vestiaire : envoyer des photos et des vidéos"],
  ["2026-10-19T21:54:33.000Z", "bf861f0", 58, "Cartes : la carte actuelle partout, badges plus faciles à distinguer"],
  ["2026-10-19T22:41:36.000Z", "67a6d7f", 60, "Ligue : partager chaque rubrique au Vestiaire, et prévenir les joueurs mis en avant"],
  ["2026-10-19T22:44:41.000Z", "16a79e4", 59, "Bola Agent : le coach personnel, à côté du Vestiaire"],
  ["2026-10-19T23:00:18.000Z", "920bf03", 62, "Bola Agent : coach encourageant, à l'écoute, qui connaît tes matchs ; ses sujets dans Activité"],
  ["2026-10-19T23:43:05.000Z", "23f4645", 63, "Feuille en direct : toucher le nom d'un joueur pour le remplacer ou le changer d'équipe"],
  ["2026-10-19T23:44:45.000Z", "889e805", 57, "Activité : les joueurs à part des admins (Sabri, Ilyes)"],
  ["2026-10-19T23:49:07.000Z", "5ac8e95", 61, "Ligue : petites cartes en photo, terrains en perspective sur gazon vert"],
  ["2026-10-19T23:58:01.000Z", "41efb90", 65, "Profil joueur : ses cartes de chaque saison, sa courbe, et comparer avec ma carte"],
  ["2026-10-20T00:00:06.000Z", "e236c39", 64, "Bola Agent : le coach montre le corps et le terrain sans générer d'image"],
  ["2026-10-22T00:25:35.000Z", "55ee191", 66, "Connexion : plus de bandeau « non vérifiée » en boucle"],
  ["2026-10-22T00:28:31.000Z", "0879292", 67, "Map : les joueurs dans leur ville, en piles qui s'ouvrent, et le catalogue par ville"],
  ["2026-10-22T00:36:49.000Z", "6866890", 69, "Map : la ville de chaque inscrit posée d'office d'après sa connexion"],
  ["2026-10-22T00:39:55.000Z", "8ad5b76", 70, "Admin : stats à un geste, courbes d'abord, pays choisis pour la carte"],
  ["2026-10-22T00:55:07.000Z", "ff30c0e", 73, "Activité : fiche joueur et nouveaux venus à suivre de près"],
  ["2026-10-22T00:56:19.000Z", "8e37492", 72, "Feuille de match : ses joueurs comptent dans « qui vient »"],
  ["2026-10-22T01:08:25.000Z", "e828ee7", 74, "Cartes à titre en couleur : MVP en or, Impact en rouge, Défensive en bleu"],
  ["2026-10-22T01:08:50.000Z", "6386065", 71, "Actus : le fil d'actualité remplace la Ligue, en cinématiques"],
  ["2026-10-22T01:11:47.000Z", "b5f5a2e", 68, "Ma carte : vrais trophées de fin de saison, paliers sur deux lignes, Collection seule"],
  ["2026-10-22T01:14:36.000Z", "67b072f", 75, "Ligue vierge : les matchs Bola comptés à vie, MVP désigné par l'app"],
  ["2026-10-22T01:28:10.000Z", "168d191", 76, "Participants : les joueurs sans équipe n'y sont plus"],
  ["2026-10-22T01:43:11.000Z", "26df1a4", 79, "Actus : formats variés (9:16, 16:9, carré, carrousel) et fil moins « Instagram »"],
  ["2026-10-22T01:43:56.000Z", "bc02b84", 78, "Map : plan pastel façon Snap, bâtiments en relief et carte inclinée"],
  ["2026-10-22T01:44:34.000Z", "c11fcce", 77, "Ouvrir un match sur le terrain, et « League | Bola | Team » en tête des Actus"],
  ["2026-10-22T02:03:44.000Z", "a7a2bd8", 81, "Actus : un seul sélecteur Actus | Classements | Matchs, les classements complets reviennent"],
  ["2026-10-22T02:10:01.000Z", "0517f9b", 82, "Actus : deux boutons Classement et Match, sans « Actus » puisqu'on y est"],
  ["2026-10-22T02:19:42.000Z", "2a771ec", 83, "Map : tous les joueurs de la ligue apparaissent, à Lille tant qu'ils n'ont pas donné leur ville"],
  ["2026-10-22T02:27:21.000Z", "876538f", 80, "Mode Team, et en-tête League | Team avec les badges SFL et Bola"],
  ["2026-10-22T02:30:01.000Z", "2078fd2", 86, "Map : les joueurs sans ville éparpillés dans la métropole, et le lien « Mets ta ville »"],
  ["2026-10-22T02:32:03.000Z", "2210a8c", 85, "Identité : plus jamais la carte de Smail à la place de la sienne"],
  ["2026-10-22T02:34:31.000Z", "0821cb7", 84, "Photo de carte : seulement le studio IA, plus de pellicule"],
  ["2026-10-22T02:36:54.000Z", "9de2623", 87, "Boutons en verre bombé : un rang par importance, un grain fin, la couleur quand elle a un sens"],
  ["2026-10-22T02:58:43.000Z", "5e475c2", 89, "Map : le carrousel se cache, et ce qui se chevauche fusionne"],
  ["2026-10-22T03:11:46.000Z", "332e87b", 91, "Admin : supprimer les comptes des membres sans carte dans la saison"],
  ["2026-10-22T03:20:47.000Z", "a5178ab", 88, "Match hors dimanche gérable, Team selon le règlement, ligue et couleur de stade sur la Map"],
  ["2026-10-22T03:26:04.000Z", "6de5bd5", 93, "Map : toucher une pile de joueurs l'ouvre en collection"],
  ["2026-10-22T03:29:31.000Z", "0d3a010", 90, "Confidentialité : une case à cocher à l'ouverture, la politique en entier, l'accord gardé avec sa date"],
  ["2026-10-22T03:49:15.000Z", "cf97c05", 96, "Confidentialité : les e-mails des joueurs et la liste des photos ne sont plus lisibles par n'importe qui"],
  ["2026-10-22T03:54:36.000Z", "b8b29b8", 92, "Boutons v3 : un verre de nuit éclairé par en dessous, une couleur pour chaque bouton"],
  ["2026-10-22T04:10:19.000Z", "d406ee0", 94, "Actus : la course devient l'onglet, terrains de chaque dimanche, même en-tête sur Bola et Team"],
  ["2026-10-22T13:30:28.000Z", "e388b27", 95, "Map : la collection d'une pile en pop-up de verre (slider, filtres, classeur)"],
  ["2026-10-22T14:04:25.000Z", "bc7444e", 98, "En-tête plus simple : un seul logo, qui déroule les autres ligues"],
  ["2026-10-22T16:38:36.000Z", "10d85ec", 99, "Actus : ton dimanche en tête, le classement qui bouge, la convocation, ce qu'il te faut, le direct"],
  ["2026-10-22T17:01:48.000Z", "22d62a7", 100, "Actus : chaque rubrique sur un terrain, tout au scroll"],
  ["2026-10-22T17:53:59.000Z", "2c18f6d", 101, "Map : les photos et les vues satellite arrivent tout de suite, et le plan se manie sur ordinateur"],
  ["2026-10-22T23:36:49.000Z", "e929983", 103, "Ma carte : rangée comme un profil, avec ta saison dimanche par dimanche"],
  ["2026-10-22T23:44:49.000Z", "a71bf2b", 102, "Typo : Actus, récap, Ma carte et profils prennent les lettres de la Map"],
  ["2026-10-23T00:01:31.000Z", "072eb2a", 104, "Map : chaque match a sa discussion, une bulle de messages sur son sticker, ses notifications et un rappel la veille"],
  ["2026-10-23T00:02:48.000Z", "f4d2e91", 105, "Ma carte : « Refaire ma carte officielle » disparaît une fois faite, « Se déconnecter » en toutes lettres"],
  ["2026-10-23T00:12:06.000Z", "f54ea71", 106, "Ouverture : « D'où tu viens ? » propose sa ville à chaque joueur pour la Map"],
  ["2026-10-23T00:30:40.000Z", "0e9e8df", 108, "Studio photo : 3 photos par jour, annoncées dès la première, et les visages gardés pour choisir entre eux"],
  ["2026-10-23T00:31:46.000Z", "5801420", 107, "Discussion : deux onglets, Match et Équipe, pour parler à son match ou à son équipe"],
  ["2026-10-23T00:50:28.000Z", "edeb6f2", 110, "Boutons v4 : la nacre, plus calme (choix de Sabri)"],
  ["2026-10-23T01:15:24.000Z", "6406254", 111, "Suivre des joueurs et les féliciter : abonnés sur chaque carte, « Suivis » en tête pour monter un match, « Bravo » dans les Actus"],
  ["2026-10-23T01:21:45.000Z", "1227480", 109, "Missions Bola : fiches de contrat de rang S, A ou B, risque à l'échec, Niveau XP et passe sur Ma carte, duels sur la Map"],
  ["2026-10-23T01:48:38.000Z", "63a7161", 116, "Abonnés façon Instagram et carte touchée posée dans le verre de la Map"],
  ["2026-10-23T01:50:54.000Z", "45489fa", 115, "Actus sur ordinateur : la page en grille de terrains, deux colonnes puis trois, le téléphone inchangé"],
  ["2026-10-23T02:07:40.000Z", "7b0a3dc", 118, "Ouvrir un match : plus de Match ou Exhibition, une feuille dans l'ordre des questions, plus rien ne se chevauche"],
  ["2026-10-23T02:12:25.000Z", "3186084", 117, "Un seul sigle SFL, redessiné à la graisse et à l'angle de BOLA"],
  ["2026-10-23T02:13:34.000Z", "a40f269", 119, "Activité : les notifications, qui les a activées et ce que chaque motif fait faire"],
  ["2026-10-23T02:15:18.000Z", "eba2286", 114, "Discussions : la barre d'écriture et le fil ne se figent plus et ne changent plus de place, selon le téléphone"],
  ["2026-10-23T02:32:24.000Z", "85bd0b8", 124, "Ouvrir un match : tous les terrains synthétiques du Nord, sur un plan et en liste, du plus proche au plus loin"],
  ["2026-10-23T02:35:34.000Z", "1387c2e", 121, "Bola Team : ajouter un joueur sans blocage, l'invité prévenu partout, plusieurs invitations d'un coup"],
  ["2026-10-23T02:42:05.000Z", "3195f46", 97, "Sécurité : plus aucun mot de passe dans le code, chacun choisit le sien"],
  ["2026-10-23T02:47:00.000Z", "edcd2b9", 122, "Mode clair et mode sombre : bascule ◐ sur Ma carte, Clair / Sombre / Auto dans Réglages"],
  ["2026-10-23T02:48:01.000Z", "1e733b5", 125, "Sécurité, suite : noms, photos, comptes en attente, crédits de l'IA, saison protégée, notifications"],
  ["2026-10-23T02:51:36.000Z", "9ba9a80", 120, "Journées : chaque match Noirs contre Blancs, avec son heure, son lieu et son terrain"],
  ["2026-10-23T02:52:58.000Z", "0462d2c", 126, "Synchronisation : le message de conflit lisible aussi en mode clair"],
  ["2026-10-23T03:16:35.000Z", "c0e9ba9", 112, "Divisions : l'annonce de la J3, puis trois divisions de 30 joueurs dès la J4"],
  ["2026-10-23T03:22:48.000Z", "7136a54", 128, "Discussion d'un match : la barre d'écriture n'est plus cachée par les onglets sur iPhone"],
  ["2026-10-23T03:25:33.000Z", "880fefc", 129, "Map : les terrains du Nord en stickers vides, un toucher pour ouvrir un match Bola ou défier une équipe"],
  ["2026-10-23T03:35:36.000Z", "e0ff7b1", 127, "Toute l'app sur ordinateur : Team, Bola, Vestiaire, Agent, discussions, Ma carte et la fiche du match prennent la place, terrains et cartes un cran plus grands"],
  ["2026-10-23T03:41:25.000Z", "cc5a759", 131, "Divisions : la notification de samedi dit la place du joueur, comme l'app"],
  ["2026-10-23T03:43:08.000Z", "5333657", 113, "Récaps Noirs contre Blancs, et chaque joueur dans le maillot de son camp"],
  ["2026-10-23T03:57:24.000Z", "e1fa5b5", 130, "Cartes : Bola au dos, plus fines et arrondies, cartes à titre et finitions en vraies matières"],
  ["2026-10-23T04:40:03.000Z", "52bffe7", 123, "Contrats en jeu, rang B·A·S, la passe qui habille la carte et l'outsider de l'arc 1"],
  ["2026-10-23T04:53:26.000Z", "3f735a6", 132, "Ligue : plus rien ne se chevauche, ni ballon sur une tête, ni prénom coupé"],
  ["2026-10-23T05:03:19.000Z", "c359e83", 133, "La journée de l'outsider par notification, la veille de chaque dimanche de l'arc 1"],
  ["2026-10-24T16:35:15.000Z", "0a47d52", 135, "La carte de Sabri en noir : la finition onyx, offerte"],
  ["2026-10-24T16:36:14.000Z", "7f21d57", 134, "Terrains du Nord : filtrer par format (à 3, 5, 7, 8, 11) sur la Map et dans « Tous les terrains »"],
  ["2026-10-24T16:50:01.000Z", "9f4b864", 137, "Intro Bola : la lune du symbole naît, BOLA en sort, plus de « Sunday Five League »"],
  ["2026-10-24T17:03:37.000Z", "7daa3df", 138, "Actus : les divisions en classement Pépite d'Or, refaites chaque dimanche par le classement"],
  ["2026-10-24T17:15:13.000Z", "d55430f", 136, "Actus : le présent et le passé, trois onglets et un seul bouton de saison ; Collection masquée dans Ma carte"],
  ["2026-10-24T17:15:30.000Z", "fca423c", 141, "Map : trouver un match d'un coup d'œil, et la Map te propose d'en ouvrir un"],
  ["2026-10-24T17:31:00.000Z", "dd43f0f", 142, "Actus : chaque division compte ses places depuis 1, avec son podium"],
  ["2026-10-24T17:37:47.000Z", "1abe4b0", 143, "Parrainage : chaque joueur invite avec son lien ou son code, vers 500 joueurs"],
  ["2026-10-24T17:46:43.000Z", "131e17a", 147, "Confidentialité : ceux qui ont déjà accepté ne revoient pas la case"],
  ["2026-10-24T17:58:57.000Z", "dff7a2a", 148, "Fiche d'un match : les joueurs d'abord, la feuille de match juste dessous"],
  ["2026-10-24T18:01:27.000Z", "6c5bf99", 145, "Cartes : toucher une carte l'ouvre en grand, en plein écran, pour la tourner, la retourner et zoomer"],
  ["2026-10-24T18:03:30.000Z", "910deb2", 144, "Accueil de l'app : tout ce qui manque au joueur dès l'ouverture, « Homme ou femme ? », sa carte qu'il retourne, puis la visite"],
  ["2026-10-24T18:20:14.000Z", "972a8af", 149, "Ma carte : le Passe Bola de la saison, vingt skins à gagner, et le Niveau XP en encadrés"],
  // </historique>
];
