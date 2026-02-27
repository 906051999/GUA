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
        background:
          "radial-gradient(720px 520px at 50% -12%, rgba(255, 255, 255, 0.9), transparent 60%), radial-gradient(520px 420px at 12% 10%, rgba(255, 255, 255, 0.72), transparent 64%), linear-gradient(180deg, #fbfaf7, #f3f1ed)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgba(27, 31, 36, 0.05), rgba(27, 31, 36, 0.05) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(to right, rgba(27, 31, 36, 0.04), rgba(27, 31, 36, 0.04) 1px, transparent 1px, transparent 76px)",
          opacity: 0.28,
          maskImage: "linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent 82%)",
        }}
      />
      <div
        style={{
          width: 420,
          height: 420,
          borderRadius: 112,
          background: "rgba(255, 255, 255, 0.92)",
          border: "1px solid rgba(27, 31, 36, 0.16)",
          boxShadow: "0 48px 140px rgba(20, 24, 28, 0.16), 0 0 0 1px rgba(255, 255, 255, 0.65) inset",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, transparent 42%, rgba(27, 31, 36, 0.04), transparent 64%), repeating-linear-gradient(90deg, rgba(27, 31, 36, 0.045), rgba(27, 31, 36, 0.045) 1px, transparent 1px, transparent 34px)",
            opacity: 0.22,
          }}
        />
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 108,
            border: "1px solid rgba(27, 31, 36, 0.12)",
            background:
              "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 245, 242, 0.7)), radial-gradient(240px 160px at 24% 18%, rgba(255, 255, 255, 0.9), transparent 70%)",
            boxShadow: "0 26px 80px rgba(20, 24, 28, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.6) inset",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 168, fontWeight: 800, letterSpacing: "0.08em", lineHeight: 1, color: "#1b1f24" }}>
            Ω
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "0.18em", color: "#1b1f24" }}>GUA</div>
            <div style={{ width: 14, height: 14, borderRadius: 999, background: "#ff7a3d", boxShadow: "0 10px 22px rgba(255, 122, 61, 0.35)" }} />
          </div>
        </div>
      </div>
    </div>,
    { width: size.width, height: size.height },
  );
}
