# ESH Design System

The shared visual system for the public website, management platform, and the companion Android app. Preserve the club identity and every institutional fact while improving hierarchy, reading comfort, responsive behavior, and interaction feedback.

## System

- Genre: modern-minimal, with a restrained sports results-sheet hierarchy.
- Shape: responsive public pages and a focused management workspace inside the existing navigation shell.
- Theme: ESH brand; exact light/dark palette and runtime club colors remain authoritative.
- Audience: supporters browsing club information and authorized club staff managing operations.
- Signature: the official ESH identity, real team imagery, and live club records already supplied by the product.

## Fixed identity

- Keep the current club and sponsor names, Arabic/French content, metrics, logos, and dates verbatim.
- Keep the current red and charcoal brand colors, theme surfaces, and club colors set from administration settings.
- Use only the official logo variants documented in `BRANDING.md`; do not recolor, redraw, or distort them.
- Keep route names, page content, controls, form fields, handlers, permissions, data calls, and native app navigation behavior.
- Keep the current font files and role assignments from `tailwind.config.mjs` and the locale layout.

## Tokens

`src/app/globals.css` contains the existing light/dark and runtime brand values. `src/app/tokens.css` exposes those same values to Tailwind as `esh-canvas`, `esh-surface`, `esh-subtle`, `esh-ink`, `esh-muted`, `esh-line`, and `esh-accent`. Never duplicate a color literal outside the established token or official asset.

Spacing follows the existing 4px base, with 8/12/16/24/32px control and content steps. Keep one content measure per surface, logical RTL/LTR spacing, minimum 44px touch targets, tabular numerals for standings and scores, and a 16px minimum for long-form mobile reading.

## Surfaces and hierarchy

- Public pages lead with the club's actual content and photographs, then matches, teams, news, and other existing sections.
- Management pages retain the current sidebar, command search, permission-aware navigation, and page-owned layouts.
- Prefer clear surface steps, hairline borders, and compact shadows already used by the product; avoid nested panels and decorative gradients.
- Use sport references for score/table hierarchy and clear numerals; Apple for focus and image-led storytelling; Ramp and shadcn for consistent controls; Raycast for restrained dark chrome. Reference colors and type are not adopted.

## Interaction and motion

- Every keyboard-operable control has an immediate, visible focus ring in the existing club accent.
- Hover, pressed, selected, loading, success, and error states reuse current semantic color tokens and remain legible in both themes.
- Transitions name only the properties they animate; keep layout stable and prefer color, opacity, and transform.
- Respect `prefers-reduced-motion`. Preserve the Android bottom navigation animation and existing image cache behavior.
- Keep loading and failure feedback attached to the action that produced it. Do not add client-side state when the current screen has no corresponding data or handler.

## References

The supplied `DESIGN 1.md` through `DESIGN 6.md` are reference-only: adopt their hierarchy, whitespace, table clarity, control consistency, and low-noise surfaces, while the fixed ESH identity above takes precedence.
