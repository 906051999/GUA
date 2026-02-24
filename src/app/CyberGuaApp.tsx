"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CyberCompass } from "@/components/CyberCompass";
import type { DivinationResult } from "@/utils/divinationEngine";
import { divine } from "@/utils/divinationEngine";

type Phase = "input" | "computing" | "result";

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDatetimeLocalValue(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mix32(seed: number, n: number) {
  let x = (seed ^ n) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x >>> 0;
}

export default function CyberGuaApp() {
  const [phase, setPhase] = useState<Phase>("input");
  const [question, setQuestion] = useState("");
  const [nickname, setNickname] = useState("");

  const [datetimeValue, setDatetimeValue] = useState(() => toDatetimeLocalValue(new Date()));
  const datetime = useMemo(() => parseDatetimeLocalValue(datetimeValue), [datetimeValue]);

  const [result, setResult] = useState<DivinationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entropyRef = useRef({
    seed: 0x12345678,
    lastT: 0,
    lastX: 0,
    lastY: 0,
    has: false,
  });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const st = entropyRef.current;
      const x = Math.floor(e.clientX);
      const y = Math.floor(e.clientY);
      if (!st.has) {
        st.has = true;
        st.lastT = now;
        st.lastX = x;
        st.lastY = y;
        st.seed = mix32(st.seed, (x << 16) ^ y);
        return;
      }

      const dt = Math.max(1, Math.floor(now - st.lastT));
      const dx = x - st.lastX;
      const dy = y - st.lastY;
      st.lastT = now;
      st.lastX = x;
      st.lastY = y;

      const speed = Math.min(4095, Math.floor(Math.sqrt(dx * dx + dy * dy) * 64));
      const sample = ((dt & 0xfff) << 20) ^ ((speed & 0xfff) << 8) ^ ((dx & 0xf) << 4) ^ (dy & 0xf);
      st.seed = mix32(st.seed, sample >>> 0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const onStart = async () => {
    const q = question.trim();
    if (!q) {
      setError("所问之事不可为空。");
      return;
    }

    setError(null);
    setPhase("computing");
    const entropy = entropyRef.current.seed >>> 0;

    const startedAt = performance.now();
    try {
      const compute = Promise.resolve().then(() =>
        divine({
          question: q,
          datetime,
          nickname: nickname.trim() ? nickname.trim() : undefined,
        }, entropy),
      );

      const [res] = await Promise.all([compute, sleep(1600)]);
      const spent = performance.now() - startedAt;
      if (spent < 1600) await sleep(1600 - spent);

      setResult(res);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "推演失败，请重试。");
      setPhase("input");
    }
  };

  const onReset = () => {
    setResult(null);
    setError(null);
    setQuestion("");
    setNickname("");
    setDatetimeValue(toDatetimeLocalValue(new Date()));
    setPhase("input");
  };

  return (
    <div className="min-h-dvh w-full cyber-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-10">
        <header className="mb-10 text-center">
          <h1 className="cyber-title text-4xl tracking-[0.35em]">赛博算卦</h1>
          <p className="mt-3 cyber-subtitle">输入极简，过程极繁，输出极决</p>
        </header>

        <main className="flex-1">
          {phase === "input" ? (
            <section className="cyber-panel">
              <div className="space-y-6">
                <div>
                  <label className="cyber-label">所问之事</label>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="例如：这次面试能过吗"
                    rows={3}
                    className="cyber-input mt-2 w-full resize-none"
                    maxLength={120}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="cyber-label">起卦时间</label>
                    <input
                      type="datetime-local"
                      value={datetimeValue}
                      onChange={(e) => setDatetimeValue(e.target.value)}
                      className="cyber-input mt-2 w-full"
                    />
                  </div>
                  <div>
                    <label className="cyber-label">
                      求测人称呼 <span className="cyber-muted">(可选)</span>
                    </label>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="例如：阿祈"
                      className="cyber-input mt-2 w-full"
                      maxLength={24}
                    />
                  </div>
                </div>

                {error ? <div className="cyber-error">{error}</div> : null}

                <div className="pt-2">
                  <button type="button" onClick={onStart} className="cyber-stamp w-full">
                    起卦
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "computing" ? (
            <section className="cyber-panel">
              <div className="flex flex-col items-center gap-8 py-6">
                <div className="relative h-[320px] w-[320px] sm:h-[380px] sm:w-[380px]">
                  <CyberCompass className="h-full w-full" intensity={1} />
                  <div className="pointer-events-none absolute inset-0 rounded-full cyber-glow-ring" />
                </div>
                <div className="text-center">
                  <div className="cyber-loading-line">天机运算中</div>
                  <div className="mt-3 cyber-code-stream">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span key={i} className="cyber-code-chunk">
                        0101·0110·1100·0011·
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {phase === "result" && result ? (
            <section className="cyber-panel">
              <div className="flex flex-col items-center gap-8 py-6">
                <div className="text-center">
                  <div className="cyber-label">最终判词</div>
                  <div
                    className="cyber-verdict glitch mt-3 text-4xl sm:text-5xl"
                    data-text={result.verdict}
                  >
                    {result.verdict}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-4 sm:flex-row">
                  <div className="cyber-card flex-1">
                    <div className="cyber-label">玄学评分</div>
                    <div className="mt-2 flex items-end gap-3">
                      <div className="cyber-score text-5xl">{result.score}</div>
                      <div className="cyber-muted pb-1">/ 100</div>
                    </div>
                    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full cyber-score-bar"
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                  </div>

                  <div className="cyber-card flex-1">
                    <div className="cyber-label">偈语 / 签文</div>
                    <div className="mt-3 cyber-poem">{result.poem}</div>
                    <div className="mt-4 cyber-muted">
                      {result.carry.hexagram.upper}上{result.carry.hexagram.lower}下 · {result.carry.hexagram.name}
                    </div>
                  </div>
                </div>

                <div className="w-full pt-2">
                  <button type="button" onClick={onReset} className="cyber-stamp w-full">
                    再卜一次
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </main>

        <footer className="mt-10 text-center text-xs text-white/45">
          本项目仅供娱乐与传统文化研究，切勿迷信。
        </footer>
      </div>
    </div>
  );
}
