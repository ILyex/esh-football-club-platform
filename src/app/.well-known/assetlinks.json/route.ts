const packageName = "dz.esh.footballclub.field";
const previewFingerprint = "26:47:ED:85:C9:47:3D:DA:86:D9:C1:75:FA:93:54:22:80:35:56:D3:67:85:68:B6:F7:CA:6A:96:99:7A:20:10";

export function GET() {
  const configuredFingerprints = (process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value));
  const fingerprints = Array.from(new Set([
    ...configuredFingerprints,
    previewFingerprint,
  ]));

  const statements = fingerprints.length ? [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints }
  }] : [];

  return Response.json(statements, { headers: { "Cache-Control": "public, max-age=300" } });
}
