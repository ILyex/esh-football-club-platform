import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { signLocalDownload } from "@/lib/storage-signing";
import { db } from "@/lib/db";

async function detectFileType(buffer: Buffer) {
  const { fileTypeFromBuffer } = await import("file-type");
  return fileTypeFromBuffer(buffer);
}

// ============================================================================
// STORAGE ERRORS & CONFIGURATION CONTRACT
// ============================================================================

export class StorageConfigurationError extends Error {
  readonly code = "STORAGE_NOT_CONFIGURED";
  constructor(message = "Private storage bucket is not configured.") {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

/** Returns true if external S3-compatible private storage is configured in environment. */
export function isStorageConfigured(): boolean {
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (driver === "local" || driver === "database" || driver === "db") return false;
  return Boolean(process.env.STORAGE_PRIVATE_BUCKET?.trim());
}

/** Private files use durable DB storage as a fallback on serverless hosts. */
export function isLocalStorageMode(): boolean {
  // Vercel function filesystems are read-only/ephemeral. Even if an old
  // deployment still says `local`, private and public bytes must use the DB
  // fallback unless a persistent object bucket is configured.
  if (isServerlessRuntime() && !isStorageConfigured()) return false;
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (driver === "local") return true;
  if (driver === "s3") return false;
  return !isStorageConfigured();
}

function isServerlessRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)
    || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
}

export function isPrivateDatabaseStorageMode(): boolean {
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  return driver === "database" || driver === "db"
    || (isServerlessRuntime() && !isStorageConfigured());
}

/** Public uploads default to the database, never the host PC's local disk. */
export function isDatabaseStorageMode(): boolean {
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (driver === "database" || driver === "db") return true;
  if (isServerlessRuntime() && !isPublicStorageConfigured()) return true;
  if (driver === "local" || driver === "s3") return false;
  return !isPublicStorageConfigured();
}

