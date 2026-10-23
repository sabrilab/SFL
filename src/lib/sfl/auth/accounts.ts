// Comptes de la ligue — TABLE GÉNÉRÉE, ne pas modifier à la main.
//
// Produite par `npx tsx tools/generate-accounts.ts` depuis le roster de la
// saison. L'identifiant de connexion et le nom de saison de chaque joueur,
// sans aucun mot de passe : c'est le serveur (Supabase) qui les vérifie.

export interface Account {
  /** Identifiant de connexion, en minuscules. */
  user: string;
  /** Nom du joueur dans la saison — c'est la clé de tout le reste de l'app. */
  name: string;
  admin?: boolean;
}

export const ACCOUNTS: Account[] = [
  { user: "abdel", name: "Abdel" },
  { user: "adel", name: "Adel" },
  { user: "adil", name: "Adil" },
  { user: "adilm", name: "Adil Maimouni" },
  { user: "adilz", name: "Adil Zerhoui" },
  { user: "adrien", name: "Adrien" },
  { user: "aghiless", name: "Aghiless" },
  { user: "anas", name: "Anas" },
  { user: "anis", name: "Anis" },
  { user: "anisr", name: "Anis R" },
  { user: "ariless", name: "Ariless" },
  { user: "ayman", name: "Ayman" },
  { user: "azzedine", name: "Azzedine" },
  { user: "badis", name: "Badis" },
  { user: "bilal", name: "Bilal" },
  { user: "farid", name: "Farid" },
  { user: "franz", name: "Franz" },
  { user: "gail", name: "Gaïl" },
  { user: "giovani", name: "Giovani" },
  { user: "guillaume", name: "Guillaume" },
  { user: "hasbi", name: "Hasbi" },
  { user: "hassana", name: "Hassan Abdel" },
  { user: "henri", name: "Henri" },
  { user: "houssyne", name: "Houssyne" },
  { user: "ibrahim", name: "Ibrahim" },
  { user: "ilies", name: "Ilies" },
  { user: "illiasse", name: "illiasse" },
  { user: "ilyes", name: "Ilyes", admin: true },
  { user: "isma", name: "Isma" },
  { user: "jouneid", name: "Jouneid" },
  { user: "k2r", name: "K2R" },
  { user: "kader", name: "Kader" },
  { user: "kais", name: "Kais" },
  { user: "kamil", name: "Kamil" },
  { user: "kevinb", name: "Kevin B" },
  { user: "kevinr", name: "kevin Raes" },
  { user: "khadim", name: "Khadim" },
  { user: "kylian", name: "Kylian" },
  { user: "lyesk", name: "Lyes Korogli" },
  { user: "malik", name: "Malik" },
  { user: "marwan", name: "Marwan" },
  { user: "mehdi", name: "Mehdi" },
  { user: "miken", name: "Miken" },
  { user: "moussa", name: "Moussa" },
  { user: "moustapha", name: "Moustapha" },
  { user: "naim", name: "Naim" },
  { user: "omar", name: "Omar" },
  { user: "rezki", name: "Rezki" },
  { user: "ryad", name: "Ryad" },
  { user: "sabri", name: "Sabri", admin: true },
  { user: "samid", name: "Sami D" },
  { user: "samy", name: "Samy" },
  { user: "sebovic", name: "Sebovic" },
  { user: "selim", name: "Selim" },
  { user: "seliml", name: "Selim laouadi" },
  { user: "sidali", name: "Sidali" },
  { user: "simonr", name: "Simon Ribeiro" },
  { user: "smail", name: "Smail" },
  { user: "soffiane", name: "Soffiane" },
  { user: "sofiane", name: "Sofiane" },
  { user: "sossoa", name: "Sosso Abdel" },
  { user: "sossoc", name: "Sosso Coach" },
  { user: "souley", name: "Souley" },
  { user: "wadie", name: "Wadie" },
  { user: "yacine", name: "Yacine" },
  { user: "yacineb", name: "Yacine Ben" },
  { user: "yamin", name: "Yamin" },
  { user: "yanis", name: "Yanis" },
  { user: "yassir", name: "Yassir" },
  { user: "yazid", name: "Yazid" },
  { user: "zakaria", name: "Zakaria" },
  { user: "zakary", name: "Zakary" },
  { user: "ziad", name: "Ziad" },
];

export function findAccount(user: string): Account | undefined {
  const needle = user.trim().replace(/^@+/, "").toLowerCase();
  return ACCOUNTS.find((a) => a.user === needle);
}
