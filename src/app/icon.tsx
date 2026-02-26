import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(120% 120% at 30% 20%, #1b2744 0%, #0b0f17 55%, #070a10 100%)",
        color: "#eef2ff",
      }}
    >
      <div
        style={{
          width: 420,
          height: 420,
          borderRadius: 120,
          border: "2px solid rgba(238, 242, 255, 0.22)",
          boxShadow: "0 40px 140px rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 128, fontWeight: 700, letterSpacing: "0.18em", lineHeight: 1 }}>GUA</div>
          <div style={{ fontSize: 54, fontWeight: 600, letterSpacing: "0.22em", opacity: 0.9, lineHeight: 1 }}>Ω</div>
        </div>
      </div>
    </div>,
    { width: size.width, height: size.height },
  );
}

