import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GUA · 不确定性归一化装置";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
        background: "radial-gradient(130% 140% at 20% 20%, #273a66 0%, #0b0f17 55%, #070a10 100%)",
        color: "#eef2ff",
        padding: "70px 74px",
      }}
    >
      <div
        style={{
          flex: 1,
          borderRadius: 44,
          border: "1px solid rgba(238, 242, 255, 0.18)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "0 50px 160px rgba(0,0,0,0.55)",
          padding: 64,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 26, letterSpacing: "0.22em", opacity: 0.85 }}>GUA</div>
          <div style={{ fontSize: 74, fontWeight: 700, letterSpacing: "0.06em", lineHeight: 1.08 }}>不确定性归一化装置</div>
          <div style={{ fontSize: 28, opacity: 0.85, lineHeight: 1.45 }}>
            一句问题，推演你的个人宇宙常量。可复算、可追溯。
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ fontSize: 22, letterSpacing: "0.12em", opacity: 0.86 }}>Ω · Deterministic Local Model</div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "0.18em" }}>GUA</div>
        </div>
      </div>
    </div>,
    { width: size.width, height: size.height },
  );
}

