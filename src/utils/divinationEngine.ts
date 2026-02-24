import { Lunar } from "lunar-javascript";

export type DivinationInput = {
  question: string;
  datetime: Date;
  nickname?: string | null;
};

export type DivinationConfig = {
  weights: {
    time: number;
    text: number;
    iching: number;
    numerology: number;
    entropy: number;
  };
  verdictThresholds: {
    greatGood: number;
    good: number;
    flat: number;
  };
};

export type DivinationResult = {
  verdict: string;
  score: number;
  poem: string;
  carry: {
    seed: number;
    pillars: {
      year: string;
      month: string;
      day: string;
      time: string;
    };
    elements: Record<"wood" | "fire" | "earth" | "metal" | "water", number>;
    hexagram: {
      upper: string;
      lower: string;
      name: string;
      changingLine: number;
    };
  };
};

export type DivinationTracePhase =
  | "时间"
  | "文字"
  | "易经"
  | "数理"
  | "天机"
  | "融合"
  | "裁决";

export type DivinationTraceKind = "group_start" | "group_end" | "event";

export type DivinationTraceEvent = {
  id: string;
  t: number;
  depth: number;
  kind: DivinationTraceKind;
  phase: DivinationTracePhase;
  message: string;
  data?: Record<string, string | number>;
  fp?: number[];
  groupDigest?: string;
  rootDigest?: string;
  prev: string;
  hash: string;
};

export const defaultDivinationConfig: DivinationConfig = {
  weights: {
    time: 0.28,
    text: 0.22,
    iching: 0.24,
    numerology: 0.16,
    entropy: 0.1,
  },
  verdictThresholds: {
    greatGood: 0.78,
    good: 0.62,
    flat: 0.46,
  },
};

const STEM_ELEMENT: Record<string, keyof DivinationResult["carry"]["elements"]> = {
  甲: "wood",
  乙: "wood",
  丙: "fire",
  丁: "fire",
  戊: "earth",
  己: "earth",
  庚: "metal",
  辛: "metal",
  壬: "water",
  癸: "water",
};

const BRANCH_ELEMENT: Record<string, keyof DivinationResult["carry"]["elements"]> = {
  子: "water",
  丑: "earth",
  寅: "wood",
  卯: "wood",
  辰: "earth",
  巳: "fire",
  午: "fire",
  未: "earth",
  申: "metal",
  酉: "metal",
  戌: "earth",
  亥: "water",
};

type TrigramKey = "qian" | "dui" | "li" | "zhen" | "xun" | "kan" | "gen" | "kun";

const TRIGRAMS: Record<
  number,
  {
    key: TrigramKey;
    name: string;
    binary: number[];
    element: keyof DivinationResult["carry"]["elements"];
  }
> = {
  1: { key: "qian", name: "乾", binary: [1, 1, 1], element: "metal" },
  2: { key: "dui", name: "兑", binary: [1, 1, 0], element: "metal" },
  3: { key: "li", name: "离", binary: [1, 0, 1], element: "fire" },
  4: { key: "zhen", name: "震", binary: [1, 0, 0], element: "wood" },
  5: { key: "xun", name: "巽", binary: [0, 1, 1], element: "wood" },
  6: { key: "kan", name: "坎", binary: [0, 1, 0], element: "water" },
  7: { key: "gen", name: "艮", binary: [0, 0, 1], element: "earth" },
  8: { key: "kun", name: "坤", binary: [0, 0, 0], element: "earth" },
};

const HEXAGRAM_NAMES: string[] = [
  "乾为天",
  "坤为地",
  "水雷屯",
  "山水蒙",
  "水天需",
  "天水讼",
  "地水师",
  "水地比",
  "风天小畜",
  "天泽履",
  "地天泰",
  "天地否",
  "天火同人",
  "火天大有",
  "地山谦",
  "雷地豫",
  "泽雷随",
  "山风蛊",
  "地泽临",
  "风地观",
  "火雷噬嗑",
  "山火贲",
  "山地剥",
  "地雷复",
  "天雷无妄",
  "山天大畜",
  "山雷颐",
  "泽风大过",
  "坎为水",
  "离为火",
  "泽山咸",
  "雷风恒",
  "天山遁",
  "雷天大壮",
  "火地晋",
  "地火明夷",
  "风火家人",
  "火泽睽",
  "水山蹇",
  "雷水解",
  "山泽损",
  "风雷益",
  "泽天夬",
  "天风姤",
  "泽地萃",
  "地风升",
  "泽水困",
  "水风井",
  "泽火革",
  "火风鼎",
  "震为雷",
  "艮为山",
  "风山渐",
  "雷泽归妹",
  "雷火丰",
  "火山旅",
  "巽为风",
  "兑为泽",
  "风水涣",
  "水泽节",
  "风泽中孚",
  "雷山小过",
  "水火既济",
  "火水未济",
];

export function divine(
  input: DivinationInput,
  entropy: number,
  config: DivinationConfig = defaultDivinationConfig,
): DivinationResult {
  return divineWithTrace(input, entropy, config).result;
}

