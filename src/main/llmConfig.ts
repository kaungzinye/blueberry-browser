export type LLMProvider = "openai" | "anthropic";

export const DEFAULT_LLM_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-5.4",
  anthropic: "claude-3-5-sonnet-20241022",
};

export function resolveLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER?.toLowerCase();
  if (provider === "anthropic") return "anthropic";
  if (provider === "openai") return "openai";

  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return "anthropic";
  }

  return "openai";
}

export function getLLMApiKey(
  provider = resolveLLMProvider(),
): string | undefined {
  return provider === "anthropic"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY;
}

export function hasLLMApiKey(): boolean {
  return Boolean(getLLMApiKey());
}
