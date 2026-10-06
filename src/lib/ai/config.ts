import "server-only";

// ============================================================================
// AI ENGINE CONFIGURATION
// ----------------------------------------------------------------------------
// Loads and validates operational configuration for local Ollama inference.
// Guarantees safe defaults and sanitizes endpoints.
// ============================================================================

export interface AIConfig {
  enabled: boolean;
  provider: "ollama";
  ollama: {
    baseUrl: string;
    model: string;
    visionModel: string;
    keepAlive: string;
    timeoutMs: number;
    maxOutputTokens: number;
    temperature: number;
  };
}

function sanitizeBaseUrl(rawUrl?: string): string {
  if (!rawUrl || !rawUrl.trim()) {
    return "http://127.0.0.1:11434";
  }
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "http://127.0.0.1:11434";
    }
    // Remove trailing slash
    return trimmed.replace(/\/+$/, "");
  } catch {
    return "http://127.0.0.1:11434";
  }
}

export function getAIConfig(): AIConfig {
  // AI is opt-in. This prevents accidental Ollama calls on cPanel or another
  // host where the local endpoint is unavailable.
  const enabled = process.env.AI_ENABLED === "true" || process.env.AI_ENABLED === "1";

  const baseUrl = sanitizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";
  const visionModel = process.env.OLLAMA_VISION_MODEL?.trim() || "llava:7b";
  // Keep the model warm briefly without occupying most of a 4GB machine all day.
  const keepAlive = process.env.OLLAMA_KEEP_ALIVE?.trim() || "2m";

  const rawTimeout = parseInt(process.env.OLLAMA_TIMEOUT_MS || "30000", 10);
  const timeoutMs = isNaN(rawTimeout) || rawTimeout < 1000 ? 30000 : Math.min(rawTimeout, 120000);

  const rawTokens = parseInt(process.env.OLLAMA_MAX_OUTPUT_TOKENS || "2048", 10);
  const maxOutputTokens = isNaN(rawTokens) || rawTokens < 64 ? 2048 : Math.min(rawTokens, 8192);

  const rawTemp = parseFloat(process.env.OLLAMA_TEMPERATURE || "0.2");
  const temperature = isNaN(rawTemp) ? 0.2 : Math.max(0.0, Math.min(rawTemp, 1.0));

  return {
    enabled,
    provider: "ollama",
    ollama: {
      baseUrl,
      model,
      visionModel,
      keepAlive,
      timeoutMs,
      maxOutputTokens,
      temperature
    }
  };
}
