// Réessayer un appel à la base après une erreur PASSAGÈRE, et seulement
// celle-là (08/11/2026). Écrit pour le calcul de nuit de la carte
// d'entraîneur (lib/sfl/entraineur-serveur.server.ts), réutilisable par toute
// route serveur qui parle à la base avec la clé secrète.
//
// Pourquoi : le cron de l'entraîneur a échoué le 06/11 et le 07/11 à
// 04:30:41Z sur « JWT issued at future ». Les journaux de la passerelle
// Supabase (edge_logs) le montrent : une seule lecture sur les douze lancées
// ensemble a été refusée (equipe_defis le 06, profiles le 07), en 401 avec
// « proxy_status: PostgREST; error=PGRST303 » ; les onze autres, dans la même
// dizaine de millisecondes et avec la même clé, ont rendu 200. Avec les clés
// secrètes (sb_secret_…), la passerelle fabrique un jeton à chaque requête ;
// cause PROBABLE, que les journaux ne montrent pas : un léger décalage
// d'horloge entre elle et PostgREST. Ce qui est établi : PostgREST le refuse
// en vérifiant le jeton, AVANT d'exécuter quoi que ce soit, et les requêtes
// voisines passent ; qu'un nouvel essai 1 s ou 3 s plus tard passe aussi
// reste à voir en production (le journal du cron le dira : « calcul fait
// après N reprise(s) », ou l'erreur « (après N reprise(s)) »). postgrest-js
// réessaie déjà seul les GET après une panne réseau ou un 503/520, jamais un
// 401, jamais un POST (donc aucun `rpc`).
//
// Ce qui est repris (erreurPassagere) :
//   · « JWT issued at future » (PGRST303) : jamais exécutée, toujours sûre ;
//   · une panne réseau (statut 0) ou un 502/503/504 de la passerelle, quand
//     l'appelant le déclare `rejouable` : une lecture, ou une écriture dont
//     le second passage ne change rien (l'appel a pu s'exécuter avant que la
//     réponse ne se perde). L'erreur doit porter ce statut : ouLever le pose
//     pour un rpc, toutesLesLignes et lireSaisonServeur pour une lecture
//     (l'erreur que rend postgrest-js ne l'a pas).
// Jamais repris : une erreur de droits, de données, de requête (tout code
// Postgres ou PostgREST autre que ci-dessus), une erreur du code lui-même.
//
// Borné : ESSAIS appels au plus (le premier et deux reprises), après 1 s puis
// 3 s ; et aucune reprise ne commence si son attente finit plus de
// `limiteMs` après le début du suivi (20 s par défaut, la route du calcul a
// maxDuration = 60). Le suivi compte les reprises (sans rien d'autre : ni
// table, ni identifiant), pour le bilan et le journal.
//
// SERVEUR UNIQUEMENT. Banc : tools/reprise-base-check.ts.

/** Une erreur telle que supabase-js la rend, avec le statut HTTP quand on l'a. */
export interface ErreurBase {
  code?: string;
  message?: string;
  status?: number;
}

/** Appels au plus, et l'attente avant chaque reprise (ms). */
export const ESSAIS = 3;
export const ATTENTES_MS = [1000, 3000] as const;
/** Fin au plus tard de la dernière attente, depuis le début du suivi (ms). */
export const LIMITE_MS = 20_000;

/** Statuts de la passerelle qu'on peut reprendre sur un appel rejouable (0 : panne réseau). */
const PASSERELLE = new Set([0, 502, 503, 504]);

export interface SuiviReprises {
  /** Reprises faites jusqu'ici, tous appels confondus. */
  reprises: number;
  readonly debut: number;
  readonly limiteMs: number;
  readonly maintenant: () => number;
  readonly attendre: (ms: number) => Promise<void>;
}

export function nouveauSuivi(options: Partial<Pick<SuiviReprises, "limiteMs" | "maintenant" | "attendre">> = {}): SuiviReprises {
  const maintenant = options.maintenant ?? Date.now;
  return {
    reprises: 0,
    debut: maintenant(),
    limiteMs: options.limiteMs ?? LIMITE_MS,
    maintenant,
    attendre: options.attendre ?? ((ms) => new Promise((ok) => setTimeout(ok, ms))),
  };
}

/** L'erreur est-elle passagère ? `rejouable` : l'appel peut s'exécuter deux fois sans rien doubler. */
export function erreurPassagere(e: unknown, rejouable: boolean): boolean {
  if (!e || typeof e !== "object") return false;
  const { code, message, status } = e as ErreurBase;
  if (code === "PGRST303" && /issued at future/i.test(message ?? "")) return true;
  return rejouable && typeof status === "number" && PASSERELLE.has(status);
}

/**
 * `appel()` jusqu'à ESSAIS fois, tant qu'il lève une erreur passagère et que
 * le suivi laisse le temps. Rend son résultat, ou lève la dernière erreur.
 */
export async function avecReprise<T>(suivi: SuiviReprises, appel: () => Promise<T>, rejouable: boolean): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await appel();
    } catch (e) {
      if (essai >= ESSAIS || !erreurPassagere(e, rejouable)) throw e;
      const ms = ATTENTES_MS[essai - 1];
      if (suivi.maintenant() + ms - suivi.debut > suivi.limiteMs) throw e;
      suivi.reprises++;
      await suivi.attendre(ms);
    }
  }
}

/** Une réponse de supabase-js ({ data, error, status }) : ses données, ou son erreur levée avec le statut. */
export async function ouLever<T>(reponse: PromiseLike<{ data: T; error: { code?: string; message?: string } | null; status?: number }>): Promise<T> {
  const { data, error, status } = await reponse;
  if (error) throw Object.assign(new Error(error.message ?? "erreur de la base"), { code: error.code, status } satisfies ErreurBase);
  return data;
}
