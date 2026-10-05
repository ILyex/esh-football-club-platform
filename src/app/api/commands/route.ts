import "server-only";

import { NextResponse } from "next/server";
import { getSessionOrThrow, toHttpErrorResponse } from "@/lib/permissions";
import { getAuthorizedCommands } from "@/lib/commands/command-registry";
import { getAttentionItems } from "@/lib/commands/attention-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getSessionOrThrow();
    const url = new URL(request.url);
    const locale = url.searchParams.get("locale") || "ar";

    const { navigation, actions } = getAuthorizedCommands(user, locale);
    const attention = await getAttentionItems(user, locale);

    return NextResponse.json({
      navigation,
      actions,
      attention
    });
  } catch (err: any) {
    const authResponse = toHttpErrorResponse(err);
    if (authResponse) return authResponse;
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
