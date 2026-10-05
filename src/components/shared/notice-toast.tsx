"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/**
 * Server actions that need to report an outcome the current page's normal
 * render can't express (e.g. "saved but not activated — 2 fields still
 * unmapped") redirect back to the same URL with `?notice=<key>`. This
 * component looks up `<key>` under the "notices" i18n namespace once on
 * mount, shows it as a toast, then strips the param so a refresh doesn't
 * repeat it. Keys under "notices.errors.*" render as error toasts;
 * everything else renders as success.
 *
 * Finance pages pass fully-qualified keys instead ("finance.errors.<CODE>" /
 * "finance.success.<KEY>") so the finance module keeps a single message
 * namespace; those resolve against the root and follow the same
 * error-vs-success rule.
 */
export function NoticeToast({ notice }: { notice?: string }) {
  const t = useTranslations("notices");
  const tRoot = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!notice) return;
    const isFinance = notice.startsWith("finance.");
    const isError = notice.startsWith("errors.") || notice.startsWith("finance.errors.");
    let message: string;
    try {
      message = isFinance ? tRoot(notice as any) : t(notice as any);
    } catch {
      return; // unknown key — never show a raw code to the user
    }
    if (isError) toast.error(message);
    else toast.success(message);

    const remainingParams = new URLSearchParams(searchParams.toString());
    remainingParams.delete("notice");
    const query = remainingParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever re-run when the notice itself changes
  }, [notice]);

  return null;
}
