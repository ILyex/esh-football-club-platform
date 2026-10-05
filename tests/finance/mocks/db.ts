// TEST DOUBLE — used only by tests/finance (never imported by application code).
import { Prisma } from "./prisma-client";
import { AsyncLocalStorage } from "node:async_hooks";

// Tracks "we are inside a $transaction callback". Any call made through the ROOT client while a transaction
// callback is running is a bug (it would escape the transaction: not atomic, not rolled back) and throws.
const txContext = new AsyncLocalStorage<{ active: true }>();

type Row = Record<string, any>;
export const store: Record<string, Row[]> = {
  treasuryAccount: [],
  treasuryTransaction: [],
  expense: [],
  budget: [],
  auditLog: [],
  generatedDocument: [],
  documentTemplateVersion: [],
  clubSettings: [],
  team: [],
  userTeam: [],
  role: [],
  user: [],
  match: [],
  meetingMinute: [],
  correspondence: [],
  backgroundJob: [],
  notification: [],
  player: [],
  staff: [],
  competition: [],
  trainingSession: [],
  document: [],
  contract: [],
  news: [],
  announcement: [],
  playerTranslation: [],
  gmailConnection: []
};
export const faults = { auditCreate: false };
const rateLimitBuckets = new Map<string, { count: number; expiresAt: number }>();
let idCounter = 0;
const UNIQUE: Record<string, string[]> = {
  treasuryTransaction: ["id", "referenceNumber", "idempotencyKey", "relatedExpenseId", "reversalOfTransactionId"],
  backgroundJob: ["id", "idempotencyKey"],
  notification: ["id", "dedupKey"],
  gmailConnection: ["id", "emailAddress"]
};


function matches(row: Row, where: Row = {}): boolean {
  if (!where || typeof where !== "object") return true;
  return Object.entries(where).every(([k, v]) => {
    if (k === "AND") {
      if (Array.isArray(v)) return v.every((cond) => matches(row, cond));
      return matches(row, v);
    }
    if (k === "OR") {
      if (Array.isArray(v)) return v.length === 0 || v.some((cond) => matches(row, cond));
      return matches(row, v);
    }
    if (k === "NOT") {
      if (Array.isArray(v)) return !v.some((cond) => matches(row, cond));
      return !matches(row, v);
    }
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("not" in v) return row[k] !== v.not;
      if ("in" in v) return Array.isArray(v.in) ? v.in.includes(row[k]) : false;
      if ("notIn" in v) return Array.isArray(v.notIn) ? !v.notIn.includes(row[k]) : true;
      if ("startsWith" in v) {
        const val = String(row[k] ?? "");
        return val.startsWith(String(v.startsWith));
      }
      if ("contains" in v) {
        const val = String(row[k] ?? "");
        return val.toLowerCase().includes(String(v.contains).toLowerCase());
      }
      if ("is" in v && v.is === null) return true; // relation filters are not modelled in this fake
      return true;
    }
    return row[k] === v;
  });
}
function uniqueFind(model: string, where: Row): Row | null {
  const found = store[model]!.find((r) => matches(r, where));
  return found ?? null;
}