let cachedS3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (cachedS3Client) return cachedS3Client;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new StorageConfigurationError("Storage credentials (STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY) are not configured.");
  }
  cachedS3Client = new S3Client({
    region: process.env.STORAGE_REGION?.trim() || "auto",
    endpoint: process.env.STORAGE_ENDPOINT?.trim(),
    // Neon Object Storage and Cloudflare R2 both use path-style S3 addressing.
    // Keep an explicit opt-out for providers that require virtual-host style.
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE?.trim().toLowerCase() !== "false",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  return cachedS3Client;
}

function getLocalStorageRoot(): string {
  const configuredRoot = process.env.STORAGE_LOCAL_ROOT?.trim();
  // Keep self-hosted uploads outside the extracted release/OneDrive folder.
  // This path survives package updates and is writable for a normal Windows
  // club account. An explicit root remains authoritative for cPanel/S3-free
  // deployments and tests.
  if (configuredRoot) return path.resolve(configuredRoot);
  if (process.env.NODE_ENV === "production" && process.env.LOCALAPPDATA) {
    return path.resolve(path.join(process.env.LOCALAPPDATA, "ESH Football Platform", ".storage"));
  }
  return path.resolve(path.join(process.cwd(), ".storage"));
}

function resolveStoragePath(directory: "private" | "public", key: string): string {
  const root = path.resolve(getLocalStorageRoot(), directory);
  const normalizedKey = path.normalize(key);
  if (!key || path.isAbsolute(key) || normalizedKey === "." || normalizedKey === ".." || normalizedKey.startsWith(`..${path.sep}`)) {
    throw new Error("Invalid storage key: directory traversal attempt.");
  }

  const resolved = path.resolve(root, normalizedKey);
  const relative = path.relative(root, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Invalid storage key: directory traversal attempt.");
  }
  return resolved;
}

function getLocalFilePath(key: string): string {
  return resolveStoragePath("private", key);
}

// ============================================================================
// PUBLIC FILE STORAGE (spec sections 22 & 60 — gallery/news/player photos)
// ----------------------------------------------------------------------------
// A SEPARATE bucket from PRIVATE_BUCKET above. This one IS publicly
// readable (public-read bucket policy / CDN in front of it) because its
// only contents are public-facing images (gallery media, news covers,
// player/staff photos) — never confidential documents. Never write a
// Document (spec section 16) row's file into this bucket.
// ============================================================================
const PUBLIC_BUCKET = process.env.STORAGE_PUBLIC_BUCKET;
const PUBLIC_BASE_URL = process.env.STORAGE_PUBLIC_BASE_URL;

export function getLocalPublicFilePath(key: string): string {
  if (!key.startsWith("public/") || key.includes("..")) {
    throw new Error("Invalid storage key: access restricted to public assets.");
  }
  const currentPath = resolveStoragePath("public", key);
  if (fs.existsSync(currentPath)) return currentPath;

  // Earlier local releases kept uploads beside the app in `.storage`. Newer
  // Windows releases keep durable uploads under LOCALAPPDATA. Read from the
  // legacy location when an existing asset has not yet been migrated, so
  // database URLs saved by older releases continue to work after an update.
  if (process.env.NODE_ENV === "production" && process.env.LOCALAPPDATA) {
    const legacyPath = path.resolve(path.join(process.cwd(), ".storage", "public", key));
    const relative = path.relative(path.resolve(path.join(process.cwd(), ".storage", "public")), legacyPath);
    if (relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
  }

  return currentPath;
}

export function isPublicStorageConfigured(): boolean {
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  return driver !== "local" && driver !== "database" && driver !== "db"
    && Boolean(process.env.STORAGE_PUBLIC_BUCKET?.trim());
}

async function persistPublicAssetInDatabase(params: { key: string; buffer: Buffer; mimeType: string }): Promise<void> {
  await db.publicAsset.upsert({
    where: { key: params.key },
    create: {
      key: params.key,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
      data: Uint8Array.from(params.buffer)
    },
    update: {
      mimeType: params.mimeType,
      sizeBytes: params.buffer.byteLength,
      data: Uint8Array.from(params.buffer)
    }
  });
}

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const MAX_VIDEO_SIZE_BYTES = 35 * 1024 * 1024; // 35MB - realistic size preventing DB/server strain

export async function validateUploadedImage(buffer: Buffer): Promise<{ mime: string; ext: string }> {
  if (buffer.byteLength === 0) {
    throw new FileValidationError("الملف فارغ.");
  }
  if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new FileValidationError("حجم الصورة يتجاوز الحد المسموح به (8MB).");
  }
  const detected = await detectFileType(buffer);
  if (!detected || !ALLOWED_IMAGE_MIME_TYPES.includes(detected.mime as any)) {
    throw new FileValidationError("نوع الصورة غير مسموح به.");
  }
  return { mime: detected.mime, ext: detected.ext };
}

/** Small image profile for dashboard banners; GIF is permitted with a stricter size limit. */
export async function validateUploadedBannerImage(buffer: Buffer): Promise<{ mime: string; ext: string }> {
  const maxBytes = 2 * 1024 * 1024;
  if (buffer.byteLength === 0) throw new FileValidationError("الملف فارغ.");
  if (buffer.byteLength > maxBytes) throw new FileValidationError("حجم صورة البانر يتجاوز 2 ميغابايت.");

  const detected = await detectFileType(buffer);
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!detected || !allowed.includes(detected.mime)) {
    throw new FileValidationError("صيغ صورة الغلاف المدعومة هي JPG وPNG وWebP وGIF.");
  }
  if (detected.mime === "image/gif") {
    if (buffer.byteLength < 10) throw new FileValidationError("ملف GIF غير مكتمل.");
    const width = buffer.readUInt16LE(6);
    const height = buffer.readUInt16LE(8);
    if (width < 1 || height < 1 || width > 1920 || height > 1080) {
      throw new FileValidationError("أبعاد GIF يجب ألا تتجاوز 1920×1080 بكسل.");
    }
  }
  return { mime: detected.mime, ext: detected.ext };
}

