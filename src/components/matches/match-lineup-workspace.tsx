"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, ChevronLeft, ChevronRight, GripVertical, HeartPulse, LoaderCircle, Search, Star, Trash2, UserCheck, UserRoundX, Users } from "lucide-react";
import { toast } from "sonner";
import { TacticalPitch } from "@/components/football/lineup-pitch-board";
import { Badge } from "@/components/ui/badge";
import { frenchPublicPersonName, localizedFootballPosition } from "@/lib/public/locale-text";
import { SafeImage } from "@/components/shared/safe-image";

type RosterPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  firstNameFr: string | null;
  lastNameFr: string | null;
  photoUrl: string | null;
  shirtNumber: number | null;
  position: string;
  status: string;
};

function playerDisplayName(player: RosterPlayer, locale: string) {
  if (locale !== "fr") return `${player.firstName} ${player.lastName}`.trim();
  const fallback = player.shirtNumber == null ? "Joueur" : `Joueur n°${player.shirtNumber}`;
  return frenchPublicPersonName(player, fallback);
}

type LineupEntry = {
  playerId: string;
  isCaptain?: boolean;
  isStarting: boolean;
  selectionStatus: string;
  position: string | null;
  shirtNumber?: number | null;
};

type LineupStatus = "STARTING" | "SUBSTITUTE" | "INJURED" | "SUSPENDED" | "NOT_CALLED";

function initialEntries(players: RosterPlayer[], entries: LineupEntry[], autoSuspendedIds: string[]) {
  const existing = new Map(entries.map((entry) => [entry.playerId, entry]));
  const autoSuspended = new Set(autoSuspendedIds);
  return players.flatMap((player) => {
    const entry = existing.get(player.id);
    if (entry) {
      const isUnavailable = autoSuspended.has(player.id) || player.status === "INJURED";
      return [{
        ...entry,
        isCaptain: Boolean(entry.isCaptain) && !isUnavailable && entry.selectionStatus === "STARTING",
        selectionStatus: autoSuspended.has(player.id)
          ? "SUSPENDED"
          : player.status === "INJURED" ? "INJURED" : entry.selectionStatus === "SUSPENDED" ? "NOT_CALLED" : entry.selectionStatus,
        isStarting: isUnavailable ? false : entry.isStarting
      }];
    }
    if (autoSuspended.has(player.id) || player.status === "INJURED") {
      return [{
        playerId: player.id,
        isCaptain: false,
        isStarting: false,
        selectionStatus: autoSuspended.has(player.id) ? "SUSPENDED" : "INJURED",
        position: player.position
      }];
    }
    return [];
  });
}

