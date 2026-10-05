import "server-only";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import {
  validateUploadedFile,
  uploadPrivateFile,
  generateStorageKey,
  FileValidationError
} from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { revalidatePath } from "next/cache";
import { verifyDocument } from "@/lib/ai/document-verifier";

/**
 * Saves an uploaded supporting document (stamped invoice, payment receipt, grant decision)
 * into private storage and records it in the Document repository linked to Finance.
 */
export async function saveSupportingFinanceDocument({
  file,
  title,
  userId,
  teamId
}: {
  file: File;
  title: string;
  userId: string;
  teamId?: string | null;
}): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = await validateUploadedFile(buffer);

  // Retrieve or create appropriate document category
  let category = await db.documentCategory.findFirst({
    where: {
      OR: [
        { name: "Administrative Documents" },
        { name: "Official Decisions" },
        { name: "Reports" },
        { name: "Other Documents" }
      ]
    }
  });

  if (!category) {
    category = await db.documentCategory.findFirst();
  }

  if (!category) {
    throw new Error("No document category found for finance records.");
  }

  const storageKey = generateStorageKey("finance-receipts", validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const doc = await db.document.create({
    data: {
      name: title,
      categoryId: category.id,
      classification: "INTERNAL", // accessible to club officers & finance roles
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: userId,
      uploadedById: userId,
      teamId: teamId || null,
      status: "APPROVED"
    }
  });

  await writeAuditLog({
    userId,
    action: "finance.document.upload",
    entityType: "Document",
    entityId: doc.id,
    changes: { originalName: file.name, sizeBytes: buffer.byteLength }
  });

  return doc.id;
}

/**
 * Server action to attach or update a stamped invoice/receipt for an existing expense.
 */
export async function attachExpenseDocumentAction(expenseId: string, formData: FormData) {
  const user = await requirePermission("finance.manage");
  const scopeContext = await getMutationScopeContext();

  const file = formData.get("receiptFile") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No receipt file provided");
  }

  const expense = await db.expense.findUniqueOrThrow({
    where: { id: expenseId },
    include: { document: true }
  });

  assertTeamScope(scopeContext, expense.teamId, "Expense");

  // ── AI + Rule-based receipt verification ─────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const validated = await validateUploadedFile(buffer);

  const verification = await verifyDocument(buffer, validated.mime, {
    kind: "EXPENSE_RECEIPT",
    amount: expense.amount,
    date: expense.date ?? null,
    payeeName: expense.description?.slice(0, 60) || null
  });

  if (verification.verdict === "REJECT") {
    const codes = verification.findings
      .filter((f) => f.severity === "error")
      .map((f) => f.code)
      .join(", ");
    throw new Error(
      `VERIFY_REJECT|${codes}|تعذّر قبول الوثيقة — يرجى التحقق من المبلغ وصحة المستند`
    );
  }
  // ── End verification ──────────────────────────────────────────────────────

  const title = `فاتورة معتمدة — ${expense.referenceNumber} (${expense.description.slice(0, 40)})`;

  // We already validated & read the buffer above — write directly to skip a second read
  let category = await db.documentCategory.findFirst({
    where: {
      OR: [
        { name: "Administrative Documents" },
        { name: "Official Decisions" },
        { name: "Reports" },
        { name: "Other Documents" }
      ]
    }
  });
  if (!category) category = await db.documentCategory.findFirst();
  if (!category) throw new Error("No document category found for finance records.");

  const storageKey = generateStorageKey("finance-receipts", validated.ext);
  await uploadPrivateFile({ key: storageKey, buffer, mimeType: validated.mime });

  const doc = await db.document.create({
    data: {
      name: title,
      categoryId: category.id,
      classification: "INTERNAL",
      storageKey,
      mimeType: validated.mime,
      sizeBytes: buffer.byteLength,
      originalName: file.name,
      ownerId: user.id,
      uploadedById: user.id,
      teamId: expense.teamId || null,
      status: "APPROVED"
    }
  });

  const documentId = doc.id;
  if (!documentId) throw new Error("Failed to save receipt document");

  await db.expense.update({
    where: { id: expenseId },
    data: { documentId }
  });

  await writeAuditLog({
    userId: user.id,
    action: "expense.receipt_attached",
    entityType: "Expense",
    entityId: expenseId,
    changes: { documentId, previousDocumentId: expense.documentId }
  });

  revalidatePath(`/[locale]/dashboard/finance/expenses/${expenseId}`, "page");
  revalidatePath("/[locale]/dashboard/finance/expenses", "page");
  return { success: true, documentId };
}

