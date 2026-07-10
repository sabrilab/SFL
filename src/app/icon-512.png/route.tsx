import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b0f1a",
          color: "#ffffff",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: -6,
          fontFamily: "sans-serif",
        }}
      >
        SFL
      </div>
    ),
    { width: 512, height: 512 }
  );
}
