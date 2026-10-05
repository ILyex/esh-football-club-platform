// TEST DOUBLE — used only by tests/finance (never imported by application code).
export class PrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, opts: { code: string }) { super(message); this.code = opts.code; this.name = "PrismaClientKnownRequestError"; }
}
export const Prisma = {
  PrismaClientKnownRequestError,
  TransactionIsolationLevel: { Serializable: "Serializable" }
};
export class PrismaClient {}
