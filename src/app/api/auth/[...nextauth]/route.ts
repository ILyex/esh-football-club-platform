import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { toAuthRateLimitResponse } from "@/lib/auth-rate-limit-response";

export const GET = handlers.GET;

export async function POST(request: NextRequest) {
  const response = await handlers.POST(request);
  return toAuthRateLimitResponse(request, response);
}