export function divineWithTrace(
  input: DivinationInput,
  entropy: number,
  config: DivinationConfig = defaultDivinationConfig,
): { result: DivinationResult; trace: DivinationTraceEvent[] } {
  const normalizedQuestion = normalizeQuestion(input.question);
  const questionHash = fnv1a32(normalizedQuestion);
  const timeSeed = timeSignature(input.datetime);
  const seed = mixSeed(questionHash, timeSeed, entropy);
  const rng = makeRng(seed);

  const trace: DivinationTraceEvent[] = [];
  const rngTrace = makeRng(seed ^ 0x9e3779b9);
  let seq = 0;
  let depth = 0;
  let t = 0;
  let prevHash = hex8(mixSeed(seed, questionHash, timeSeed));
  let rootAcc = fnv1a32(prevHash);
  const groupStack: { depth: number; startIndex: number; startHash: string; acc: number }[] = [];

  const stableData = (data?: Record<string, string | number>, fp?: number[]) => {
    const base = data
      ? Object.keys(data)
          .sort((a, b) => a.localeCompare(b))
          .map((k) => `${k}=${String(data[k])}`)
          .join("|")
      : "";
    const fpStr = fp && fp.length > 0 ? `fp=${fp.map((n) => round4(n)).join(",")}` : "";
    if (!base) return fpStr;
    if (!fpStr) return base;
    return `${base}|${fpStr}`;
  };

  const push = (
    kind: DivinationTraceKind,
    phase: DivinationTracePhase,
    message: string,
    data?: Record<string, string | number>,
    fp?: number[],
  ) => {
    if (kind === "group_end") depth = Math.max(0, depth - 1);

    const step =
      kind === "event"
        ? 80 + Math.floor(rngTrace() * 220)
        : 160 + Math.floor(rngTrace() * 360);
    t += step;

    const id = `E${String(++seq).padStart(4, "0")}`;
    const prev = prevHash;
    const payload = `${prev}|t=${t}|d=${depth}|k=${kind}|p=${phase}|m=${message}|${stableData(data, fp)}`;
    const hash = hex8(fnv1a32(payload));
    prevHash = hash;

    const index = trace.length;
    trace.push({
      id,
      t,
      depth,
      kind,
      phase,
      message,
      data,
      fp,
      prev,
      hash,
    });

    rootAcc = fnv1a32(`${hex8(rootAcc)}|${hash}`);
    for (const g of groupStack) {
      g.acc = fnv1a32(`${hex8(g.acc)}|${hash}`);
    }

    if (kind === "group_start") {
      groupStack.push({ depth, startIndex: index, startHash: hash, acc: fnv1a32(hash) });
      depth += 1;
      return;
    }

    if (kind === "group_end") {
      for (let i = groupStack.length - 1; i >= 0; i -= 1) {
        const g = groupStack[i];
        if (g.depth === depth) {
          groupStack.splice(i, 1);
          const digest = hex8(fnv1a32(`${g.startHash}|${hex8(g.acc)}|${hash}`));
          trace[g.startIndex].groupDigest = digest;
          trace[g.startIndex].data = { ...(trace[g.startIndex].data ?? {}), gd: digest.slice(0, 8) };
          trace[index].groupDigest = digest;
          trace[index].data = { ...(trace[index].data ?? {}), gd: digest.slice(0, 8) };
          break;
        }
      }
    }
  };

  const groupStart = (
    phase: DivinationTracePhase,
    title: string,
    data?: Record<string, string | number>,
    fp?: number[],
  ) => push("group_start", phase, title, data, fp);
  const groupEnd = (
    phase: DivinationTracePhase,
    title: string,
    data?: Record<string, string | number>,
    fp?: number[],
  ) => push("group_end", phase, title, data, fp);
  const emit = (phase: DivinationTracePhase, message: string, data?: Record<string, string | number>, fp?: number[]) =>
    push("event", phase, message, data, fp);

  groupStart("天机", "启封", { seed: hex8(seed), qh: hex8(questionHash), ts: hex8(timeSeed), e: hex8(entropy >>> 0) });
  emit("天机", "启封问事，落符入盘", { q: normalizedQuestion.length, qh: hex8(questionHash) });
  emit("天机", "构建天机种子", { seed: hex8(seed), drift: round4(rngTrace()) });
  emit("天机", "编排扰动门限", { gate: round4(0.35 + rngTrace() * 0.55), bias: round4((rngTrace() - 0.5) * 0.12) });
  emit("天机", "噪声谱拟合", { n1: round4(rngTrace()), n2: round4(rngTrace()), n3: round4(rngTrace()), h: hex8(mixSeed(seed, entropy, questionHash)) });
  groupEnd("天机", "启封完毕", { head: prevHash });

  const lunar = Lunar.fromDate(input.datetime);
  const pillars = {
    year: String(lunar.getYearInGanZhiExact?.() ?? lunar.getYearInGanZhi()),
    month: String(lunar.getMonthInGanZhiExact?.() ?? lunar.getMonthInGanZhi()),
    day: String(lunar.getDayInGanZhiExact2?.() ?? lunar.getDayInGanZhi()),
    time: String(lunar.getTimeInGanZhi()),
  };

  const elements = calcElementsFromPillars(pillars);
  const timeScore = scoreTime(elements);
  groupStart("时间", "时序维度", { y: pillars.year, m: pillars.month, d: pillars.day, h: pillars.time });
  emit("时间", "推四柱干支", { year: pillars.year, month: pillars.month, day: pillars.day, time: pillars.time });
  const timeVec = Array.from({ length: 9 }).map(() => round4(rngTrace()));
  emit("时间", "时序映射矩阵", { m: timeVec.map((n) => String(n)).join(",") });
  emit("时间", "节律折叠 / 相位校正", { phi: round4(rngTrace()), psi: round4(rngTrace()), omega: round4(rngTrace()) });
  emit("时间", "五行向量归一", {
    wood: round4(elements.wood),
    fire: round4(elements.fire),
    earth: round4(elements.earth),
    metal: round4(elements.metal),
    water: round4(elements.water),
  });
  emit("时间", "平衡度 / 流转度合成", { score: round4(timeScore), k: round4(0.85 + rngTrace() * 0.3) });
  groupEnd("时间", "时序完毕", { score: round4(timeScore), tail: prevHash });

  const textNumbers = calcTextNumbers(normalizedQuestion);
  const textScore = scoreText(textNumbers);
  groupStart("文字", "文字外应", { len: textNumbers.length, u: hex8(textNumbers.unicodeSum), c: hex8(textNumbers.chaos) });
  emit("文字", "外应数取象", { len: textNumbers.length, u: hex8(textNumbers.unicodeSum), s: textNumbers.pseudoStrokes, c: hex8(textNumbers.chaos) });
  const windows = Math.min(7, Math.max(3, Math.floor(normalizedQuestion.length / 6)));
  groupStart("文字", "切片/频域/噪声", { w: windows });
  for (let i = 0; i < windows; i += 1) {
    const a = (questionHash + i * 131) >>> 0;
    emit("文字", "字相切片 / 频域折算", { i: i + 1, w: hex8(a), p: round4(rngTrace()), t: round4(rngTrace()) });
  }
  groupEnd("文字", "切片收束", { h: prevHash });
  emit("文字", "外应归一评分", { score: round4(textScore), sigma: round4(0.18 + rngTrace() * 0.22) });
  groupEnd("文字", "外应完毕", { score: round4(textScore), tail: prevHash });

  const hexagram = calcHexagram({
    timeSeed,
    questionHash,
    entropy,
    rng,
  });
  const ichingScore = scoreIChing(hexagram);
  const upperIndex = Object.values(TRIGRAMS).findIndex((t) => t.name === hexagram.upper) + 1;
  const lowerIndex = Object.values(TRIGRAMS).findIndex((t) => t.name === hexagram.lower) + 1;
  groupStart("易经", "易经维度", { name: hexagram.name, line: hexagram.changingLine });
  emit("易经", "梅花起卦", {
    upper: `${hexagram.upper}(${upperIndex || 0})`,
    lower: `${hexagram.lower}(${lowerIndex || 0})`,
    name: hexagram.name,
    line: hexagram.changingLine,
  });
  emit("易经", "动爻触发 / 爻位偏置", { line: hexagram.changingLine, bias: round4((hexagram.changingLine - 3.5) / 7), h: hex8(mixSeed(seed, hexagram.changingLine, entropy)) });
  groupStart("易经", "六爻采样", { n: 6 });
  for (let i = 0; i < 6; i += 1) {
    emit("易经", "爻象采样", { i: i + 1, v: round4(rngTrace()), z: hex8(mixSeed(questionHash, timeSeed, i + 1)) });
  }
  groupEnd("易经", "六爻收束", { h: prevHash });
  emit("易经", "卦势评分", { score: round4(ichingScore), mu: round4(0.4 + rngTrace() * 0.3) });
  groupEnd("易经", "易经完毕", { score: round4(ichingScore), tail: prevHash });

  const numerology = calcNumerology(input.datetime, normalizedQuestion, input.nickname ?? "");
  const numerologyScore = scoreNumerology(numerology);
  groupStart("数理", "数理维度", { life: numerology.life, inquiry: numerology.inquiry, bridge: numerology.bridge });
  emit("数理", "数秘折算能量", { life: numerology.life, inquiry: numerology.inquiry, bridge: numerology.bridge });
  emit("数理", "数字根回路", { r1: round4(rngTrace()), r2: round4(rngTrace()), r3: round4(rngTrace()), k: round4(1.2 + rngTrace() * 0.9) });
  emit("数理", "回路收敛判定", { eps: round4(0.001 + rngTrace() * 0.009), it: 3 + Math.floor(rngTrace() * 9) });
  emit("数理", "数理评分", { score: round4(numerologyScore), phi: round4(0.5 + rngTrace() * 0.2) });
  groupEnd("数理", "数理完毕", { score: round4(numerologyScore), tail: prevHash });

  const entropyScore = scoreEntropy(entropy);
  groupStart("天机", "扰动注入", { entropy: hex8(entropy >>> 0) });
  emit("天机", "微熵扰动注入", { entropy: hex8(entropy >>> 0), score: round4(entropyScore) });
  for (let i = 0; i < 6; i += 1) {
    emit("天机", "扰动折叠", { i: i + 1, d: round4((rngTrace() - 0.5) * 0.22), n: hex8(mixSeed(entropy, seed, i + 17)) });
  }
  emit("天机", "扰动归一评分", { score: round4(entropyScore), alpha: round4(0.2 + rngTrace() * 0.6) });
  groupEnd("天机", "扰动完毕", { score: round4(entropyScore), tail: prevHash });

  const env = derivePseudoEnv(seed, timeSeed, entropy, input.datetime);
  groupStart("天机", "多学科环境场", { model: "SYNTH", v: 2 });
  emit("天机", "坐标投影", {
    lat: round4(env.lat),
    lon: round4(env.lon),
    alt: Math.round(env.alt),
    tz: env.tz,
  }, fp8([env.lat, env.lon, env.alt, env.tz, env.mag, env.temp, env.pressure, env.radiation]));
  emit("天机", "大气/海洋/地磁", {
    temp: round4(env.temp),
    pressure: round4(env.pressure),
    humidity: round4(env.humidity),
    salinity: round4(env.salinity),
    mag: round4(env.mag),
  }, fp8([env.pressure, env.temp, env.humidity, env.salinity, env.mag, env.lat, env.lon, env.alt]));
  emit("天机", "天文背景辐照", {
    radiation: round4(env.radiation),
    solar: round4(env.solar),
    lunar: round4(env.lunar),
    tide: round4(env.tide),
  }, fp8([env.radiation, env.solar, env.lunar, env.tide, env.lat, env.lon, env.tz, env.mag]));
  groupEnd("天机", "环境场封装", { h: prevHash });

  const factors = computeMultidisciplinaryFactors({
    seed,
    questionHash,
    timeSeed,
    entropy,
    timeScore,
    textScore,
    ichingScore,
    numerologyScore,
    entropyScore,
    elements,
    env,
    rngTrace,
    groupStart,
    groupEnd,
    emit,
  });

  const factorScore = clamp01(factors.score01);
  const factorGate = clamp01(0.25 + env.radiation * 0.28 + entropyScore * 0.22 + rngTrace() * 0.14);

  const combinedBase = combineScores(
    {
      time: timeScore,
      text: textScore,
      iching: ichingScore,
      numerology: numerologyScore,
      entropy: entropyScore,
    },
    config.weights,
  );
  const combined = clamp01(combinedBase * (1 - factorGate) + factorScore * factorGate);
  groupStart("融合", "融合维度", { mode: "nonlinear" });
  emit("融合", "权重归一", {
    wTime: round4(config.weights.time),
    wText: round4(config.weights.text),
    wI: round4(config.weights.iching),
    wN: round4(config.weights.numerology),
    wE: round4(config.weights.entropy),
  });
  emit("融合", "多学科因子注入", {
    factor: round4(factorScore),
    gate: round4(factorGate),
    base: round4(combinedBase),
  }, factors.fp8);
  const parts = {
    time: timeScore * config.weights.time,
    text: textScore * config.weights.text,
    iching: ichingScore * config.weights.iching,
    numerology: numerologyScore * config.weights.numerology,
    entropy: entropyScore * config.weights.entropy,
  };
  emit("融合", "分量叠加", {
    pT: round4(parts.time),
    pX: round4(parts.text),
    pI: round4(parts.iching),
    pN: round4(parts.numerology),
    pE: round4(parts.entropy),
  });
  const iters = 18 + Math.floor(rngTrace() * 9);
  groupStart("融合", "非线性映射迭代", { n: iters });
  for (let i = 0; i < iters; i += 1) {
    const s = rngTrace();
    const a = 0.65 + rngTrace() * 1.15;
    const b = 0.12 + rngTrace() * 0.72;
    const c = -0.25 + rngTrace() * 0.5;
    emit("融合", "迭代步", { i: i + 1, s: round4(s), a: round4(a), b: round4(b), c: round4(c) }, fp8([s, a, b, c, factorScore, factorGate, combinedBase, entropyScore]));
  }
  groupEnd("融合", "迭代收束", { h: prevHash });
  emit("融合", "融合评分(0..1)", { score01: round4(combined), checksum: hex8(mixSeed(seed, questionHash, timeSeed)) });
  groupEnd("融合", "融合完毕", { score01: round4(combined), tail: prevHash });

  const score = clampInt(Math.round(remapTo100(combined, rng())), 0, 100);
  const verdict = pickVerdict(score, config.verdictThresholds, hexagram.changingLine);
  const poem = pickPoem({
    verdict,
    seed,
    dominantElement: dominantElementOf(elements),
    hexagramName: hexagram.name,
    salt: factors.signature,
  });

  groupStart("裁决", "裁决封存", { score });
  emit("裁决", "裁决成句", { score, verdict });
  emit("裁决", "封存签文", { poem, seal: hex8(mixSeed(seed, score, questionHash)) });
  emit("裁决", "签名链校验", { head: trace[0]?.hash ?? "", tail: prevHash, ok: 1 });
  groupEnd("裁决", "封存完毕", { tail: prevHash });

  const rootDigest = hex8(rootAcc);
  for (let i = trace.length - 1; i >= 0; i -= 1) {
    if (trace[i].phase === "裁决" && trace[i].message === "签名链校验") {
      trace[i].rootDigest = rootDigest;
      trace[i].data = { ...(trace[i].data ?? {}), root: rootDigest };
      break;
    }
  }
  if (trace[0]) trace[0].rootDigest = rootDigest;

  const result: DivinationResult = {
    verdict,
    score,
    poem,
    carry: {
      seed,
      pillars,
      elements,
      hexagram,
    },
  };

  return { result, trace };
}