function model(name: string, extra: Record<string, any> = {}) {
  return {
    async findUnique({ where, include }: any) {
      const row = uniqueFind(name, where);
      return row ? decorate(name, row, include) : null;
    },
    async findUniqueOrThrow({ where, include }: any) {
      const row = uniqueFind(name, where);
      if (!row) throw new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025" });
      return decorate(name, row, include);
    },
    async findMany({ where, select }: any = {}) { return store[name]!.filter((r) => matches(r, where)).map((r) => ({ ...r })); },
    async create({ data }: any) {
      if (name === "auditLog" && faults.auditCreate) throw new Error("audit insert failed");
      for (const field of UNIQUE[name] ?? []) {
        if (data[field] != null && store[name]!.some((r) => r[field] === data[field])) {
          throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${field}`, { code: "P2002" });
        }
      }
      const nullDefaults = name === "treasuryTransaction" ? { relatedExpenseId: null, reversalOfTransactionId: null, documentId: null, description: null } : {};
      const now = new Date();
      const row = { id: data.id ?? `id${++idCounter}`, createdAt: now, updatedAt: now, ...nullDefaults, ...data };
      store[name]!.push(row);
      return { ...row };
    },
    async createMany({ data }: any) {
      const items = Array.isArray(data) ? data : [data];
      const now = new Date();
      items.forEach((item) => store[name]!.push({ id: item.id ?? `id${++idCounter}`, createdAt: now, updatedAt: now, ...item }));
      return { count: items.length };
    },
    async findFirst({ where, include, orderBy }: any = {}) {
      let rows = store[name]!.filter((r) => matches(r, where));
      if (orderBy) {
        const [field, dir] = Object.entries(orderBy)[0] as [string, string];
        rows = [...rows].sort((a, b) => {
          const valA = a[field] instanceof Date ? a[field].getTime() : (a[field] ?? 0);
          const valB = b[field] instanceof Date ? b[field].getTime() : (b[field] ?? 0);
          return dir.toLowerCase() === "desc" ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
        });
      }
      return rows[0] ? decorate(name, rows[0], include) : null;
    },
    async update({ where, data }: any) {
      const row = uniqueFind(name, where);
      if (!row) throw new Prisma.PrismaClientKnownRequestError("not found", { code: "P2025" });
      Object.assign(row, { updatedAt: new Date(), ...data });
      return { ...row };
    },
    async updateMany({ where, data }: any) {
      const rows = store[name]!.filter((r) => matches(r, where));
      const now = new Date();
      rows.forEach((r) => Object.assign(r, { updatedAt: now, ...data }));
      return { count: rows.length };
    },
    async upsert({ where, create, update }: any) {
      const existing = uniqueFind(name, where);
      if (existing) {
        Object.assign(existing, { updatedAt: new Date(), ...update });
        return { ...existing };
      }
      for (const field of UNIQUE[name] ?? []) {
        if (create[field] != null && store[name]!.some((r) => r[field] === create[field])) {
          throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${field}`, { code: "P2002" });
        }
      }
      const now = new Date();
      const row = { id: create.id ?? `id${++idCounter}`, createdAt: now, updatedAt: now, ...create };
      store[name]!.push(row);
      return { ...row };
    },
    async count({ where }: any = {}) { return store[name]!.filter((r) => matches(r, where)).length; },
    ...extra
  };
}
function decorate(name: string, row: Row, include?: Row) {
  const out: Row = { ...row };
  if (name === "expense" && include?.treasuryTransaction) {
    const tx = store.treasuryTransaction!.find((t) => t.relatedExpenseId === row.id) ?? null;
    out.treasuryTransaction = tx ? { ...tx } : null;
    if (tx && include.treasuryTransaction?.include?.reversedBy) {
      const rev = store.treasuryTransaction!.find((t) => t.reversalOfTransactionId === tx.id);
      out.treasuryTransaction.reversedBy = rev ? { id: rev.id } : null;
    }
  }
  if (name === "treasuryTransaction") {
    if (include?.treasuryAccount) out.treasuryAccount = { ...store.treasuryAccount!.find((a) => a.id === row.treasuryAccountId) };
    if (include?.relatedExpense) out.relatedExpense = row.relatedExpenseId ? { ...store.expense!.find((e) => e.id === row.relatedExpenseId) } : null;
    if (include?.reversedBy) { const rev = store.treasuryTransaction!.find((t) => t.reversalOfTransactionId === row.id); out.reversedBy = rev ? { id: rev.id } : null; }
  }
  if (name === "expense" && include?.treasuryTransaction?.include?.treasuryAccount && out.treasuryTransaction) {
    out.treasuryTransaction.treasuryAccount = { ...store.treasuryAccount!.find((a) => a.id === out.treasuryTransaction.treasuryAccountId) };
  }
  return out;
}