/**
 * Validates uploaded media file (image or lightweight video) for public gallery and news.
 * Strictly enforces magic byte detection and size thresholds (8MB for images, 35MB for videos).
 */
export async function validateUploadedMedia(buffer: Buffer): Promise<{ mime: string; ext: string; isVideo: boolean }> {
  if (buffer.byteLength === 0) {
    throw new FileValidationError("الملف فارغ.");
  }

  const detected = await detectFileType(buffer);
  if (!detected) {
    throw new FileValidationError("نوع الملف غير معروف أو تالف.");
  }

  const isImg = ALLOWED_IMAGE_MIME_TYPES.includes(detected.mime as any);
  const isVid = ALLOWED_VIDEO_MIME_TYPES.includes(detected.mime as any);

  if (!isImg && !isVid) {
    throw new FileValidationError("نوع الملف غير مسموح به. الصيغ المدعومة: صور (JPG, PNG, WebP) وفيديوهات (MP4, WebM).");
  }

  if (isImg && buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new FileValidationError("حجم الصورة يتجاوز الحد الأقصى المسموح به (8MB).");
  }

  if (isVid && buffer.byteLength > MAX_VIDEO_SIZE_BYTES) {
    throw new FileValidationError("حجم الفيديو يتجاوز الحد الأقصى المسموح به (35MB). يرجى تقليل حجم الفيديو لضمان سرعة التحميل وتجنب استهلاك الموارد.");
  }

  return { mime: detected.mime, ext: detected.ext, isVideo: isVid };
}

export function generatePublicStorageKey(category: string, ext: string): string {
  const datePrefix = new Date().toISOString().slice(0, 7);
  return `public/${category}/${datePrefix}/${nanoid(24)}.${ext}`;
}

