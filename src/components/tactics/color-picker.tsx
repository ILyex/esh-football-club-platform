"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const PRESETS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#38bdf8", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f3f4f6", "#94a3b8", "#111827"];

function hexToHsl(hex: string) {
  const normalized = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : "ef4444";
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  const l = (max + min) / 2;
  const s = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100; const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1)); const m = lightness - chroma / 2;
  const rgb = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${rgb.map((channel) => Math.round((channel! + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function TacticalColorPicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const [hsl, setHsl] = useState(() => hexToHsl(value));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setHex(value); setHsl(hexToHsl(value)); }, [value]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function applyHex(next: string) {
    const normalized = next.startsWith("#") ? next : `#${next}`;
    setHex(normalized);
    if (/^#[\da-f]{6}$/i.test(normalized)) { setHsl(hexToHsl(normalized)); onChange(normalized.toLowerCase()); }
  }
  function applyHsl(next: typeof hsl) {
    setHsl(next);
    const nextHex = hslToHex(next.h, next.s, next.l);
    setHex(nextHex); onChange(nextHex);
  }

  return <div ref={rootRef} className="tactical-color-root">
    <button type="button" aria-label={label} aria-expanded={open} title={label} onClick={() => setOpen((current) => !current)} className="tactical-color-trigger">
      <span className="tactical-color-dot" style={{ backgroundColor: value }}/><span>{label}</span><ChevronDown size={13} className={open ? "rotate-180" : ""}/>
    </button>
    {open && <div role="dialog" aria-label={label} className="tactical-color-popover">
      <div className="tactical-color-head"><span className="tactical-color-preview" style={{ backgroundColor: /^#[\da-f]{6}$/i.test(hex) ? hex : value }}/><div className="min-w-0 flex-1"><span className="tactical-color-caption">{label}</span><input aria-label="HEX" value={hex} maxLength={7} onChange={(event) => applyHex(event.target.value)} onBlur={() => { if (!/^#[\da-f]{6}$/i.test(hex)) setHex(value); }} className="tactical-color-hex" /></div></div>
      <div className="tactical-color-presets" aria-label={label}>{PRESETS.map((swatch) => <button key={swatch} type="button" aria-label={swatch} aria-pressed={value.toLowerCase() === swatch} onClick={() => { onChange(swatch); setHex(swatch); setHsl(hexToHsl(swatch)); }} className="tactical-color-swatch" style={{ backgroundColor: swatch }}>{value.toLowerCase() === swatch && <Check size={13}/>}</button>)}</div>
      <label className="tactical-color-range"><span>H</span><input aria-label="Hue" type="range" min={0} max={360} value={Math.round(hsl.h)} onChange={(event) => applyHsl({ ...hsl, h: Number(event.target.value) })} style={{ background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}/></label>
      <label className="tactical-color-range"><span>S</span><input aria-label="Saturation" type="range" min={0} max={100} value={Math.round(hsl.s)} onChange={(event) => applyHsl({ ...hsl, s: Number(event.target.value) })} style={{ background: `linear-gradient(90deg,#888,${hslToHex(hsl.h, 100, 50)})` }}/></label>
      <label className="tactical-color-range"><span>L</span><input aria-label="Lightness" type="range" min={0} max={100} value={Math.round(hsl.l)} onChange={(event) => applyHsl({ ...hsl, l: Number(event.target.value) })} style={{ background: `linear-gradient(90deg,#000,${hslToHex(hsl.h, hsl.s, 50)},#fff)` }}/></label>
      <button type="button" onClick={() => setOpen(false)} className="tactical-color-done">تم</button>
    </div>}
  </div>;
}
