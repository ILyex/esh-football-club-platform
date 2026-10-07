import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getGmailConnectionStatus, listMailboxMessages } from "@/lib/integrations/gmail/service";
import { MailClient } from "./mail-client";
import type { GmailMessageSummary } from "@/lib/integrations/gmail/types";

// ============================================================================
// PHASE 11 — OFFICIAL CLUB MAILBOX PAGE (SERVER COMPONENT)
// ============================================================================

export default async function MailPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requirePagePermission("mail.view", locale);

  const status = await getGmailConnectionStatus();
  let initialMessages: GmailMessageSummary[] = [];
  let initialLoadError = false;

  if (status.connection?.status === "CONNECTED") {
    try {
      const res = await listMailboxMessages({ label: "INBOX", maxResults: 20 }, user);
      initialMessages = res.messages;
    } catch {
      // Keep the page usable and show a localized error rather than a misleading empty inbox.
      initialMessages = [];
      initialLoadError = true;
    }
  }
  const currentStatus = initialLoadError ? await getGmailConnectionStatus() : status;

  const isProgrammer = user.roleKey === "super_admin" && user.permissions.includes("*");
  const canManage = hasPermission(user, "mail.manage");
  const canSend = hasPermission(user, "mail.send");

  return (
    <div className="flex flex-col gap-6 p-6">
      <MailClient
        initialStatus={currentStatus}
        initialMessages={initialMessages}
        initialLoadError={initialLoadError}
        locale={locale}
        canManage={canManage}
        canSend={canSend}
        isProgrammer={isProgrammer}
      />
    </div>
  );
}
