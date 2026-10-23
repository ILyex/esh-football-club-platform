"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

interface ResizableSidebarProps {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  locale?: string;
}

export function ResizableSidebar({
  children,
  defaultWidth = 264, // 16.5rem / ~264px standard width
  minWidth = 220,
  maxWidth = 420,
  locale = "ar"
}: ResizableSidebarProps) {
  const [width, setWidth] = useState<number>(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const isRtl = locale === "ar";
  const sidebarRef = useRef<HTMLElement>(null);
  const widthRef = useRef<number>(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // Restore saved width from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem("esh_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setWidth(parsed);
        }
      }
    } catch {
      // Ignore localStorage issues
    }
  }, [minWidth, maxWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = defaultWidth;
      if (isRtl) {
        // In RTL, sidebar is on the right side of screen: dragging to the left increases width
        newWidth = window.innerWidth - e.clientX;
      } else {
        // In LTR, sidebar is on the left side of screen: dragging to the right increases width
        newWidth = e.clientX;
      }

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        localStorage.setItem("esh_sidebar_width", widthRef.current.toString());
      } catch {
        // Ignore
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isResizing, isRtl, minWidth, maxWidth, defaultWidth]);

  return (
    <aside
      ref={sidebarRef}
      data-dashboard-sidebar
      style={{ width: `${width}px` }}
      className="relative sticky top-0 z-40 flex w-full shrink-0 flex-col justify-between border-b border-border bg-card transition-none dark:bg-[var(--club-secondary)] print:hidden md:z-30 md:w-auto md:border-b-0 md:border-e md:h-screen"
    >
      {/* Sidebar Content */}
      <div className="flex flex-col h-full w-full overflow-hidden">
        {children}
      </div>

      {/* Resize Handle (Drag bar on the inner edge: left in RTL, right in LTR) */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        onDoubleClick={() => {
          // Double click resets to default width
          setWidth(defaultWidth);
          try {
            localStorage.setItem("esh_sidebar_width", defaultWidth.toString());
          } catch {}
        }}
        title={locale === "ar" ? "اسحب لتمديد أو تضييق القائمة الجانبية (انقر مرتين لإعادة الضبط)" : "Glisser pour redimensionner (double-clic pour réinitialiser)"}
        style={{ [isRtl ? "left" : "right"]: "-6px" }}
        className="hidden md:flex absolute top-0 bottom-0 z-40 w-3 items-center justify-center cursor-col-resize group transition-colors select-none hover:bg-club-primary/15 active:bg-club-primary/30"
      >
        {/* Subtle indicator line */}
        <div className={`h-8 w-1 rounded-full transition-[background-color,opacity,transform] duration-150 ${
          isResizing
            ? "scale-y-150 bg-club-primary ring-2 ring-club-primary/20"
            : "bg-muted-foreground/30 group-hover:scale-y-150 group-hover:bg-club-primary"
        }`} />
      </div>
    </aside>
  );
}
