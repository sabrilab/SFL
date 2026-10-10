import { ImageResponse } from "next/og";

// L'icône d'écran d'accueil : le symbole BOLA (disque et croissant découpé),
// blanc sur Noir Nuit, un peu plus petit que sur le favicon pour respirer
// dans le carré arrondi d'iOS.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#08090B",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "17%",
            top: "17%",
            width: "66%",
            height: "66%",
            borderRadius: "50%",
            background: "#F4F5F2",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "37.3%",
            top: "42.3%",
            width: "40.8%",
            height: "40.8%",
            borderRadius: "50%",
            background: "#08090B",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