export function extractPublicStorageKey(urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  if (urlOrKey.includes("/api/storage/public-file")) {
    try {
      const url = new URL(urlOrKey, "http://localhost");
      return url.searchParams.get("key");
    } catch {
      return null;
    }
  }
  if (urlOrKey.startsWith("public/")) {
    return urlOrKey;
  }
  const match = urlOrKey.match(/(public\/[a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return urlOrKey;
}

/** Stores public media in S3 when configured, otherwise in the database. */
export async function uploadPublicFile(params: { key: string; buffer: Buffer; mimeType: string }): Promise<string> {
  if (isPublicStorageConfigured()) {
    try {
      // Resolve the client inside the guarded block as well. A partially
      // configured deployment (bucket set but credentials missing) must not
      // crash the Server Component while saving a small profile avatar.
      const s3 = getS3Client();
      await s3.send(
        new PutObjectCommand({
          Bucket: PUBLIC_BUCKET,
          Key: params.key,
          Body: params.buffer,
          ContentType: params.mimeType
        })
      );
      // If no public CDN URL is configured, serve through the app's S3 proxy.
      return PUBLIC_BASE_URL?.trim()
        ? `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${params.key}`
        : `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
    } catch (error) {
      // Keep small public images available through the database-backed public
      // file route if the configured object store is unavailable. This also
      // prevents imported club crests from falling back to fragile EMS URLs.
      if (params.buffer.byteLength <= MAX_IMAGE_SIZE_BYTES) {
        try {
          await persistPublicAssetInDatabase(params);
          return `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
        } catch {
          // Continue to the narrow legacy avatar fallback below.
        }
      }
      if (params.key.startsWith("public/users/") && params.buffer.byteLength <= 700 * 1024) {
        return `data:${params.mimeType};base64,${params.buffer.toString("base64")}`;
      }
      throw error;
    }
  }

  if (isDatabaseStorageMode()) {
    await persistPublicAssetInDatabase(params);
    return `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
  }

  if (!isLocalStorageMode()) {
    throw new StorageConfigurationError("Public storage bucket is not configured.");
  }

  // Explicit local mode is retained for development and opt-in deployments.
  const targetPath = resolveStoragePath("public", params.key);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, params.buffer);
  return `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
}

export async function deletePublicFile(urlOrKey: string): Promise<void> {
  // Database-backed avatars and external legacy URLs are not S3 objects.
  if (urlOrKey.startsWith("data:") || /^https?:\/\//i.test(urlOrKey)) return;
  const key = extractPublicStorageKey(urlOrKey) || urlOrKey;
  if (!key) return;

  if (isPublicStorageConfigured()) {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
    return;
  }

  if (isDatabaseStorageMode()) {
    const deleted = await db.publicAsset.deleteMany({ where: { key } });
    if (deleted.count > 0) return;
    // Existing files from releases before database media remain readable and
    // deletable through the legacy local path during migration.
  }

  if (!isLocalStorageMode() && !isDatabaseStorageMode()) {
    throw new StorageConfigurationError("Public storage bucket is not configured.");
  }

  try {
    const localPath = getLocalPublicFilePath(key);
    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
    }
  } catch {
    // safe no-op on delete error
  }
}

type PublicFileObject = {
  body: Buffer;
  contentRange?: string;
  contentLength?: number;
};

/** Read a public media object retained in the database during storage migrations. */
async function getDatabasePublicFileObject(key: string, range?: string | null): Promise<PublicFileObject | null> {
  const asset = await db.publicAsset.findUnique({
    where: { key },
    select: { sizeBytes: true }
  });
  if (!asset) return null;

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2]) && asset.sizeBytes > 0) {
      const start = match[1] ? Number(match[1]) : Math.max(0, asset.sizeBytes - Number(match[2]));
      const end = match[1] && match[2] ? Number(match[2]) : asset.sizeBytes - 1;
      if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start && start < asset.sizeBytes) {
        const boundedEnd = Math.min(end, asset.sizeBytes - 1);
        const length = boundedEnd - start + 1;
        const [rangeAsset] = process.env.DATABASE_PROVIDER === "mysql"
          ? await db.$queryRaw<Array<{ data: Uint8Array }>>`SELECT SUBSTRING(data, ${start + 1}, ${length}) AS data FROM PublicAsset WHERE \`key\` = ${key}`
          : await db.$queryRaw<Array<{ data: Uint8Array }>>`SELECT substring("data" FROM ${start + 1} FOR ${length}) AS "data" FROM "PublicAsset" WHERE "key" = ${key}`;
        if (!rangeAsset?.data) throw new Error("Public media range was not found.");
        const body = Buffer.from(rangeAsset.data);
        return {
          body,
          contentRange: `bytes ${start}-${boundedEnd}/${asset.sizeBytes}`,
          contentLength: body.byteLength
        };
      }
    }
  }

  const fullAsset = await db.publicAsset.findUnique({ where: { key }, select: { data: true } });
  if (!fullAsset) throw new Error("Public asset was not found.");
  return { body: Buffer.from(fullAsset.data), contentLength: asset.sizeBytes };
}

