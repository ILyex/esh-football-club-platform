"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { sanitizeReturnTo } from "@/lib/team-switcher-security";
import { loginSchema } from "@/lib/validations/auth";

export type LoginFormState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rawCallbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");
  const callbackUrl = sanitizeReturnTo(rawCallbackUrl, "/dashboard");

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const invalidEmail = parsed.error.issues.some((issue) => issue.path[0] === "email");
    return { error: invalidEmail ? "invalid_email" : "invalid_password" };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          error: (error as AuthError & { code?: string }).code === "rate_limited"
            ? "rate_limited"
            : "invalid_credentials"
        };
      }

      // Keep internal details out of the response, but distinguish service
      // failures from rejected credentials so a database/configuration outage
      // is not misreported as a user's password problem.
      console.error(`[auth] sign-in service error: ${error.type}`);
      return { error: "login_unavailable" };
    }
    throw error; // NEXT_REDIRECT and similar framework signals must re-throw
  }
}