function normalizeQuestion(question: string) {
  return question.trim().replace(/\s+/g, " ").slice(0, 120);
}

function fnv1a32(input: string) {
  let hash = 0x811c9dc5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function mixSeed(a: number, b: number, c: number) {
  let x = (a ^ rotl32(b, 11) ^ rotl32(c >>> 0, 7)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x >>> 0;
}

function rotl32(x: number, r: number) {
  return ((x << r) | (x >>> (32 - r))) >>> 0;
}

function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) / 0xffffffff) * 0.999999999;
  };
}

function clamp01(n: number) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampInt(n: number, min: number, max: number) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function hex8(n: number) {
  return (n >>> 0).toString(16).padStart(8, "0");
}

function timeSignature(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = date.getMinutes();
  const s = date.getSeconds();
  const a = y * 3721 + m * 521 + d * 97 + h * 23 + min * 7 + s;
  return (a >>> 0) ^ rotl32((m * 131 + d * 17 + h) >>> 0, 9);
}

type PseudoEnv = {
  lat: number;
  lon: number;
  alt: number;
  tz: number;
  temp: number;
  pressure: number;
  humidity: number;
  salinity: number;
  mag: number;
  radiation: number;
  solar: number;
  lunar: number;
  tide: number;
  grav: number;
};

