import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { renderTemplate } from "../src/lib/documents/template-engine";
import {
  StorageConfigurationError,
  isStorageConfigured,
  isLocalStorageMode,
  uploadPrivateFile,
  getPrivateFileBuffer,
  getPrivateFileDownloadUrl,
  deletePrivateFile
} from "../src/lib/storage";
import { getStorageConfigurationSummary, validateEnvironment } from "../src/lib/env";

describe("Storage Subsystem & Configuration Invariants", () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe("Configuration Contract & Fail-Fast Verification", () => {
    test("in production without STORAGE_PRIVATE_BUCKET, throws StorageConfigurationError fail-fast", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.STORAGE_PRIVATE_BUCKET;

      await assert.rejects(
        async () => {
          await uploadPrivateFile({
            key: "test/file.docx",
            buffer: Buffer.from("test"),
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          });
        },
        (err: any) => {
          assert.ok(err instanceof StorageConfigurationError);
          assert.equal(err.code, "STORAGE_NOT_CONFIGURED");
          assert.ok(err.message.includes("Private storage bucket is not configured"));
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await getPrivateFileBuffer("test/file.docx");
        },
        (err: any) => {
          assert.ok(err instanceof StorageConfigurationError);
          assert.equal(err.code, "STORAGE_NOT_CONFIGURED");
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await getPrivateFileDownloadUrl("test/file.docx");
        },
        (err: any) => {
          assert.ok(err instanceof StorageConfigurationError);
          assert.equal(err.code, "STORAGE_NOT_CONFIGURED");
          return true;
        }
      );
    });

    test("validateEnvironment enforces STORAGE_PRIVATE_BUCKET in production", () => {
      const prodWithoutStorage = validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
        AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
        CRON_SECRET: "valid-production-cron-secret-123456789"
      });
      assert.equal(prodWithoutStorage.ok, false);
      assert.ok(prodWithoutStorage.issues.some((i) => i.includes("STORAGE_PRIVATE_BUCKET is strictly required")));

      const prodWithStorage = validateEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@host:5432/db?sslmode=require",
        AUTH_SECRET: "a-very-long-production-auth-secret-key-32-chars-plus",
        CRON_SECRET: "valid-production-cron-secret-123456789",
        STORAGE_PRIVATE_BUCKET: "esh-private-bucket",
        STORAGE_PUBLIC_BUCKET: "esh-public-bucket"
      });
      assert.equal(prodWithStorage.ok, true);
    });

    test("getStorageConfigurationSummary never leaks secrets and reports strictly configured/missing", () => {
      delete process.env.STORAGE_PRIVATE_BUCKET;
      delete process.env.STORAGE_ENDPOINT;
      delete process.env.STORAGE_ACCESS_KEY_ID;
      delete process.env.STORAGE_SECRET_ACCESS_KEY;

      const summaryUnconfigured = getStorageConfigurationSummary();
      assert.deepEqual(summaryUnconfigured, {
        privateBucket: "missing",
        s3Endpoint: "missing",
        s3AccessKey: "missing",
        s3SecretKey: "missing"
      });

      process.env.STORAGE_PRIVATE_BUCKET = "esh-private-test";
      process.env.STORAGE_ENDPOINT = "https://r2.example.com";
      process.env.STORAGE_ACCESS_KEY_ID = "super-secret-key-id";
      process.env.STORAGE_SECRET_ACCESS_KEY = "ultra-secret-access-token";

      const summaryConfigured = getStorageConfigurationSummary();
      assert.deepEqual(summaryConfigured, {
        privateBucket: "configured",
        s3Endpoint: "configured",
        s3AccessKey: "configured",
        s3SecretKey: "configured"
      });

      // Confirm no secret strings leaked in values
      for (const val of Object.values(summaryConfigured)) {
        assert.ok(val === "configured" || val === "missing");
      }
    });
  });

  describe("Development Storage Driver (Local Private Store)", () => {
    const testKey = `test-docs/test-${Date.now()}.docx`;
    const testData = Buffer.from("ESH Test Document Binary Content");

    beforeEach(() => {
      process.env.NODE_ENV = "test";
      delete process.env.STORAGE_PRIVATE_BUCKET;
    });

    afterEach(async () => {
      await deletePrivateFile(testKey).catch(() => undefined);
    });

    test("isLocalStorageMode is active when unconfigured outside production", () => {
      assert.equal(isStorageConfigured(), false);
      assert.equal(isLocalStorageMode(), true);
    });

    test("uploadPrivateFile writes and getPrivateFileBuffer reads back exact bytes", async () => {
      await uploadPrivateFile({
        key: testKey,
        buffer: testData,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const retrieved = await getPrivateFileBuffer(testKey);
      assert.deepEqual(retrieved, testData);
    });

    test("getPrivateFileBuffer throws clean error when file does not exist", async () => {
      await assert.rejects(
        async () => {
          await getPrivateFileBuffer("non-existent-key-12345.bin");
        },
        /Object not found/
      );
    });

    test("getPrivateFileDownloadUrl produces signed URL with key, expires, and HMAC sig", async () => {
      process.env.AUTH_SECRET = "test-auth-secret-12345678901234567890";
      const url = await getPrivateFileDownloadUrl(testKey, 60);

      assert.ok(url.startsWith("/api/storage/local-download?"));
      const parsed = new URL(url, "http://localhost");
      assert.equal(parsed.searchParams.get("key"), testKey);
      assert.ok(parsed.searchParams.get("expires"));
      assert.ok(parsed.searchParams.get("sig"));
    });

    test("deletePrivateFile removes stored file", async () => {
      await uploadPrivateFile({
        key: testKey,
        buffer: testData,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const beforeDelete = await getPrivateFileBuffer(testKey);
      assert.equal(beforeDelete.length, testData.length);

      await deletePrivateFile(testKey);

      await assert.rejects(
        async () => {
          await getPrivateFileBuffer(testKey);
        },
        /Object not found/
      );
    });
  });

  describe("Official Template Retrieval & DOCX Integrity", () => {
    test("template fixture is valid PK zip archive and parseable by docxtemplater", async () => {
      process.env.NODE_ENV = "test";
      delete process.env.STORAGE_PRIVATE_BUCKET;

      // In local dev, getPrivateFileBuffer can load official-template fixture
      const templateBuf = await getPrivateFileBuffer("templates/official-template.docx");

      // Verify ZIP magic bytes (PK\x03\x04)
      assert.equal(templateBuf[0], 0x50);
      assert.equal(templateBuf[1], 0x4b);
      assert.equal(templateBuf[2], 0x03);
      assert.equal(templateBuf[3], 0x04);

      // Verify renderTemplate parses and renders without errors
      const renderedBuf = renderTemplate(templateBuf, {
        CLUB: "ESPOIR SPORTIF HOSNI",
        REF: "EXP-2026-TEST",
        AMOUNT: "25 000 DZD",
        CAT: "EQUIPMENT",
        DATE: "02/10/2026",
        PAYREF: "VIR-998877",
        NOTE: "Test expense statement"
      });

      // Verify rendered output has PK signature and contains substituted data
      assert.equal(renderedBuf[0], 0x50);
      assert.equal(renderedBuf[1], 0x4b);
      assert.equal(renderedBuf[2], 0x03);
      assert.equal(renderedBuf[3], 0x04);

      const renderedZip = new PizZip(renderedBuf);
      const headerXml = renderedZip.file("word/header1.xml")?.asText();
      const bodyXml = renderedZip.file("word/document.xml")?.asText();
      assert.ok(headerXml);
      assert.ok(bodyXml);
      assert.ok(headerXml.includes("ESPOIR SPORTIF HOSNI"));
      assert.ok(bodyXml.includes("EXP-2026-TEST"));
      assert.ok(bodyXml.includes("25 000 DZD"));
    });
  });
});
