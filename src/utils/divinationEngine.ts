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
  const normalizedQuestion = normalizeQuestion(input.question);
  const questionHash = fnv1a32(normalizedQuestion);
  const timeSeed = timeSignature(input.datetime);
  const seed = mixSeed(questionHash, timeSeed, entropy);
  const rng = makeRng(seed);

  const lunar = Lunar.fromDate(input.datetime);
  const pillars = {
    year: String(lunar.getYearInGanZhiExact?.() ?? lunar.getYearInGanZhi()),
    month: String(lunar.getMonthInGanZhiExact?.() ?? lunar.getMonthInGanZhi()),
    day: String(lunar.getDayInGanZhiExact2?.() ?? lunar.getDayInGanZhi()),
    time: String(lunar.getTimeInGanZhi()),
  };

  const elements = calcElementsFromPillars(pillars);
  const timeScore = scoreTime(elements);

  const textNumbers = calcTextNumbers(normalizedQuestion);
  const textScore = scoreText(textNumbers);

  const hexagram = calcHexagram({
    timeSeed,
    questionHash,
    entropy,
    rng,
  });
  const ichingScore = scoreIChing(hexagram);

  const numerology = calcNumerology(input.datetime, normalizedQuestion, input.nickname ?? "");
  const numerologyScore = scoreNumerology(numerology);

  const entropyScore = scoreEntropy(entropy);

  const combined = combineScores(
    {
      time: timeScore,
      text: textScore,
      iching: ichingScore,
      numerology: numerologyScore,
      entropy: entropyScore,
    },
    config.weights,
  );

  const score = clampInt(Math.round(remapTo100(combined, rng())), 0, 100);
  const verdict = pickVerdict(score, config.verdictThresholds, hexagram.changingLine);
  const poem = pickPoem({
    verdict,
    seed,
    dominantElement: dominantElementOf(elements),
    hexagramName: hexagram.name,
  });

  return {
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
}) {
  const pick = makeRng((args.seed ^ fnv1a32(args.verdict + args.hexagramName)) >>> 0);
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

