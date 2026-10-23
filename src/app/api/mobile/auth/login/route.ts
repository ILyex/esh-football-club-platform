import { NextResponse } from "next/server";
import { authenticatePlatformCredentials } from "@/lib/credentials-auth";
import { canUseNativeMatchday, createNativeSessionToken } from "@/lib/native-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return NextResponse.json({ error: "invalid_request" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const user = await authenticatePlatformCredentials(body, request);
    if (!user) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    if (!canUseNativeMatchday(user)) return NextResponse.json({ error: "admin_access_required" }, { status: 403 });
    const rememberMe = body.rememberMe === true || body.rememberMe === "true";
    const session = await createNativeSessionToken(user, rememberMe);
    return NextResponse.json({ ...session, user: { id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, firstNameFr: user.firstNameFr, lastNameFr: user.lastNameFr, dateOfBirth: user.dateOfBirth, bloodGroup: user.bloodGroup, email: user.email, image: user.image, licenseNumber: user.licenseNumber, licenseRole: user.licenseRole, roleKey: user.roleKey, roleName: user.roleName, permissions: user.permissions } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    if (code === "rate_limited") return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
    if (code === "captcha_unavailable") return NextResponse.json({ error: "captcha_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (code === "captcha_required") return NextResponse.json({ error: "captcha_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ error: "login_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
