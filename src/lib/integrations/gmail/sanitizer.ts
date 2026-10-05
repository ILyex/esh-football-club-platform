import sanitizeHtml from "sanitize-html";

// ============================================================================
// PHASE 11 — GMAIL INTEGRATION: HTML EMAIL SANITIZATION & XSS GUARD
// ============================================================================

const ALLOWED_TAGS = [
  "p", "br", "b", "i", "em", "strong", "u", "s",
  "a", "ul", "ol", "li", "span", "div", "blockquote", "pre", "code",
  "table", "thead", "tbody", "tr", "td", "th",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "font", "center", "small", "big", "sup", "sub", "strike"
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel", "style"],
    span: ["style", "dir"],
    div: ["style", "dir", "align"],
    p: ["style", "dir", "align"],
    ul: ["style"],
    ol: ["style"],
    li: ["style"],
    blockquote: ["style"],
    pre: ["style"],
    code: ["style"],
    hr: ["style"],
    font: ["style", "color", "size", "face"],
    center: ["style"],
    table: ["style", "width", "height", "border", "cellpadding", "cellspacing", "align", "bgcolor"],
    thead: ["style", "align", "valign"],
    tbody: ["style", "align", "valign"],
    tr: ["style", "align", "valign", "bgcolor"],
    td: ["style", "colspan", "rowspan", "width", "height", "align", "valign", "bgcolor"],
    th: ["style", "colspan", "rowspan", "width", "height", "align", "valign", "bgcolor"],
    h1: ["style", "align"],
    h2: ["style", "align"],
    h3: ["style", "align"],
    h4: ["style", "align"],
    h5: ["style", "align"],
    h6: ["style", "align"]
  },
  allowedStyles: {
    "*": {
      // Keep common email layout styles while rejecting URL, positioning, and executable CSS.
      color: [/^#(0x)?[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)$/i, /^[a-z]{1,20}$/i],
      "background-color": [/^#(0x)?[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)$/i, /^[a-z]{1,20}$/i],
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/, /^start$/, /^end$/],
      "font-weight": [/^\d+$/, /^bold$/, /^normal$/],
      "font-style": [/^italic$/, /^normal$/],
      "text-decoration": [/^underline$/, /^none$/, /^line-through$/],
      "font-family": [/^[\w\s,"'-]{1,120}$/],
      "font-size": [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large)$/i],
      "line-height": [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)$/i],
      width: [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?|auto)$/i],
      "max-width": [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?|none)$/i],
      height: [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?|auto)$/i],
      "min-height": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
      padding: [/^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%)?\s*){1,4}$/i],
      "padding-top": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
      "padding-right": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
      "padding-bottom": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
      "padding-left": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)?$/i],
      margin: [/^(?:-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)?|auto)\s*(?:-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)?|auto)?\s*(?:-?\d+(?:\.\d+)?(?:px|pt|em|rem|%)?\s*){0,2}$/i],
      border: [/^(?:(?:\d+(?:\.\d+)?px)\s+)?(?:solid|dashed|dotted|double|none)(?:\s+(?:#[\da-f]{3,8}|rgba?\([^)]{1,50}\)|[a-z]{1,20}))?$/i],
      "border-color": [/^#[\da-f]{3,8}$/i, /^rgba?\([^)]{1,50}\)$/i, /^[a-z]{1,20}$/i],
      "border-width": [/^\d+(?:\.\d+)?(?:px|pt)$/i],
      "border-style": [/^(?:solid|dashed|dotted|double|none)$/i],
      "border-radius": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/i],
      "border-collapse": [/^(?:collapse|separate)$/i],
      "vertical-align": [/^(?:top|middle|bottom|baseline)$/i],
      "white-space": [/^(?:normal|nowrap|pre|pre-wrap)$/i],
      direction: [/^(?:ltr|rtl)$/i]
    }
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"]
  },
  transformTags: {
    a: (tagName, attribs) => {
      return {
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow"
        }
      };
    }
  },
  disallowedTagsMode: "discard"
};

/**
 * Strips dangerous HTML, script tags, event handlers, iframes, and CSS exploits
 * from untrusted incoming Gmail bodies.
 */
export function sanitizeEmailHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== "string") {
    return "";
  }

  try {
    const cleaned = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
    return cleaned.trim();
  } catch (error) {
    // Fail closed to plain-text escaping if parser throws
    return escapeHtml(rawHtml);
  }
}

/**
 * Escapes plain text for safe insertion into HTML.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
}
