/**
 * Media detection utility to identify whether a media URL or filename is a video.
 */
export function isVideoUrl(urlOrKey: string | null | undefined): boolean {
  if (!urlOrKey) return false;
  const parts = urlOrKey.split("?");
  const clean = (parts[0] || "").toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov");
}
