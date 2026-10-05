"use server";

import { requirePermission } from "@/lib/permissions";
import {
  getGmailConnectionStatus,
  listMailboxMessages,
  getMailThread,
  getMailMessage,
  setThreadReadState,
  sendOfficialEmail,
  replyToOfficialEmail,
  disconnectOfficialGmail,
  trashMailMessage,
  trashMailThread
} from "@/lib/integrations/gmail/service";
import { buildGoogleAuthUrl } from "@/lib/integrations/gmail/config";
import { enqueueGmailSyncJob } from "@/lib/integrations/gmail/job-handler";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const MAX_MAIL_ATTACHMENTS = 10;
const MAX_MAIL_ATTACHMENT_BYTES = 18 * 1024 * 1024;

async function readMailAttachments(formData: FormData) {
  const entries = formData.getAll("attachments");
  if (entries.some((entry) => typeof entry === "string" && entry.length > 0)) {
    throw new Error("Invalid email attachment data.");
  }
  const files = entries.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_MAIL_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_MAIL_ATTACHMENTS} files per email.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_MAIL_ATTACHMENT_BYTES) {
    throw new Error("Email attachments must total 18 MB or less.");
  }
  return Promise.all(files.map(async (file) => ({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    contentBase64: Buffer.from(await file.arrayBuffer()).toString("base64")
  })));
}

// ============================================================================
// PHASE 11 — MAIL SERVER ACTIONS (STRICT RBAC & AUDIT AT ENTRY)
// ============================================================================

export async function getMailStatusAction() {
  await requirePermission("mail.view");
  return await getGmailConnectionStatus();
}

export async function getGoogleConnectUrlAction(locale: string = "ar") {
  const user = await requirePermission("mail.manage");
  return buildGoogleAuthUrl(user.id, locale === "fr" ? "fr" : "ar");
}

export async function listMessagesAction(options: {
  pageToken?: string;
  query?: string;
  label?: string;
} = {}) {
  const user = await requirePermission("mail.view");
  return await listMailboxMessages(options, user);
}

export async function getThreadAction(threadId: string) {
  const user = await requirePermission("mail.view");
  return await getMailThread(threadId, user);
}

export async function getMessageAction(messageId: string) {
  const user = await requirePermission("mail.view");
  return await getMailMessage(messageId, user);
}

export async function markReadAction(threadId: string, read: boolean) {
  const user = await requirePermission("mail.view");
  await setThreadReadState(threadId, read, user);
  revalidatePath("/dashboard/mail");
  return { success: true };
}

export async function deleteMessageAction(messageId: string) {
  const user = await requirePermission("mail.manage");
  await trashMailMessage(messageId, user);
  revalidatePath("/dashboard/mail");
  return { success: true };
}

export async function deleteThreadAction(threadId: string) {
  const user = await requirePermission("mail.manage");
  await trashMailThread(threadId, user);
  revalidatePath("/dashboard/mail");
  return { success: true };
}

export async function sendEmailAction(formData: FormData) {
  const user = await requirePermission("mail.send");

  const toRaw = formData.get("to") as string;
  const ccRaw = (formData.get("cc") as string) || "";
  const bccRaw = (formData.get("bcc") as string) || "";
  const subject = formData.get("subject") as string;
  const bodyText = (formData.get("bodyText") as string) || "";
  const bodyHtml = (formData.get("bodyHtml") as string) || "";

  const to = toRaw
    ? toRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const cc = ccRaw
    ? ccRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const bcc = bccRaw
    ? bccRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const attachments = await readMailAttachments(formData);

  const result = await sendOfficialEmail(
    { to, cc, bcc, subject, bodyText, bodyHtml, attachments },
    user
  );

  revalidatePath("/dashboard/mail");
  return { success: true, result };
}

export async function replyEmailAction(formData: FormData) {
  const user = await requirePermission("mail.send");

  const threadId = formData.get("threadId") as string;
  const inReplyTo = formData.get("inReplyTo") as string;
  const references = (formData.get("references") as string) || undefined;
  const toRaw = formData.get("to") as string;
  const ccRaw = (formData.get("cc") as string) || "";
  const subject = formData.get("subject") as string;
  const bodyText = (formData.get("bodyText") as string) || "";
  const bodyHtml = (formData.get("bodyHtml") as string) || "";

  const to = toRaw
    ? toRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const cc = ccRaw
    ? ccRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const attachments = await readMailAttachments(formData);

  const result = await replyToOfficialEmail(
    { threadId, inReplyTo, references, to, cc, subject, bodyText, bodyHtml, attachments },
    user
  );

  revalidatePath("/dashboard/mail");
  return { success: true, result };
}

export async function disconnectMailAction() {
  const user = await requirePermission("mail.manage");
  await disconnectOfficialGmail(user);
  revalidatePath("/dashboard/mail");
  return { success: true };
}

export async function triggerMailSyncAction() {
  const user = await requirePermission("mail.view");
  await enqueueGmailSyncJob(db, { userId: user.id });
  return { success: true, message: "Sync job enqueued" };
}
