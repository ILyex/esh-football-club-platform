"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeReturnTo } from "@/lib/team-switcher-security";
import { loginSchema } from "@/lib/validations/auth";

export type LoginFormState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const localeValue = String(formData.get("locale") ?? "ar");
  const locale = localeValue === "fr" ? "fr" : "ar";
  const publicSiteOnly = process.env.PUBLIC_SITE_ONLY === "true" || process.env.PUBLIC_SITE_ONLY === "1";
  // A bare login entry is intended for match operators. Dashboard visits
  // still retain their explicit callbackUrl from the protected-route gate.
  const defaultDestination = `/${locale}/field/matches`;
  const rawCallbackUrl = String(formData.get("callbackUrl") ?? "").trim();
  const callbackTargetsHiddenDashboard = publicSiteOnly && /^\/(?:(?:ar|fr)\/)?dashboard(?:\/|$)/.test(rawCallbackUrl);
  const callbackUrl = callbackTargetsHiddenDashboard
    ? defaultDestination
    : sanitizeReturnTo(rawCallbackUrl, defaultDestination);
  const rememberMe = formData.get("rememberMe") === "on";

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const invalidEmail = parsed.error.issues.some((issue) => issue.path[0] === "email");
    return { error: invalidEmail ? "invalid_email" : "invalid_password" };
  }

  try {
    const redirectUrl = await signIn("credentials", {
      email,
      password,
      rememberMe: String(rememberMe),
      redirect: false,
      redirectTo: callbackUrl
    });

    if (!rememberMe) {
      const cookieStore = await cookies();
      for (const cookie of cookieStore.getAll()) {
        if (!/^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(cookie.name)) continue;
        cookieStore.set(cookie.name, cookie.value, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: cookie.name.startsWith("__Secure-")
        });
      }
    }

    redirect(redirectUrl);
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