export function MatchLineupWorkspace({
  matchId,
  locale,
  players,
  lineups,
  autoSuspendedPlayerIds,
  canEdit,
  saveEntry,
  removeEntry,
  swapPositions,
  fetchFafLineup,
  syncAutomaticSuspensions
}: {
  matchId: string;
  locale: string;
  players: RosterPlayer[];
  lineups: LineupEntry[];
  autoSuspendedPlayerIds: string[];
  canEdit: boolean;
  saveEntry: (formData: FormData) => Promise<unknown>;
  removeEntry: (playerId: string) => Promise<void>;
  swapPositions: (playerId: string, targetPlayerId: string, position: string, targetPosition: string) => Promise<void>;
  fetchFafLineup?: ReactNode;
  syncAutomaticSuspensions: () => Promise<string[]>;
}) {
  const isAr = locale === "ar";
  const router = useRouter();
  const [entries, setEntries] = useState<LineupEntry[]>(() => initialEntries(players, lineups, autoSuspendedPlayerIds));
  const [query, setQuery] = useState("");
  const [rosterPage, setRosterPage] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ playerId: string; x: number; y: number } | null>(null);
  const touchDragRef = useRef<{ playerId: string; x: number; y: number } | null>(null);
  const suppressRosterClick = useRef(false);
  const persistedIds = useRef(new Set(lineups.map((entry) => entry.playerId)));
  const suspensionSyncMatchId = useRef<string | null>(null);
  const syncSuspensionsActionRef = useRef(syncAutomaticSuspensions);
  syncSuspensionsActionRef.current = syncAutomaticSuspensions;
  const autoSuspended = useMemo(() => new Set(autoSuspendedPlayerIds), [autoSuspendedPlayerIds]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  useEffect(() => {
    if (!canEdit || autoSuspendedPlayerIds.length === 0 || suspensionSyncMatchId.current === matchId) return;
    suspensionSyncMatchId.current = matchId;
    let active = true;
    syncSuspensionsActionRef.current()
      .then((syncedIds) => {
        if (active && syncedIds.length > 0) {
          syncedIds.forEach((id) => persistedIds.current.add(id));
          router.refresh();
        }
      })
      .catch((error) => {
        console.error("Automatic match suspensions could not be synchronized:", error);
        suspensionSyncMatchId.current = null;
        toast.error(isAr ? "تعذر تطبيق إيقاف لاعب المباراة السابقة تلقائياً." : "Impossible d’appliquer automatiquement la suspension du match précédent.");
      });
    return () => { active = false; };
  }, [canEdit, matchId, autoSuspendedPlayerIds.length, isAr, router]);

  useEffect(() => {
    setEntries(initialEntries(players, lineups, autoSuspendedPlayerIds));
    lineups.forEach((entry) => persistedIds.current.add(entry.playerId));
  }, [players, lineups, autoSuspendedPlayerIds]);

  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.playerId, entry])), [entries]);
  const startingPlayers = useMemo(() => entries
    .filter((entry) => entry.selectionStatus === "STARTING")
    .map((entry) => {
      const player = playerById.get(entry.playerId);
      if (!player) return null;
      return {
        playerId: player.id,
        playerName: playerDisplayName(player, "ar"),
        playerNameFr: playerDisplayName(player, "fr"),
        photoUrl: player.photoUrl,
        shirtNumber: entryById.get(player.id)?.shirtNumber ?? player.shirtNumber,
        position: entry.position || player.position,
        isCaptain: Boolean(entry.isCaptain)
      };
    })
    .filter((player): player is NonNullable<typeof player> => player !== null), [entries, entryById, playerById]);
  const selectedStartingPlayer = startingPlayers.find((player) => player.playerId === selectedPlayerId) ?? null;
  const availablePlayers = players.filter((player) => !entryById.has(player.id));
  const visibleAvailablePlayers = availablePlayers.filter((player) => `${playerDisplayName(player, locale)} ${player.firstName} ${player.lastName}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const rosterPageSize = Math.max(1, Math.ceil(availablePlayers.length / 2));
  const rosterPageCount = Math.min(2, Math.max(1, Math.ceil(availablePlayers.length / rosterPageSize)));
  const pagedAvailablePlayers = visibleAvailablePlayers.slice(rosterPage * rosterPageSize, (rosterPage + 1) * rosterPageSize);
  const benchPlayers = entries.filter((entry) => entry.selectionStatus === "SUBSTITUTE");
  const playerCount = (status: string) => entries.filter((entry) => entry.selectionStatus === status).length;

  const persistStatus = async (playerId: string, selectionStatus: LineupStatus, positionOverride?: string) => {
    if (!canEdit || savingPlayerId) return;
    if (autoSuspended.has(playerId) && selectionStatus !== "SUSPENDED") {
      toast.error(isAr ? "هذا اللاعب موقوف تلقائياً بسبب بطاقة حمراء في المباراة السابقة." : "Ce joueur est automatiquement suspendu après un carton rouge au match précédent.");
      return;
    }
    const player = playerById.get(playerId);
    if (!player) return;
    if (player.status === "INJURED" && selectionStatus !== "INJURED") {
      toast.error(isAr ? "اللاعب مصاب ويجب أن يبقى في قائمة المصابين." : "Ce joueur est blessé et doit rester dans la liste des blessés.");
      return;
    }
    const current = entryById.get(playerId);
    const startingCount = entries.filter((entry) => entry.selectionStatus === "STARTING" && entry.playerId !== playerId).length;
    if (selectionStatus === "STARTING" && startingCount >= 11) {
      toast.error(isAr ? "لا يمكن أن يتجاوز التشكيل الأساسي 11 لاعباً." : "L’équipe titulaire ne peut pas dépasser 11 joueurs.");
      return;
    }
    const nextPosition = positionOverride || current?.position || player.position;
    if (selectionStatus === "STARTING" && nextPosition.toUpperCase().split(":", 1)[0] === "GOALKEEPER" && entries.some((entry) =>
      entry.playerId !== playerId && entry.selectionStatus === "STARTING" &&
      (entry.position || playerById.get(entry.playerId)?.position)?.toUpperCase().split(":", 1)[0] === "GOALKEEPER"
    )) {
      toast.error(isAr ? "لا يمكن اختيار أكثر من حارس مرمى واحد في التشكيلة الأساسية." : "Un seul gardien peut être titulaire.");
      return;
    }

    const nextEntry: LineupEntry = {
      playerId,
      isStarting: selectionStatus === "STARTING",
      selectionStatus,
      position: nextPosition,
      isCaptain: selectionStatus === "STARTING" && Boolean(current?.isCaptain)
    };
    const previousEntries = entries;
    setEntries((currentEntries) => [...currentEntries.filter((entry) => entry.playerId !== playerId), nextEntry]);
    setSelectedPlayerId(null);
    setSavingPlayerId(playerId);

    try {
      const formData = new FormData();
      formData.set("playerId", playerId);
      formData.set("isStarting", nextEntry.isStarting ? "true" : "false");
      formData.set("isCaptain", nextEntry.isCaptain ? "true" : "false");
      formData.set("selectionStatus", selectionStatus);
      formData.set("position", nextEntry.position ?? "");
      await saveEntry(formData);
      persistedIds.current.add(playerId);
      router.refresh();
    } catch (error) {
      setEntries(previousEntries);
      console.error("Lineup player update failed:", error);
      const reason = error instanceof Error ? error.message : "";
      toast.error(reason === "lineupStartingLimit"
        ? (isAr ? "اكتمل الحد الأقصى للتشكيل الأساسي: 11 لاعباً." : "Le maximum de 11 titulaires est atteint.")
        : reason === "lineupGoalkeeperLimit"
          ? (isAr ? "لا يمكن اختيار أكثر من حارس مرمى واحد في التشكيلة الأساسية." : "Un seul gardien peut être titulaire.")
        : reason === "lineupPlayerInjured"
          ? (isAr ? "اللاعب مصاب ويجب أن يبقى في قائمة المصابين." : "Ce joueur est blessé et doit rester dans la liste des blessés.")
        : reason === "lineupPlayerSuspended"
          ? (isAr ? "هذا اللاعب موقوف بسبب بطاقة حمراء في المباراة السابقة من البطولة." : "Ce joueur est suspendu après un carton rouge au match précédent de la compétition.")
          : (isAr ? "تعذر تحديث التشكيلة. حاول مرة أخرى." : "Impossible de mettre à jour la composition. Réessayez."));
    } finally {
      setSavingPlayerId(null);
    }
  };

  const swapStartingPlayers = async (playerId: string, targetPlayerId: string, position: string, targetPosition: string) => {
    if (!canEdit || savingPlayerId || playerId === targetPlayerId) return;
    const source = entryById.get(playerId);
    const target = entryById.get(targetPlayerId);
    if (source?.selectionStatus !== "STARTING" || target?.selectionStatus !== "STARTING") return;
    const previousEntries = entries;
    setEntries((currentEntries) => currentEntries.map((entry) =>
      entry.playerId === playerId ? { ...entry, position: targetPosition }
        : entry.playerId === targetPlayerId ? { ...entry, position }
          : entry
    ));
    setSelectedPlayerId(null);
    setSavingPlayerId(playerId);
    try {
      await swapPositions(playerId, targetPlayerId, position, targetPosition);
      router.refresh();
    } catch (error) {
      setEntries(previousEntries);
      console.error("Match lineup position swap failed:", error);
      toast.error(isAr ? "تعذر تبديل مركزي اللاعبين. حاول مرة أخرى." : "Impossible d’échanger les postes. Réessayez.");
    } finally {
      setSavingPlayerId(null);
    }
  };

  const persistCaptain = async (playerId: string) => {
    if (!canEdit || savingPlayerId) return;
    const current = entryById.get(playerId);
    if (!current || current.selectionStatus !== "STARTING") return;
    const nextCaptain = !current.isCaptain;
    const previousEntries = entries;
    setEntries((currentEntries) => currentEntries.map((entry) => ({
      ...entry,
      isCaptain: entry.playerId === playerId ? nextCaptain : false
    })));
    setSavingPlayerId(playerId);
    try {
      const formData = new FormData();
      formData.set("playerId", playerId);
      formData.set("isStarting", "true");
      formData.set("selectionStatus", "STARTING");
      formData.set("isCaptain", String(nextCaptain));
      formData.set("position", current.position ?? playerById.get(playerId)?.position ?? "");
      await saveEntry(formData);
      router.refresh();
    } catch (error) {
      setEntries(previousEntries);
      console.error("Match captain update failed:", error);
      toast.error(isAr ? "تعذر تحديث قائد الفريق." : "Impossible de modifier le capitaine.");
    } finally {
      setSavingPlayerId(null);
    }
  };

  const removeFromMatch = async (playerId: string) => {
    if (!canEdit || savingPlayerId || autoSuspended.has(playerId)) return;
    const previousEntries = entries;
    setEntries((currentEntries) => currentEntries.filter((entry) => entry.playerId !== playerId));
    if (selectedPlayerId === playerId) setSelectedPlayerId(null);
    setSavingPlayerId(playerId);
    try {
      if (persistedIds.current.has(playerId)) await removeEntry(playerId);
      persistedIds.current.delete(playerId);
      router.refresh();
    } catch (error) {
      setEntries(previousEntries);
      console.error("Lineup player removal failed:", error);
      toast.error(isAr ? "تعذر إخراج اللاعب من القائمة." : "Impossible de retirer ce joueur de la liste.");
    } finally {
      setSavingPlayerId(null);
    }
  };

  const dropHandlers = (selectionStatus: LineupStatus) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (canEdit) event.preventDefault();
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!canEdit) return;
      event.preventDefault();
      const playerId = event.dataTransfer.getData("text/plain") || selectedPlayerId;
      if (playerId) void persistStatus(playerId, selectionStatus);
    },
    onClick: () => {
      if (selectedPlayerId) void persistStatus(selectedPlayerId, selectionStatus);
    }
  });

  const startTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>, playerId: string) => {
    if (!canEdit || event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressRosterClick.current = true;
    const nextDrag = { playerId, x: event.clientX, y: event.clientY };
    touchDragRef.current = nextDrag;
    setTouchDrag(nextDrag);
    const edge = 72;
    if (event.clientY > window.innerHeight - edge) window.scrollBy({ top: 14, behavior: "auto" });
    else if (event.clientY < edge) window.scrollBy({ top: -14, behavior: "auto" });
  };

  const moveTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>, playerId: string) => {
    if (touchDragRef.current?.playerId !== playerId) return;
    event.preventDefault();
    const nextDrag = { playerId, x: event.clientX, y: event.clientY };
    touchDragRef.current = nextDrag;
    setTouchDrag(nextDrag);
  };

  const endTouchDrag = (event: ReactPointerEvent<HTMLSpanElement>, playerId: string) => {
    if (touchDragRef.current?.playerId !== playerId) return;
    event.preventDefault();
    event.stopPropagation();
    const dropZone = document.elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-lineup-drop-zone]")
      ?.dataset.lineupDropZone;
    const validStatuses: LineupStatus[] = ["STARTING", "SUBSTITUTE", "INJURED", "SUSPENDED", "NOT_CALLED"];
    touchDragRef.current = null;
    setTouchDrag(null);
    if (dropZone && validStatuses.includes(dropZone as LineupStatus)) {
      void persistStatus(playerId, dropZone as LineupStatus);
    } else {
      setSelectedPlayerId(playerId);
    }
    window.setTimeout(() => { suppressRosterClick.current = false; }, 0);
  };

  const cancelTouchDrag = (playerId: string) => {
    if (touchDragRef.current?.playerId === playerId) {
      touchDragRef.current = null;
      setTouchDrag(null);
    }
    window.setTimeout(() => { suppressRosterClick.current = false; }, 0);
  };

  const statusGroups: Array<{ status: LineupStatus; label: string; icon: typeof HeartPulse; tone: string }> = [
    { status: "INJURED", label: isAr ? "مصاب" : "Blessé", icon: HeartPulse, tone: "amber" },
    { status: "SUSPENDED", label: isAr ? "موقوف" : "Suspendu", icon: Ban, tone: "red" },
    { status: "NOT_CALLED", label: isAr ? "غير مستدعى" : "Non convoqué", icon: UserRoundX, tone: "slate" }
  ];

  const statusStyle = (tone: string) => tone === "amber"
    ? "border-amber-500/25 bg-amber-500/[0.045] text-amber-500"
    : tone === "red"
      ? "border-red-500/25 bg-red-500/[0.045] text-red-500"
      : "border-border bg-muted/20 text-muted-foreground";

  return (
    <div className="space-y-4">
      <div dir={isAr ? "rtl" : "ltr"} className="grid min-w-0 items-start gap-4 rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="min-w-0 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">{isAr ? "إعداد قائمة المباراة" : "Préparer la composition"}</h2>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{isAr ? "وزّع اللاعبين بين التشكيلة الأساسية والدكة والحالات." : "Répartissez les joueurs entre les titulaires, le banc et les statuts."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <Badge tone="neutral">{isAr ? `أساسي ${startingPlayers.length}/11` : `Titulaires ${startingPlayers.length}/11`}</Badge>
            <Badge tone="neutral">{isAr ? `احتياط ${benchPlayers.length}` : `Remplaçants ${benchPlayers.length}`}</Badge>
            <Badge tone="neutral">{isAr ? `متاح ${availablePlayers.length}` : `Disponibles ${availablePlayers.length}`}</Badge>
          </div>
        </div>
        {canEdit && <div className="min-w-0">{fetchFafLineup}</div>}
      </div>
      <div dir="ltr" className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.5fr)] 2xl:gap-6">
      <aside dir={isAr ? "rtl" : "ltr"} className="min-w-0 rounded-2xl border border-border/70 bg-background/35 p-4 sm:p-5 xl:sticky xl:top-20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><Users className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <h3 className="text-sm font-bold text-foreground">{isAr ? "قائمة اللاعبين" : "Effectif"}</h3>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{isAr ? `${availablePlayers.length} لاعب؛ اسحب من المقبض أو اضغط لاعباً ثم الوجهة` : `${availablePlayers.length} joueurs ; faites glisser la poignée ou touchez le joueur puis sa destination`}</p>
            </div>
          </div>
          <Badge tone="neutral">{availablePlayers.length}</Badge>
        </div>

        <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground focus-within:border-club-primary/50">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value); setRosterPage(0); }} placeholder={isAr ? "ابحث عن لاعب" : "Rechercher un joueur"} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </label>

        <div className="min-h-[188px] sm:min-h-[280px]">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-2 xl:grid-cols-1">
          {pagedAvailablePlayers.map((player) => {
            const selected = selectedPlayerId === player.id;
            const isPlayerUnavailable = player.status === "INJURED";
            const displayName = playerDisplayName(player, locale);
            return (
              <button
                key={player.id}
                type="button"
                draggable={canEdit && !isPlayerUnavailable}
                onDragStart={(event) => { event.dataTransfer.setData("text/plain", player.id); event.dataTransfer.effectAllowed = "move"; }}
                onClick={() => {
                  if (suppressRosterClick.current) return;
                  if (canEdit && !isPlayerUnavailable) setSelectedPlayerId(selected ? null : player.id);
                }}
                aria-pressed={selected}
                title={`${displayName} — ${localizedFootballPosition(player.position, locale)}`}
                aria-label={`${displayName}, ${localizedFootballPosition(player.position, locale)}`}
                className={`touch-manipulation flex min-h-14 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border p-1 text-center transition-colors active:scale-[0.98] sm:flex-row sm:justify-start sm:gap-3 sm:p-2.5 sm:text-start ${selected ? "border-club-primary bg-club-primary/10 ring-2 ring-club-primary/15" : "border-border/70 bg-card hover:border-club-primary/40 hover:bg-club-primary/[0.035]"} ${!canEdit || isPlayerUnavailable ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
              >
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  <span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full border-2 border-border bg-muted sm:border">
                    {player.photoUrl ? (
                      <SafeImage src={player.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={`${player.firstName} ${player.lastName}`} className="h-full w-full object-cover" />
                    ) : `${displayName.charAt(0)}${displayName.split(/\s+/u).at(-1)?.charAt(0) ?? ""}`}
                  </span>
                  {player.shirtNumber != null && <span className="absolute -bottom-1 -end-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-card bg-club-primary px-1 text-[9px] font-black leading-none text-white shadow-sm ring-1 ring-club-primary/30">{player.shirtNumber}</span>}
                  {canEdit && !isPlayerUnavailable && !autoSuspended.has(player.id) && (
                    <span
                      aria-hidden="true"
                      onPointerDown={(event) => startTouchDrag(event, player.id)}
                      onPointerMove={(event) => moveTouchDrag(event, player.id)}
                      onPointerUp={(event) => endTouchDrag(event, player.id)}
                      onPointerCancel={() => cancelTouchDrag(player.id)}
                      className="absolute -top-1 -start-1 z-20 flex h-5 w-5 touch-none items-center justify-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-sm sm:hidden"
                    >
                      <GripVertical className="h-3 w-3" />
                    </span>
                  )}
                </span>
                <span className="sr-only sm:not-sr-only sm:min-w-0 sm:flex-1">
                  <span className="block truncate text-xs font-bold text-foreground">{displayName}</span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">{localizedFootballPosition(player.position, locale)}</span>
                  {autoSuspended.has(player.id) && <span className="mt-1 block text-[10px] font-bold text-red-500">{isAr ? "موقوف تلقائياً" : "Suspendu automatiquement"}</span>}
                </span>
                {savingPlayerId === player.id && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-club-primary" aria-label={isAr ? "جار الحفظ" : "Enregistrement"} />}
              </button>
            );
          })}
          </div>
          {pagedAvailablePlayers.length === 0 && (
            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs leading-5 text-muted-foreground">
              {visibleAvailablePlayers.length === 0 ? (availablePlayers.length === 0 ? (isAr ? "كل اللاعبين موزعون في الملعب أو الدكة أو قائمة الحالات." : "Tous les joueurs sont affectés au terrain, au banc ou à une liste de statut.") : (isAr ? "لا يوجد لاعب بهذا الاسم." : "Aucun joueur ne correspond à cette recherche.")) : (isAr ? "لا يوجد لاعب في هذه الصفحة من البحث الحالي." : "Aucun joueur sur cette page pour cette recherche.")}
            </p>
          )}
        </div>

        {rosterPageCount > 1 && (
          <nav dir={isAr ? "rtl" : "ltr"} className="mt-3 flex items-center justify-between rounded-xl border border-border/70 bg-card/70 p-1.5" aria-label={isAr ? "صفحات قائمة اللاعبين" : "Pages de la liste des joueurs"}>
            <button type="button" onClick={() => setRosterPage((page) => Math.max(0, page - 1))} disabled={rosterPage === 0} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}{isAr ? "السابق" : "Précédent"}
            </button>
            <span className="text-[11px] font-bold tabular-nums text-foreground">{isAr ? `الصفحة ${rosterPage + 1} من ${rosterPageCount}` : `Page ${rosterPage + 1} sur ${rosterPageCount}`}</span>
            <button type="button" onClick={() => setRosterPage((page) => Math.min(rosterPageCount - 1, page + 1))} disabled={rosterPage >= rosterPageCount - 1} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">
              {isAr ? "التالي" : "Suivant"}{isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </nav>
        )}

        {selectedPlayerId && canEdit && (
          <p className="mt-3 rounded-lg bg-club-primary/10 px-3 py-2 text-center text-[11px] font-semibold text-club-primary">
            {isAr ? "تم اختيار اللاعب؛ اضغط الملعب أو الدكة لإضافته." : "Joueur sélectionné ; cliquez sur le terrain ou le banc pour l’ajouter."}
          </p>
        )}
      </aside>

      <div dir={isAr ? "rtl" : "ltr"} className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/35 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <UserCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            <h3 className="text-sm font-bold text-foreground">{isAr ? "التشكيل الأساسي" : "Équipe titulaire"}</h3>
          </div>
          <div className="flex items-center gap-2">
            {selectedStartingPlayer && canEdit && (
              <button
                type="button"
                onClick={() => void persistCaptain(selectedStartingPlayer.playerId)}
                disabled={Boolean(savingPlayerId)}
                aria-pressed={Boolean(selectedStartingPlayer.isCaptain)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${selectedStartingPlayer.isCaptain ? "border-amber-400/35 bg-amber-400/10 text-amber-400" : "border-border bg-card text-muted-foreground hover:border-amber-400/35 hover:text-amber-400"}`}
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                {selectedStartingPlayer.isCaptain
                  ? (isAr ? "إلغاء صفة القائد" : "Retirer le brassard")
                  : (isAr ? "تعيين قائد الفريق" : "Désigner capitaine")}
              </button>
            )}
            {selectedStartingPlayer && canEdit && (
              <button
                type="button"
                onClick={() => void removeFromMatch(selectedStartingPlayer.playerId)}
                disabled={Boolean(savingPlayerId)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-2.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {isAr ? "إزالة اللاعب المحدد" : "Retirer le joueur sélectionné"}
              </button>
            )}
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${startingPlayers.length > 11 ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-500"}`}>
              {startingPlayers.length}/11 {isAr ? "لاعباً" : "joueurs"}
            </span>
          </div>
        </div>

        <p className="-mt-2 text-center text-[11px] leading-4 text-muted-foreground sm:hidden">
          {isAr ? "اختر لاعباً ثم اضغط على خانة المركز المطلوب أو اسحبه إليها." : "Choisissez un joueur puis touchez le poste souhaité ou glissez-le dessus."}
        </p>

        <div data-lineup-drop-zone="STARTING" className={`relative rounded-2xl transition-shadow ${touchDrag ? "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-background" : ""}`}>
          <TacticalPitch
            startingLineup={startingPlayers}
            locale={locale}
            compact
            className="mx-auto max-w-[760px]"
            editable={canEdit}
            selectedPlayerId={selectedPlayerId}
            onDropPlayer={(playerId) => void persistStatus(playerId, "STARTING")}
            onAssignPosition={(playerId, position) => void persistStatus(playerId, "STARTING", position)}
            onSwapPlayers={(playerId, targetPlayerId, position, targetPosition) => void swapStartingPlayers(playerId, targetPlayerId, position, targetPosition)}
            onClickField={() => { if (selectedPlayerId) void persistStatus(selectedPlayerId, "STARTING"); }}
            onDragStartPlayer={(playerId, event) => { event.dataTransfer.setData("text/plain", playerId); event.dataTransfer.effectAllowed = "move"; }}
            onClickPlayer={(playerId) => setSelectedPlayerId(playerId)}
          />
          {startingPlayers.length === 0 && (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 z-30 -translate-y-1/2 rounded-xl border border-dashed border-white/30 bg-emerald-950/80 px-4 py-3 text-center text-xs font-semibold text-emerald-50/80">
              {isAr ? "اسحب اللاعب إلى المركز المطلوب أو حدده ثم اضغط على خانة المركز." : "Glissez le joueur au poste souhaité ou sélectionnez-le puis touchez la position."}
            </div>
          )}
        </div>

        <section data-lineup-drop-zone="SUBSTITUTE" {...dropHandlers("SUBSTITUTE")} className={`rounded-2xl border p-4 transition-colors ${canEdit ? "cursor-pointer border-sky-500/25 bg-sky-500/[0.035] hover:border-sky-500/50" : "border-border/70 bg-background/30"} ${touchDrag ? "ring-2 ring-sky-400/60" : ""}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500"><Users className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <h4 className="text-xs font-bold text-foreground">{isAr ? "دكة الاحتياط" : "Banc des remplaçants"}</h4>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{isAr ? "اسحب اللاعب أو اختره ثم اضغط هنا" : "Glissez un joueur ou sélectionnez-le puis touchez ici"}</p>
              </div>
            </div>
            <Badge tone="neutral">{benchPlayers.length}</Badge>
          </div>
          <div className="flex min-h-16 flex-wrap items-center gap-2">
            {benchPlayers.length > 0 ? benchPlayers.map((entry) => {
              const player = playerById.get(entry.playerId);
              if (!player) return null;
              return <PlayerToken key={entry.playerId} player={{ ...player, shirtNumber: entry.shirtNumber ?? player.shirtNumber }} locale={locale} canEdit={canEdit} busy={savingPlayerId === entry.playerId} selected={selectedPlayerId === player.id} onSelect={() => setSelectedPlayerId(player.id)} onDragStart={(event) => event.dataTransfer.setData("text/plain", player.id)} onRemove={() => void removeFromMatch(player.id)} />;
            }) : <p className="w-full rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-[11px] text-muted-foreground">{isAr ? "اسحب لاعباً أو اختره ثم اضغط هنا لإضافته إلى الدكة." : "Glissez un joueur ou sélectionnez-le puis touchez ici pour l’ajouter au banc."}</p>}
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3" aria-label={isAr ? "حالات اللاعبين" : "Statuts des joueurs"}>
          {statusGroups.map(({ status, label, icon: Icon, tone }) => {
            const groupEntries = entries.filter((entry) => entry.selectionStatus === status);
            return (
              <div key={status} data-lineup-drop-zone={status} {...dropHandlers(status)} className={`min-w-0 rounded-xl border p-3 transition-colors ${statusStyle(tone)} ${canEdit ? "cursor-pointer hover:brightness-110" : ""} ${touchDrag ? "ring-2 ring-club-primary/50" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-xs font-bold"><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{label}</span>
                  <span className="text-xs font-bold tabular-nums">{groupEntries.length}</span>
                </div>
                {status === "SUSPENDED" && groupEntries.some((entry) => autoSuspended.has(entry.playerId)) && (
                  <p className="mb-2 text-[10px] leading-4 text-red-500">{isAr ? "يُوقف تلقائياً بعد بطاقة حمراء في آخر مباراة بالبطولة." : "Suspension automatique après un carton rouge au match précédent."}</p>
                )}
                <div className="flex min-h-12 flex-wrap items-center gap-1.5">
                  {groupEntries.map((entry) => {
                    const player = playerById.get(entry.playerId);
                    if (!player) return null;
                    const locked = autoSuspended.has(player.id) || player.status === "INJURED";
                    return <PlayerToken key={entry.playerId} player={{ ...player, shirtNumber: entry.shirtNumber ?? player.shirtNumber }} locale={locale} canEdit={canEdit && !locked} busy={savingPlayerId === player.id} selected={selectedPlayerId === player.id} onDragStart={(event) => event.dataTransfer.setData("text/plain", player.id)} onRemove={() => void removeFromMatch(player.id)} onSelect={() => { if (!locked) setSelectedPlayerId(player.id); }} compact />;
                  })}
                  {groupEntries.length === 0 && <p className="w-full text-center text-[10px] text-muted-foreground">{canEdit ? (isAr ? "أسقط اللاعب هنا" : "Déposez ici") : "—"}</p>}
                </div>
              </div>
            );
          })}
        </section>
      </div>
      </div>
      {touchDrag && (() => {
        const draggedPlayer = playerById.get(touchDrag.playerId);
        if (!draggedPlayer) return null;
        return (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[100] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-club-primary/40 bg-card/95 py-1 pe-3 ps-1.5 text-xs font-bold text-foreground shadow-xl ring-2 ring-club-primary/20 backdrop-blur"
            style={{ left: touchDrag.x, top: touchDrag.y }}
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-muted">
              {draggedPlayer.photoUrl ? (
                <SafeImage src={draggedPlayer.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={`${draggedPlayer.firstName} ${draggedPlayer.lastName}`} className="h-full w-full object-cover" />
              ) : playerDisplayName(draggedPlayer, locale).charAt(0)}
            </span>
            <span className="max-w-36 truncate">{playerDisplayName(draggedPlayer, locale)}</span>
          </div>
        );
      })()}
    </div>
  );
}

