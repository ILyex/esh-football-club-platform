import "server-only";
import path from "node:path";

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
    issues.push("DATABASE_URL must specify SSL explicitly in production (for example sslmode=require).");
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

  const poolMax = env.DATABASE_POOL_MAX?.trim();
  if (poolMax && (!/^\d+$/.test(poolMax) || Number(poolMax) < 1 || Number(poolMax) > 20)) {
    issues.push("DATABASE_POOL_MAX must be an integer between 1 and 20 per application process.");
  }

  // 3. Background Jobs / Cron Secret Invariant
  const cronSecret = env.CRON_SECRET?.trim();
  if (isProduction && !cronSecret) {
    issues.push("CRON_SECRET is strictly required in production to protect the background jobs cron endpoint.");
  } else if (cronSecret && cronSecret.length < 32) {
    if (isProduction) {
      issues.push("CRON_SECRET must be at least 32 characters in production.");
    } else {
      warnings.push("CRON_SECRET has less than 32 characters; use a longer random secret for production.");
    }
  }

  // Auth.js and middleware need a public origin for redirects and callbacks.
  // Reject localhost in production so cPanel/Passenger cannot redirect visitors
  // back to an operator's private machine or an internal app port.
  const publicAuthUrl = (env.AUTH_URL || env.NEXTAUTH_URL)?.trim();
  if (isProduction && env.AUTH_URL?.trim() && env.NEXTAUTH_URL?.trim() && env.AUTH_URL.trim() !== env.NEXTAUTH_URL.trim()) {
    issues.push("AUTH_URL and NEXTAUTH_URL must match exactly in production.");
  }
  if (isProduction && !publicAuthUrl) {
    issues.push("AUTH_URL (or NEXTAUTH_URL) must contain the public HTTPS origin in production.");
  } else if (isProduction && publicAuthUrl) {
    try {
      const parsed = new URL(publicAuthUrl);
      const localHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1" || parsed.hostname.endsWith(".localhost");
      if (parsed.protocol !== "https:" || localHost || parsed.username || parsed.password) {
        issues.push("AUTH_URL (or NEXTAUTH_URL) must be a public HTTPS origin without credentials.");
      }
    } catch {
      issues.push("AUTH_URL (or NEXTAUTH_URL) must be a valid public HTTPS URL.");
    }
  }

  // 4. Object Storage Invariant (Private vs Public Bucket Separation)
  const privateBucket = env.STORAGE_PRIVATE_BUCKET?.trim();
  const publicBucket = env.STORAGE_PUBLIC_BUCKET?.trim();
  const storageAccessKey = env.STORAGE_ACCESS_KEY_ID?.trim();
  const storageSecretKey = env.STORAGE_SECRET_ACCESS_KEY?.trim();
  const storageEndpoint = env.STORAGE_ENDPOINT?.trim();
  const storageDriver = env.STORAGE_DRIVER?.trim().toLowerCase() || "s3";
  const localStorageRoot = env.STORAGE_LOCAL_ROOT?.trim();
  if (storageDriver !== "s3" && storageDriver !== "local" && storageDriver !== "database" && storageDriver !== "db") {
    issues.push("STORAGE_DRIVER must be 's3', 'local', or 'database'.");
  }
  if (privateBucket && publicBucket && privateBucket === publicBucket) {
    issues.push("STORAGE_PRIVATE_BUCKET and STORAGE_PUBLIC_BUCKET must NOT be the same bucket (isolation violation).");
  }
  if (isProduction) {
    if (storageDriver === "local") {
      if (!localStorageRoot || !path.isAbsolute(localStorageRoot)) {
        issues.push("STORAGE_LOCAL_ROOT must be an absolute persistent directory when local storage is used in production.");
      } else {
        const normalizedRoot = path.resolve(localStorageRoot).replace(/\\/g, "/").toLowerCase();
        if (/(^|\/)public_html(\/|$)/.test(normalizedRoot)) {
          issues.push("STORAGE_LOCAL_ROOT must be outside public_html to prevent direct access to private documents.");
        }
        warnings.push("Local file storage is tied to one server and must be included in off-server backups.");
      }
    } else if (storageDriver === "database" || storageDriver === "db") {
      warnings.push("Private documents and public media use PostgreSQL storage; include asset tables in database backups.");
    } else {
      if (!privateBucket) {
        issues.push("STORAGE_PRIVATE_BUCKET is required in production for secure private document storage.");
      }
      if (!publicBucket) {
        issues.push("STORAGE_PUBLIC_BUCKET is required in production for public media storage.");
      }
      if ((privateBucket || publicBucket) && (!storageAccessKey || !storageSecretKey || !storageEndpoint)) {
        issues.push("STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, and STORAGE_ENDPOINT are required when S3 storage is configured.");
      }
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

  // Cap Core is on by default in production and uses a domain-separated key
  // derived from the required AUTH_SECRET. Local development opts in with
  // matching server/client flags so a developer can test without affecting
  // ordinary local sign-in.
  const captchaEnabled = isProduction || env.CAPTCHA_ENABLED === "true" || env.CAPTCHA_ENABLED === "1";
  const capSecret = env.CAP_SECRET?.trim();
  if (captchaEnabled && capSecret && capSecret.length < 32) {
    warnings.push("CAP_SECRET is shorter than 32 characters; use a high-entropy secret or leave it empty to derive one from AUTH_SECRET.");
  }
  const publicCaptchaEnabled = env.NEXT_PUBLIC_CAPTCHA_ENABLED === "true" || env.NEXT_PUBLIC_CAPTCHA_ENABLED === "1";
  if (!isProduction && captchaEnabled !== publicCaptchaEnabled) {
    warnings.push("CAPTCHA_ENABLED and NEXT_PUBLIC_CAPTCHA_ENABLED should both be enabled or disabled together.");
  }

  // 7. AI Subsystem Invariant
  // AI is opt-in. A missing flag must never activate Ollama implicitly.
  const aiEnabled = env.AI_ENABLED === "true" || env.AI_ENABLED === "1";
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
