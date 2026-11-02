import "server-only";
import { AIProvider, AIAvailabilityResult } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { CloudflareWorkersAIProvider } from "./providers/cloudflare-workers-ai";
import { getAIConfig } from "./config";

// ============================================================================
// AI PROVIDER REGISTRY & COMPATIBILITY LAYER
// ----------------------------------------------------------------------------
// Vendor-agnostic provider boundary. All application modules (e.g. DocumentAI)
// call into this facade.
// ============================================================================

const useCloudflare = process.env.AI_PROVIDER === "cloudflare" ||
  (!process.env.AI_PROVIDER && (process.env.DEPLOY_TARGET === "cloudflare" || process.env.VERCEL === "1"));
const activeProvider: AIProvider = !useCloudflare
  ? new OllamaProvider()
  : new CloudflareWorkersAIProvider();

/**
 * Resolve an OCR-capable model for the active deployment. Do not let the
 * Ollama-only `llava:7b` default leak into Vercel/Workers AI requests.
 */
export function getAIVisionModel(): string {
  if (process.env.AI_VISION_MODEL?.trim()) return process.env.AI_VISION_MODEL.trim();
  if (process.env.AI_MODEL?.trim()) return process.env.AI_MODEL.trim();
  return useCloudflare ? "@cf/google/gemma-4-26b-a4b-it" : getAIConfig().ollama.visionModel;
}

/**
 * Returns the currently active AI provider instance.
 */
export function getActiveAIProvider(): AIProvider {
  return activeProvider;
}

/**
 * Checks whether AI capability is enabled and configured in the environment.
 * Pure configuration check: performs zero network calls.
 */
export function isAIConfigured(): boolean {
  return activeProvider.isConfigured();
}

/**
 * Probes the reachability and model health of the active provider.
 * Bound to a short network timeout; safe to call without crashing.
 *
 * Cached for 60 seconds: the same probe was issued before every AI feature
 * call (referee report, document check, coach assistant), doubling the latency
 * of every AI action on a slow provider. A short TTL keeps the signal fresh
 * while removing the redundant round-trip.
 */
let availabilityCache: { at: number; result: AIAvailabilityResult } | null = null;
const AVAILABILITY_TTL_MS = 60_000;

export async function checkAIAvailability(options?: { force?: boolean }): Promise<AIAvailabilityResult> {
  const now = Date.now();
  if (!options?.force && availabilityCache && now - availabilityCache.at < AVAILABILITY_TTL_MS) {
    return availabilityCache.result;
  }
  const result = await activeProvider.checkAvailability();
  availabilityCache = { at: now, result };
  return result;
}

/**
 * Low-level text completion call for application features.
 * Validates system instructions and user input without granting database or environment access.
 */
export async function runAICompletion(params: {
  system: string;
  input: string;
  maxTokens?: number;
  timeoutMs?: number;
  images?: string[];
  model?: string;
}): Promise<string> {
  const request = {
    system: params.system,
    prompt: params.input,
    maxTokens: params.maxTokens,
    timeoutMs: params.timeoutMs,
    images: params.images,
    model: params.model
  };

  // One retry for transient provider failures (network blip, 5xx, cold start).
  // Quota exhaustion and disabled AI are not retried: they will fail the same
  // way and would double the user's wait for nothing.
  try {
    const result = await activeProvider.generateText(request);
    return result.text;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    const retryable = code === "AI_UNAVAILABLE" || code === "AI_TIMEOUT";
    if (!retryable) throw error;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const retry = await activeProvider.generateText(request);
    return retry.text;
  }
}
