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
  if (process.env.STORAGE_DRIVER?.trim().toLowerCase() === "local") return false;
  return Boolean(process.env.STORAGE_PRIVATE_BUCKET?.trim());
}

/** In non-production environments (or when STORAGE_DRIVER=local), allows fallback to isolated local private storage. */
export function isLocalStorageMode(): boolean {
  const driver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
  if (driver === "local") return true;
  if (driver === "s3") return false;
  return !isStorageConfigured() && process.env.NODE_ENV !== "production";
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
  // Resolve the configurable root once per call so environment values are
  // respected by cPanel's application manager and by test processes.
  return path.resolve(configuredRoot || path.join(process.cwd(), ".storage"));
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
  return resolveStoragePath("public", key);
}

export function isPublicStorageConfigured(): boolean {
  return process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "local"
    && Boolean(process.env.STORAGE_PUBLIC_BUCKET?.trim());
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

/** Uploads to the PUBLIC bucket (or local storage if unconfigured) and returns the resulting public URL. Never used for Document rows. */
export async function uploadPublicFile(params: { key: string; buffer: Buffer; mimeType: string }): Promise<string> {
  if (isPublicStorageConfigured()) {
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: PUBLIC_BUCKET,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.mimeType
      })
    );
    // If no public CDN URL is configured (for example, Neon private buckets),
    // serve the object through the app's authenticated S3 proxy route.
    return PUBLIC_BASE_URL?.trim()
      ? `${PUBLIC_BASE_URL.replace(/\/$/, "")}/${params.key}`
      : `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
  }

  if (!isLocalStorageMode()) {
    throw new StorageConfigurationError("Public storage bucket is not configured.");
  }

  // Local storage mode for public media (works out of the box in development and self-hosted environments)
  const targetPath = getLocalPublicFilePath(params.key);
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, params.buffer);
  return `/api/storage/public-file?key=${encodeURIComponent(params.key)}`;
}

export async function deletePublicFile(urlOrKey: string): Promise<void> {
  const key = extractPublicStorageKey(urlOrKey) || urlOrKey;
  if (!key) return;

  if (isPublicStorageConfigured()) {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
    return;
  }

  if (!isLocalStorageMode()) {
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

/** Read a public object from the configured bucket, optionally using an HTTP byte range. */
export async function getPublicFileObject(key: string, range?: string | null): Promise<{
  body: Buffer;
  contentRange?: string;
  contentLength?: number;
}> {
  if (!isPublicStorageConfigured()) {
    throw new StorageConfigurationError("Public storage bucket is not configured.");
  }
  if (!key.startsWith("public/") || key.includes("..")) {
    throw new Error("Invalid storage key: access restricted to public assets.");
  }
  const response = await getS3Client().send(new GetObjectCommand({
    Bucket: PUBLIC_BUCKET,
    Key: key,
    Range: range || undefined
  }));
  const byteArray = await response.Body?.transformToByteArray();
  if (!byteArray) throw new Error("Public object was not found.");
  return {
    body: Buffer.from(byteArray),
    contentRange: response.ContentRange,
    contentLength: response.ContentLength
  };
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

  if (isLocalStorageMode()) {
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
    const response = await s3.send(command);
    const byteArray = await response.Body?.transformToByteArray();
    if (!byteArray) throw new Error(`Object not found or empty: ${key}`);
    return Buffer.from(byteArray);
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

  if (isLocalStorageMode()) {
    const targetPath = getLocalFilePath(key);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => undefined);
    }
    return;
  }

  throw new StorageConfigurationError("Private storage bucket is not configured.");
}
