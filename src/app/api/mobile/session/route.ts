import { NextResponse } from "next/server";
import { getNativePrincipal, revokeNativeSession } from "@/lib/native-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ user: { id: user.id, name: user.name, firstName: user.firstName, lastName: user.lastName, dateOfBirth: user.dateOfBirth?.toISOString() ?? null, bloodGroup: user.bloodGroup, email: user.email, image: user.image, licenseNumber: user.licenseNumber, licenseRole: user.licenseRole, roleKey: user.roleKey, roleName: user.roleName, permissions: user.permissions } }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await revokeNativeSession(request, user.id);
  return new Response(null, { status: 204 });
}
