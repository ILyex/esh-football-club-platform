/**
 * Unified Official Security Watermark for ESH SIDI HOSNI.
 *
 * Strict institutional watermark displaying "ESH" in a repeating diagonal pattern
 * using Traditional Arabic / Arabic Typesetting typography.
 * Shared across screen previews, print stylesheets, and PDF exports.
 */

// SVG with Traditional Arabic typography, subtle professional opacity
export const ESH_WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <text x="50" y="42" font-family="'Traditional Arabic', 'Arabic Typesetting', serif" font-size="22" font-weight="bold" fill="#000000" fill-opacity="0.10" transform="rotate(-22 50 42)" text-anchor="middle" letter-spacing="4">ESH</text>
  <text x="150" y="92" font-family="'Traditional Arabic', 'Arabic Typesetting', serif" font-size="22" font-weight="bold" fill="#000000" fill-opacity="0.10" transform="rotate(-22 150 92)" text-anchor="middle" letter-spacing="4">ESH</text>
</svg>`;

export const ESH_WATERMARK_BASE64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjAwIDEwMCI+CiAgPHRleHQgeD0iNTAiIHk9IjQyIiBmb250LWZhbWlseT0iJ1RyYWRpdGlvbmFsIEFyYWJpYycsICdBcmFiaWMgVHlwZXNldHRpbmcnLCBzZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xMCIgdHJhbnNmb3JtPSJyb3RhdGUoLTIyIDUwIDQyKSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjQiPkVTSDwvdGV4dD4KICA8dGV4dCB4PSIxNTAiIHk9IjkyIiBmb250LWZhbWlseT0iJ1RyYWRpdGlvbmFsIEFyYWJpYycsICdBcmFiaWMgVHlwZXNldHRpbmcnLCBzZXJpZiIgZm9udC1zaXplPSIyMiIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xMCIgdHJhbnNmb3JtPSJyb3RhdGUoLTIyIDE1MCA5MikiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSI0Ij5FU0g8L3RleHQ+Cjwvc3ZnPg==";

export const ESH_WATERMARK_DATA_URL = `data:image/svg+xml;base64,${ESH_WATERMARK_BASE64}`;
export const ESH_WATERMARK_CSS_URL = `url("${ESH_WATERMARK_DATA_URL}")`;

// A full-page SVG image for print output. Using an actual <img> instead of a
// CSS background makes the watermark print even when the browser's "print
// background graphics" option is disabled.
const ESH_PRINT_WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><defs><pattern id="esh-watermark" width="100" height="50" patternUnits="userSpaceOnUse"><text x="25" y="21" font-family="'Traditional Arabic','Arabic Typesetting',serif" font-size="11" font-weight="bold" fill="#000" fill-opacity="0.16" transform="rotate(-22 25 21)" text-anchor="middle" letter-spacing="2">ESH</text><text x="75" y="46" font-family="'Traditional Arabic','Arabic Typesetting',serif" font-size="11" font-weight="bold" fill="#000" fill-opacity="0.16" transform="rotate(-22 75 46)" text-anchor="middle" letter-spacing="2">ESH</text></pattern></defs><rect width="794" height="1123" fill="url(#esh-watermark)"/></svg>`;
export const ESH_PRINT_WATERMARK_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ESH_PRINT_WATERMARK_SVG)}`;

export const ESH_DOCUMENT_FONT_FAMILY = "'Traditional Arabic', 'Arabic Typesetting', serif";
