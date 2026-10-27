// Envoi d'une notification web push, sans bibliothèque : Node a tout ce
// qu'il faut (ECDH P-256, HKDF, AES-GCM, signature ES256).
//
// Deux standards, et rien d'autre :
//   · VAPID (RFC 8292) — un jeton signé par notre clé privée dit au service
//     de push (Apple, Google, Mozilla) qui envoie ;
//   · le chiffrement aes128gcm (RFC 8291 + 8188) — seul le téléphone abonné
//     peut lire le message ; le service de push ne voit qu'un bloc opaque.
//
// SERVEUR UNIQUEMENT : la clé privée vient de VAPID_PRIVATE_KEY (Vercel) ;
// la clé publique s'en déduit. L'admin crée la paire dans son navigateur
// (page « Envoyer une notification ») et colle la clé privée dans Vercel.
// Changer la clé oblige tous les téléphones à se réabonner.

import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

export interface Abonnement {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface CleVapid {
  /** Point public non compressé (65 octets), en base64url. */
  publique: string;
  /** Scalaire privé (32 octets), en base64url. */
  privee: string;
  /** Contact donné aux services de push (mailto: ou https:). */
  sujet: string;
}

/**
 * Les services de notifications connus (Apple, Google, Mozilla, Microsoft).
 * Un abonnement ne peut viser qu'eux : le serveur appelle son adresse à
 * chaque envoi, et une adresse quelconque ferait de lui un relais. La base
 * garde la même liste (supabase/schema.sql, push_abonnements_service_connu) :
 * les changer ensemble.
 */
const SERVICES_PUSH =
  /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)\//;

export function serviceConnu(endpoint: string): boolean {
  return SERVICES_PUSH.test(endpoint);
}

const b64 = (b: Buffer) => b.toString("base64url");
const deB64 = (s: string) => Buffer.from(s, "base64url");

/** La paire VAPID du serveur, ou null tant que VAPID_PRIVATE_KEY manque. */
export function cleVapid(): CleVapid | null {
  const privee = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!privee) return null;
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(deB64(privee));
    return {
      publique: b64(ecdh.getPublicKey()),
      privee,
      sujet: process.env.VAPID_SUBJECT ?? "https://getbola.app",
    };
  } catch {
    return null;
  }
}

/** Jeton VAPID pour l'origine du service de push, valable 12 h. */
export function jetonVapid(endpoint: string, cle: CleVapid, maintenant = Date.now()): string {
  const pub = deB64(cle.publique);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: cle.privee,
    x: b64(pub.subarray(1, 33)),
    y: b64(pub.subarray(33, 65)),
  };
  const entete = b64(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corps = b64(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(maintenant / 1000) + 12 * 3600,
        sub: cle.sujet,
      })
    )
  );
  const signature = sign("sha256", Buffer.from(`${entete}.${corps}`), {
    key: createPrivateKey({ key: jwk, format: "jwk" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${entete}.${corps}.${b64(signature)}`;
}

/** Le message chiffré pour un abonnement (un seul enregistrement aes128gcm). */
export function chiffrer(message: Buffer, ab: Abonnement): Buffer {
  const uaPublique = deB64(ab.p256dh);
  const secretAuth = deB64(ab.auth);

  const ephemere = createECDH("prime256v1");
  ephemere.generateKeys();
  const asPublique = ephemere.getPublicKey();
  const secretEcdh = ephemere.computeSecret(uaPublique);

  const infoCle = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublique, asPublique]);
  const ikm = Buffer.from(hkdfSync("sha256", secretEcdh, secretAuth, infoCle, 32));

  const sel = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, sel, Buffer.from("Content-Encoding: nonce\0"), 12));

  const chiffreur = createCipheriv("aes-128-gcm", cek, nonce);
  // 0x02 : délimiteur du dernier (et seul) enregistrement.
  const chiffre = Buffer.concat([chiffreur.update(Buffer.concat([message, Buffer.from([2])])), chiffreur.final()]);
  const tag = chiffreur.getAuthTag();

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([sel, rs, Buffer.from([asPublique.length]), asPublique, chiffre, tag]);
}

export type Resultat = "envoye" | "mort" | "echec";

/** Envoie à un téléphone. « mort » : l'abonnement n'existe plus, à effacer. */
export async function envoyer(ab: Abonnement, message: unknown, cle: CleVapid): Promise<Resultat> {
  // Une adresse hors des services connus n'est jamais appelée : l'abonnement
  // est compté mort, et l'appelant l'efface.
  if (!serviceConnu(ab.endpoint)) return "mort";
  try {
    const r = await fetch(ab.endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jetonVapid(ab.endpoint, cle)}, k=${cle.publique}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(24 * 3600),
        Urgency: "normal",
      },
      body: new Uint8Array(chiffrer(Buffer.from(JSON.stringify(message)), ab)),
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return "envoye";
    return r.status === 404 || r.status === 410 ? "mort" : "echec";
  } catch {
    return "echec";
  }
}
