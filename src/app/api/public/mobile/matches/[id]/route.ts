import { NextResponse } from "next/server";
import { getPublicMatchDetail } from "@/lib/public/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await getPublicMatchDetail(id);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
}
