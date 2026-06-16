import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_MODELS,
  hasLLMApiKey,
  resolveLLMProvider,
} from "../llmConfig";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("resolveLLMProvider", () => {
  it("uses GPT-5.4 as the default OpenAI model", () => {
    expect(DEFAULT_LLM_MODELS.openai).toBe("gpt-5.4");
  });

  it("defaults to OpenAI when no provider is configured", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = "openai-key";

    expect(resolveLLMProvider()).toBe("openai");
    expect(hasLLMApiKey()).toBe(true);
  });

  it("uses Anthropic only when explicitly configured", () => {
    process.env.LLM_PROVIDER = "anthropic";
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    expect(resolveLLMProvider()).toBe("anthropic");
    expect(hasLLMApiKey()).toBe(true);
  });

  it("falls back to Anthropic when it is the only available key", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    expect(resolveLLMProvider()).toBe("anthropic");
    expect(hasLLMApiKey()).toBe(true);
  });
});
