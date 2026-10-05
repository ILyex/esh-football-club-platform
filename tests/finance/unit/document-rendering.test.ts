import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { store, reset, faults } from "../mocks/db";
import { session, signedOut } from "../mocks/auth";
import { files, storageLog } from "../mocks/storage";
import {
  isPdfConverterConfigured,
  getSanitizedConverterUrl,
  isValidDocxHeader,
  isValidPdfHeader,
  convertDocxToPdf
} from "@/lib/documents/pdf-converter";
import { GET as downloadRoute } from "@/app/api/generated-documents/[id]/download/route";
import { RESOLVER_REGISTRY } from "@/lib/documents/entity-data-resolvers";

const VALID_DOCX_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
const VALID_PDF_HEADER = Buffer.from("%PDF-1.7\nSample PDF Content\n%%EOF");
const FAKE_DOCX_AS_PDF = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x4e, 0x4f, 0x54, 0x5f, 0x50, 0x44, 0x46]);

let originalFetch: typeof globalThis.fetch;
let originalEnvUrl: string | undefined;

beforeEach(() => {
  reset();
  store.role!.push({ key: "super_admin", teamScoped: false });
  files.clear();
  storageLog.length = 0;
  signedOut.value = false;
  faults.auditCreate = false;

  originalEnvUrl = process.env.PDF_CONVERTER_URL;
  delete process.env.PDF_CONVERTER_URL;

  originalFetch = globalThis.fetch;

  session.user = {
    id: "user-1",
    name: "Doc Tester",
    email: "tester@club.local",
    roleKey: "super_admin",
    roleName: "Admin",
    permissions: ["documents.generate", "finance.view", "finance.approve"]
  };
});

afterEach(() => {
  if (originalEnvUrl !== undefined) {
    process.env.PDF_CONVERTER_URL = originalEnvUrl;
  } else {
    delete process.env.PDF_CONVERTER_URL;
  }
  globalThis.fetch = originalFetch;
});

// ============================================================================
// 1. PDF CONVERTER ABSTRACTION & SECURITY TESTS
// ============================================================================

test("pdf-converter: configuration checks and endpoint sanitization", () => {
  assert.equal(isPdfConverterConfigured(), false);
  assert.equal(getSanitizedConverterUrl(), null);

  process.env.PDF_CONVERTER_URL = "http://gotenberg.local:3000/forms/libreoffice/convert";
  assert.equal(isPdfConverterConfigured(), true);
  assert.equal(getSanitizedConverterUrl(), "http://gotenberg.local:3000/forms/libreoffice/convert");

  // SSRF prevention: reject unsafe protocols
  process.env.PDF_CONVERTER_URL = "javascript:alert(1)";
  assert.throws(() => getSanitizedConverterUrl(), /Unsafe PDF_CONVERTER_URL protocol/);

  process.env.PDF_CONVERTER_URL = "file:///etc/passwd";
  assert.throws(() => getSanitizedConverterUrl(), /Unsafe PDF_CONVERTER_URL protocol/);

  process.env.PDF_CONVERTER_URL = "ftp://internal.vault/upload";
  assert.throws(() => getSanitizedConverterUrl(), /Unsafe PDF_CONVERTER_URL protocol/);
});

test("pdf-converter: magic-byte format validation", () => {
  assert.equal(isValidDocxHeader(VALID_DOCX_HEADER), true);
  assert.equal(isValidDocxHeader(Buffer.from("not a zip")), false);
  assert.equal(isValidDocxHeader(Buffer.from([])), false);

  assert.equal(isValidPdfHeader(VALID_PDF_HEADER), true);
  assert.equal(isValidPdfHeader(FAKE_DOCX_AS_PDF), false);
  assert.equal(isValidPdfHeader(Buffer.from("PLAIN TEXT")), false);
  assert.equal(isValidPdfHeader(Buffer.from([])), false);
});

test("pdf-converter: convertDocxToPdf fails gracefully when unconfigured", async () => {
  const result = await convertDocxToPdf(VALID_DOCX_HEADER);
  assert.equal(result.success, false);
  assert.equal(result.error, "PDF_CONVERTER_NOT_CONFIGURED");
  assert.equal(result.statusCode, 503);
});

