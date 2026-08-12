"use client";

// Le dernier filet. `error.tsx` rattrape ce qui casse DANS une page ; si c'est
// la mise en page elle-même qui tombe, il n'est jamais monté et Next affiche
// son écran brut. Ce fichier remplace sa propre balise <html>, donc il ne peut
// s'appuyer sur rien de l'app — ni thème, ni composants, ni polices : tout est
// écrit en ligne, à la main.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  async function reparer() {
    try {
      if ("caches" in window) {
        const noms = await caches.keys();
        await Promise.all(noms.map((n) => caches.delete(n)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // On recharge quand même : mieux vaut essayer.
    }
    window.location.replace("/");
  }

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070707",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#6FA8FF",
            }}
          >
            Sunday Five League
          </p>
          <h1 style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800 }}>
            L&apos;app n&apos;a pas pu démarrer
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.45)" }}>
            Ton appareil garde probablement une version abîmée. Répare-la — tes données ne
            bougent pas.
          </p>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
            <button
              onClick={reset}
              style={{
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.06)",
                color: "#fff",
                borderRadius: 999,
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Réessayer
            </button>
            <button
              onClick={reparer}
              style={{
                border: "none",
                background: "#6FA8FF",
                color: "#0A0B0E",
                borderRadius: 999,
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Réparer l&apos;app
            </button>
          </div>

          <pre
            style={{
              marginTop: 28,
              textAlign: "left",
              overflowX: "auto",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 14,
              padding: "10px 14px",
              fontSize: 11,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.55)",
            }}
          >
            {error.name}: {error.message}
            {error.digest ? `\ndigest ${error.digest}` : ""}
            {error.stack ? `\n${error.stack.split("\n").slice(1, 7).join("\n")}` : ""}
          </pre>
        </div>
      </body>
    </html>
  );
}
