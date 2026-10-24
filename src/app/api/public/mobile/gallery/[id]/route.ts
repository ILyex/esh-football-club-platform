import { NextResponse } from "next/server";
import { getPublicAlbumDetail } from "@/lib/public/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const album = await getPublicAlbumDetail(id);
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(album, { headers: { "Cache-Control": "no-store" } });
}
