"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Container,
  Divider,
  Group,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { CyberCompass } from "@/components/CyberCompass";
import type { DivinationResult, DivinationTraceEvent } from "@/utils/divinationEngine";
import { divineWithTrace } from "@/utils/divinationEngine";

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
  const [trace, setTrace] = useState<DivinationTraceEvent[]>([]);
  const [traceVisible, setTraceVisible] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const logEndRef = useRef<HTMLDivElement | null>(null);
  const runIdRef = useRef(0);

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [traceVisible]);

  const onStart = async () => {
    const q = question.trim();
    if (!q) {
      setError("所问之事不可为空。");
      return;
    }

    setError(null);
    setPhase("computing");
    const entropy = entropyRef.current.seed >>> 0;
    setTrace([]);
    setTraceVisible(0);
    setCollapsed({});

    const runId = (runIdRef.current += 1);
    try {
      const { result: res, trace: steps } = await Promise.resolve().then(() =>
        divineWithTrace(
          {
            question: q,
            datetime,
            nickname: nickname.trim() ? nickname.trim() : undefined,
          },
          entropy,
        ),
      );

      if (runIdRef.current !== runId) return;
      setTrace(steps);

      const totalMs = 20000;
      const baseDelay = Math.floor(totalMs / Math.max(1, steps.length));
      for (let i = 0; i < steps.length; i += 1) {
        if (runIdRef.current !== runId) return;
        setTraceVisible(i + 1);
        const phaseBoost =
          steps[i]?.phase === "易经" ? 180 : steps[i]?.phase === "融合" ? 140 : steps[i]?.phase === "裁决" ? 220 : 0;
        const jitter = Math.floor(((mix32(entropy, i + 31) >>> 0) % 160) - 80);
        await sleep(Math.max(18, baseDelay + phaseBoost + jitter));
      }

      if (runIdRef.current !== runId) return;
      await sleep(260);

      setResult(res);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "推演失败，请重试。");
      setPhase("input");
    }
  };

  const onReset = () => {
    runIdRef.current += 1;
    setResult(null);
    setError(null);
    setTrace([]);
    setTraceVisible(0);
    setCollapsed({});
    setQuestion("");
    setNickname("");
    setDatetimeValue(toDatetimeLocalValue(new Date()));
    setPhase("input");
  };

  const canStart = question.trim().length > 0 && phase === "input";
  const shortcutHint = "Ctrl/⌘ + Enter";

  const shownTrace = useMemo(() => {
    const raw = trace.slice(0, traceVisible);
    const out: DivinationTraceEvent[] = [];
    let hiddenDepth: number | null = null;

    for (const evt of raw) {
      if (hiddenDepth !== null) {
        if (evt.kind === "group_end" && evt.depth === hiddenDepth) {
          hiddenDepth = null;
          continue;
        }
        if (evt.depth > hiddenDepth) continue;
        hiddenDepth = null;
      }

      if (evt.kind === "group_end") continue;

      if (evt.kind === "group_start" && collapsed[evt.id]) {
        out.push(evt);
        hiddenDepth = evt.depth;
        continue;
      }

      out.push(evt);
    }

    return out;
  }, [trace, traceVisible, collapsed]);

  const digestInfo = useMemo(() => {
    const evt = [...trace].reverse().find((e) => e.phase === "裁决" && e.message === "签名链校验");
    const root = evt?.rootDigest ?? (typeof evt?.data?.root === "string" ? evt?.data?.root : undefined);
    const head = typeof evt?.data?.head === "string" ? evt?.data?.head : undefined;
    const tail = typeof evt?.data?.tail === "string" ? evt?.data?.tail : undefined;
    const ok = evt?.data?.ok === 1;
    return { root, head, tail, ok };
  }, [trace]);

  const summaryFp = useMemo(() => {
    const evt = [...trace].reverse().find((e) => e.message === "多学科因子注入" && Array.isArray(e.fp));
    return Array.isArray(evt?.fp) ? evt.fp : undefined;
  }, [trace]);

  return (
    <Box className="gua-bg" mih="100dvh">
      <Container size="md" py={56}>
        <Stack gap={36}>
          <Stack gap={6} align="center">
            <Badge variant="outline" color="gray" radius="xl" size="lg" className="gua-mark">
              GUA
            </Badge>
            <Title order={1} ff="ui-serif, STSong, Songti SC, SimSun, serif" fw={600}>
              赛博算卦
            </Title>
            <Text fz="sm" c="dimmed" ff="var(--mantine-font-family-monospace)" style={{ letterSpacing: "0.18em" }}>
              输入极简 · 过程极繁 · 输出极决
            </Text>
          </Stack>

          {phase === "input" ? (
            <Paper withBorder radius="lg" p="xl" bg="rgba(0,0,0,0.45)" className="gua-panel">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xl">
                  <Stack gap={6}>
                    <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.18em" }}>
                      起卦
                    </Text>
                    <Text c="dimmed" fz="sm">
                      写下所问之事，余者交给推演。结果只给一句判词、一组分数、一句偈语。
                    </Text>
                  </Stack>
                  <Badge variant="light" color="gray" radius="md" ff="var(--mantine-font-family-monospace)">
                    {shortcutHint}
                  </Badge>
                </Group>

                <Textarea
                  label="所问之事"
                  placeholder="例如：这次面试能过吗"
                  value={question}
                  onChange={(e) => setQuestion(e.currentTarget.value)}
                  autosize
                  minRows={3}
                  maxRows={6}
                  maxLength={120}
                  description={
                    <Text component="span" fz="xs" c="dimmed" ff="var(--mantine-font-family-monospace)">
                      {Math.min(120, question.length)}/120
                    </Text>
                  }
                  styles={{
                    label: { fontFamily: "ui-serif, STKaiti, KaiTi, Songti SC, serif", letterSpacing: "0.14em" },
                    input: { fontFamily: "var(--mantine-font-family-monospace)" },
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onStart();
                  }}
                />

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                  <TextInput
                    label="起卦时间"
                    type="datetime-local"
                    value={datetimeValue}
                    onChange={(e) => setDatetimeValue(e.currentTarget.value)}
                    styles={{
                      label: { fontFamily: "ui-serif, STKaiti, KaiTi, Songti SC, serif", letterSpacing: "0.14em" },
                      input: { fontFamily: "var(--mantine-font-family-monospace)" },
                    }}
                  />
                  <TextInput
                    label="求测人称呼（可选）"
                    placeholder="例如：阿祈"
                    value={nickname}
                    onChange={(e) => setNickname(e.currentTarget.value)}
                    maxLength={24}
                    styles={{
                      label: { fontFamily: "ui-serif, STKaiti, KaiTi, Songti SC, serif", letterSpacing: "0.14em" },
                      input: { fontFamily: "var(--mantine-font-family-monospace)" },
                    }}
                  />
                </SimpleGrid>

                {error ? (
                  <Alert color="gray" variant="light" radius="md" ff="var(--mantine-font-family-monospace)">
                    {error}
                  </Alert>
                ) : null}

                <Button fullWidth radius="xl" size="md" onClick={onStart} disabled={!canStart}>
                  起卦
                </Button>
              </Stack>
            </Paper>
          ) : null}

          {phase === "computing" ? (
            <Paper withBorder radius="lg" p="xl" bg="rgba(0,0,0,0.45)" className="gua-panel">
              <Stack gap="xl">
                <Group justify="space-between" align="flex-end">
                  <Stack gap={4}>
                    <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.18em" }}>
                      推演中
                    </Text>
                    <Group gap="xs">
                      <Badge variant="outline" color="gray" radius="sm">
                        {traceVisible > 0 ? trace[Math.min(traceVisible - 1, trace.length - 1)]?.phase : "启封"}
                      </Badge>
                      <Text fz="xs" c="dimmed" ff="var(--mantine-font-family-monospace)">
                        {traceVisible}/{Math.max(1, trace.length)}
                      </Text>
                    </Group>
                  </Stack>
                  <Text fz="xs" c="dimmed">
                    本地计算 · 逐步回放
                  </Text>
                </Group>

                <Progress
                  value={(traceVisible / Math.max(1, trace.length)) * 100}
                  radius="xl"
                  color="gray"
                  styles={{
                    root: { background: "rgba(255,255,255,0.06)" },
                    section: { transition: "width 240ms ease" },
                  }}
                />

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                  <Box>
                    <Box className="gua-compass">
                      <CyberCompass className="gua-compass-canvas" intensity={0.85} />
                      <Box className="gua-compass-ring" />
                    </Box>
                  </Box>

                  <Paper withBorder radius="md" p="md" bg="rgba(0,0,0,0.35)">
                    <Group justify="space-between" mb="sm">
                      <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.14em" }}>
                        推演日志
                      </Text>
                      <Text fz="xs" c="dimmed" ff="var(--mantine-font-family-monospace)">
                        可见即可信
                      </Text>
                    </Group>
                    <Group justify="space-between" align="center" mb="sm" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap">
                        <Badge variant={digestInfo.ok ? "light" : "outline"} color="gray" radius="sm">
                          {digestInfo.ok ? "校验通过" : "校验待定"}
                        </Badge>
                        <Code fz="xs" c="dimmed">
                          root:{digestInfo.root ? shortHash(digestInfo.root) : "------"}
                        </Code>
                        <Code fz="xs" c="dimmed">
                          head:{digestInfo.head ? shortHash(digestInfo.head) : "------"}
                        </Code>
                        <Code fz="xs" c="dimmed">
                          tail:{digestInfo.tail ? shortHash(digestInfo.tail) : "------"}
                        </Code>
                      </Group>
                      {summaryFp ? <Fingerprint fp={summaryFp} /> : null}
                    </Group>
                    <Divider opacity={0.2} />
                    <ScrollArea h={360} mt="sm" type="always" scrollbars="y">
                      <Stack gap={10} py={6}>
                        {shownTrace.map((evt, idx) => {
                          const isGroup = evt.kind === "group_start";
                          const isCollapsed = isGroup && !!collapsed[evt.id];
                          const indent = evt.depth * 12;
                          const time = formatTime(evt.t);
                          const chain = `${shortHash(evt.prev)}→${shortHash(evt.hash)}`;
                          const gd = evt.groupDigest ? shortHash(evt.groupDigest) : null;

                          return (
                            <Box key={evt.id} pos="relative">
                              {indent > 0 ? <Box className="gua-track" style={{ width: indent }} /> : null}
                              <Group gap="sm" align="baseline" wrap="nowrap" style={{ paddingLeft: indent }}>
                                <Text
                                  fz="xs"
                                  c="dimmed"
                                  ff="var(--mantine-font-family-monospace)"
                                  style={{ width: 44, flex: "0 0 44px" }}
                                >
                                  {String(idx + 1).padStart(2, "0")}
                                </Text>
                                <Text
                                  fz="xs"
                                  c="dimmed"
                                  ff="var(--mantine-font-family-monospace)"
                                  style={{ width: 84, flex: "0 0 84px" }}
                                >
                                  {time}
                                </Text>
                                <Badge
                                  variant={isGroup ? "outline" : "light"}
                                  color="gray"
                                  radius="sm"
                                  ff="var(--mantine-font-family-monospace)"
                                  style={{ flex: "0 0 auto" }}
                                >
                                  {evt.phase}
                                </Badge>

                                {isGroup ? (
                                  <UnstyledButton
                                    onClick={() =>
                                      setCollapsed((prev) => ({ ...prev, [evt.id]: !prev[evt.id] }))
                                    }
                                    style={{ flex: 1 }}
                                  >
                                    <Group gap="xs" wrap="nowrap" align="baseline">
                                      <Text fz="sm" ff="var(--mantine-font-family-monospace)">
                                        {isCollapsed ? "▸" : "▾"} {evt.message}
                                      </Text>
                                      <Code fz="xs" c="dimmed" style={{ marginLeft: "auto" }}>
                                        {gd ? `gd:${gd}  ` : ""}
                                        {chain}
                                      </Code>
                                    </Group>
                                  </UnstyledButton>
                                ) : (
                                  <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                                    <Text fz="sm" ff="var(--mantine-font-family-monospace)" style={{ flex: 1 }}>
                                      {evt.message}
                                    </Text>
                                    <Code fz="xs" c="dimmed">
                                      {chain}
                                    </Code>
                                  </Group>
                                )}
                              </Group>
                              {Array.isArray(evt.fp) ? (
                                <Box style={{ paddingLeft: indent + 128, marginTop: 6 }}>
                                  <Fingerprint fp={evt.fp} />
                                </Box>
                              ) : null}
                              {evt.data ? (
                                <Text
                                  mt={4}
                                  fz="xs"
                                  c="dimmed"
                                  ff="var(--mantine-font-family-monospace)"
                                  style={{ overflowWrap: "anywhere", paddingLeft: indent + 128 }}
                                >
                                  {formatData(evt.data)}
                                </Text>
                              ) : null}
                            </Box>
                          );
                        })}
                        <div ref={logEndRef} />
                      </Stack>
                    </ScrollArea>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Paper>
          ) : null}

          {phase === "result" && result ? (
            <Paper withBorder radius="lg" p="xl" bg="rgba(0,0,0,0.45)" className="gua-panel">
              <Stack gap="xl">
                <Stack gap={8}>
                  <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.18em" }}>
                    最终判词
                  </Text>
                  <Divider opacity={0.2} />
                  <Title
                    order={2}
                    className="gua-glitch"
                    data-text={result.verdict}
                    ff="ui-serif, STKaiti, KaiTi, Songti SC, serif"
                    fw={700}
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {result.verdict}
                  </Title>
                </Stack>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                  <Paper withBorder radius="md" p="md" bg="rgba(0,0,0,0.35)">
                    <Group justify="space-between" align="baseline">
                      <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.14em" }}>
                        玄学评分
                      </Text>
                      <Text fz="xs" c="dimmed" ff="var(--mantine-font-family-monospace)">
                        / 100
                      </Text>
                    </Group>
                    <Group gap="sm" mt="sm" align="flex-end">
                      <Title order={3} ff="var(--mantine-font-family-monospace)" fw={700}>
                        {result.score}
                      </Title>
                    </Group>
                    <Progress
                      value={result.score}
                      radius="xl"
                      mt="md"
                      color="gray"
                      styles={{
                        root: { background: "rgba(255,255,255,0.06)" },
                      }}
                    />
                  </Paper>

                  <Paper withBorder radius="md" p="md" bg="rgba(0,0,0,0.35)">
                    <Text fw={600} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif" style={{ letterSpacing: "0.14em" }}>
                      偈语 / 签文
                    </Text>
                    <Text mt="sm" lh={1.9} ff="ui-serif, STKaiti, KaiTi, Songti SC, serif">
                      {result.poem}
                    </Text>
                    <Text mt="md" fz="xs" c="dimmed" ff="var(--mantine-font-family-monospace)">
                      {result.carry.hexagram.upper}上{result.carry.hexagram.lower}下 · {result.carry.hexagram.name}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <Button fullWidth radius="xl" size="md" onClick={onReset} variant="default">
                  再卜一次
                </Button>
              </Stack>
            </Paper>
          ) : null}

          <Text ta="center" fz="xs" c="dimmed">
            本项目仅供娱乐与传统文化研究，切勿迷信。
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}

function formatData(data: Record<string, string | number>) {
  const keys = Object.keys(data);
  const ordered = keys.sort((a, b) => a.localeCompare(b));
  return ordered
    .map((k) => `${k}=${String(data[k])}`)
    .join("  ");
}

function formatTime(ms: number) {
  return `+${(ms / 1000).toFixed(3)}s`;
}

function shortHash(hex: string) {
  if (!hex) return "--------";
  return hex.slice(0, 6);
}

function Fingerprint({ fp }: { fp: number[] }) {
  const v = fp.slice(0, 8);
  return (
    <Group gap={3} wrap="nowrap" align="flex-end">
      {v.map((x, i) => {
        const h = 4 + Math.round(x * 12);
        const o = 0.18 + x * 0.72;
        return (
          <Box
            key={i}
            style={{
              width: 10,
              height: h,
              borderRadius: 2,
              background: `rgba(255,255,255,${o})`,
              boxShadow: x > 0.75 ? "0 0 10px rgba(255,255,255,0.08)" : undefined,
            }}
          />
        );
      })}
    </Group>
  );
}
