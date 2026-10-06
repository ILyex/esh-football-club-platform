"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Inbox,
  Send,
  FileText,
  Star,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Mail,
  MailOpen,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Unlink,
  Download,
  UploadCloud,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GmailConnectionDTO,
  GmailMessageSummary,
  GmailThreadDetail
} from "@/lib/integrations/gmail/types";
import {
  listMessagesAction,
  getThreadAction,
  markReadAction,
  sendEmailAction,
  replyEmailAction,
  disconnectMailAction,
  triggerMailSyncAction,
  getGoogleConnectUrlAction,
  deleteMessageAction,
  deleteThreadAction
} from "@/lib/actions/mail";
import { toast } from "sonner";

interface MailClientProps {
  initialStatus: {
    isGoogleConfigured: boolean;
    connection: GmailConnectionDTO | null;
  };
  initialMessages: GmailMessageSummary[];
  initialLoadError?: boolean;
  locale: string;
  canManage: boolean;
  canSend: boolean;
  isProgrammer?: boolean;
}

export function MailClient({
  initialStatus,
  initialMessages,
  initialLoadError = false,
  locale,
  canManage,
  canSend,
  isProgrammer = false
}: MailClientProps) {
  const t = useTranslations("mail");
  const isRtl = locale === "ar";

  const [connectionStatus, setConnectionStatus] = useState(initialStatus);
  const [activeFolder, setActiveFolder] = useState<string>("INBOX");
  const [messages, setMessages] = useState<GmailMessageSummary[]>(initialMessages);
  const [hasLoadError, setHasLoadError] = useState(initialLoadError);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<GmailThreadDetail | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Quick reply state
  const [replyBody, setReplyBody] = useState("");
  const [replyAttachedFiles, setReplyAttachedFiles] = useState<File[]>([]);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Folders list
  const folders = [
    { key: "INBOX", label: t("inbox"), icon: Inbox },
    { key: "SENT", label: t("sent"), icon: Send },
    { key: "DRAFT", label: t("drafts"), icon: FileText },
    { key: "STARRED", label: t("starred"), icon: Star },
    { key: "SPAM", label: t("spam"), icon: AlertCircle },
    { key: "TRASH", label: t("trash"), icon: Trash2 }
  ];

  // Refresh or filter folder
  const handleSelectFolder = (folderKey: string) => {
    setActiveFolder(folderKey);
    setSelectedThreadId(null);
    setSelectedThread(null);
    setCurrentPage(1);
    startTransition(async () => {
      try {
        const res = await listMessagesAction({ label: folderKey, query: searchQuery || undefined });
        setMessages(res.messages);
        setHasLoadError(false);
      } catch (err: any) {
        setHasLoadError(true);
        toast.error(err.message || "Failed to load messages");
      }
    });
  };

  // Perform search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    startTransition(async () => {
      try {
        const res = await listMessagesAction({
          label: activeFolder,
          query: searchQuery.trim() || undefined
        });
        setMessages(res.messages);
        setHasLoadError(false);
      } catch (err: any) {
        setHasLoadError(true);
        toast.error(err.message || "Search failed");
      }
    });
  };

  const totalEmails = messages.length;
  const totalPages = Math.max(1, Math.ceil(totalEmails / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalEmails);
  const paginatedMessages = messages.slice(startIndex, endIndex);

  // Open Thread
  const handleOpenThread = (threadId: string) => {
    setSelectedThreadId(threadId);
    startTransition(async () => {
      try {
        const thread = await getThreadAction(threadId);
        setSelectedThread(thread);
        // Automatically mark as read
        if (thread.isUnread) {
          try {
            await markReadAction(threadId, true);
            setMessages((prev) =>
              prev.map((m) => (m.threadId === threadId ? { ...m, isUnread: false } : m))
            );
          } catch {
            // Silently ignore mark-read errors so thread view still opens smoothly
          }
        }
      } catch (err: any) {
        // Resilient Fallback: construct thread detail from currently loaded message summary
        const msg = messages.find((m) => m.threadId === threadId || m.id === threadId);
        if (msg) {
          const fallbackThread: GmailThreadDetail = {
            id: msg.threadId,
            subject: msg.subject || (locale === "ar" ? "(بدون موضوع)" : "(Sans objet)"),
            participants: [msg.sender, msg.recipient].filter(Boolean) as any,
            lastMessageDate: msg.receivedAt,
            isUnread: msg.isUnread,
            messageCount: 1,
            messages: [
              {
                id: msg.id,
                threadId: msg.threadId,
                snippet: msg.snippet,
                internalDate: new Date(msg.receivedAt).getTime().toString(),
                sender: msg.sender,
                recipient: msg.recipient,
                to: [msg.recipient?.email || ""].filter(Boolean),
                cc: [],
                bcc: [],
                subject: msg.subject,
                labels: msg.labels,
                isUnread: false,
                hasAttachments: msg.hasAttachments,
                receivedAt: msg.receivedAt,
                bodyText: msg.snippet,
                // The list snippet is untrusted text. Keep it in bodyText so
                // React escapes it instead of injecting it as HTML.
                bodyHtml: "",
                attachments: []
              }
            ]
          };
          setSelectedThread(fallbackThread);
        } else {
          toast.error(err.message || (locale === "ar" ? "فشل فتح الرسالة" : "Échec du chargement du message"));
        }
      }
    });
  };

  // Toggle Read/Unread
  const handleToggleRead = async (threadId: string, currentRead: boolean) => {
    startTransition(async () => {
      try {
        await markReadAction(threadId, !currentRead);
        setMessages((prev) =>
          prev.map((m) => (m.threadId === threadId ? { ...m, isUnread: currentRead } : m))
        );
        if (selectedThread?.id === threadId) {
          setSelectedThread((prev) => (prev ? { ...prev, isUnread: currentRead } : null));
        }
        toast.success(currentRead ? t("markAsUnread") : t("markAsRead"));
      } catch (err: any) {
        toast.error(err.message || "Action failed");
      }
    });
  };

  // Delete / Trash Thread
  const handleDeleteThread = async (threadId: string) => {
    if (!window.confirm(locale === "ar" ? "هل أنت متأكد من نقل هذه المحادثة إلى سلة المهملات؟" : "Déplacer cette conversation vers la corbeille ?")) return;
    startTransition(async () => {
      try {
        await deleteThreadAction(threadId);
        setMessages((prev) => prev.filter((m) => m.threadId !== threadId));
        if (selectedThreadId === threadId) {
          setSelectedThreadId(null);
          setSelectedThread(null);
        }
        toast.success(locale === "ar" ? "تم نقل المحادثة إلى سلة المهملات" : "Conversation déplacée dans la corbeille");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete thread");
      }
    });
  };

  // Delete / Trash Single Message
  const handleDeleteMessage = async (messageId: string, threadId: string) => {
    if (!window.confirm(locale === "ar" ? "هل أنت متأكد من حذف هذه الرسالة؟" : "Supprimer ce message ?")) return;
    startTransition(async () => {
      try {
        await deleteMessageAction(messageId);
        if (selectedThread) {
          const remaining = selectedThread.messages.filter((m) => m.id !== messageId);
          if (remaining.length === 0) {
            setSelectedThreadId(null);
            setSelectedThread(null);
            setMessages((prev) => prev.filter((m) => m.threadId !== threadId));
          } else {
            setSelectedThread({ ...selectedThread, messages: remaining });
          }
        }
        toast.success(locale === "ar" ? "تم نقل الرسالة إلى سلة المهملات" : "Message déplacé dans la corbeille");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete message");
      }
    });
  };

  const handleUnsubscribe = (url: string) => {
    const confirmed = window.confirm(
      locale === "ar"
        ? "فتح صفحة إلغاء الاشتراك لهذه القائمة البريدية؟"
        : "Ouvrir la page de désabonnement de cette liste ?"
    );
    if (!confirmed) return;
    // The server only exposes https/mailto List-Unsubscribe endpoints. Open
    // them in a separate tab so the mailbox remains available and the sender's
    // confirmation page can complete the unsubscribe safely.
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Trigger Sync
  const handleSync = () => {
    startTransition(async () => {
      try {
        await triggerMailSyncAction();
        toast.success(t("syncSuccess"));
        // reload current folder
        const res = await listMessagesAction({ label: activeFolder, query: searchQuery || undefined });
        setMessages(res.messages);
        setHasLoadError(false);
      } catch (err: any) {
        setHasLoadError(true);
        toast.error(err.message || "Sync failed");
      }
    });
  };

  // Connect Google
  const handleConnectGoogle = async () => {
    startTransition(async () => {
      try {
        const { url, error } = await getGoogleConnectUrlAction(locale);
        if (url) {
          // Use an explicit navigation so popup blockers cannot silently
          // swallow the OAuth transition from a server-action callback.
          window.location.assign(url);
        } else {
          toast.error(error || "Failed to initiate Google OAuth");
        }
      } catch (err: any) {
        toast.error(err.message || "Authorization failed");
      }
    });
  };

  // Disconnect Google
  const handleDisconnect = async () => {
    if (!window.confirm(t("confirmDisconnect"))) return;
    startTransition(async () => {
      try {
        await disconnectMailAction();
        setConnectionStatus((prev) => ({
          ...prev,
          connection: prev.connection ? { ...prev.connection, status: "DISCONNECTED" } : null
        }));
        setMessages([]);
        setSelectedThread(null);
        toast.success("Disconnected successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to disconnect");
      }
    });
  };

  // Submit Send
  const handleSendEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    for (const file of attachedFiles) {
      formData.append("attachments", file);
    }
    startTransition(async () => {
      try {
        await sendEmailAction(formData);
        toast.success(t("sentSuccess"));
        setIsComposeOpen(false);
        setAttachedFiles([]);
        // reload sent or current folder
        const res = await listMessagesAction({ label: activeFolder });
        setMessages(res.messages);
      } catch (err: any) {
        toast.error(err.message || "Failed to send email");
      }
    });
  };

  // Submit Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !replyBody.trim()) return;
    const lastMsg = selectedThread.messages[selectedThread.messages.length - 1];
    if (!lastMsg) return;

    const formData = new FormData();
    formData.set("threadId", selectedThread.id);
    formData.set("inReplyTo", lastMsg.id);
    formData.set("to", lastMsg.sender.email);
    formData.set("subject", selectedThread.subject.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject}`);
    formData.set("bodyText", replyBody);
    for (const file of replyAttachedFiles) {
      formData.append("attachments", file);
    }

    startTransition(async () => {
      try {
        await replyEmailAction(formData);
        toast.success(t("sentSuccess"));
        setReplyBody("");
        setReplyAttachedFiles([]);
        // Reload thread
        const updated = await getThreadAction(selectedThread.id);
        setSelectedThread(updated);
      } catch (err: any) {
        toast.error(err.message || "Reply failed");
      }
    });
  };

  const isConnected = connectionStatus.connection?.status === "CONNECTED";

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header & Connection Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs">
            {isConnected ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {connectionStatus.connection?.emailAddress}
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{t("disconnected")}</span>
              </>
            )}
          </div>

          {/* Sync Button */}
          {isConnected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
              <span>{t("sync")}</span>
            </button>
          )}

          {/* Connect / Disconnect Buttons */}
          {canManage && (
            <>
              {isConnected ? (
                isProgrammer && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>{t("disconnectGoogle")}</span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isPending}
                  title={!connectionStatus.isGoogleConfigured ? "Google OAuth غير مهيأ على الخادم" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-club-primary/90 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>{t("connectGoogle")}</span>
                </button>
              )}
            </>
          )}

          {/* Compose Button */}
          {canSend && isConnected && (
            <button
              type="button"
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-club-primary/90"
            >
              <Plus className="h-4 w-4" />
              <span>{t("compose")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Unconfigured Notice if Google credentials missing */}
      {!connectionStatus.isGoogleConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">{t("unconfiguredNotice")}</p>
          </div>
        </div>
      )}

      {hasLoadError && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("mailLoadError")}</p>
            {connectionStatus.connection?.status === "REVOKED" || connectionStatus.connection?.status === "ERROR"
              ? <p className="mt-1 leading-relaxed">{t("connectionNeedsReconnect")}</p>
              : null}
          </div>
        </div>
      )}

      {/* Main Mail Layout: Folders Sidebar + Messages List + Thread Viewer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 min-h-[650px]">
        {/* Left Column: Folders */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <nav className="flex flex-col gap-1">
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.key;
              return (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => handleSelectFolder(folder.key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-start",
                    isActive
                      ? "bg-club-primary text-white"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{folder.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Middle Column: Message List */}
        <div className={cn("rounded-xl border border-border bg-card shadow-sm flex flex-col", (selectedThread || (selectedThreadId && isPending)) ? "hidden lg:flex lg:col-span-4" : "lg:col-span-10")}>
          {/* Search Bar */}
          <div className="border-b border-border p-3">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-background py-1.5 pe-3 ps-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-club-primary focus:outline-none"
              />
              <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            </form>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <Mail className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p>{t("noMessages")}</p>
              </div>
            ) : (
              paginatedMessages.map((msg) => {
                const isSelected = selectedThreadId === msg.threadId;
                const isLoadingThis = isPending && isSelected && (!selectedThread || selectedThread.id !== msg.threadId);
                return (
                  <div
                    key={msg.id}
                    onClick={() => handleOpenThread(msg.threadId)}
                    className={cn(
                      "group cursor-pointer p-3 transition-colors text-start",
                      msg.isUnread ? "bg-muted/40 font-semibold" : "bg-card",
                      isSelected && "border-s-4 border-s-club-primary bg-club-primary/5",
                      "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="truncate text-foreground font-medium">
                        {msg.sender.name || msg.sender.email}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLoadingThis && <RefreshCw className="h-3 w-3 animate-spin text-club-primary" />}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.receivedAt).toLocaleDateString(locale, {
                            month: "short",
                            day: "numeric"
                          })}
                        </span>
                        {canManage && <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(msg.threadId);
                          }}
                          title={locale === "ar" ? "حذف" : "Supprimer"}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive p-0.5 rounded transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-foreground font-medium truncate">
                      {msg.isUnread && <span className="h-1.5 w-1.5 rounded-full bg-club-primary shrink-0" />}
                      <span className="truncate">{msg.subject}</span>
                      {msg.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0 ms-auto" />}
                    </div>

                    <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground font-normal">
                      {msg.snippet}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls (Max 10 emails per page) */}
          {totalEmails > 0 && (
            <div className="border-t border-border p-2.5 flex items-center justify-between gap-2 bg-muted/20 text-xs text-muted-foreground select-none">
              <span className="text-[11px] tabular-nums">
                {isRtl ? (
                  <>
                    عرض <strong className="text-foreground">{startIndex + 1}</strong> -{" "}
                    <strong className="text-foreground">{endIndex}</strong> من أصل{" "}
                    <strong className="text-foreground">{totalEmails}</strong>
                  </>
                ) : (
                  <>
                    <strong className="text-foreground">{startIndex + 1}</strong> -{" "}
                    <strong className="text-foreground">{endIndex}</strong> sur{" "}
                    <strong className="text-foreground">{totalEmails}</strong>
                  </>
                )}
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                    title={isRtl ? "الصفحة السابقة" : "Précédent"}
                  >
                    {isRtl ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                  </button>

                  <span className="px-2 text-[11px] font-semibold text-foreground">
                    {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="rounded-md border border-border p-1 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                    title={isRtl ? "الصفحة التالية" : "Suivant"}
                  >
                    {isRtl ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Thread Detail & Loading State */}
        {(selectedThread || (selectedThreadId && isPending)) && (
          <div className="lg:col-span-6 rounded-xl border border-border bg-card shadow-sm flex flex-col overflow-hidden">
            {isPending && (!selectedThread || selectedThread.id !== selectedThreadId) ? (
              <div className="flex flex-col h-full">
                <div className="border-b border-border p-4 flex items-center justify-between gap-3 bg-muted/20 animate-pulse">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedThread(null);
                        setSelectedThreadId(null);
                      }}
                      className="lg:hidden rounded-lg p-1 hover:bg-muted text-muted-foreground"
                    >
                      {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                    </button>
                    <div className="space-y-1.5">
                      <div className="h-4 w-48 bg-muted rounded" />
                      <div className="h-3 w-32 bg-muted rounded" />
                    </div>
                  </div>
                  <RefreshCw className="h-4 w-4 animate-spin text-club-primary" />
                </div>
                <div className="flex-1 p-4 space-y-4 animate-pulse">
                  <div className="rounded-lg border border-border p-4 bg-background space-y-3">
                    <div className="h-4 w-40 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                    <div className="h-3 w-4/5 bg-muted rounded" />
                    <div className="h-3 w-3/5 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ) : selectedThread ? (
              <>
                {/* Thread Header */}
                <div className="border-b border-border p-4 flex items-center justify-between gap-3 bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedThread(null);
                        setSelectedThreadId(null);
                      }}
                      className="lg:hidden rounded-lg p-1 hover:bg-muted text-muted-foreground"
                    >
                      {isRtl ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-foreground truncate">{selectedThread.subject}</h2>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {selectedThread.participants.map((p) => p.name || p.email).join(", ")}
                      </p>
                    </div>
                  </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleToggleRead(selectedThread.id, !selectedThread.isUnread)}
                  title={selectedThread.isUnread ? t("markAsRead") : t("markAsUnread")}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                >
                  {selectedThread.isUnread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </button>
                {canManage && <button
                  type="button"
                  onClick={() => handleDeleteThread(selectedThread.id)}
                  title={locale === "ar" ? "حذف المحادثة بالكامل" : "Supprimer la conversation"}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedThread(null);
                    setSelectedThreadId(null);
                    setReplyAttachedFiles([]);
                    setReplyBody("");
                  }}
                  title={locale === "ar" ? "إغلاق المعاينة والرجوع للبريد" : "Fermer la vue"}
                  aria-label={locale === "ar" ? "إغلاق" : "Fermer"}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors border border-border/60 ms-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages in Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedThread.messages.map((msg, idx) => (
                <div key={msg.id} className="rounded-lg border border-border p-4 bg-background shadow-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 mb-3 text-xs">
                    <div>
                      <span className="font-bold text-foreground">{msg.sender.name || msg.sender.email}</span>
                      <span className="text-[11px] text-muted-foreground ms-2">&lt;{msg.sender.email}&gt;</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(msg.receivedAt).toLocaleString(locale)}
                      </span>
                      {msg.unsubscribe && (
                        <button
                          type="button"
                          onClick={() => handleUnsubscribe(msg.unsubscribe!.url)}
                          title={locale === "ar" ? "إلغاء الاشتراك من هذه القائمة" : "Se désabonner de cette liste"}
                          aria-label={locale === "ar" ? "إلغاء الاشتراك" : "Se désabonner"}
                          className="rounded p-1 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 transition-colors"
                        >
                          <Unlink className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManage && <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg.id, msg.threadId)}
                        title={locale === "ar" ? "حذف هذه الرسالة" : "Supprimer ce message"}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>}
                    </div>
                  </div>

                  {/* Sanitized HTML Body or Escaped Text Body */}
                  {msg.bodyHtml ? (
                    <div
                      dir="auto"
                      className="mail-html-body max-w-none overflow-x-auto rounded-lg border border-border/70 bg-white p-3 text-sm leading-7 text-slate-800 [&_table]:!max-w-full [&_table]:border-collapse [&_td]:break-words [&_th]:break-words [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2"
                      dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                    />
                  ) : (
                    <pre dir="auto" className="whitespace-pre-wrap break-words font-sans text-sm text-foreground leading-7">
                      {msg.bodyText || msg.snippet}
                    </pre>
                  )}

                  {/* Attachments Section */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-4 border-t border-border/60 pt-3">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>{t("attachments")} ({msg.attachments.length})</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/mail/attachment?messageId=${msg.id}&attachmentId=${att.id}&filename=${encodeURIComponent(att.filename)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-muted text-foreground transition-colors"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[150px]">{att.filename}</span>
                            <span className="text-[10px] text-muted-foreground">({Math.round(att.size / 1024)} KB)</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Quick Reply Form - directly below the message end */}
              {canSend && (
                <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3 mt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/60 pb-2">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Send className="h-3.5 w-3.5 text-club-primary" />
                      <span>{t("reply")}</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      {isRtl ? "كتابة رد على هذه الرسالة" : "Répondre à ce message"}
                    </span>
                  </div>
                  <form onSubmit={handleSendReply} className="flex flex-col gap-2.5">
                    <textarea
                      rows={3}
                      placeholder={t("reply")}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-club-primary focus:outline-none"
                    />

                    {/* Attached files chips */}
                    {replyAttachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {replyAttachedFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs shadow-2xs"
                          >
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-[150px] font-medium text-foreground">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">({Math.round(file.size / 1024)} KB)</span>
                            <button
                              type="button"
                              onClick={() => setReplyAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                              className="ms-1 text-muted-foreground hover:text-destructive cursor-pointer"
                              title={t("removeAttachment")}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      {/* Attachment button & hidden input */}
                      <div>
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-club-primary hover:underline cursor-pointer"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>{t("attachFiles")}</span>
                        </button>
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files) {
                              const newFiles = Array.from(e.target.files);
                              setReplyAttachedFiles((prev) => [...prev, ...newFiles]);
                              e.target.value = "";
                            }
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPending || (!replyBody.trim() && replyAttachedFiles.length === 0)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-3.5 py-1.5 text-xs font-medium text-white hover:bg-club-primary/90 disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{t("send")}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            </>
          ) : null}
        </div>
      )}
      </div>

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-sm font-bold text-foreground">{t("compose")}</h3>
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setAttachedFiles([]);
                }}
                className="text-xs text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("to")}</label>
                <input
                  type="text"
                  name="to"
                  required
                  placeholder="recipient@example.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-club-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("cc")}</label>
                  <input
                    type="text"
                    name="cc"
                    placeholder="cc@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-club-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t("bcc")}</label>
                  <input
                    type="text"
                    name="bcc"
                    placeholder="bcc@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-club-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("subject")}</label>
                <input
                  type="text"
                  name="subject"
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-club-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t("body")}</label>
                <textarea
                  name="bodyText"
                  rows={7}
                  required
                  className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground focus:border-club-primary focus:outline-none"
                />
              </div>

              {/* Attachments Upload Section */}
              <section className="rounded-xl border border-border bg-muted/15 p-3.5 sm:p-4" aria-label={t("attachments")}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Paperclip className="h-4 w-4 text-club-primary" aria-hidden="true" />
                    <span>{t("attachments")}</span>
                    {attachedFiles.length > 0 && <span className="rounded-full bg-club-primary/10 px-2 py-0.5 text-[10px] font-bold text-club-primary">{attachedFiles.length}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{t("optional")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (event.dataTransfer.files.length) setAttachedFiles((prev) => [...prev, ...Array.from(event.dataTransfer.files)]);
                  }}
                  className="group flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/60 px-4 py-4 text-center transition hover:border-club-primary/60 hover:bg-club-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-club-primary/10 text-club-primary transition group-hover:scale-105">
                    <UploadCloud className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-club-primary">{t("attachFiles")}</span>
                  <span className="text-[11px] text-muted-foreground">{t("dropFilesHint")}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setAttachedFiles((prev) => [...prev, ...newFiles]);
                      e.target.value = "";
                    }
                  }}
                />

                {attachedFiles.length > 0 && (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {attachedFiles.map((file, idx) => (
                      <li key={`${file.name}-${file.size}-${idx}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><FileText className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                          title={t("removeAttachment")}
                          aria-label={`${t("removeAttachment")}: ${file.name}`}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setIsComposeOpen(false);
                    setAttachedFiles([]);
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-club-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-club-primary/90 disabled:opacity-50 shadow-xs"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{t("send")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
