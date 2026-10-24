import { NextResponse } from "next/server";
import { getPublicAlbumDetail } from "@/lib/public/gallery";
import { frenchPublicText } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const rawAlbum = await getPublicAlbumDetail(id);
  const album = rawAlbum && locale === "fr" ? {
    ...rawAlbum,
    name: frenchPublicText(rawAlbum.name, "Album du club"),
    description: rawAlbum.description ? frenchPublicText(rawAlbum.description, "Photos du club") : null,
    samplePhotos: rawAlbum.samplePhotos.map((photo) => ({ ...photo, caption: photo.caption ? frenchPublicText(photo.caption, "Photo du club") : null })),
    photos: rawAlbum.photos.map((photo) => ({ ...photo, caption: photo.caption ? frenchPublicText(photo.caption, "Photo du club") : null }))
  } : rawAlbum;
  if (!album) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(album, { headers: { "Cache-Control": "no-store" } });
}
