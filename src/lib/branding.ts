import type { CSSProperties } from "react";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeHex(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value : fallback;
}

function rgbChannels(hex: string): string {
  const normalized = hex.slice(1);
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16)).join(" ");
}

function hoverHex(hex: string): string {
  const channels = [0, 2, 4].map((index) => Math.round(Number.parseInt(hex.slice(index + 1, index + 3), 16) * 0.86));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function getClubBrandStyle(primaryColor: string, secondaryColor: string): CSSProperties {
  const primary = normalizeHex(primaryColor, "#DC2626");
  const secondary = normalizeHex(secondaryColor, "#111214");

  return {
    "--club-primary": primary,
    "--club-primary-rgb": rgbChannels(primary),
    "--club-primary-hover": hoverHex(primary),
    "--club-secondary": secondary,
    "--club-secondary-rgb": rgbChannels(secondary)
  } as CSSProperties;
}