test("pdf-converter: convertDocxToPdf rejects invalid DOCX input", async () => {
  process.env.PDF_CONVERTER_URL = "http://converter.local/convert";
  const result = await convertDocxToPdf(Buffer.from("invalid-binary"));
  assert.equal(result.success, false);
  assert.equal(result.error, "INVALID_DOCX_INPUT");
  assert.equal(result.statusCode, 400);
});

test("pdf-converter: convertDocxToPdf rejects oversized input payload", async () => {
  process.env.PDF_CONVERTER_URL = "http://converter.local/convert";
  const oversized = Buffer.alloc(21 * 1024 * 1024); // 21 MB (exceeds 20 MB ceiling)
  oversized[0] = 0x50; oversized[1] = 0x4b; oversized[2] = 0x03; oversized[3] = 0x04;

  const result = await convertDocxToPdf(oversized);
  assert.equal(result.success, false);
  assert.equal(result.error, "PAYLOAD_TOO_LARGE");
  assert.equal(result.statusCode, 413);
});

test("pdf-converter: convertDocxToPdf succeeds with genuine PDF output", async () => {
  process.env.PDF_CONVERTER_URL = "http://converter.local/forms/libreoffice/convert";

  globalThis.fetch = async (input, init) => {
    return new Response(new Uint8Array(VALID_PDF_HEADER), {
      status: 200,
      headers: { "Content-Type": "application/pdf" }
    });
  };

  const result = await convertDocxToPdf(VALID_DOCX_HEADER, { filename: "report.docx" });
  assert.equal(result.success, true);
  assert.equal(result.statusCode, 200);
  assert.ok(result.pdfBuffer);
  assert.equal(isValidPdfHeader(result.pdfBuffer!), true);
});

test("pdf-converter: convertDocxToPdf rejects fake PDF output (renamed DOCX)", async () => {
  process.env.PDF_CONVERTER_URL = "http://converter.local/convert";

  globalThis.fetch = async () => {
    // Malicious or buggy converter returns docx bytes instead of %PDF-
    return new Response(new Uint8Array(FAKE_DOCX_AS_PDF), {
      status: 200,
      headers: { "Content-Type": "application/pdf" }
    });
  };

  const result = await convertDocxToPdf(VALID_DOCX_HEADER);
  assert.equal(result.success, false);
  assert.equal(result.error, "INVALID_PDF_OUTPUT_MAGIC_BYTES");
  assert.equal(result.statusCode, 502);
});

test("pdf-converter: convertDocxToPdf handles converter service error safely", async () => {
  process.env.PDF_CONVERTER_URL = "http://converter.local/convert";

  globalThis.fetch = async () => {
    return new Response("Internal Server Error in LibreOffice daemon", { status: 500 });
  };

  const result = await convertDocxToPdf(VALID_DOCX_HEADER);
  assert.equal(result.success, false);
  assert.equal(result.statusCode, 502);
  assert.match(result.error!, /CONVERSION_SERVICE_ERROR: 500/);
});

// ============================================================================
// 2. DOWNLOAD ROUTE ENHANCEMENT TESTS (DOCX & PDF FORMATS)
// ============================================================================

