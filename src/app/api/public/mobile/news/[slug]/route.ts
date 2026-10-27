import { NextResponse } from "next/server";
import { getPublicNewsArticle } from "@/lib/public/news";
import { frenchPublicText } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const article = await getPublicNewsArticle(slug, locale);
  if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const localized = locale === "fr" ? {
    ...article,
    title: frenchPublicText(article.title, "Actualité du club"),
    content: frenchPublicText(article.content, "Le contenu de cet article n’est pas disponible en français."),
    category: article.category ? frenchPublicText(article.category, "Club") : null
  } : article;
  return NextResponse.json(localized, { headers: { "Cache-Control": "no-store" } });
}
