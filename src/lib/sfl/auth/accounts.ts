// Comptes de la ligue — TABLE GÉNÉRÉE, ne pas modifier à la main.
//
// Produite par `npx tsx tools/generate-accounts.ts` depuis le roster de la
// saison. Seule l'empreinte du mot de passe est embarquée : l'app ne connaît
// pas les mots de passe en clair (la liste lisible vit dans docs/COMPTES.md,
// hors application).
//
// Empreinte = SHA-256 de `sfl:<identifiant>:<mot de passe>`.

export interface Account {
  /** Identifiant de connexion, en minuscules. */
  user: string;
  /** Nom du joueur dans la saison — c'est la clé de tout le reste de l'app. */
  name: string;
  /** SHA-256 de `sfl:user:password`. */
  hash: string;
  admin?: boolean;
}

export const ACCOUNTS: Account[] = [
  { user: "abdel", name: "Abdel", hash: "771e8863bb2bf665195fd62e9ca99fa0f4bebf6ae4117670bd8713c11d5d9173" },
  { user: "adel", name: "Adel", hash: "1f800a72f565b61a177569c512cfd518997095fb0f34577f8d76b5533e3f72e1" },
  { user: "adil", name: "Adil", hash: "e9c3b74bee4e6780d71179a9424daa845cab138fff9d68d010b0fa2f752ba346" },
  { user: "adilm", name: "Adil Maimouni", hash: "f7cbd0b746a3b17d653150e7b3ad579f7844528a45d17869a3663774fd32642f" },
  { user: "adilz", name: "Adil Zerhoui", hash: "7d7456f4cff40e0fa78957d5874f875616ff36332c25774cf7d688c4a33a0c60" },
  { user: "adrien", name: "Adrien", hash: "f868bc2ead27f65629bec934d00212bba8d0d764dd6aebbfa395d1eaa2546338" },
  { user: "aghiless", name: "Aghiless", hash: "a530936d81584831e221981f7d6846b6a558b3d57867c5fe50131f99a0a5bf4f" },
  { user: "anas", name: "Anas", hash: "9b1220f7344918ec5d86f09a618b16a8abb1976ebe534b53e2a92383720371f6" },
  { user: "anis", name: "Anis", hash: "84beea8b77df2c292a1e5bcec0a51acd525ae80c83cccf1ef2fe78b65381a939" },
  { user: "anisr", name: "Anis R", hash: "5b381a83019f5b81ee2f47299b622fba783bbd3fd0be0eccbbca9799260d0a4f" },
  { user: "ariless", name: "Ariless", hash: "fcf7b25e85a6f1e0f2159664f50c6e2cb2306a402e64eea7c713336f2c114e37" },
  { user: "ayman", name: "Ayman", hash: "d65e527f2511333a7cd9db2fe4a9cd6374fcffc7f05f4030e1a997faa0a7633a" },
  { user: "azzedine", name: "Azzedine", hash: "c5550d263d1c31056e78e8147a33c0911f27381fcc6d6428d6e7314eb5929ebb" },
  { user: "badis", name: "Badis", hash: "a6f88b2755cf81c44b39c15d0b4a280f173a58000ee0e0dd8ceb66cb16b577f6" },
  { user: "bilal", name: "Bilal", hash: "fc9cae2fe340e91c6b70c45e711136f7e5a051e5c62c3755ab0122ca50ae8d9c" },
  { user: "farid", name: "Farid", hash: "4e994d52e355601a06a145e3a740e8087053dcf2a699bb6d4b240eee3c04878c" },
  { user: "franz", name: "Franz", hash: "27cbedfe796c2c7edf93f3211be9d249dde5837df89488cfd706fec2b21752a0" },
  { user: "gail", name: "Gaïl", hash: "f8bdbdb88c179cf6361a4da584565382095ea6e49a938a3c1bc74f02d0de8d03" },
  { user: "giovani", name: "Giovani", hash: "83dfb9b98c5ae6a26ce02e52a1669b1900b61b2febd117c7354ca48508423acf" },
  { user: "guillaume", name: "Guillaume", hash: "d41bc71d72015c82470483d0752ea79b2b0e3c12d2d5b9ef2df4353fb24ae85b" },
  { user: "hasbi", name: "Hasbi", hash: "1db978e77baa6e94d1c7c9563eb73574c018552b71d9f7547b12fe7fe2c6c7ea" },
  { user: "hassana", name: "Hassan Abdel", hash: "57cfa9261086d0c494d1a82dda87d5434f4360d36b39ca17f164c8609ffba0f2" },
  { user: "henri", name: "Henri", hash: "5f784a8f7e97e78a219f5f54c1b8e535001b45f9a446a1f3cc51568fc145481c" },
  { user: "houssyne", name: "Houssyne", hash: "d326c21ca63b0e9aed656fc3c62e87b477cdf2cbdbc5c64d43def03692da2215" },
  { user: "ibrahim", name: "Ibrahim", hash: "63e5bd26bc5f188d6c632efafe822e436c17b26428c13823899cc209dec4eed2" },
  { user: "ilies", name: "Ilies", hash: "f54fd5056ef1abe1b4f7f44f83f32fe77c4b953cd1641a0fa75c047f27feffe6" },
  { user: "illiasse", name: "illiasse", hash: "9961aea92ad4ee060a9c35e51ab1c263b4223717e1597e53a2bc61c825a9fa84" },
  { user: "ilyes", name: "Ilyes", hash: "4fd91189841166fd3c17ecd07a9b815c2dbf5a723360b29604802f5f3fa9316c", admin: true },
  { user: "isma", name: "Isma", hash: "69b5c3fb4b255d0643e40dacc49735302e5763c626fa0eae9df46ee32a142407" },
  { user: "jouneid", name: "Jouneid", hash: "317397b940ca6082bb42263d97723a50fb5ac02aad8d4827b58301fe18313eb6" },
  { user: "k2r", name: "K2R", hash: "546bdfd1ec9773cbc49a2558157a8e2b044e7ecb7e03aadbfc6f845f6e583a50" },
  { user: "kader", name: "Kader", hash: "4ffc1fce1d6557083a95d66e4c88a37e38332b37dd176f42e8df0dc200835fb3" },
  { user: "kais", name: "Kais", hash: "1285aeb04cf2fd97b0d229cac38dde062ac8c6ab15b4dd762abf503c5a76ec95" },
  { user: "kamil", name: "Kamil", hash: "fcf0c55ca170d442ee9c1f8b2d7c598abc93c424c7775d6a26d0c77504b7c333" },
  { user: "kevinb", name: "Kevin B", hash: "88bc4ef503874b2da0a4b69e84b6e0fa2bc014bcd9fa0589eea9a5bf577de6f2" },
  { user: "kevinr", name: "kevin Raes", hash: "ecf0ed9b5c7a1123c6a4bc2b1644f7bdca1e4e2a325d6e165089523eab8e2f89" },
  { user: "khadim", name: "Khadim", hash: "8338a85657b98bf0af29fc3251e1440c2ebc7914f469055722b0c2d1957ef2e2" },
  { user: "kylian", name: "Kylian", hash: "0a20ff5d9f3dc78d883890f2366e92336bbb91d91d404790c45602af4411a11e" },
  { user: "lyesk", name: "Lyes Korogli", hash: "e440de73e60d0b0b87250dbdd85695cf24a0e16f1a7b20f50eabe959167a54b7" },
  { user: "malik", name: "Malik", hash: "633b652203c4c94d63c1f15bf69b2784af2a48200ee32c917d6debd1cb08bb2e" },
  { user: "marwan", name: "Marwan", hash: "2adcceec8b24ddd422f29460168874150dfb9068007df137b2c8310e96e06ed6" },
  { user: "mehdi", name: "Mehdi", hash: "dbb59711f91e6e735ab8ab2ddd48a576f0ff4f98d04014a637ae8686e1d09889" },
  { user: "moussa", name: "Moussa", hash: "eddb7248c1f24a81959c89c699e8a490e4b265f919cc2cbbeaefcf4826252f4f" },
  { user: "moustapha", name: "Moustapha", hash: "44baaf1a51b498f5cabc1a6f68f79510ed8b00670cc16fa5532c3af4952aa722" },
  { user: "naim", name: "Naim", hash: "5788a35331b3c1b1645099713f8ab62b4c0222f992d206b4b45b2b42111b9f26" },
  { user: "omar", name: "Omar", hash: "0a5638077e9f60303320678a31b2e6beef0f4b8db787b2901a6cf83aa899d472" },
  { user: "rezki", name: "Rezki", hash: "9462a36c40bfed5df81aad3752012f59760ca59cf27ce13b70bc675d1fb4451d" },
  { user: "ryad", name: "Ryad", hash: "e2a6903a16c743cad410fc61934ea4f013cee75507537db71f9c005f774983f3" },
  { user: "sabri", name: "Sabri", hash: "5f9d6a1fcc1e7f1cdbd128d5622f90997a54e955251f4ec2240b5190b51ef318" },
  { user: "samid", name: "Sami D", hash: "bde755a09b65d8a243a8c276cbbcc61a2868bb37e9f26e3ed469dadab13d14c2" },
  { user: "samy", name: "Samy", hash: "3141c0209d8d7915f5b30051ffb3e587318450e171656c9fbd8dfc892a392edd" },
  { user: "sebovic", name: "Sebovic", hash: "b6f6b8f75f9c740aecce9123e8d1e51d76befa942fd8d5729d0a2b8d524738f1" },
  { user: "selim", name: "Selim", hash: "4e8ef21408d28678c7f39ef3d126dea1024e007bdc5cd4da2b504e60d2ba69a0" },
  { user: "seliml", name: "Selim laouadi", hash: "8ca7e738a635fceaf0e5b70a8cb15bae96eedf865830a010b5eaa9e8daffa1c3" },
  { user: "sidali", name: "Sidali", hash: "618c80ad29876a926feea91daa4ff55bc98820dffeafc3a36153fbcbc46f3bdc" },
  { user: "simonr", name: "Simon Ribeiro", hash: "fbff11eb10229124098e926c1bf491a168b1fcef8ac17c5017bc2aedde0fa89c" },
  { user: "smail", name: "Smail", hash: "9f2cd1216b85594ee761e69e1686f9256833af525228ca0f6eb46420ad200029" },
  { user: "soffiane", name: "Soffiane", hash: "757d386df5aff62ad829b3d3cdf80fd716f8b5cb3e2d7527ad98274e09111f00" },
  { user: "sofiane", name: "Sofiane", hash: "ecf213124c05834b964b80963c0ba5960ed109ebcc967bb743ffb5d67ec4020a" },
  { user: "sossoa", name: "Sosso Abdel", hash: "f2fb415738ba56a73fe89142eec41aa08c420a220ee80ac844a932f5a9ca6794" },
  { user: "sossoc", name: "Sosso Coach", hash: "f1e4a680041bc2eb1a0e79db9218d11a27c4c9567c388de2a580ed9ed9f3eebe" },
  { user: "souley", name: "Souley", hash: "c1896524c3cf083ba6dfb8f112ce2f63dc954061fa23de3cd1526c46f878b0dc" },
  { user: "wadie", name: "Wadie", hash: "6ffc646ae4d29e6337c820cbef3d1aee23454b7cc6d403dbca2b22d83d3ae5ae" },
  { user: "yacine", name: "Yacine", hash: "249d771ca16427e463128052981ec489b8015667c9a7c55feb6c9513c99d3f30" },
  { user: "yacineb", name: "Yacine Ben", hash: "42189f9e1784ee34fdd2d4399421d9f56c93ef28739c3fa8ec1a660045697da5" },
  { user: "yamin", name: "Yamin", hash: "dd1b301fe5aa56124c5c9762034b73298903ed5b22a92ab44af67b8e7ad87cb5" },
  { user: "yanis", name: "Yanis", hash: "eb1e2ab10083628c9dacabd53b8fc2c9ab62b28e2972f7c1f6546cb589f22a6e" },
  { user: "yassir", name: "Yassir", hash: "37902a6b20c66799071f5001026a2ea068d100df8ea089cea520d9d1cb9e0074" },
  { user: "yazid", name: "Yazid", hash: "14be67e78853bfd593753bb20148e3be5fd46707ff40be1a0dcb755457a74c4a" },
  { user: "zakaria", name: "Zakaria", hash: "13f5c83c7e5f961961993fa136fe049fd768193da588c694f7ba670576ae4d6f" },
  { user: "zakary", name: "Zakary", hash: "901559ff7163f8c075f46eebc90757504b938168849fb37304800fb22287bef6" },
  { user: "ziad", name: "Ziad", hash: "d9b4aa4cd6ce872ee1b3fc9a4a629da300b377b72010b2d182c62a4ffd7e2588" },
];

export function findAccount(user: string): Account | undefined {
  const needle = user.trim().toLowerCase();
  return ACCOUNTS.find((a) => a.user === needle);
}
