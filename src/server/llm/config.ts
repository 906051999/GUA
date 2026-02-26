import { parseBool, parseList } from "@/server/llm/env";

export type BigmodelServerConfig = {
  apiKey: string;
  baseUrl: string;
  availableModels: string[];
  thinkingModels: Set<string>;
  defaultModel: string;
  streamDefault: boolean;
  thinkingDefault: boolean;
  temperature: number;
  maxTokens: number;
};

export type LlmClientConfig = {
  models: Array<{ id: string; thinking: boolean }>;
  defaults: { model: string; stream: boolean; thinking: boolean };
  warnings?: string[];
};

export type BigmodelClientEnvConfig = {
  availableModels: string[];
  thinkingModels: Set<string>;
  defaultModel: string;
  streamDefault: boolean;
  thinkingDefault: boolean;
  warnings: string[];
};

export function resolveBigmodelConfig(): { config: BigmodelServerConfig } | { response: Response } {
  const apiKey = (process.env.BIGMODEL_API_KEY || "").trim();
  if (!apiKey) return { response: new Response("缺少 BIGMODEL_API_KEY。", { status: 500 }) };

  const baseUrl = (process.env.BIGMODEL_BASE_URL || "").trim();
  if (!baseUrl) return { response: new Response("缺少 BIGMODEL_BASE_URL。", { status: 500 }) };

  const resolvedClient = resolveBigmodelClientConfig();
  if ("response" in resolvedClient) return resolvedClient;
  const { availableModels, thinkingModels, defaultModel, streamDefault, thinkingDefault } = resolvedClient.config;

  const temperature = Number(process.env.BIGMODEL_TEMPERATURE ?? "1.0");
  const maxTokens = Number(process.env.BIGMODEL_MAX_TOKENS ?? "4096");

  return {
    config: {
      apiKey,
      baseUrl,
      availableModels,
      thinkingModels,
      defaultModel,
      streamDefault,
      thinkingDefault,
      temperature,
      maxTokens,
    },
  };
}

export function resolveBigmodelClientConfig(): { config: BigmodelClientEnvConfig } | { response: Response } {
  const warnings: string[] = [];
  const fallbackModel = (process.env.BIGMODEL_MODEL || "").trim();
  const availableModels = (() => {
    const models = parseList(process.env.BIGMODEL_MODELS);
    if (models.length) return models;
    if (fallbackModel) return [fallbackModel];
    return [];
  })();
  if (!availableModels.length) return { response: new Response("缺少 BIGMODEL_MODELS/BIGMODEL_MODEL。", { status: 500 }) };

  const thinkingModels = new Set(parseList(process.env.BIGMODEL_THINKING_MODELS));
  const desiredDefaultModel = (process.env.BIGMODEL_DEFAULT_MODEL || fallbackModel || availableModels[0] || "").trim();
  if (!desiredDefaultModel) return { response: new Response("缺少 BIGMODEL_DEFAULT_MODEL/BIGMODEL_MODEL。", { status: 500 }) };
  const defaultModel = availableModels.includes(desiredDefaultModel) ? desiredDefaultModel : availableModels[0]!;
  if (defaultModel !== desiredDefaultModel) {
    warnings.push(`默认 model=${desiredDefaultModel} 不在 BIGMODEL_MODELS 中，已回退为 ${defaultModel}。`);
  }

  const streamDefault = parseBool(process.env.BIGMODEL_STREAM_DEFAULT ?? process.env.BIGMODEL_STREAM, true);

  const thinkingDefaultRaw =
    process.env.BIGMODEL_THINKING_DEFAULT ??
    (process.env.BIGMODEL_THINKING_TYPE
      ? process.env.BIGMODEL_THINKING_TYPE.toLowerCase() === "disabled"
        ? "0"
        : "1"
      : undefined);
  const thinkingDefault = parseBool(thinkingDefaultRaw, true);

  return { config: { availableModels, thinkingModels, defaultModel, streamDefault, thinkingDefault, warnings } };
}

export function toClientConfig(cfg: BigmodelClientEnvConfig): LlmClientConfig {
  const models = cfg.availableModels.map((id) => ({ id, thinking: cfg.thinkingModels.has(id) }));
  const effectiveThinkingDefault = cfg.thinkingDefault && cfg.thinkingModels.has(cfg.defaultModel);
  return {
    models,
    defaults: { model: cfg.defaultModel, stream: cfg.streamDefault, thinking: effectiveThinkingDefault },
    warnings: cfg.warnings.length ? cfg.warnings : undefined,
  };
}

