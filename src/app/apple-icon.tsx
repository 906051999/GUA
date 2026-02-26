import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          width: 156,
          height: 156,
          borderRadius: 44,
          border: "1px solid rgba(238, 242, 255, 0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "0.14em" }}>GUA</div>
      </div>
    </div>,
    { width: size.width, height: size.height },
  );
}

