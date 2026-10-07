/**
 * Unified Official Security Watermark for ESH SIDI HOSNI.
 *
 * Strict institutional watermark displaying "ESH" in a repeating diagonal pattern
 * using Traditional Arabic / Arabic Typesetting typography.
 * Shared across screen previews, print stylesheets, and PDF exports.
 */

// SVG with Traditional Arabic typography, subtle professional opacity
export const ESH_WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">
  <text x="50" y="30" font-family="'Traditional Arabic', 'Arabic Typesetting', serif" font-size="18" font-weight="bold" fill="#000000" fill-opacity="0.10" transform="rotate(-22 50 25)" text-anchor="middle" letter-spacing="2.5">ESH</text>
</svg>`;

export const ESH_WATERMARK_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ESH_WATERMARK_SVG)}`;
export const ESH_WATERMARK_CSS_URL = `url("${ESH_WATERMARK_DATA_URL}")`;

// A full-page SVG image for print output. Using an actual <img> instead of a
// CSS background makes the watermark print even when the browser's "print
// background graphics" option is disabled.
const ESH_PRINT_WATERMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123"><defs><pattern id="esh-watermark" width="100" height="50" patternUnits="userSpaceOnUse"><text x="50" y="30" font-family="'Traditional Arabic','Arabic Typesetting',serif" font-size="10" font-weight="bold" fill="#000" fill-opacity="0.16" transform="rotate(-22 50 25)" text-anchor="middle" letter-spacing="2">ESH</text></pattern></defs><rect width="794" height="1123" fill="url(#esh-watermark)"/></svg>`;
export const ESH_PRINT_WATERMARK_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ESH_PRINT_WATERMARK_SVG)}`;

export const ESH_DOCUMENT_FONT_FAMILY = "'Traditional Arabic', 'Arabic Typesetting', serif";