const treasuryTransaction = model("treasuryTransaction", {
  async aggregate({ where, _sum }: any) {
    const rows = store.treasuryTransaction!.filter((r) => matches(r, where));
    return { _sum: { amount: rows.length ? rows.reduce((s, r) => s + r.amount, 0) : null } };
  },
  async groupBy({ where }: any) {
    const groups = new Map<string, number>();
    for (const r of store.treasuryTransaction!.filter((x) => matches(x, where))) {
      const key = `${r.treasuryAccountId}|${r.type}`;
      groups.set(key, (groups.get(key) ?? 0) + r.amount);
    }
    return [...groups.entries()].map(([k, sum]) => { const [treasuryAccountId, type] = k.split("|"); return { treasuryAccountId, type, _sum: { amount: sum } }; });
  }
});

// Serializes transactions (a mutex) and rolls back on throw — models the OUTCOME a SERIALIZABLE
// transaction guarantees. It does NOT model Postgres itself.
let lock: Promise<unknown> = Promise.resolve();
function guarded(models: Record<string, any>, isTx: boolean) {
  const out: Record<string, any> = {};
  for (const [name, m] of Object.entries(models)) {
    out[name] = Object.fromEntries(
      Object.entries(m).map(([fn, impl]) => [
        fn,
        (...args: any[]) => {
          if (!isTx && txContext.getStore()) throw new Error(`ROOT CLIENT USED INSIDE TRANSACTION: ${name}.${fn}`);
          return (impl as any)(...args);
        }
      ])
    );
  }
  return out;
}
const models = {
  treasuryAccount: model("treasuryAccount"),
  treasuryTransaction,
  expense: model("expense"),
  clubSettings: model("clubSettings"),
  budget: model("budget"),
  auditLog: model("auditLog"),
  generatedDocument: model("generatedDocument"),
  documentTemplateVersion: model("documentTemplateVersion"),
  team: model("team"),
  userTeam: model("userTeam"),
  role: model("role"),
  user: model("user"),
  match: model("match"),
  meetingMinute: model("meetingMinute"),
  correspondence: model("correspondence"),
  backgroundJob: model("backgroundJob"),
  notification: model("notification"),
  player: model("player"),
  staff: model("staff"),
  competition: model("competition"),
  trainingSession: model("trainingSession"),
  document: model("document"),
  contract: model("contract"),
  news: model("news"),
  announcement: model("announcement"),
  playerTranslation: model("playerTranslation"),
  gmailConnection: model("gmailConnection")
};
const txClient: any = guarded(models, true);
export const db: any = {
  ...guarded(models, false),
  async $queryRaw(strings: TemplateStringsArray, ...values: any[]) {
    const sql = strings.join("?");
    if (!sql.includes('INSERT INTO "RateLimitBucket"')) throw new Error("Unexpected raw query in finance test double");
    const [key, windowMs] = values as [string, number, number];
    const now = Date.now();
    const current = rateLimitBuckets.get(key);
    const next = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowMs }
      : { count: current.count + 1, expiresAt: current.expiresAt };
    rateLimitBuckets.set(key, next);
    return [{ count: next.count, resetTimeMs: BigInt(next.expiresAt) }];
  },
  async $executeRaw(strings: TemplateStringsArray, ...values: any[]) {
    const sql = strings.join("?");
    if (sql.includes('DELETE FROM "RateLimitBucket" WHERE "key" = ?')) {
      return Number(rateLimitBuckets.delete(String(values[0])));
    }
    if (sql.includes('WITH expired AS')) {
      const now = Date.now();
      for (const [key, bucket] of rateLimitBuckets) if (bucket.expiresAt < now) rateLimitBuckets.delete(key);
      return 0;
    }
    throw new Error("Unexpected raw command in finance test double");
  },
  async $transaction(fn: (tx: any) => Promise<any>) {
    const run = async () => {
      const snapshot = JSON.parse(JSON.stringify(store), (k, v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v));
      // yield so that concurrent callers genuinely interleave before entering the critical section
      await Promise.resolve();
      try { return await txContext.run({ active: true }, () => fn(txClient)); } catch (e) { for (const key of Object.keys(store)) store[key] = snapshot[key]; throw e; }
    };
    const next = lock.then(run, run);
    lock = next.catch(() => undefined);
    return next;
  }
};
export function reset() { for (const k of Object.keys(store)) store[k] = []; idCounter = 0; }
