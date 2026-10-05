import { z } from "zod";

// ============================================================================
// AI ENGINE INTERFACES & NORMALIZED TYPES
// ----------------------------------------------------------------------------
// Defines vendor-agnostic AI provider contracts for local Ollama and
// future open-weight models.
// ============================================================================

export type AIErrorCode =
  | "AI_DISABLED"
  | "AI_NOT_CONFIGURED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_MODEL_NOT_FOUND"
  | "AI_BAD_REQUEST"
  | "AI_PARSE_ERROR"
  | "AI_RESPONSE_TOO_LARGE";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}

export interface AITextGenerationParams {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Optional base64 images for vision-capable models. */
  images?: string[];
  /** Optional model override (e.g. a vision model). */
  model?: string;
}

export interface AITextGenerationResult {
  text: string;
  model: string;
  provider: string;
  finishReason?: string;
}

export interface AIStructuredGenerationParams<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  temperature?: number;
}

export interface AIAvailabilityResult {
  available: boolean;
  modelFound?: boolean;
  error?: string;
  details?: {
    version?: string;
    models?: string[];
  };
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  checkAvailability(): Promise<AIAvailabilityResult>;
  generateText(params: AITextGenerationParams): Promise<AITextGenerationResult>;
  generateStructured<T>(params: AIStructuredGenerationParams<T>): Promise<T>;
}
