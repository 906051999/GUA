export const runtime = "nodejs";

export async function GET() {
  const { resolveBigmodelClientConfig, toClientConfig } = await import("@/server/llm/config");
  const resolved = resolveBigmodelClientConfig();
  if ("response" in resolved) return resolved.response;
  return Response.json(toClientConfig(resolved.config));
}
