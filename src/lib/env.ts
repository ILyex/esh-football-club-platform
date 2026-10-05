import "server-only";

// ============================================================================
// PHASE 13 — PRODUCTION ENVIRONMENT VALIDATOR & FAIL-FAST AUDIT
// ----------------------------------------------------------------------------
// Enforces security invariants, validates environment variables, and ensures
// that production deployments fail fast on missing secrets or insecure defaults.
// ============================================================================

export interface EnvironmentValidationResult {
  ok: boolean;
  isProduction: boolean;
  issues: string[];
  warnings: string[];
}

const INSECURE_DEFAULT_SECRETS = [
  "replace-with-a-random-32-byte-secret",
  "secret",
  "changeme",
  "1234567890",
  "supersecret"
];

/**
 * Validates the runtime environment against production security invariants.
 * Safe to call at startup or in health checks.
 */
export function validateEnvironment(customEnv?: Record<string, string | undefined>): EnvironmentValidationResult {
  const env = customEnv ?? process.env;
  const isProduction = env.NODE_ENV === "production";
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Database Connection Invariant
  const dbUrl = env.DATABASE_URL?.trim();
  if (!dbUrl) {
    issues.push("DATABASE_URL is required but is missing or empty.");
  } else if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    issues.push("DATABASE_URL must be a valid PostgreSQL connection URI starting with postgresql:// or postgres://.");
  } else if (isProduction && !dbUrl.includes("sslmode=") && !dbUrl.includes("ssl=")) {
    warnings.push("DATABASE_URL does not specify an explicit sslmode in production.");
  }

  // 2. Authentication Secret Invariant
  const authSecret = env.AUTH_SECRET?.trim();
  if (!authSecret) {
    if (isProduction) {
      issues.push("AUTH_SECRET is strictly required in production for secure session signing.");
    } else {
      warnings.push("AUTH_SECRET is not configured; local sessions may use ephemeral keys.");
    }
  } else {
    if (INSECURE_DEFAULT_SECRETS.includes(authSecret.toLowerCase())) {
      issues.push("AUTH_SECRET is using an insecure default or placeholder value.");
    }
    if (authSecret.length < 32) {
      if (isProduction) {
        issues.push("AUTH_SECRET has insufficient entropy (must be at least 32 characters in production).");
      } else {
        warnings.push("AUTH_SECRET has less than 32 characters.");
      }
    }
  }

  // 3. Background Jobs / Cron Secret Invariant
  const cronSecret = env.CRON_SECRET?.trim();
  if (isProduction && !cronSecret) {
    issues.push("CRON_SECRET is strictly required in production to protect the background jobs cron endpoint.");
  } else if (cronSecret && cronSecret.length < 16) {
    warnings.push("CRON_SECRET has less than 16 characters; consider using a longer random secret.");
  }

  // 4. Object Storage Invariant (Private vs Public Bucket Separation)
  const privateBucket = env.STORAGE_PRIVATE_BUCKET?.trim();
  const publicBucket = env.STORAGE_PUBLIC_BUCKET?.trim();
  if (privateBucket && publicBucket && privateBucket === publicBucket) {
    issues.push("STORAGE_PRIVATE_BUCKET and STORAGE_PUBLIC_BUCKET must NOT be the same bucket (isolation violation).");
  }
  if (isProduction) {
    if (!privateBucket) {
      issues.push("STORAGE_PRIVATE_BUCKET is strictly required in production for secure private document storage.");
    }
  } else {
    if (!privateBucket) {
      warnings.push("STORAGE_PRIVATE_BUCKET is not configured; using secure local filesystem private storage in development.");
    }
  }

  // 5. Gmail Module Security Invariant
  const hasGoogleClientId = Boolean(env.GOOGLE_CLIENT_ID?.trim());
  const hasGoogleClientSecret = Boolean(env.GOOGLE_CLIENT_SECRET?.trim());
  const hasEncryptionKey = Boolean(env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim());

  if (hasGoogleClientId || hasGoogleClientSecret) {
    if (!hasGoogleClientId || !hasGoogleClientSecret) {
      issues.push("Incomplete Google OAuth config: both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be provided.");
    }
    if (!hasEncryptionKey) {
      issues.push("GMAIL_TOKEN_ENCRYPTION_KEY is required when Google OAuth is configured (to encrypt refresh tokens).");
    } else if ((env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim().length ?? 0) < 32) {
      issues.push("GMAIL_TOKEN_ENCRYPTION_KEY must have at least 32 characters (256-bit AES key).");
    }
  }

  // 6. FAF Connect Integration Invariant
  const fafEnabled = env.FAF_ENABLED === "true";
  if (fafEnabled) {
    if (!env.FAF_PORTAL_URL?.trim()) {
      issues.push("FAF_PORTAL_URL is required when FAF_ENABLED is true.");
    }
  }

  // 7. AI Subsystem Invariant
  const aiEnabled = env.AI_ENABLED !== "false" && env.AI_ENABLED !== "0";
  if (aiEnabled && env.OLLAMA_BASE_URL) {
    const rawUrl = env.OLLAMA_BASE_URL.trim();
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      warnings.push(`OLLAMA_BASE_URL has non-standard protocol: ${rawUrl}`);
    }
  }

  return {
    ok: issues.length === 0,
    isProduction,
    issues,
    warnings
  };
}

/**
 * Asserts production environment validity, throwing an error if critical invariants fail.
 */
export function assertProductionEnvironment(): void {
  const result = validateEnvironment();
  if (!result.ok && result.isProduction) {
    throw new Error(`Production environment configuration error:\n${result.issues.map((i) => ` - ${i}`).join("\n")}`);
  }
}

/**
 * Returns safe non-sensitive configuration status of storage subsystem.
 * Strictly outputs "configured" | "missing" — never prints keys, tokens or secrets.
 */
export function getStorageConfigurationSummary(): {
  privateBucket: "configured" | "missing";
  s3Endpoint: "configured" | "missing";
  s3AccessKey: "configured" | "missing";
  s3SecretKey: "configured" | "missing";
} {
  return {
    privateBucket: process.env.STORAGE_PRIVATE_BUCKET?.trim() ? "configured" : "missing",
    s3Endpoint: process.env.STORAGE_ENDPOINT?.trim() ? "configured" : "missing",
    s3AccessKey: process.env.STORAGE_ACCESS_KEY_ID?.trim() ? "configured" : "missing",
    s3SecretKey: process.env.STORAGE_SECRET_ACCESS_KEY?.trim() ? "configured" : "missing"
  };
}

