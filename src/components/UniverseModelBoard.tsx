"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UniverseModelV1 } from "@/types/universeModel";

type UniverseModelBoardProps = {
  model: UniverseModelV1 | null;
  mode?: "hud" | "mesh" | "flow";
  background?: boolean;
  height?: number;
  className?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
};

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function mix32(seed: number, n: number) {
  let x = (seed ^ n) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x >>> 0;
}

function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
    x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    return (x >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function hsl(h: number, s: number, l: number, a = 1) {
  const hh = ((h % 360) + 360) % 360;
  return `hsla(${hh}, ${Math.round(clamp01(s) * 100)}%, ${Math.round(clamp01(l) * 100)}%, ${clamp01(a)})`;
}

function len2(x: number, y: number) {
  return x * x + y * y;
}

function norm(x: number, y: number) {
  const d = Math.sqrt(len2(x, y)) || 1;
  return { x: x / d, y: y / d };
}

export function UniverseModelBoard({ model, mode = "mesh", background = true, height = 160, className, onClick, onDoubleClick }: UniverseModelBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevThetaRef = useRef<number[] | null>(null);
  const animStartRef = useRef(0);
  const animFromRef = useRef<number[] | null>(null);
  const animToRef = useRef<number[] | null>(null);
  const lastKeyRef = useRef<string>("");

  const stable = useMemo(() => {
    if (!model) return { seed: 0, runCount: 0, theta16: Array.from({ length: 16 }, () => 0.5), likes01: 0 };
    const theta16 = (Array.isArray(model.theta16) ? model.theta16 : []).slice(0, 16).map((x) => clamp01(Number(x)));
    while (theta16.length < 16) theta16.push(0.5);
    const likes01 = model.likes?.total ? clamp01(model.likes.liked / model.likes.total) : 0;
    return { seed: model.salt >>> 0, runCount: Math.max(0, Math.trunc(model.runCount ?? 0)), theta16, likes01 };
  }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const key = `${stable.seed}:${stable.runCount}:${stable.theta16.map((x) => Math.round(x * 1000)).join(",")}:${mode}:${background ? 1 : 0}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      const prev = prevThetaRef.current ?? stable.theta16;
      animFromRef.current = prev;
      animToRef.current = stable.theta16;
      prevThetaRef.current = stable.theta16;
      animStartRef.current = performance.now();
    }

    const draw = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const seed = stable.seed || 0x12345678;
      const prng = makePrng(mix32(seed, 0x51ed270b) ^ mix32(seed, stable.runCount));
      const baseHue = Math.floor(prng() * 360);
      const accentHue = (baseHue + 38 + Math.floor(prng() * 38)) % 360;
      const likesHue = (baseHue + Math.floor(lerp(-22, 22, stable.likes01))) % 360;

      if (background) {
        const bg = ctx.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, hsl(baseHue, 0.18 + 0.12 * stable.likes01, 0.97, 1));
        bg.addColorStop(1, hsl(accentHue, 0.14, 0.94, 1));
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.65);
        vignette.addColorStop(0, "rgba(15, 23, 42, 0)");
        vignette.addColorStop(1, "rgba(15, 23, 42, 0.10)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
      }

      const dt = t / 1000;

      ctx.save();
      ctx.translate(cx, cy);

      const panelR = Math.min(w, h) * 0.42;

      const animFrom = animFromRef.current ?? stable.theta16;
      const animTo = animToRef.current ?? stable.theta16;
      const animT = easeInOutCubic(Math.min(1, Math.max(0, (t - animStartRef.current) / 850)));
      const theta = stable.theta16.map((_, i) => lerp(animFrom[i] ?? 0.5, animTo[i] ?? 0.5, animT));

      const ringProg = clamp01(stable.runCount / 120);

      if (mode === "hud") {
        ctx.save();
        const gridSeed = makePrng(mix32(seed, 0xa2b84f1d));
        ctx.lineWidth = 1;
        for (let i = 0; i < 42; i += 1) {
          const a = gridSeed() * Math.PI * 2;
          const rr = panelR * (0.2 + 0.9 * gridSeed());
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          const ll = panelR * (0.08 + 0.14 * gridSeed());
          const a2 = a + (gridSeed() - 0.5) * 0.9;
          ctx.strokeStyle = hsl(baseHue, 0.18, 0.28, 0.14);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a2) * ll, y + Math.sin(a2) * ll);
          ctx.stroke();
        }
        ctx.restore();

        const ringSeg = 64;
        ctx.save();
        ctx.rotate(((seed % 3600) / 3600) * Math.PI * 2);
        ctx.lineWidth = 2;
        for (let i = 0; i < ringSeg; i += 1) {
          const p = (i + 0.5) / ringSeg;
          const lit = p <= ringProg;
          const a0 = (i / ringSeg) * Math.PI * 2;
          const a1 = ((i + 1) / ringSeg) * Math.PI * 2;
          const r0 = panelR * 0.92;
          const alpha = lit ? 0.26 + 0.18 * ringProg : 0.08;
          ctx.strokeStyle = hsl(lit ? likesHue : baseHue, 0.22, lit ? 0.24 : 0.32, alpha);
          ctx.beginPath();
          ctx.arc(0, 0, r0, a0, a1);
          ctx.stroke();
        }
        ctx.restore();

        const roseR = panelR * 0.78;
        const petalCount = 16;
        const wobble = 0.012 * Math.sin(dt * 1.2 + (seed % 13));
        const angleOffset = ((mix32(seed, 0x93a1) % 6283) / 1000) * 0.14;

        ctx.save();
        ctx.rotate(angleOffset);
        ctx.beginPath();
        for (let i = 0; i < petalCount; i += 1) {
          const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
          const v = clamp01(theta[i] ?? 0.5);
          const r = roseR * (0.26 + 0.78 * v) * (1 + wobble);
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const fill = ctx.createRadialGradient(0, 0, roseR * 0.2, 0, 0, roseR * 1.1);
        fill.addColorStop(0, hsl(accentHue, 0.34, 0.16, 0.14));
        fill.addColorStop(1, hsl(baseHue, 0.28, 0.18, 0.04));
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
        ctx.strokeStyle = hsl(accentHue, 0.32, 0.22, 0.62);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = hsl(baseHue, 0.18, 0.22, 0.22);
        ctx.beginPath();
        ctx.arc(0, 0, roseR * 0.56, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      } else if (mode === "mesh") {
        const count = Math.max(64, Math.min(180, 64 + Math.round(120 * ringProg)));
        const p0 = makePrng(mix32(seed, 0x1a73d9c1) ^ mix32(seed, stable.runCount));
        const points = Array.from({ length: count }, () => {
          const a = p0() * Math.PI * 2;
          const rr = Math.sqrt(p0());
          return { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
        });

        const anchors = Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
          const r = 0.25 + 0.55 * clamp01(theta[i] ?? 0.5);
          return { x: Math.cos(a) * r, y: Math.sin(a) * r, w: 0.35 + 0.9 * clamp01(theta[i] ?? 0.5) };
        });

        for (const p of points) {
          let dx = 0;
          let dy = 0;
          for (let i = 0; i < anchors.length; i += 1) {
            const a = anchors[i]!;
            const vx = a.x - p.x;
            const vy = a.y - p.y;
            const d = len2(vx, vy) + 0.05;
            const f = (a.w * 0.008) / d;
            dx += vx * f;
            dy += vy * f;
          }
          p.x = p.x + dx;
          p.y = p.y + dy;
        }

        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hsl(accentHue, 0.3, 0.26, 0.18 + ringProg * 0.08);
        ctx.fillStyle = hsl(baseHue, 0.18, 0.2, 0.06);

        const scale = panelR * 0.98;
        const pts = points.map((p) => ({ x: p.x * scale, y: p.y * scale }));

        const knn = 3;
        const nearest = (i: number) => {
          const src = pts[i]!;
          const best: Array<{ j: number; d: number }> = [];
          for (let j = 0; j < pts.length; j += 1) {
            if (j === i) continue;
            const q = pts[j]!;
            const d = len2(src.x - q.x, src.y - q.y);
            best.push({ j, d });
          }
          best.sort((a, b) => a.d - b.d);
          return best.slice(0, knn);
        };

        for (let i = 0; i < pts.length; i += 1) {
          const src = pts[i]!;
          const nn = nearest(i);
          for (const it of nn) {
            const q = pts[it.j]!;
            const d = Math.sqrt(it.d);
            const maxD = panelR * 0.92;
            if (d > maxD) continue;
            const a = (1 - d / maxD) * (0.22 + 0.18 * ringProg);
            ctx.strokeStyle = hsl(accentHue, 0.32, 0.24, a);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
          if (nn.length >= 2) {
            const a = pts[nn[0]!.j]!;
            const b = pts[nn[1]!.j]!;
            ctx.fillStyle = hsl(baseHue, 0.18, 0.18, 0.025 + 0.02 * ringProg);
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.closePath();
            ctx.fill();
          }
        }

        const pointSeed = makePrng(mix32(seed, 0x8f3a2c1d));
        for (let i = 0; i < pts.length; i += 1) {
          const p = pts[i]!;
          const r = 0.9 + pointSeed() * (1.6 + ringProg * 1.2);
          const a = 0.16 + 0.22 * pointSeed();
          ctx.fillStyle = hsl(likesHue, 0.28, 0.26, a);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.lineWidth = 1;
        ctx.strokeStyle = hsl(baseHue, 0.12, 0.22, 0.22);
        ctx.beginPath();
        ctx.arc(0, 0, panelR * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        const pr = makePrng(mix32(seed, 0xd03fbc2a) ^ mix32(seed, stable.runCount));
        const lines = Math.max(80, Math.min(220, 90 + Math.round(180 * ringProg)));
        const steps = Math.max(32, Math.min(96, 40 + Math.round(56 * ringProg)));
        const stepSize = 0.022 + (0.012 * (theta[2] ?? 0.5));
        const scale = panelR * 0.98;

        const f0 = 1.2 + (theta[0] ?? 0.5) * 2.4;
        const f1 = 1.2 + (theta[1] ?? 0.5) * 2.4;
        const f2 = 1.2 + (theta[2] ?? 0.5) * 2.4;
        const f3 = 1.2 + (theta[3] ?? 0.5) * 2.4;
        const ph0 = (mix32(seed, 0x91a2) % 6283) / 1000;
        const ph1 = (mix32(seed, 0x4b21) % 6283) / 1000;

        const field = (x: number, y: number) => {
          const a = Math.sin(x * f0 + ph0) + Math.cos(y * f1 + ph1);
          const b = Math.cos(x * f2 + ph1) - Math.sin(y * f3 + ph0);
          const v = norm(a, b);
          const swirl = 0.4 + 0.8 * (theta[9] ?? 0.5);
          return { x: v.x * swirl + -y * 0.18, y: v.y * swirl + x * 0.18 };
        };

        ctx.save();
        ctx.rotate(((seed % 8192) / 8192) * 0.32);
        for (let i = 0; i < lines; i += 1) {
          let x = (pr() * 2 - 1) * 0.98;
          let y = (pr() * 2 - 1) * 0.98;
          const w = 0.6 + pr() * 0.9;
          ctx.lineWidth = w;
          ctx.strokeStyle = hsl(accentHue, 0.28, 0.22, 0.05 + 0.06 * ringProg);
          ctx.beginPath();
          ctx.moveTo(x * scale, y * scale);
          for (let s = 0; s < steps; s += 1) {
            const v = field(x, y);
            x += v.x * stepSize;
            y += v.y * stepSize;
            if (Math.abs(x) > 1.1 || Math.abs(y) > 1.1) break;
            ctx.lineTo(x * scale, y * scale);
          }
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = hsl(baseHue, 0.12, 0.22, 0.18);
        ctx.lineWidth = 1;
        const rings = 5;
        for (let i = 1; i <= rings; i += 1) {
          const r = panelR * (0.2 + (i / rings) * 0.75);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.restore();

      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.76)";
      ctx.font = `600 ${Math.max(12, Math.floor(Math.min(w, h) * 0.05))}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const pad = 12;
      const saltHex = (stable.seed >>> 0).toString(16).padStart(8, "0").slice(0, 8);
      ctx.fillText(`模型 ${saltHex} · 推演 ${stable.runCount}`, pad, pad);
      ctx.globalAlpha = 0.7;
      ctx.fillText(`满意 ${Math.round(stable.likes01 * 100)}%`, pad, pad + 18);
      ctx.restore();

    };

    raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [background, mode, stable.likes01, stable.runCount, stable.seed, stable.theta16]);

  const style = useMemo(() => ({ height, width: "100%", display: "block", borderRadius: 16 }), [height]);
  return <canvas ref={canvasRef} className={className} style={style} onClick={onClick} onDoubleClick={onDoubleClick} />;
}
