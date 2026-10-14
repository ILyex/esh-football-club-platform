import "server-only";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AIProvider, AITextGenerationParams, AITextGenerationResult, AIStructuredGenerationParams, AIAvailabilityResult } from "../types";
import { AIError } from "../types";

const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
type WorkersAIBinding = { run(model: string, input: Record<string, unknown>): Promise<unknown> };
type WorkersEnv = CloudflareEnv & { AI?: WorkersAIBinding };

function getErrorCode(error: unknown): string {
  if (error instanceof Error) return `${error.message} ${String((error as Error & { code?: unknown }).code ?? "")} ${JSON.stringify(error.cause ?? "")}`;
  return typeof error === "string" ? error : JSON.stringify(error);
}

function normalizeError(error: unknown): AIError {
  const detail = getErrorCode(error);
  if (/3036|daily free allocation|quota.{0,20}(exhaust|limit)|exhaust.{0,20}quota/i.test(detail)) {
    return new AIError("AI_QUOTA_EXHAUSTED", "Cloudflare Workers AI daily allowance is exhausted", error);
  }
  if (/3007|timeout|timed out/i.test(detail)) return new AIError("AI_TIMEOUT", "Cloudflare Workers AI request timed out", error);
  return new AIError("AI_UNAVAILABLE", "Cloudflare Workers AI request failed", error);
}

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const result = payload as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }> };
  if (typeof result.response === "string") return result.response;
  const content = result.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export class CloudflareWorkersAIProvider implements AIProvider {
  readonly name = "cloudflare-workers-ai";

  isConfigured(): boolean {
    return (process.env.AI_ENABLED === "true" || process.env.AI_ENABLED === "1") &&
      (process.env.AI_PROVIDER || "cloudflare") === "cloudflare";
  }

  async checkAvailability(): Promise<AIAvailabilityResult> {
    if (!this.isConfigured()) return { available: false, error: "AI is disabled or not configured" };
    try {
      const { env } = await getCloudflareContext({ async: true });
      return (env as WorkersEnv).AI
        ? { available: true, modelFound: true, details: { models: [process.env.AI_MODEL || DEFAULT_MODEL] } }
        : { available: false, error: "Workers AI binding is missing" };
    } catch {
      return { available: false, error: "Workers AI is only available in the Cloudflare runtime" };
    }
  }

  async generateText(params: AITextGenerationParams): Promise<AITextGenerationResult> {
    if (!this.isConfigured()) throw new AIError("AI_DISABLED", "AI is disabled by configuration");
    if (params.system.length > 16_000 || params.prompt.length > 64_000 || params.images?.some((image) => image.length > 14_000_000)) {
      throw new AIError("AI_BAD_REQUEST", "AI input exceeds the configured size limit");
    }

    try {
      const { env } = await getCloudflareContext({ async: true });
      const binding = (env as WorkersEnv).AI;
      if (!binding) throw new AIError("AI_NOT_CONFIGURED", "Workers AI binding is missing");
      const userContent: unknown = params.images?.length
        ? [
            { type: "text", text: params.prompt },
            ...params.images.map((image) => ({ type: "image_url", image_url: { url: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}` } }))
          ]
        : params.prompt;
      const model = params.model || process.env.AI_MODEL || DEFAULT_MODEL;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let result: unknown;
      try {
        result = await Promise.race([
          binding.run(model, {
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: userContent }
          ],
          max_completion_tokens: Math.max(1, Math.min(params.maxTokens ?? 1024, 4096)),
          temperature: Math.max(0, Math.min(params.temperature ?? 0.2, 1)),
            stream: false
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new AIError("AI_TIMEOUT", "Workers AI request timed out")), Math.max(1000, Math.min(params.timeoutMs ?? 30_000, 120_000)));
          })
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      const text = responseText(result).trim();
      if (!text) throw new AIError("AI_PARSE_ERROR", "Workers AI returned an empty response");
      if (text.length > 64_000) throw new AIError("AI_RESPONSE_TOO_LARGE", "Workers AI response exceeded 64 KB");
      return { text, model, provider: this.name };
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw normalizeError(error);
    }
  }

  async generateStructured<T>(params: AIStructuredGenerationParams<T>): Promise<T> {
    let hint = "";
    if (params.schema instanceof z.ZodObject) hint = ` Required top-level keys: ${Object.keys(params.schema.shape).join(", ")}.`;
    const result = await this.generateText({
      system: `${params.system}\nReturn only a valid JSON object matching the requested schema.${hint}`,
      prompt: params.prompt,
      maxTokens: 2048,
      timeoutMs: params.timeoutMs,
      temperature: params.temperature
    });
    const raw = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      const parsed: unknown = JSON.parse(raw);
      const validated = params.schema.safeParse(parsed);
      if (!validated.success) throw new AIError("AI_PARSE_ERROR", `Model output failed schema validation: ${validated.error.message}`);
      return validated.data;
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw new AIError("AI_PARSE_ERROR", "Workers AI returned invalid JSON", error);
    }
  }
}
