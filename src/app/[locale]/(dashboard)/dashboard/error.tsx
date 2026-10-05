"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, ArrowRight, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isForbidden =
    error.message?.toLowerCase().includes("forbidden") ||
    error.name === "ForbiddenError" ||
    error.message?.includes("VERIFY_REJECT");

  useEffect(() => {
    console.error("[Dashboard Error Boundary]:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
        <ShieldAlert className="h-8 w-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading mb-2">
        {isForbidden ? "وصول غير مصرّح به (403)" : "حدث خطأ غير متوقع"}
      </h1>

      <p className="max-w-md text-sm text-muted-foreground leading-relaxed mb-6">
        {isForbidden
          ? "حسابك لا يملك الصلاحيات الإدارية الكافية للوصول إلى هذا القسم أو تنفيذ هذا الإجراء في النظام الرقابي لنادي أمل سيدي حسني."
          : (error.message || "تعذر إتمام العملية المطلوبة، يرجى المحاولة مرة أخرى أو مراجعة إدارة النظام.")}
      </p>

      <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
        <Button variant="outline" size="default" onClick={() => reset()} className="h-9 w-full min-w-36 px-3 text-xs sm:w-36">
          <RefreshCw className="h-4 w-4" />
          <span>إعادة المحاولة</span>
        </Button>

        <Link href="/ar/dashboard" className="w-full sm:w-36">
          <Button size="default" className="h-9 w-full min-w-36 px-3 text-xs">
            <Home className="h-4 w-4" />
            <span>العودة للرئيسية</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
