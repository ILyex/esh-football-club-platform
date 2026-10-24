import { NextResponse } from "next/server";
import { getPublicNewsArticle } from "@/lib/public/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const article = await getPublicNewsArticle(slug, locale);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(article, { headers: { "Cache-Control": "no-store" } });
}
