import { ImageResponse } from "next/og";

// Le symbole BOLA : un disque et son croissant découpé (public/bola/symbole-noir.svg),
// ici en blanc sur Noir Nuit. Les proportions reprennent le tracé : le disque
// fait 76 % du côté, la découpe 47 %, posée vers le bas à droite.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            left: "11.7%",
            top: "11.7%",
            width: "76.4%",
            height: "76.4%",
            borderRadius: "50%",
            background: "#F4F5F2",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "35.2%",
            top: "41%",
            width: "47.2%",
            height: "47.2%",
            borderRadius: "50%",
            background: "#08090B",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
