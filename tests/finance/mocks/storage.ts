// TEST DOUBLE — used only by tests/finance (never imported by application code).
export const files = new Map<string, Buffer>();
export const storageLog: string[] = [];
export function generateStorageKey(category: string, ext: string) { return `${category}/${files.size + storageLog.length}-${Math.random().toString(36).slice(2)}.${ext}`; }
export async function uploadPrivateFile({ key, buffer }: { key: string; buffer: Buffer }) { files.set(key, Buffer.from(buffer)); storageLog.push(`put ${key}`); }
export async function getPrivateFileBuffer(key: string) { const b = files.get(key); if (!b) throw new Error("missing template file"); return Buffer.from(b); } // a COPY, like a real download
export async function deletePrivateFile(key: string) { files.delete(key); storageLog.push(`del ${key}`); }
export async function getPrivateFileDownloadUrl(key: string) { return `https://signed.example/${key}`; }
