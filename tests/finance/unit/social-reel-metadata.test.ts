import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { resolveSocialReelMetadata } from "@/lib/social-reel-metadata";
import { getReelScrollDelta, getSocialReelEmbedUrl } from "@/lib/social-reels";
import { toAuthRateLimitResponse } from "@/lib/auth-rate-limit-response";

const originalFetch = globalThis.fetch;
const originalMetaToken = process.env.META_OEMBED_ACCESS_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalMetaToken === undefined) delete process.env.META_OEMBED_ACCESS_TOKEN;
  else process.env.META_OEMBED_ACCESS_TOKEN = originalMetaToken;
});

test("Instagram reel embeds request the caption-free compact layout", () => {
  assert.equal(
    getSocialReelEmbedUrl({ url: "https://www.instagram.com/reel/ABC123/", platform: "instagram" }),
    "https://www.instagram.com/reel/ABC123/embed?hidecaption=true"
  );
});

test("desktop reel arrows scroll one card in their physical direction", () => {
  assert.equal(getReelScrollDelta("left", 320), -320);
  assert.equal(getReelScrollDelta("right", 320), 320);
});

test("credentials callback exposes account lockout as HTTP 429", async () => {
  const request = new Request("https://example.test/api/auth/callback/credentials", { method: "POST" });
  const response = Response.json({ url: "https://example.test/ar/login?error=CredentialsSignin&code=rate_limited" });
  const limited = await toAuthRateLimitResponse(request, response);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "900");
  assert.deepEqual(await limited.json(), { error: "Too many login attempts", retryAfter: 900 });
});

test("credentials callback leaves ordinary authentication responses unchanged", async () => {
  const request = new Request("https://example.test/api/auth/callback/credentials", { method: "POST" });
  const response = Response.json({ url: "https://example.test/ar/login?error=CredentialsSignin&code=credentials" }, { status: 200 });
  const result = await toAuthRateLimitResponse(request, response);
  assert.equal(result.status, 200);
  assert.match((await result.json()).url, /code=credentials/);
});

test("Instagram metadata prefers official Meta oEmbed title when configured", async () => {
  process.env.META_OEMBED_ACCESS_TOKEN = "audit-test-token";
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return Response.json({ title: "Match day highlights" });
  }) as typeof fetch;

  const result = await resolveSocialReelMetadata("https://www.instagram.com/reel/ABC123/", "instagram");
  assert.equal(result.title, "Match day highlights");
  assert.equal(result.url, "https://www.instagram.com/reel/ABC123/");
  assert.match(new URL(requestedUrl).pathname, /instagram_oembed$/);
  assert.equal(new URL(requestedUrl).searchParams.get("access_token"), "audit-test-token");
});

test("Instagram metadata uses public Meta oEmbed without requiring an access token", async () => {
  delete process.env.META_OEMBED_ACCESS_TOKEN;
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return Response.json({ title: "Public Instagram reel title" });
  }) as typeof fetch;

  const result = await resolveSocialReelMetadata("https://www.instagram.com/reel/ABC123/", "instagram");
  const parsedUrl = new URL(requestedUrl);
  assert.equal(result.title, "Public Instagram reel title");
  assert.equal(parsedUrl.searchParams.get("access_token"), null);
  assert.equal(parsedUrl.searchParams.get("maxwidth"), "420");
});

test("Instagram metadata reads a public Open Graph description when oEmbed is unavailable", async () => {
  delete process.env.META_OEMBED_ACCESS_TOKEN;
  globalThis.fetch = (async () => new Response(
    '<html><head><meta property="og:title" content="Instagram"><meta property="og:description" content="A public training session"></head></html>',
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  )) as typeof fetch;

  const result = await resolveSocialReelMetadata("https://www.instagram.com/reel/ABC123/", "instagram");
  assert.equal(result.title, "A public training session");
});
