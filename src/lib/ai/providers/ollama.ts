import "server-only";
import { z } from "zod";
import { AIProvider, AITextGenerationParams, AITextGenerationResult, AIStructuredGenerationParams, AIAvailabilityResult, AIError } from "../types";
import { getAIConfig } from "../config";

// ============================================================================
// OLLAMA LOCAL AI PROVIDER
// ----------------------------------------------------------------------------
// Pure HTTP client utilizing native fetch with explicit timeouts, connection
// resilience, SSRF protection, and error normalization.
// Never exposes endpoint credentials or internal network topologies to the client.
// ============================================================================

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama";

  public isConfigured(): boolean {
    const config = getAIConfig();
    return config.enabled && Boolean(config.ollama.baseUrl) && Boolean(config.ollama.model);
  }

  /**
   * Safe reachability and model availability check.
   * Never runs expensive text inference simply to probe health.
   * Bound to a short 2500ms timeout.
   */
  public async checkAvailability(): Promise<AIAvailabilityResult> {
    const config = getAIConfig();
    if (!config.enabled) {
      return { available: false, error: "AI is explicitly disabled via configuration" };
    }

    try {
      const response = await fetch(`${config.ollama.baseUrl}/api/tags`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2500)
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Ollama returned HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const modelList = Array.isArray(data.models) ? data.models.map((m) => m.name) : [];

      const targetModel = config.ollama.model.toLowerCase();
      const modelFound = modelList.some(
        (m) => m.toLowerCase() === targetModel || m.toLowerCase().startsWith(`${targetModel}:`)
      );

      return {
        available: true,
        modelFound,
        details: {
          models: modelList
        }
      };
    } catch (err: any) {
      return {
        available: false,
        error: err.name === "TimeoutError" ? "Health check timed out (2500ms)" : "Ollama service is unreachable"
      };
    }
  }

  /**
   * Generates text via Ollama `/api/generate`.
   * Enforces timeout and maximum output size.
   */
  public async generateText(params: AITextGenerationParams): Promise<AITextGenerationResult> {
    const config = getAIConfig();

    if (!config.enabled) {
      throw new AIError("AI_DISABLED", "AI capability is disabled via configuration");
    }

    if (!this.isConfigured()) {
      throw new AIError("AI_NOT_CONFIGURED", "Ollama provider is not configured properly");
    }

    const timeoutMs = Math.max(1000, Math.min(params.timeoutMs ?? config.ollama.timeoutMs, 120_000));
    const maxTokens = Math.max(1, Math.min(params.maxTokens ?? config.ollama.maxOutputTokens, 8192));
    const temperature = Math.max(0, Math.min(params.temperature ?? config.ollama.temperature, 1));
    if (params.system.length > 16_000 || params.prompt.length > 64_000) {
      throw new AIError("AI_BAD_REQUEST", "Ollama prompt exceeds the configured input limit");
    }
    if (params.images?.some((image) => image.length > 14_000_000)) {
      throw new AIError("AI_BAD_REQUEST", "An image exceeds the 10 MB encoded input limit");
    }

    const requestBody: Record<string, unknown> = {
      model: params.model || config.ollama.model,
      system: params.system,
      prompt: params.prompt,
      stream: false,
      keep_alive: config.ollama.keepAlive,
      options: {
        temperature,
        num_predict: maxTokens
      }
    };
    if (params.images && params.images.length > 0) {
      requestBody.images = params.images.map((image) => image.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, ""));
    }

    let response: Response;
    try {
      response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("aborted")) {
        throw new AIError("AI_TIMEOUT", `Ollama inference timed out after ${timeoutMs}ms`, err);
      }
      throw new AIError("AI_UNAVAILABLE", "Failed to connect to local Ollama service", err);
    }

    if (response.status === 404) {
      throw new AIError(
        "AI_MODEL_NOT_FOUND",
        `Configured model '${config.ollama.model}' was not found in local Ollama instance. Run 'ollama pull ${config.ollama.model}'`
      );
    }

    if (!response.ok) {
      throw new AIError(
        "AI_BAD_REQUEST",
        `Ollama returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch (err) {
      throw new AIError("AI_PARSE_ERROR", "Ollama returned malformed or non-JSON response", err);
    }

    const text = typeof payload.response === "string" ? payload.response : "";

    // Defense against memory exhaustion / runaway response amplification
    if (text.length > 64000) {
      throw new AIError("AI_RESPONSE_TOO_LARGE", "Ollama response exceeded maximum allowable size (64KB)");
    }

    return {
      text,
      model: payload.model || config.ollama.model,
      provider: this.name,
      finishReason: payload.done_reason
    };
  }

  /**
   * Generates machine-readable output validated with Zod.
   */
  public async generateStructured<T>(params: AIStructuredGenerationParams<T>): Promise<T> {
    const config = getAIConfig();

    if (!config.enabled) {
      throw new AIError("AI_DISABLED", "AI capability is disabled via configuration");
    }

    if (!this.isConfigured()) {
      throw new AIError("AI_NOT_CONFIGURED", "Ollama provider is not configured properly");
    }
    const timeoutMs = Math.max(1000, Math.min(params.timeoutMs ?? config.ollama.timeoutMs, 120_000));
    let schemaKeysHint = "";
    if (params.schema instanceof z.ZodObject) {
      const keys = Object.keys(params.schema.shape);
      if (keys.length > 0) {
        schemaKeysHint = ` Expected JSON structure with keys: ${keys.join(", ")}.`;
      }
    }
    const systemWithJsonRule = `${params.system}\n\nIMPORTANT: You must respond ONLY with a valid, raw JSON object matching the requested schema.${schemaKeysHint} Do not enclose in markdown code blocks or add explanatory prose.`;

    if (params.system.length > 16_000 || params.prompt.length > 64_000) {
      throw new AIError("AI_BAD_REQUEST", "Ollama prompt exceeds the configured input limit");
    }

    const requestBody = {
      model: config.ollama.model,
      system: systemWithJsonRule,
      prompt: params.prompt,
      format: "json",
      stream: false,
      keep_alive: config.ollama.keepAlive,
      options: {
        temperature: Math.max(0, Math.min(params.temperature ?? 0.1, 1)),
        num_predict: config.ollama.maxOutputTokens
      }
    };

    let response: Response;
    try {
      response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("aborted")) {
        throw new AIError("AI_TIMEOUT", `Structured generation timed out after ${timeoutMs}ms`, err);
      }
      throw new AIError("AI_UNAVAILABLE", "Failed to connect to local Ollama service", err);
    }

    if (!response.ok) {
      throw new AIError("AI_BAD_REQUEST", `Ollama returned HTTP ${response.status}`);
    }

    let payload: { response?: unknown };
    try {
      payload = (await response.json()) as { response?: unknown };
    } catch (err) {
      throw new AIError("AI_PARSE_ERROR", "Ollama returned malformed or non-JSON response", err);
    }
    if (typeof payload.response !== "string" || payload.response.length > 64_000) {
      throw new AIError("AI_RESPONSE_TOO_LARGE", "Ollama structured response is missing or exceeds 64 KB");
    }
    const rawText = (payload.response || "").trim();

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (err) {
      throw new AIError("AI_PARSE_ERROR", "Failed to parse structured JSON from model output", err);
    }

    const validationResult = params.schema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new AIError(
        "AI_PARSE_ERROR",
        `Model output failed schema validation: ${validationResult.error.message}`
      );
    }

    return validationResult.data;
  }
}
