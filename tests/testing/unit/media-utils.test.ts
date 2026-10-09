import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicMediaUrl } from "../../../src/lib/media-utils";

test("normalizes storage keys and legacy localhost media URLs to this deployment", () => {
  const key = "public/players/2026/player photo.png";
  const expected = `/api/storage/public-file?key=${encodeURIComponent(key)}`;

  assert.equal(normalizePublicMediaUrl(key), expected);
  assert.equal(normalizePublicMediaUrl(`https://localhost:3000/api/storage/public-file?key=${encodeURIComponent(key)}`), expected);
  assert.equal(normalizePublicMediaUrl(`/api/storage/public-file?key=${encodeURIComponent(key)}`), expected);
  assert.equal(normalizePublicMediaUrl(`/public/players/2026/photo.webp`), "/api/storage/public-file?key=public%2Fplayers%2F2026%2Fphoto.webp");
});

test("preserves supported external and data image URLs and rejects invalid values", () => {
  assert.equal(normalizePublicMediaUrl("https://cdn.example.test/photo.webp"), "https://cdn.example.test/photo.webp");
  assert.equal(normalizePublicMediaUrl("https://cdn.example.test/public/photo.webp"), "https://cdn.example.test/public/photo.webp");
  assert.equal(normalizePublicMediaUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(normalizePublicMediaUrl(null), null);
  assert.equal(normalizePublicMediaUrl("javascript:alert(1)"), null);
  assert.equal(normalizePublicMediaUrl(""), null);
});
