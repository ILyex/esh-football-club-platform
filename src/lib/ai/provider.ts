import "server-only";
import { AIProvider, AIAvailabilityResult } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { CloudflareWorkersAIProvider } from "./providers/cloudflare-workers-ai";

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
 */
export async function checkAIAvailability(): Promise<AIAvailabilityResult> {
  return activeProvider.checkAvailability();
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
  const result = await activeProvider.generateText({
    system: params.system,
    prompt: params.input,
    maxTokens: params.maxTokens,
    timeoutMs: params.timeoutMs,
    images: params.images,
    model: params.model
  });
  return result.text;
}
