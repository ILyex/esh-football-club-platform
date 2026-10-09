"use client";

import type { ReactNode, SyntheticEvent } from "react";

function protectMediaInteraction(event: SyntheticEvent<HTMLElement>) {
  const target = event.target;
  if (target instanceof Element && target.closest("img, video, picture")) {
    event.preventDefault();
  }
}

/** Removes the ordinary browser context-menu and drag-save shortcuts on public media. */
export function PublicMediaProtection({ children }: { children: ReactNode }) {
  return (
    <div
      data-public-content
      onContextMenu={protectMediaInteraction}
      onDragStart={protectMediaInteraction}
    >
      {children}
    </div>
  );
}
