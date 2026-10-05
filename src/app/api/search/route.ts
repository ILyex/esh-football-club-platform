import { NextResponse } from "next/server";
import { executeGlobalSearch } from "@/lib/search/search-service";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionOrThrow } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const user = await getSessionOrThrow();
    const rl = await checkRateLimit({ key: `search:user:${user.id}`, limit: 60, windowMs: 60 * 1000 });

    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many search requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(Math.max(1, (rl.resetTimeMs - Date.now()) / 1000)).toString()
          }
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const locale = searchParams.get("locale") || "ar";
    const category = searchParams.get("category") || undefined;

    const response = await executeGlobalSearch(q, {
      locale,
      filterCategory: category,
      limitPerCategory: 6,
      user
    });

    return NextResponse.json(response);
  } catch (err: any) {
    if (err.message === "Unauthenticated" || err.message?.includes("Forbidden")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