function derivePseudoEnv(seed: number, timeSeed: number, entropy: number, date: Date): PseudoEnv {
  const r = makeRng(mixSeed(seed, timeSeed, entropy ^ 0x6a09e667));
  const lat = ((mixSeed(seed, 180000, timeSeed) % 180000) / 1000 - 90) + (r() - 0.5) * 0.18;
  const lon = ((mixSeed(seed, 360000, entropy) % 360000) / 1000 - 180) + (r() - 0.5) * 0.22;
  const tz = clampInt(Math.round(lon / 15), -12, 14);
  const alt = Math.round(((mixSeed(seed, timeSeed, 913) % 120000) / 10 - 800) + (r() - 0.5) * 120);

  const month = date.getMonth() + 1;
  const seasonal = Math.sin(((month - 1) / 12) * Math.PI * 2);
  const solar = clamp01(0.45 + 0.35 * seasonal + 0.12 * (r() - 0.5));
  const lunar = clamp01(0.5 + 0.4 * Math.sin(((date.getDate() % 29) / 29) * Math.PI * 2) + 0.08 * (r() - 0.5));
  const tide = clamp01(0.5 * solar + 0.5 * lunar + 0.08 * (r() - 0.5));

  const temp = 18 - (Math.abs(lat) / 90) * 32 + seasonal * 10 + (r() - 0.5) * 4.2;
  const pressure = 101.325 * Math.exp(-Math.max(0, alt) / 8500) + (r() - 0.5) * 1.8;
  const humidity = clamp01(0.62 - (Math.abs(lat) / 120) + (r() - 0.5) * 0.18);
  const salinity = clamp01(0.48 + (r() - 0.5) * 0.22 + (Math.abs(lon) / 180) * 0.08);

  const mag = 25 + (1 - Math.abs(lat) / 90) * 35 + (r() - 0.5) * 4;
  const radiation = clamp01(0.22 + solar * 0.42 + (r() - 0.5) * 0.12);
  const grav = 9.78 + 0.05 * Math.cos((lat / 180) * Math.PI) - Math.max(0, alt) * 0.000003 + (r() - 0.5) * 0.002;

  return {
    lat,
    lon,
    alt,
    tz,
    temp,
    pressure,
    humidity,
    salinity,
    mag,
    radiation,
    solar,
    lunar,
    tide,
    grav,
  };
}

function fp8(values: number[]) {
  const v = new Array(8).fill(0).map((_, i) => values[i] ?? 0);
  const mean = v.reduce((a, b) => a + b, 0) / 8;
  const centered = v.map((x) => x - mean);
  const norm = Math.sqrt(centered.reduce((a, b) => a + b * b, 0)) || 1;
  const out = centered.map((x) => clamp01(0.5 + (x / norm) * 0.65));
  return out;
}

function vecAdd(a: number[], b: number[]) {
  return a.map((x, i) => x + (b[i] ?? 0));
}

function vecScale(a: number[], k: number) {
  return a.map((x) => x * k);
}

function vecMix(a: number[], b: number[], t: number) {
  const u = clamp01(t);
  return a.map((x, i) => x * (1 - u) + (b[i] ?? 0) * u);
}

function vecClamp01(a: number[]) {
  return a.map((x) => clamp01(x));
}

function vecEntropy01(a: number[]) {
  const xs = a.map((x) => Math.max(0, x));
  const sum = xs.reduce((acc, v) => acc + v, 0) || 1;
  const p = xs.map((x) => x / sum);
  let h = 0;
  for (const pi of p) {
    if (pi > 1e-12) h -= pi * Math.log2(pi);
  }
  const max = Math.log2(p.length || 1) || 1;
  return clamp01(h / max);
}

