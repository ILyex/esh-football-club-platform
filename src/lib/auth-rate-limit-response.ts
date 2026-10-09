/** Expose credential throttling as HTTP 429 for API clients and security scanners. */
export async function toAuthRateLimitResponse(request: Request, response: Response): Promise<Response> {
  if (new URL(request.url).pathname !== "/api/auth/callback/credentials") return response;

  let redirectUrl = response.headers.get("location");
  if (!redirectUrl) {
    try {
      const body: unknown = await response.clone().json();
      if (body && typeof body === "object" && "url" in body && typeof body.url === "string") {
        redirectUrl = body.url;
      }
    } catch {
      return response;
    }
  }
  if (!redirectUrl) return response;

  let redirect: URL;
  try {
    redirect = new URL(redirectUrl, request.url);
  } catch {
    return response;
  }
  if (redirect.searchParams.get("error") !== "CredentialsSignin" || redirect.searchParams.get("code") !== "rate_limited") {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("location");
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("retry-after", "900");
  return new Response(JSON.stringify({ error: "Too many login attempts", retryAfter: 900 }), { status: 429, headers });
}