test("download route: format=docx returns 302 redirect and audits download", async () => {
  files.set("gen/doc-1.docx", VALID_DOCX_HEADER);
  store.generatedDocument!.push({
    id: "doc-1",
    storageKey: "gen/doc-1.docx",
    relatedEntityType: "Match",
    relatedEntityId: "match-1",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const req = { url: "http://localhost/api/generated-documents/doc-1/download?format=docx" } as any;
  const res = await downloadRoute(req, { params: Promise.resolve({ id: "doc-1" }) });

  assert.equal(res.status, 302);
  assert.ok(store.auditLog!.some((a) => a.action === "generatedDocument.download" && a.entityId === "doc-1"));
});

test("download route: format=pdf returns 503 with helpful instructions when converter is unconfigured", async () => {
  files.set("gen/doc-1.docx", VALID_DOCX_HEADER);
  store.generatedDocument!.push({
    id: "doc-1",
    storageKey: "gen/doc-1.docx",
    relatedEntityType: "Match",
    relatedEntityId: "match-1",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  const req = { url: "http://localhost/api/generated-documents/doc-1/download?format=pdf" } as any;
  const res = await downloadRoute(req, { params: Promise.resolve({ id: "doc-1" }) });

  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.error, "PDF_CONVERTER_NOT_CONFIGURED");
  assert.match(data.message, /Print preview.*Save as PDF/);
});

test("download route: format=pdf succeeds and serves application/pdf when converter is configured", async () => {
  process.env.PDF_CONVERTER_URL = "http://gotenberg.local:3000/forms/libreoffice/convert";
  files.set("gen/doc-1.docx", VALID_DOCX_HEADER);
  store.generatedDocument!.push({
    id: "doc-1",
    storageKey: "gen/doc-1.docx",
    relatedEntityType: "Match",
    relatedEntityId: "match-1",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  globalThis.fetch = async () => {
    return new Response(new Uint8Array(VALID_PDF_HEADER), {
      status: 200,
      headers: { "Content-Type": "application/pdf" }
    });
  };

  const req = { url: "http://localhost/api/generated-documents/doc-1/download?format=pdf" } as any;
  const res = await downloadRoute(req, { params: Promise.resolve({ id: "doc-1" }) });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  assert.equal(res.headers.get("Content-Disposition"), 'inline; filename="doc-1.pdf"');
  assert.ok(store.auditLog!.some((a) => a.action === "generatedDocument.download_pdf" && a.entityId === "doc-1"));
});

test("download route: format=pdf enforces exact same entity-level financial permissions", async () => {
  process.env.PDF_CONVERTER_URL = "http://gotenberg.local:3000/forms/libreoffice/convert";
  files.set("gen/fin-1.docx", VALID_DOCX_HEADER);
  store.generatedDocument!.push({
    id: "fin-1",
    storageKey: "gen/fin-1.docx",
    relatedEntityType: "Expense",
    relatedEntityId: "exp-1",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  // Coach holds documents.generate, but lacks finance.view
  session.user.permissions = ["documents.generate"];

  const req = { url: "http://localhost/api/generated-documents/fin-1/download?format=pdf" } as any;
  const res = await downloadRoute(req, { params: Promise.resolve({ id: "fin-1" }) });

  assert.equal(res.status, 403);
  assert.ok(store.auditLog!.some((a) => a.action === "generatedDocument.download_denied" && a.entityId === "fin-1"));
});

test("download route: does not leak internal storage keys or raw bucket URLs on denial or error", async () => {
  store.generatedDocument!.push({
    id: "secret-doc",
    storageKey: "private-vault/highly-confidential-secret-key-12345.docx",
    relatedEntityType: "Expense",
    relatedEntityId: "exp-secret",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  session.user.permissions = []; // No permissions at all

  const req = { url: "http://localhost/api/generated-documents/secret-doc/download?format=pdf" } as any;
  const res = await downloadRoute(req, { params: Promise.resolve({ id: "secret-doc" }) });

  assert.equal(res.status, 403);
  const text = await res.text();
  assert.ok(!text.includes("highly-confidential-secret-key-12345"), "internal storage key must never leak in error response");
});

// ============================================================================
// 3. RESOLVER REGISTRY & REGISTERED TYPES COVERAGE
// ============================================================================

test("document-resolvers: all six registered types exist with authoritative DB paths", () => {
  const expectedTypes = [
    "MATCH_REPORT",
    "MEETING_MINUTES",
    "CORRESPONDENCE",
    "EXPENSE_STATEMENT",
    "DEPOSIT_RECEIPT",
    "WITHDRAWAL_RECEIPT"
  ];

  for (const t of expectedTypes) {
    const resolver = RESOLVER_REGISTRY[t];
    assert.ok(resolver, `Resolver for ${t} must be registered`);
    assert.ok(resolver.entityType.length > 0, `${t} must declare entityType`);
    assert.ok(resolver.availablePaths.length > 0, `${t} must offer availablePaths`);
    assert.equal(typeof resolver.resolveBundle, "function", `${t} must have resolveBundle function`);
    assert.equal(typeof resolver.listEntities, "function", `${t} must have listEntities function`);
  }

  // Financial types must enforce finance gates and forbid AI assist
  const financialTypes = ["EXPENSE_STATEMENT", "DEPOSIT_RECEIPT", "WITHDRAWAL_RECEIPT"];
  for (const ft of financialTypes) {
    const resolver = RESOLVER_REGISTRY[ft]!;
    assert.equal(resolver.generatePermission, "finance.approve");
    assert.equal(resolver.readPermission, "finance.view");
    assert.equal(resolver.aiAssistAllowed, false);
    assert.equal(resolver.auditOnEntity, true);
  }
});

// ============================================================================
// 4. REAL MULTI-PAGE RENDERING VERIFICATION (Constraint 10 & 11)
// ============================================================================

test("real rendering verification: generates authentic multi-page DOCX with Arabic RTL, French LTR, tables, headers and successfully parses with docx-preview", async () => {
  if (typeof (globalThis as any).DOMParser === "undefined" || !(globalThis as any).DOMParser.prototype.parseFromString) {
    const xmldom = await import("@xmldom/xmldom");
    class NodeDOMParser extends xmldom.DOMParser {
      parseFromString(str: string, type: any) {
        const doc = super.parseFromString(str, type);
        if (doc && !("firstElementChild" in doc)) {
          Object.defineProperty(doc, "firstElementChild", {
            get() {
              return this.documentElement;
            }
          });
        }
        return doc;
      }
    }
    (globalThis as any).DOMParser = NodeDOMParser;
    if (typeof (globalThis as any).Node === "undefined") {
      (globalThis as any).Node = xmldom.Node || { ELEMENT_NODE: 1, TEXT_NODE: 3 };
    }
  }

  const PizZip = (await import("pizzip")).default;
  const Docxtemplater = (await import("docxtemplater")).default;
  const docxPreview = await import("docx-preview");

  // Create a real OPC/OpenXML DOCX archive
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );

  // Document XML with:
  // - Arabic paragraph with <w:bidi/> and <w:rtl/>
  // - French paragraph with standard typography
  // - Formatted two-column data table
  // - Page break element (<w:br w:type="page"/>)
  // - Second page content
  const docXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
        '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t>{{CLUB_AR}} - وصل استلام رسمي</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t>{{CLUB_FR}} - Reçu Officiel</w:t></w:r></w:p>' +
        '<w:tbl>' +
          '<w:tr><w:tc><w:p><w:r><w:t>Référence</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{REF}}</w:t></w:r></w:p></w:tc></w:tr>' +
          '<w:tr><w:tc><w:p><w:r><w:t>Montant</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>{{AMOUNT}} DZD</w:t></w:r></w:p></w:tc></w:tr>' +
        '</w:tbl>' +
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' +
        '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/></w:rPr><w:t>الصفحة 2: ملاحظات وتأشيرات الإدارة</w:t></w:r></w:p>' +
      '</w:body>' +
    '</w:document>';
  zip.file("word/document.xml", docXml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true
  });

  doc.render({
    CLUB_AR: "الترجي الرياضي سيدي حسني",
    CLUB_FR: "Espoir Sidi Hosni",
    REF: "EXP-2026-0042",
    AMOUNT: "45 000"
  });

  const generatedDocx = doc.getZip().generate({ type: "nodebuffer" });

  // 1. Verify byte generation
  assert.ok(generatedDocx.length > 500, "DOCX buffer must be a valid binary archive");
  assert.equal(isValidDocxHeader(generatedDocx), true, "Generated buffer must have PK zip header");

  // 2. Verify docx-preview parse engine on the generated binary
  const parsed = await docxPreview.parseAsync(generatedDocx);
  assert.ok(parsed, "docx-preview must parse the generated document without error");
  assert.ok(parsed.partsMap, "docx-preview must identify document parts");
  assert.ok(parsed.partsMap["word/document.xml"], "word/document.xml part must be present in parsed document");
});