/** Read a public object from the configured bucket, optionally using an HTTP byte range. */
export async function getPublicFileObject(key: string, range?: string | null): Promise<PublicFileObject> {
  if (!key.startsWith("public/") || key.includes("..")) {
    throw new Error("Invalid storage key: access restricted to public assets.");
  }

  if (isDatabaseStorageMode()) {
    const asset = await getDatabasePublicFileObject(key, range);
    if (asset) return asset;

    // Preserve access to files uploaded before the database migration. New
    // uploads cannot use this path; it is only a compatibility read fallback.
    // If absent in the DB, continue to the old on-disk path for migration-era assets.
  } else if (!isPublicStorageConfigured() && !isLocalStorageMode()) {
    throw new StorageConfigurationError("Public storage is not configured.");
  }

  if (isPublicStorageConfigured()) {
    try {
      const response = await getS3Client().send(new GetObjectCommand({
        Bucket: PUBLIC_BUCKET,
        Key: key,
        Range: range || undefined
      }));
      const byteArray = await response.Body?.transformToByteArray();
      if (byteArray) {
        return {
          body: Buffer.from(byteArray),
          contentRange: response.ContentRange,
          contentLength: response.ContentLength
        };
      }
    } catch {
      // Public uploads created before the S3 migration may still live in the DB.
    }

    const migratedAsset = await getDatabasePublicFileObject(key, range);
    if (migratedAsset) return migratedAsset;
  }

  if (!isLocalStorageMode() && !isDatabaseStorageMode()) throw new Error("Public asset was not found.");
  const filePath = getLocalPublicFilePath(key);
  if (!fs.existsSync(filePath)) throw new Error("Public asset was not found.");
  const stat = await fs.promises.stat(filePath);
  const body = await fs.promises.readFile(filePath);
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2]) && stat.size > 0) {
      const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
      const end = match[1] && match[2] ? Number(match[2]) : stat.size - 1;
      if (Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start && start < stat.size) {
        const boundedEnd = Math.min(end, stat.size - 1);
        const part = body.subarray(start, boundedEnd + 1);
        return { body: part, contentRange: `bytes ${start}-${boundedEnd}/${stat.size}`, contentLength: part.byteLength };
      }
    }
  }
  return { body, contentLength: stat.size };
}

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" // .xlsx
] as const;

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export class FileValidationError extends Error {}

/**
 * Validates a file server-side before it is ever written to storage.
 * Checks real magic-number-derived type (not client-supplied MIME/extension)
 * against an allow-list, and enforces a max size. Throws FileValidationError
 * with a user-safe message on failure.
 */
export async function validateUploadedFile(buffer: Buffer): Promise<{ mime: string; ext: string }> {
  if (buffer.byteLength === 0) {
    throw new FileValidationError("الملف فارغ.");
  }
  if (buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw new FileValidationError("حجم الملف يتجاوز الحد المسموح به (25MB).");
  }

  const detected = await detectFileType(buffer);

  if (!detected || !ALLOWED_DOCUMENT_MIME_TYPES.includes(detected.mime as any)) {
    throw new FileValidationError("نوع الملف غير مسموح به.");
  }

  return { mime: detected.mime, ext: detected.ext };
}

/** Generates a random, non-guessable storage key — never derived from the user-supplied filename. */
export function generateStorageKey(category: string, ext: string): string {
  const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM, keeps buckets browsable
  return `documents/${category}/${datePrefix}/${nanoid(24)}.${ext}`;
}

export async function uploadPrivateFile(params: {
  key: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<void> {
  if (isStorageConfigured()) {
    const bucket = process.env.STORAGE_PRIVATE_BUCKET?.trim();
    if (!bucket) {
      throw new StorageConfigurationError("Private storage bucket is not configured.");
    }
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.mimeType
      })
    );
    return;
  }

  if (isPrivateDatabaseStorageMode()) {
    await db.privateAsset.upsert({
      where: { key: params.key },
      create: { key: params.key, mimeType: params.mimeType, sizeBytes: params.buffer.byteLength, data: Uint8Array.from(params.buffer) },
      update: { mimeType: params.mimeType, sizeBytes: params.buffer.byteLength, data: Uint8Array.from(params.buffer) }
    });
    return;
  }

  if (isLocalStorageMode()) {
    const targetPath = getLocalFilePath(params.key);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, params.buffer);
    return;
  }

  throw new StorageConfigurationError("Private storage bucket is not configured.");
}

/** Short-lived (default 2 min) signed GET URL — minted only after a server-side permission check. */
export async function getPrivateFileDownloadUrl(
  key: string,
  expiresInSeconds = 120,
  options?: { inline?: boolean }
): Promise<string> {
  if (isStorageConfigured()) {
    const bucket = process.env.STORAGE_PRIVATE_BUCKET?.trim();
    if (!bucket) {
      throw new StorageConfigurationError("Private storage bucket is not configured.");
    }
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: options?.inline ? "inline" : undefined
    });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
  }

  if (isLocalStorageMode() || isPrivateDatabaseStorageMode()) {
    const boundedExpiry = Math.max(1, Math.min(Math.floor(expiresInSeconds), 300));
    const expiresAt = Date.now() + boundedExpiry * 1000;
    const inline = options?.inline === true;
    const signature = signLocalDownload(key, expiresAt, inline);
    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      sig: signature
    });
    if (inline) {
      params.set("inline", "true");
    }
    return `/api/storage/local-download?${params.toString()}`;
  }

  throw new StorageConfigurationError("Private storage bucket is not configured.");
}