function computeMultidisciplinaryFactors(ctx: {
  seed: number;
  questionHash: number;
  timeSeed: number;
  entropy: number;
  timeScore: number;
  textScore: number;
  ichingScore: number;
  numerologyScore: number;
  entropyScore: number;
  elements: DivinationResult["carry"]["elements"];
  env: PseudoEnv;
  rngTrace: () => number;
  groupStart: (p: DivinationTracePhase, t: string, d?: Record<string, string | number>, fp?: number[]) => void;
  groupEnd: (p: DivinationTracePhase, t: string, d?: Record<string, string | number>, fp?: number[]) => void;
  emit: (p: DivinationTracePhase, m: string, d?: Record<string, string | number>, fp?: number[]) => void;
}) {
  const mk = (tag: number) =>
    makeRng(mixSeed(mixSeed(ctx.seed, ctx.questionHash, tag), ctx.timeSeed, (ctx.entropy ^ tag) >>> 0));

  const v0 = [
    ctx.elements.wood,
    ctx.elements.fire,
    ctx.elements.earth,
    ctx.elements.metal,
    ctx.elements.water,
    ctx.timeScore,
    ctx.textScore,
    ctx.ichingScore,
    ctx.numerologyScore,
    ctx.entropyScore,
    ctx.env.radiation,
    ctx.env.mag / 100,
    ctx.env.pressure / 110,
    (ctx.env.temp + 40) / 90,
    ctx.env.humidity,
    ctx.env.tide,
  ].map((x) => clamp01(x));

  let vec = v0.slice(0, 16);
  let sumScalar = 0;
  let sigAcc = fnv1a32(hex8(ctx.seed));

  const factor = (phase: DivinationTracePhase, title: string, tag: number, run: (r: () => number) => { scalar: number; vec: number[]; fp: number[]; sig: string }) => {
    const r = mk(tag);
    ctx.groupStart(phase, title, { tag: hex8(tag) }, undefined);
    const out = run(r);
    ctx.emit(phase, "因子输出", { s: round4(out.scalar), sig: out.sig }, out.fp);
    ctx.groupEnd(phase, "因子封箱", { s: round4(out.scalar), sig: out.sig }, out.fp);
    vec = vecMix(vec, out.vec, 0.35 + ctx.env.radiation * 0.25 + r() * 0.1);
    sumScalar += out.scalar;
    sigAcc = fnv1a32(`${hex8(sigAcc)}|${out.sig}`);
  };

  factor("时间", "天文/潮汐/共振", 0x01a11ce, (r) => {
    const phase = (ctx.env.solar * 0.6 + ctx.env.lunar * 0.4 + r() * 0.08) * Math.PI * 2;
    const tide = ctx.env.tide + (r() - 0.5) * 0.06;
    const resonance = clamp01(0.5 + Math.sin(phase * 2.1) * 0.35 + (r() - 0.5) * 0.12);
    const scalar = clamp01(0.35 * resonance + 0.35 * tide + 0.3 * ctx.env.radiation);
    const vecOut = vecClamp01(vecAdd(vecScale(vec, 0.85), vecScale(v0, 0.15)).map((x, i) => clamp01(x + (Math.sin(phase + i * 0.6) * 0.08))));
    const fp = fp8([scalar, resonance, tide, ctx.env.radiation, ctx.env.solar, ctx.env.lunar, ctx.env.lat, ctx.env.lon]);
    const sig = hex8(fnv1a32(`astro|${hex8(ctx.seed)}|${round4(phase)}|${round4(resonance)}`));
    ctx.emit("时间", "潮汐势估计", { tide: round4(tide), res: round4(resonance) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("时间", "地理/地磁/地形势能", 0x02b00b1e, (r) => {
    const lat = ctx.env.lat;
    const alt = ctx.env.alt;
    const mag = ctx.env.mag;
    const grav = ctx.env.grav;
    const potential = clamp01(((grav * Math.max(0, alt)) / 100000) + 0.18 + (r() - 0.5) * 0.08);
    const decl = clamp01(0.5 + (mag - 45) / 60 + (r() - 0.5) * 0.18);
    const scalar = clamp01(potential * 0.55 + decl * 0.45);
    const vecOut = vecClamp01(vec.map((x, i) => clamp01(x * (0.92 + r() * 0.06) + (i % 3 === 0 ? potential * 0.06 : decl * 0.04))));
    const fp = fp8([scalar, potential, decl, lat, alt / 9000, mag / 100, grav / 10, ctx.env.tz]);
    const sig = hex8(fnv1a32(`geo|${hex8(ctx.timeSeed)}|${Math.round(lat * 1000)}|${Math.round(alt)}`));
    ctx.emit("时间", "地磁偏角折算", { mag: round4(mag), decl: round4(decl) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("天机", "物理/热噪声/布朗/谐振", 0x03c0ffee, (r) => {
    const kT = (ctx.env.temp + 273.15) * 1.380649e-23;
    const noise = clamp01(0.5 + Math.log10(1 + kT * 1e21) * 0.18 + (r() - 0.5) * 0.16);
    let x = clamp01(0.5 + (r() - 0.5) * 0.6);
    for (let i = 0; i < 12; i += 1) x = clamp01(x + (r() - 0.5) * 0.22);
    const brown = clamp01(x);
    const resonance = clamp01(0.5 + Math.sin((ctx.env.mag / 60) * Math.PI * 2) * 0.28 + (r() - 0.5) * 0.12);
    const scalar = clamp01(noise * 0.34 + brown * 0.33 + resonance * 0.33);
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v + (i % 2 === 0 ? (noise - 0.5) * 0.08 : (resonance - 0.5) * 0.06) + (brown - 0.5) * 0.04)));
    const fp = fp8([scalar, noise, brown, resonance, ctx.env.temp, ctx.env.mag, ctx.env.pressure, ctx.env.humidity]);
    const sig = hex8(fnv1a32(`phys|${round4(noise)}|${round4(brown)}|${round4(resonance)}`));
    ctx.emit("天机", "热噪声谱", { noise: round4(noise), kT: round4(kT * 1e21) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("天机", "化学/反应速率/能垒穿越", 0x04d15ea5, (r) => {
    const R = 8.314;
    const T = ctx.env.temp + 273.15;
    const Ea = 35000 + (ctx.env.radiation * 22000) + (r() - 0.5) * 8000;
    const A = 1e12 * (0.6 + r() * 0.9);
    const k = A * Math.exp(-Ea / (R * T));
    const rate = clamp01(Math.log10(1 + k) / 12);
    const barrier = clamp01(1 - Ea / 100000);
    const scalar = clamp01(rate * 0.62 + (1 - barrier) * 0.38);
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v * (0.9 + r() * 0.08) + (i % 4 === 1 ? rate * 0.07 : barrier * 0.05))));
    const fp = fp8([scalar, rate, barrier, T / 360, Ea / 100000, ctx.env.radiation, ctx.env.humidity, ctx.env.salinity]);
    const sig = hex8(fnv1a32(`chem|${Math.round(Ea)}|${round4(rate)}`));
    ctx.emit("天机", "Arrhenius 估计", { Ea: Math.round(Ea), k: round4(k), rate: round4(rate) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("文字", "信息论/熵/互信息/编码增益", 0x05123456, (r) => {
    const src = vec.map((v, i) => clamp01(v + (Math.sin((i + 1) * 1.7 + r() * 0.3) * 0.05)));
    const H = vecEntropy01(src);
    const snr = 0.5 + ctx.env.mag / 120 + (r() - 0.5) * 0.2;
    const cap = clamp01(Math.log2(1 + Math.max(0.01, snr)) / 3);
    const gain = clamp01(0.4 + (H - 0.5) * 0.35 + (cap - 0.5) * 0.35 + (r() - 0.5) * 0.12);
    const scalar = clamp01(0.45 * H + 0.25 * cap + 0.3 * gain);
    const vecOut = vecClamp01(src.map((v, i) => clamp01(v * (0.86 + r() * 0.12) + (i % 5 === 0 ? gain * 0.08 : cap * 0.05))));
    const fp = fp8([scalar, H, cap, gain, ctx.textScore, ctx.entropyScore, ctx.env.mag, ctx.env.radiation]);
    const sig = hex8(fnv1a32(`info|${round4(H)}|${round4(cap)}|${round4(gain)}`));
    ctx.emit("文字", "信道容量映射", { H: round4(H), cap: round4(cap), gain: round4(gain) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("数理", "混沌/Logistic/Lorenz", 0x06ca0500, (r) => {
    let x = clamp01(0.2 + r() * 0.6);
    const rr = 3.57 + r() * 0.4;
    for (let i = 0; i < 24; i += 1) x = clamp01(rr * x * (1 - x));
    let lx = 0.1 + (r() - 0.5) * 0.2;
    let ly = 0.0 + (r() - 0.5) * 0.2;
    let lz = 0.0 + (r() - 0.5) * 0.2;
    const dt = 0.01 + r() * 0.008;
    const sigma = 10;
    const rho = 28 + (r() - 0.5) * 6;
    const beta = 8 / 3 + (r() - 0.5) * 0.4;
    for (let i = 0; i < 80; i += 1) {
      const dx = sigma * (ly - lx);
      const dy = lx * (rho - lz) - ly;
      const dz = lx * ly - beta * lz;
      lx += dx * dt;
      ly += dy * dt;
      lz += dz * dt;
    }
    const chaos = clamp01(0.5 + (x - 0.5) * 0.8);
    const lor = clamp01(0.5 + (Math.tanh(lx) + Math.tanh(ly) + Math.tanh(lz)) / 6);
    const scalar = clamp01(chaos * 0.55 + lor * 0.45);
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v + (i % 2 === 0 ? (chaos - 0.5) * 0.09 : (lor - 0.5) * 0.08))));
    const fp = fp8([scalar, chaos, lor, rr, dt * 100, rho / 40, beta / 3, ctx.numerologyScore]);
    const sig = hex8(fnv1a32(`chaos|${round4(chaos)}|${round4(lor)}|${round4(rr)}`));
    ctx.emit("数理", "混沌迭代摘要", { x: round4(x), rr: round4(rr), lor: round4(lor) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("天机", "量子/振幅/坍缩/干涉", 0x0715c0de, (r) => {
    let re = (r() - 0.5) * 1.2;
    let im = (r() - 0.5) * 1.2;
    const paths = 5 + Math.floor(r() * 7);
    let interference = 0;
    for (let i = 0; i < paths; i += 1) {
      const ang = (r() * 2 - 1) * Math.PI;
      const ar = Math.cos(ang);
      const ai = Math.sin(ang);
      const nr = re * ar - im * ai;
      const ni = re * ai + im * ar;
      re = nr + (r() - 0.5) * 0.08;
      im = ni + (r() - 0.5) * 0.08;
      interference += Math.cos(ang + re * 0.7) * 0.1;
    }
    const amp = clamp01(Math.sqrt(re * re + im * im) / 1.2);
    const collapse = clamp01(0.5 + (r() - 0.5) * 0.2 + (amp - 0.5) * 0.35);
    const scalar = clamp01(0.42 * amp + 0.28 * collapse + 0.3 * clamp01(0.5 + interference));
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v * (0.88 + r() * 0.1) + (i % 3 === 0 ? (amp - 0.5) * 0.09 : (collapse - 0.5) * 0.07))));
    const fp = fp8([scalar, amp, collapse, interference, ctx.env.radiation, ctx.env.mag, ctx.env.tide, ctx.entropyScore]);
    const sig = hex8(fnv1a32(`quant|${round4(amp)}|${round4(collapse)}|${paths}`));
    ctx.emit("天机", "测量坍缩", { amp: round4(amp), collapse: round4(collapse), paths }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("数理", "生物/动力学/阈值/代谢通量", 0x081eaf00, (r) => {
    let S = 0.85;
    let I = 0.12;
    let R = 0.03;
    const beta = 0.18 + r() * 0.22;
    const gamma = 0.08 + r() * 0.16;
    const steps = 24;
    for (let i = 0; i < steps; i += 1) {
      const dS = -beta * S * I;
      const dI = beta * S * I - gamma * I;
      const dR = gamma * I;
      S = clamp01(S + dS);
      I = clamp01(I + dI);
      R = clamp01(R + dR);
    }
    const flux = clamp01(0.5 + (I - 0.1) * 1.3 + (r() - 0.5) * 0.12);
    const threshold = clamp01(0.5 + (ctx.textScore - 0.5) * 0.35 + (ctx.ichingScore - 0.5) * 0.35 + (r() - 0.5) * 0.12);
    const scalar = clamp01(0.52 * flux + 0.48 * threshold);
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v + (i % 4 === 2 ? (flux - 0.5) * 0.09 : (threshold - 0.5) * 0.07))));
    const fp = fp8([scalar, flux, threshold, beta, gamma, S, I, R]);
    const sig = hex8(fnv1a32(`bio|${round4(flux)}|${round4(threshold)}|${steps}`));
    ctx.emit("数理", "SIR 收敛态", { S: round4(S), I: round4(I), R: round4(R), flux: round4(flux) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  factor("融合", "计算机/哈希雪崩/误差传播", 0x09c0de00, (r) => {
    const h1 = fnv1a32(`${hex8(ctx.seed)}|${hex8(ctx.questionHash)}|${hex8(ctx.timeSeed)}`);
    const h2 = fnv1a32(`${hex8(ctx.entropy)}|${hex8(h1)}|${hex8(ctx.seed ^ ctx.entropy)}`);
    const avalanche = clamp01(0.5 + (((h1 ^ h2) >>> 0) % 1000) / 1000 - 0.5 + (r() - 0.5) * 0.12);
    const drift = clamp01(0.5 + (ctx.entropyScore - 0.5) * 0.55 + (r() - 0.5) * 0.18);
    const scalar = clamp01(0.55 * avalanche + 0.45 * drift);
    const vecOut = vecClamp01(vec.map((v, i) => clamp01(v * (0.9 + r() * 0.08) + (i % 3 === 1 ? (avalanche - 0.5) * 0.1 : (drift - 0.5) * 0.08))));
    const fp = fp8([scalar, avalanche, drift, (h1 >>> 0) % 997, (h2 >>> 0) % 991, ctx.entropyScore, ctx.textScore, ctx.timeScore]);
    const sig = hex8(fnv1a32(`comp|${hex8(h1)}|${hex8(h2)}|${round4(avalanche)}`));
    ctx.emit("融合", "雪崩系数", { h1: hex8(h1), h2: hex8(h2), av: round4(avalanche) }, fp);
    return { scalar, vec: vecOut, fp, sig };
  });

  const score01 = clamp01(sumScalar / 9 * 0.58 + vecEntropy01(vec) * 0.42);
  const signature = hex8(fnv1a32(`${hex8(sigAcc)}|${hex8(ctx.seed)}|${round4(score01)}`));
  const fpOut = fp8([score01, vecEntropy01(vec), ctx.timeScore, ctx.textScore, ctx.ichingScore, ctx.numerologyScore, ctx.entropyScore, ctx.env.radiation]);
  ctx.groupStart("融合", "多学科汇总", { n: 9, score01: round4(score01), sig: signature }, fpOut);
  ctx.emit("融合", "多学科指纹", { sig: signature, e: round4(vecEntropy01(vec)) }, fpOut);
  ctx.groupEnd("融合", "汇总封箱", { score01: round4(score01), sig: signature }, fpOut);

  return { score01, fp8: fpOut, signature };
}

function calcElementsFromPillars(pillars: DivinationResult["carry"]["pillars"]) {
  const base: DivinationResult["carry"]["elements"] = {
    wood: 0,
    fire: 0,
    earth: 0,
    metal: 0,
    water: 0,
  };

  const parts = [pillars.year, pillars.month, pillars.day, pillars.time]
    .join("")
    .split("");

  for (const token of parts) {
    const stemEl = STEM_ELEMENT[token];
    if (stemEl) base[stemEl] += 1.35;
    const branchEl = BRANCH_ELEMENT[token];
    if (branchEl) base[branchEl] += 1.0;
  }

  const sum = Object.values(base).reduce((acc, v) => acc + v, 0) || 1;
  return {
    wood: base.wood / sum,
    fire: base.fire / sum,
    earth: base.earth / sum,
    metal: base.metal / sum,
    water: base.water / sum,
  };
}

function dominantElementOf(elements: DivinationResult["carry"]["elements"]) {
  let best: keyof DivinationResult["carry"]["elements"] = "earth";
  let bestVal = -1;
  (Object.keys(elements) as (keyof DivinationResult["carry"]["elements"])[]).forEach((k) => {
    const v = elements[k];
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  });
  return best;
}

function scoreTime(elements: DivinationResult["carry"]["elements"]) {
  const balance =
    1 -
    (Math.abs(elements.wood - 0.2) +
      Math.abs(elements.fire - 0.2) +
      Math.abs(elements.earth - 0.2) +
      Math.abs(elements.metal - 0.2) +
      Math.abs(elements.water - 0.2)) /
      2;
  const flow = clamp01(elements.wood * 0.9 + elements.fire * 1.05 + elements.earth * 0.85 + elements.metal * 1.0 + elements.water * 0.95);
  return clamp01(balance * 0.62 + flow * 0.38);
}

function calcTextNumbers(question: string) {
  let unicodeSum = 0;
  let pseudoStrokes = 0;
  let chaos = 0;
  let i = 0;
  for (const ch of question) {
    const cp = ch.codePointAt(0) ?? 0;
    unicodeSum = (unicodeSum + cp) >>> 0;
    const st = pseudoStroke(cp);
    pseudoStrokes += st;
    chaos = (chaos + Math.imul((cp ^ st) >>> 0, 2654435761)) >>> 0;
    i += 1;
  }
  const length = Math.max(1, i);
  return {
    length,
    unicodeSum,
    pseudoStrokes,
    chaos: chaos >>> 0,
  };
}

function pseudoStroke(codePoint: number) {
  const a = ((codePoint >>> 3) ^ (codePoint * 1315423911)) >>> 0;
  const b = (a ^ (a >>> 11) ^ (a << 7)) >>> 0;
  return 5 + (b % 23);
}

function scoreText(nums: ReturnType<typeof calcTextNumbers>) {
  const density = clamp01(nums.pseudoStrokes / (nums.length * 22));
  const focus = clamp01(1 - Math.abs((nums.unicodeSum % 97) / 97 - 0.5) * 1.9);
  const omen = clamp01(((nums.chaos ^ (nums.chaos >>> 13)) % 1000) / 1000);
  return clamp01(density * 0.44 + focus * 0.36 + omen * 0.2);
}

function calcHexagram(args: { timeSeed: number; questionHash: number; entropy: number; rng: () => number }) {
  const base = (args.timeSeed + rotl32(args.questionHash, 5) + rotl32(args.entropy >>> 0, 9)) >>> 0;
  const upperIndex = ((base % 8) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  const lowerIndex = ((((base >>> 3) + (args.questionHash % 37)) % 8) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  const changingLine = 1 + Math.floor(args.rng() * 6);

  const upper = TRIGRAMS[upperIndex];
  const lower = TRIGRAMS[lowerIndex];
  const name = hexagramNameFrom(upperIndex, lowerIndex);

  return {
    upper: upper.name,
    lower: lower.name,
    name,
    changingLine,
  };
}

function hexagramNameFrom(upperIndex: number, lowerIndex: number) {
  const key = ((upperIndex - 1) << 3) + (lowerIndex - 1);
  return HEXAGRAM_NAMES[key] ?? "未济";
}

function scoreIChing(hex: DivinationResult["carry"]["hexagram"]) {
  const agitation = clamp01(Math.abs(3.5 - hex.changingLine) / 3.5);
  const omen = clamp01(1 - agitation * 0.55);
  const harmony = /乾为天|坤为地|地天泰|风天小畜|风雷益|水火既济/.test(hex.name) ? 1 : /天地否|泽天夬|泽水困|水山蹇|火水未济/.test(hex.name) ? 0.18 : 0.6;
  return clamp01(omen * 0.64 + harmony * 0.36);
}

function calcNumerology(date: Date, question: string, nickname: string) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const life = digitalRoot(sumDigits(y) + sumDigits(m) + sumDigits(d));
  const inquiry = digitalRoot(sumDigits32(fnv1a32(question)) + sumDigits32(fnv1a32(nickname)));

  const bridge = digitalRoot(life * 7 + inquiry * 3 + ((y + m + d) % 9));
  return {
    life,
    inquiry,
    bridge,
  };
}

function sumDigits(n: number) {
  const s = String(Math.abs(n));
  let acc = 0;
  for (const ch of s) acc += ch.charCodeAt(0) - 48;
  return acc;
}

function sumDigits32(n: number) {
  let x = n >>> 0;
  let acc = 0;
  while (x > 0) {
    acc += x % 10;
    x = Math.floor(x / 10);
  }
  return acc;
}

function digitalRoot(n: number) {
  let x = n;
  while (x >= 10) x = sumDigits(x);
  return x;
}

function scoreNumerology(n: ReturnType<typeof calcNumerology>) {
  const lifeBoost = [0.5, 0.68, 0.62, 0.72, 0.58, 0.66, 0.7, 0.6, 0.74, 0.64][n.life] ?? 0.62;
  const inquiryTilt = [0.5, 0.7, 0.6, 0.76, 0.58, 0.64, 0.72, 0.62, 0.74, 0.66][n.inquiry] ?? 0.62;
  const bridge = [0.5, 0.66, 0.6, 0.7, 0.58, 0.64, 0.72, 0.62, 0.76, 0.68][n.bridge] ?? 0.62;
  return clamp01(lifeBoost * 0.45 + inquiryTilt * 0.35 + bridge * 0.2);
}

function scoreEntropy(entropy: number) {
  const x = (entropy >>> 0) % 100000;
  const n = x / 100000;
  const curve = 1 - Math.abs(n - 0.5) * 1.6;
  return clamp01(0.35 + curve * 0.65);
}

function combineScores(
  scores: { time: number; text: number; iching: number; numerology: number; entropy: number },
  weights: DivinationConfig["weights"],
) {
  const sumW = weights.time + weights.text + weights.iching + weights.numerology + weights.entropy || 1;
  const w = {
    time: weights.time / sumW,
    text: weights.text / sumW,
    iching: weights.iching / sumW,
    numerology: weights.numerology / sumW,
    entropy: weights.entropy / sumW,
  };
  const linear =
    scores.time * w.time +
    scores.text * w.text +
    scores.iching * w.iching +
    scores.numerology * w.numerology +
    scores.entropy * w.entropy;

  const nonLinear = 1 / (1 + Math.exp(-6.2 * (linear - 0.5)));
  return clamp01(nonLinear * 0.92 + linear * 0.08);
}

function remapTo100(score01: number, jitter: number) {
  const s = clamp01(score01);
  const breathe = (jitter - 0.5) * 0.06;
  const shaped = clamp01(s + breathe);
  return shaped * 100;
}

function pickVerdict(score: number, t: DivinationConfig["verdictThresholds"], changingLine: number) {
  const s = score / 100;
  if (s >= t.greatGood) return changingLine <= 2 ? "大吉，宜速战" : "大吉，乘势行";
  if (s >= t.good) return changingLine <= 3 ? "吉，宜主动" : "吉，稳中进";
  if (s >= t.flat) return changingLine <= 3 ? "平，待时机" : "平，宜观望";
  return changingLine >= 5 ? "凶，宜守静" : "凶，慎言行";
}

function pickPoem(args: {
  verdict: string;
  seed: number;
  dominantElement: keyof DivinationResult["carry"]["elements"];
  hexagramName: string;
  salt?: string;
}) {
  const salt = args.salt ? `|${args.salt}` : "";
  const pick = makeRng((args.seed ^ fnv1a32(args.verdict + args.hexagramName + salt)) >>> 0);
  const pool = poemPool(args.verdict, args.dominantElement);
  const idx = Math.floor(pick() * pool.length);
  return pool[idx] ?? "静观其变，勿急于名。";
}

function poemPool(verdict: string, el: keyof DivinationResult["carry"]["elements"]) {
  const base = [
    "灯火未明，先守一息。",
    "风起于青萍之末，势成于无声。",
    "一步不让，万步皆空。",
    "欲速不达，欲稳则成。",
    "天机不语，唯人自知。",
    "行到水穷处，坐看云起时。",
    "心有霓虹，脚踏尘埃。",
    "算法在走，命数在变。",
  ];
  const byVerdict: Record<string, string[]> = {
    "大吉，宜速战": ["雷动而行，勿失其时。", "今夜金光落指尖，明日可定乾坤。", "乘势而起，一击即中。"],
    "大吉，乘势行": ["顺风不等人，起念便成章。", "势来如潮，踏浪而上。", "大道已开，莫问归期。"],
    "吉，宜主动": ["先声夺人，后势自稳。", "心定则锋利，出手见分晓。", "一步先，步步先。"],
    "吉，稳中进": ["以稳为刃，切开迷雾。", "慢半拍，反得全局。", "稳住气口，再推一寸。"],
    "平，待时机": ["不争一时，争一势。", "此刻宜藏锋，待明日亮刃。", "按下暂停，胜过盲冲。"],
    "平，宜观望": ["观其变，守其正。", "风未定，先系好舟。", "静看局面，自有落点。"],
    "凶，宜守静": ["退一步不是输，是换命。", "此局不宜硬碰，宜断舍离。", "守住底线，即是转机。"],
    "凶，慎言行": ["口为祸门，心为护符。", "慎言可保身，慎行可保局。", "少说一句，多留一线。"],
  };
  const byElement: Record<string, string[]> = {
    wood: ["青木藏锋，先长根再发芽。", "枝叶向上，先稳土再逐风。"],
    fire: ["火候未足，先蓄热再点燃。", "光可照路，亦可灼人。"],
    earth: ["厚土不语，能载万物亦能埋雷。", "稳住重心，天地自宽。"],
    metal: ["金刃需磨，先正其锋再断其物。", "冷光一闪，胜过百句豪言。"],
    water: ["水善利万物而不争，绕开即是胜。", "深水不响，急流最险。"],
  };

  const v = byVerdict[verdict] ?? [];
  const e = byElement[el] ?? [];
  return [...v, ...e, ...base];
}
