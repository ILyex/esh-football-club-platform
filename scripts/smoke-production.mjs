const baseUrl = (process.env.SMOKE_BASE_URL || "https://esh-platform-vercel-preview.vercel.app").replace(/\/+$/, "");
const timeoutMs = 15_000;

const checks = [
  {
    path: "/api/health?type=liveness",
    verify: async (response) => {
      const body = await response.json();
      return body.status === "healthy" && body.probe === "liveness";
    }
  },
  {
    path: "/api/health?type=readiness",
    verify: async (response) => {
      const body = await response.json();
      return body.status === "healthy" && body.services?.database === "connected";
    }
  },
  ...["/ar", "/fr"].map((path) => ({
    path,
    verify: async (response) => {
      const contentType = response.headers.get("content-type") || "";
      const html = await response.text();
      return contentType.includes("text/html") && html.length > 10_000 && /<html[\s>]/i.test(html);
    }
  }))
];

let failed = false;
for (const check of checks) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "esh-production-smoke/1.0" }
    });
    const passed = response.ok && await check.verify(response);
    const elapsedMs = Math.round(performance.now() - started);
    console.log(`${passed ? "PASS" : "FAIL"} ${check.path} HTTP ${response.status} ${elapsedMs}ms`);
    if (!passed) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.path} ${Math.round(performance.now() - started)}ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exitCode = 1;