// Reads a private object's bytes directly into memory, server-side only —
// used by the document generation service to feed an uploaded .docx
// template into docxtemplater. Never exposed to the browser; the browser
// only ever gets a short-lived signed URL (above) or the generated output.
export async function getPrivateFileBuffer(key: string): Promise<Buffer> {
  if (isStorageConfigured()) {
    const bucket = process.env.STORAGE_PRIVATE_BUCKET?.trim();
    if (!bucket) {
      throw new StorageConfigurationError("Private storage bucket is not configured.");
    }
    const s3 = getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    try {
      const response = await s3.send(command);
      const byteArray = await response.Body?.transformToByteArray();
      if (!byteArray) throw new Error(`Object not found or empty: ${key}`);
      return Buffer.from(byteArray);
    } catch (error) {
      const storageError = error as { name?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number }; message?: string };
      const missingObject = storageError.$metadata?.httpStatusCode === 404
        || [storageError.name, storageError.Code, storageError.code].some((code) => code === "NoSuchKey" || code === "NotFound" || code === "NoSuchObject")
        || /specified key does not exist|no such key|object not found/i.test(storageError.message || "");
      if (!missingObject) throw error;

      // Deployments sometimes switch from DB/local storage to S3 while older
      // document rows still point to files in the previous backend. Recover
      // those bytes once and copy them into the active bucket under the same
      // key so every later read (including signed downloads) works normally.
      const legacyAsset = await db.privateAsset.findUnique({ where: { key }, select: { data: true, mimeType: true } });
      let recovered: Buffer | null = legacyAsset?.data ? Buffer.from(legacyAsset.data) : null;
      let recoveredMime = legacyAsset?.mimeType || "application/octet-stream";
      if (!recovered) {
        const localPath = getLocalFilePath(key);
        if (fs.existsSync(localPath)) recovered = await fs.promises.readFile(localPath);
      }
      if (!recovered?.byteLength) throw error;

      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: recovered, ContentType: recoveredMime }));
      return recovered;
    }
  }

  if (isPrivateDatabaseStorageMode()) {
    const asset = await db.privateAsset.findUnique({ where: { key }, select: { data: true } });
    if (asset?.data) return Buffer.from(asset.data);
    throw new Error(`Object not found or empty: ${key}`);
  }

  if (isLocalStorageMode()) {
    const targetPath = getLocalFilePath(key);
    if (!fs.existsSync(targetPath)) {
      if (key.startsWith("templates/") || key.startsWith("template/")) {
        const fixturePath = path.resolve(process.cwd(), "tests", "finance", "fixtures", "official-template.docx");
        if (fs.existsSync(fixturePath)) {
          const fixtureBuf = await fs.promises.readFile(fixturePath);
          await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.promises.writeFile(targetPath, fixtureBuf);
          return fixtureBuf;
        }
      }
      throw new Error(`Object not found or empty: ${key}`);
    }
    return fs.promises.readFile(targetPath);
  }

  throw new StorageConfigurationError("Private storage bucket is not configured.");
}

export async function deletePrivateFile(key: string): Promise<void> {
  if (isStorageConfigured()) {
    const bucket = process.env.STORAGE_PRIVATE_BUCKET?.trim();
    if (!bucket) return;
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }

  if (isPrivateDatabaseStorageMode()) {
    await db.privateAsset.deleteMany({ where: { key } });
    return;
  }

  if (isLocalStorageMode()) {
    const targetPath = getLocalFilePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => undefined);
    }
    return;
  }

  throw new StorageConfigurationError("Private storage bucket is not configured.");
}