function PlayerToken({ player, locale, canEdit, busy, onDragStart, onRemove, onSelect, selected = false, compact = false }: {
  player: RosterPlayer;
  locale: string;
  canEdit: boolean;
  busy: boolean;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onSelect: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const isAr = locale === "ar";
  return (
    <span className={`group/token inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card text-foreground shadow-xs ${selected ? "border-club-primary ring-2 ring-club-primary/15" : "border-border/70"} ${compact ? "py-1 ps-1 pe-1.5" : "py-1.5 ps-1.5 pe-2"}`}>
      <button type="button" draggable={canEdit} aria-pressed={selected} onClick={(event) => { event.stopPropagation(); if (canEdit) onSelect(); }} onDragStart={onDragStart} title={`${playerDisplayName(player, locale)} — ${localizedFootballPosition(player.position, locale)}`} className={`touch-manipulation inline-flex min-h-11 min-w-0 items-center gap-1.5 text-start ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}>
        <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold text-muted-foreground ${compact ? "h-7 w-7" : "h-9 w-9"}`}>
          {player.photoUrl ? (
            <SafeImage src={player.photoUrl} fallbackSrc="/branding/person-placeholder.svg" alt={`${player.firstName} ${player.lastName}`} className="h-full w-full object-cover" />
          ) : `${playerDisplayName(player, locale).charAt(0)}${playerDisplayName(player, locale).split(/\s+/u).at(-1)?.charAt(0) ?? ""}`}
        </span>
        <span className="max-w-32 truncate text-[10px] font-semibold">{playerDisplayName(player, locale)}</span>
        {player.shirtNumber != null && <span className="font-mono text-[9px] font-bold text-muted-foreground">#{player.shirtNumber}</span>}
      </button>
      {busy ? <LoaderCircle className="h-3 w-3 animate-spin text-club-primary" /> : canEdit && (
        <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(); }} aria-label={`${isAr ? "إزالة" : "Retirer"} ${playerDisplayName(player, locale)}`} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-70 transition-colors hover:bg-red-500/10 hover:text-red-500 group-hover/token:opacity-100">
          <Trash2 className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
