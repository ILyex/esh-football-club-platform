"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Circle, Download, Eraser, FilePlus2, Flag, List, Maximize2, Minimize2, Move, Pencil, Printer, Redo2, Save, Shield, Trash2, Undo2, Users, ZoomIn, ZoomOut, Route, Play, Pause, Image as ImageIcon, Video, Repeat2, Trash, Gauge, Settings2 } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";
import { TacticalColorPicker } from "@/components/tactics/color-picker";
import { saveTacticalPlanAction } from "@/app/[locale]/(dashboard)/dashboard/tactics/actions";

type Team = { id: string; name: string; category: string };
type PlayerItem = { id: string; kind: "player" | "opponent"; x: number; y: number; number: string; label: string; color: string };
type MarkItem = { id: string; kind: "arrow" | "line" | "zone" | "path"; x: number; y: number; x2: number; y2: number; color: string; label?: string; points?: { x: number; y: number }[] };
type BallItem = { id: string; kind: "ball"; x: number; y: number; color?: string };
type Item = PlayerItem | MarkItem | BallItem;
type AnimationFrame = { time: number; positions: Record<string, { x: number; y: number }> };
type BoardData = { items: Item[]; orientation: "horizontal" | "vertical"; mode?: "image" | "video"; notes: string; coachName?: string; coachId?: string; animation?: { duration: number; frames: AnimationFrame[] } };
type Plan = { id: string; title: string; description: string; formation: string; teamId: string | null; teamName: string; creatorName: string; isOwner: boolean; data: unknown; updatedAt: string };
type Tool = "select" | "player" | "opponent" | "ball" | "arrow" | "line" | "zone" | "path" | "eraser";

const FORMATIONS: Record<string, number[][]> = {
  "4-3-3": [[14, 50], [27, 18], [27, 39], [27, 61], [27, 82], [43, 25], [45, 50], [43, 75], [62, 22], [64, 50], [62, 78]],
  "4-4-2": [[14, 50], [27, 18], [27, 39], [27, 61], [27, 82], [44, 17], [44, 39], [44, 61], [44, 83], [64, 36], [64, 64]],
  "4-2-3-1": [[14, 50], [27, 18], [27, 39], [27, 61], [27, 82], [41, 39], [41, 61], [54, 19], [56, 50], [54, 81], [68, 50]],
  "3-5-2": [[14, 50], [28, 25], [28, 50], [28, 75], [45, 14], [44, 32], [44, 50], [44, 68], [45, 86], [65, 37], [65, 63]],
  "3-4-3": [[14, 50], [28, 25], [28, 50], [28, 75], [45, 18], [43, 39], [43, 61], [45, 82], [64, 21], [66, 50], [64, 79]],
  "4-1-4-1": [[14, 50], [27, 18], [27, 39], [27, 61], [27, 82], [39, 50], [53, 18], [53, 39], [53, 61], [53, 82], [68, 50]]
};
const STARTING_FORMATION = FORMATIONS["4-3-3"] ?? [];
const HOME_COLOR = "#dc2626";
const AWAY_COLOR = "#38bdf8";
const HOME_KEEPER_COLOR = "#8b5cf6";
const DEFAULT_ITEMS: Item[] = [
  ...STARTING_FORMATION.map(([x = 14, y = 50], i) => ({ id: `h${i + 1}`, kind: "player" as const, x: x * 10, y: y * 6.4, number: String(i + 1), label: (["GB", "DD", "DC", "DC", "DG", "MDF", "MC", "MC", "AD", "BU", "AG"][i] ?? ""), color: i === 0 ? HOME_KEEPER_COLOR : HOME_COLOR })),
  ...STARTING_FORMATION.map(([x = 14, y = 50], i) => ({ id: `a${i + 1}`, kind: "opponent" as const, x: (100 - x) * 10, y: y * 6.4, number: String(i + 1), label: "", color: AWAY_COLOR }))
];
const freshBoard = (): BoardData => ({ items: DEFAULT_ITEMS.map((item) => ({ ...item })), orientation: "horizontal", mode: "image", notes: "" });
const PALETTE = ["#f3f4f6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa"];
const LEGACY_POSITION_LABELS: Record<string, string> = { GK: "GB", RB: "DD", RCB: "DC", LCB: "DC", LB: "DG", DM: "MDF", CM: "MC", RW: "AD", ST: "BU", LW: "AG" };
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function animatedItems(board: BoardData, time: number): Item[] {
  const frames = [...(board.animation?.frames ?? [])].sort((a, b) => a.time - b.time);
  return board.items.map((item) => {
    if (item.kind !== "player" && item.kind !== "opponent" && item.kind !== "ball") return item;
    let exactOrBefore = { time: 0, x: item.x, y: item.y };
    let next: { time: number; x: number; y: number } | undefined;
    for (const frame of frames) {
      const position = frame.positions?.[item.id];
      if (!position) continue;
      const sample = { time: frame.time, ...position };
      if (sample.time <= time) exactOrBefore = sample;
      else { next = sample; break; }
    }
    if (!next || next.time === exactOrBefore.time) return { ...item, x: exactOrBefore.x, y: exactOrBefore.y };
    const ratio = (time - exactOrBefore.time) / (next.time - exactOrBefore.time);
    return { ...item, x: exactOrBefore.x + (next.x - exactOrBefore.x) * ratio, y: exactOrBefore.y + (next.y - exactOrBefore.y) * ratio };
  });
}

function upsertAnimationFrame(board: BoardData, time: number, items: Item[]): BoardData {
  const frameTime = Math.round(time * 10) / 10;
  const positions = Object.fromEntries(items.flatMap((item) => item.kind === "player" || item.kind === "opponent" || item.kind === "ball" ? [[item.id, { x: Math.round(item.x * 10) / 10, y: Math.round(item.y * 10) / 10 }]] : []));
  const frames = (board.animation?.frames ?? []).filter((frame) => Math.abs(frame.time - frameTime) > 0.05);
  frames.push({ time: frameTime, positions });
  return { ...board, animation: { duration: board.animation?.duration ?? 10, frames: frames.sort((a, b) => a.time - b.time) } };
}

function prepareBoard(data: unknown): BoardData | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const board = data as BoardData;
  if (!Array.isArray(board.items)) return null;
  return {
    ...board,
    mode: board.mode === "video" || (board.animation?.frames?.length ?? 0) > 0 ? "video" : "image",
    coachName: board.coachName ?? "",
    animation: board.animation && Array.isArray(board.animation.frames) ? board.animation : { duration: 10, frames: [] },
    items: board.items.map((item) => {
      if (item.kind !== "player" && item.kind !== "opponent") return item;
      const legacyLabel = item.label.trim().toUpperCase();
      const label = LEGACY_POSITION_LABELS[legacyLabel];
      return {
        ...item,
        ...(label ? { label } : {}),
        ...(item.kind === "player" && legacyLabel === "GK" && item.color.toLowerCase() === "#f3f4f6" ? { color: HOME_KEEPER_COLOR } : {}),
        ...(item.kind === "player" && legacyLabel !== "GK" && item.color.toLowerCase() === "#f3f4f6" ? { color: HOME_COLOR } : {}),
        ...(item.kind === "opponent" && item.color.toLowerCase() === "#ef4444" ? { color: AWAY_COLOR } : {})
      };
    })
  };
}

function localize(locale: string) {
  const ar = locale === "ar";
  return ar ? {
    title: "الخطط والتكتيك", subtitle: "أنشئ خطط اللعب، حرّك اللاعبين، ارسم التحركات واطبع لوحة التدريب.", newPlan: "خطة جديدة", save: "حفظ الخطة", saving: "جارٍ الحفظ…", print: "طباعة", export: "تصدير SVG", saveVideo: "حفظ الفيديو", savingVideo: "جارٍ تجهيز الفيديو", videoSaved: "تم تنزيل الفيديو", videoExportError: "تعذر إنشاء الفيديو في هذا المتصفح.", videoExportUnsupported: "المتصفح لا يدعم تسجيل الفيديو.", plans: "خططي المحفوظة", selectPlan: "اختر خطة للبدء", titlePlaceholder: "اسم الخطة التكتيكية", description: "وصف الخطة / الهدف التدريبي", formation: "التشكيلة", team: "الفئة / الفريق", noTeam: "بدون فريق محدد", tools: "أدوات السبورة", select: "تحريك / تحديد", player: "إضافة لاعب", opponent: "إضافة خصم", ball: "الكرة", arrow: "سهم حركة", line: "خط تكتيكي", zone: "منطقة", path: "مسار حركة حر", eraser: "ممحاة العنصر", color: "لون الأداة المحددة", clear: "مسح الرسوم", undo: "تراجع", redo: "إعادة", notes: "ملاحظات المدرب", notesPlaceholder: "نقاط التدريب، واجبات اللاعبين، المحفزات التكتيكية…", playerDetails: "تفاصيل العنصر المحدد", number: "الرقم", label: "المركز / الاسم", deleteItem: "حذف العنصر", coach: "اسم المدرب", coachPlaceholder: "اختر المدرب", coachEmpty: "لا يوجد مدرب متاح لهذه الفئة", opponentLabel: "الخصم", created: "تم حفظ الخطة بنجاح", deleted: "تم حذف الخطة", delete: "حذف", players: "لاعبون", saved: "آخر حفظ", orientation: "اتجاه الملعب", horizontal: "أفقي", vertical: "عمودي", fitScreen: "ملء الشاشة", exitFitScreen: "إنهاء ملء الشاشة", empty: "لا توجد خطط محفوظة بعد", confirmDelete: "حذف هذه الخطة نهائيًا؟", error: "تعذر حفظ الخطة. تحقق من اتصالك وصلاحيتك.", pitch: "ملعب كرة القدم", animation: "حركة التشكيلة", play: "تشغيل", pause: "إيقاف", seconds: "ثوانٍ", noFrame: "حرّك لاعبًا لبناء أول لقطة", imagePlan: "خطة صورة", videoPlan: "خطة فيديو", imageHelp: "تشكيلة ثابتة قابلة للرسم والطباعة", videoHelp: "خطط للحركة مع لقطات زمنية", playbackSpeed: "سرعة التشغيل", loop: "تكرار الحركة", deleteFrame: "حذف اللقطة الحالية", keyframe: "لقطة محفوظة", noKeyframe: "المؤشر ليس على لقطة محفوظة", videoGuide: "اسحب اللاعب لإضافة لقطة عند الوقت المحدد. في النهاية اضغط «حفظ الخطة».", advanced: "إعدادات متقدمة"
  } : {
    title: "Tactics & planning", subtitle: "Create match plans, position players, draw movements and print your coaching board.", newPlan: "New plan", save: "Save plan", saving: "Saving…", print: "Print", export: "Export SVG", saveVideo: "Save video", savingVideo: "Preparing video", videoSaved: "Video downloaded", videoExportError: "Could not create a video in this browser.", videoExportUnsupported: "This browser does not support video recording.", plans: "Saved plans", selectPlan: "Choose a plan to start", titlePlaceholder: "Tactical plan name", description: "Plan description / coaching objective", formation: "Formation", team: "Team / category", noTeam: "No team selected", tools: "Board tools", select: "Select / move", player: "Add player", opponent: "Add opponent", ball: "Ball", arrow: "Movement arrow", line: "Tactical line", zone: "Zone", path: "Free movement path", eraser: "Erase item", color: "Selected tool color", clear: "Clear drawings", undo: "Undo", redo: "Redo", notes: "Coach notes", notesPlaceholder: "Coaching points, player duties, tactical triggers…", playerDetails: "Selected item details", number: "Number", label: "Position / name", deleteItem: "Delete item", coach: "Coach name", coachPlaceholder: "Choose a coach", coachEmpty: "No coach is available for this team", opponentLabel: "Opponent", created: "Plan saved", deleted: "Plan deleted", delete: "Delete", players: "players", saved: "Last saved", orientation: "Pitch orientation", horizontal: "Horizontal", vertical: "Vertical", fitScreen: "Fit to screen", exitFitScreen: "Exit full screen", empty: "No saved plans yet", confirmDelete: "Delete this plan permanently?", error: "Could not save the plan. Check your connection and permissions.", pitch: "Football pitch", animation: "Lineup animation", play: "Play", pause: "Pause", seconds: "seconds", noFrame: "Move a player to create the first keyframe", imagePlan: "Image plan", videoPlan: "Video plan", imageHelp: "A static, drawable and printable formation", videoHelp: "Build player movements with timed keyframes", playbackSpeed: "Playback speed", loop: "Loop animation", deleteFrame: "Delete current keyframe", keyframe: "Saved keyframe", noKeyframe: "The playhead is not on a saved keyframe", videoGuide: "Drag a player to add a keyframe at the selected time. Press Save plan when done.", advanced: "Advanced settings"
  };
}

export function TacticalBoard({ locale, canEdit, teams, coaches, plans: initialPlans, initialPlanId, clubLogoUrl }: { locale: string; canEdit: boolean; teams: Team[]; coaches: { id: string; label: string; teamIds: string[] }[]; plans: Plan[]; initialPlanId?: string; clubLogoUrl?: string | null }) {
  const t = localize(locale);
  const initialPlan = initialPlans.find((plan) => plan.id === initialPlanId);
  const initialBoard = prepareBoard(initialPlan?.data);
  const [plans, setPlans] = useState(initialPlans);
  const [activeId, setActiveId] = useState<string | null>(initialPlan?.id ?? null);
  const [title, setTitle] = useState(initialPlan?.title ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [formation, setFormation] = useState(initialPlan?.formation ?? "4-3-3");
  const [teamId, setTeamId] = useState(initialPlan?.teamId ?? "");
  const [board, setBoard] = useState<BoardData>(() => initialBoard ?? freshBoard());
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>(HOME_COLOR);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [videoExportProgress, setVideoExportProgress] = useState<number | null>(null);
  const [videoExportMessage, setVideoExportMessage] = useState("");
  const [history, setHistory] = useState<BoardData[]>([]);
  const [future, setFuture] = useState<BoardData[]>([]);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [durationDraft, setDurationDraft] = useState(String(initialBoard?.animation?.duration ?? 10));
  const playheadRef = useRef(0);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [pendingCurrent, setPendingCurrent] = useState<{ x: number; y: number } | null>(null);
  const [pendingPath, setPendingPath] = useState<{ x: number; y: number }[] | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragId = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePlan = plans.find((plan) => plan.id === activeId);
  const canEditActive = canEdit && (!activePlan || Boolean(activePlan.teamId) || activePlan.isOwner);
  const count = board.items.filter((item) => item.kind === "player").length;
  const activeItem = board.items.find((item) => item.id === selected);
  const duration = board.animation?.duration ?? 10;
  const availableCoaches = useMemo(() => teamId ? coaches.filter((coach) => coach.teamIds.includes(teamId)) : coaches, [coaches, teamId]);
  const selectedCoach = availableCoaches.find((coach) => coach.id === board.coachId || (!board.coachId && coach.label === board.coachName));
  const coachOptions = [
    { value: "", label: t.coachPlaceholder },
    ...(board.coachName && !selectedCoach ? [{ value: "__legacy__", label: board.coachName, disabled: true }] : []),
    ...availableCoaches.map((coach) => ({ value: coach.id, label: coach.label }))
  ];
  const displayItems = useMemo(() => animatedItems(board, playhead).map((item) =>
    dragPreview?.id === item.id ? { ...item, x: dragPreview.x, y: dragPreview.y } : item
  ), [board, playhead, dragPreview]);

  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

  useEffect(() => {
    setDurationDraft(String(duration));
  }, [duration]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let startedAt = performance.now() - (playheadRef.current / playbackRate) * 1000;
    const tick = (now: number) => {
      let next = ((now - startedAt) / 1000) * playbackRate;
      if (next >= duration) {
        if (loopPlayback) {
          next %= duration;
          startedAt = now - (next / playbackRate) * 1000;
        } else {
          playheadRef.current = duration;
          setPlayhead(duration);
          setPlaying(false);
          return;
        }
      }
      playheadRef.current = next;
      setPlayhead(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, playbackRate, loopPlayback]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [expanded]);

  function updateBoard(change: (current: BoardData) => BoardData) {
    setHistory((old) => [...old.slice(-39), board]);
    setFuture([]);
    setBoard(change(board));
  }
  function setAnimationDuration(value: number) {
    const nextDuration = Math.min(60, Math.max(2, value));
    updateBoard((current) => ({ ...current, animation: { duration: nextDuration, frames: current.animation?.frames ?? [] } }));
    if (playhead > nextDuration) setPlayhead(nextDuration);
  }
  const keyframes = board.animation?.frames ?? [];
  const currentKeyframeIndex = keyframes.findIndex((frame) => Math.abs(frame.time - playhead) < 0.06);
  function deleteCurrentKeyframe() {
    if (currentKeyframeIndex < 0) return;
    updateBoard((current) => ({ ...current, animation: { duration: current.animation?.duration ?? 10, frames: (current.animation?.frames ?? []).filter((_, index) => index !== currentKeyframeIndex) } }));
  }
  function setPlanMode(mode: "image" | "video") {
    if (board.mode === mode) return;
    setPlaying(false);
    setPlayhead(0);
    setBoard((current) => ({ ...current, mode }));
  }
  function newPlan() {
    setPlaying(false); setPlayhead(0); setActiveId(null); setTitle(""); setDescription(""); setFormation("4-3-3"); setTeamId(""); setBoard(freshBoard()); setHistory([]); setFuture([]); setSelected(null); setDragPreview(null); dragId.current = null;
  }
  function point(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current; if (!svg) return { x: 500, y: 320 };
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const matrix = svg.getScreenCTM(); if (!matrix) return { x: 500, y: 320 };
    const result = p.matrixTransform(matrix.inverse());
    const mapped = board.orientation === "vertical" ? { x: result.y, y: 640 - result.x } : { x: result.x, y: result.y };
    return { x: Math.min(990, Math.max(10, mapped.x)), y: Math.min(630, Math.max(10, mapped.y)) };
  }
  function onBoardPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!canEditActive || playing) return;
    const p = point(event);
    if (tool === "eraser") {
      const distanceToSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
        const dx = x2 - x1; const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared)) : 0;
        return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      };
      const hit = [...board.items].reverse().find((item) => {
        if (item.kind === "player" || item.kind === "opponent") return Math.hypot(p.x - item.x, p.y - item.y) <= 30;
        if (item.kind === "ball") return Math.hypot(p.x - item.x, p.y - item.y) <= 20;
        if (item.kind === "zone") return p.x >= Math.min(item.x, item.x2) - 8 && p.x <= Math.max(item.x, item.x2) + 8 && p.y >= Math.min(item.y, item.y2) - 8 && p.y <= Math.max(item.y, item.y2) + 8;
        if (item.kind !== "arrow" && item.kind !== "line" && item.kind !== "path") return false;
        const points = item.kind === "path" ? item.points ?? [{ x: item.x, y: item.y }, { x: item.x2, y: item.y2 }] : [{ x: item.x, y: item.y }, { x: item.x2, y: item.y2 }];
        return points.slice(1).some((next, index) => distanceToSegment(p.x, p.y, points[index]!.x, points[index]!.y, next.x, next.y) <= 16);
      });
      if (hit) {
        updateBoard((b) => ({ ...b, items: b.items.filter((item) => item.id !== hit.id) }));
        setSelected((current) => current === hit.id ? null : current);
      }
      return;
    }
    if (tool === "player" || tool === "opponent") {
      const kind = tool === "player" ? "player" : "opponent";
      const markerColor = kind === "opponent" && color.toLowerCase() === HOME_COLOR ? AWAY_COLOR : color;
      updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind, x: p.x, y: p.y, number: String(b.items.filter((it) => it.kind === kind).length + 1), label: kind === "opponent" ? "" : "MC", color: markerColor }] }));
      setTool("select"); return;
    }
    if (tool === "ball") { updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind: "ball", x: p.x, y: p.y, color }] })); setTool("select"); return; }
    if (tool === "path") { setPendingPath([p]); event.currentTarget.setPointerCapture(event.pointerId); return; }
    if (tool === "arrow" || tool === "line" || tool === "zone") { setPending(p); setPendingCurrent(p); event.currentTarget.setPointerCapture(event.pointerId); return; }
    setSelected(null);
  }
  function onBoardPointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (pendingPath && canEditActive) {
      const p = point(event);
      const last = pendingPath[pendingPath.length - 1]!;
      const points = Math.hypot(p.x - last.x, p.y - last.y) > 2 ? [...pendingPath, p] : pendingPath;
      if (points.length > 1) updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind: "path", x: points[0]!.x, y: points[0]!.y, x2: points[points.length - 1]!.x, y2: points[points.length - 1]!.y, points, color }] }));
      setPendingPath(null); return;
    }
    if (!pending || !canEditActive) return;
    const p = point(event);
    if (Math.hypot(p.x - pending.x, p.y - pending.y) > 8) {
      const kind = tool === "arrow" ? "arrow" : tool === "zone" ? "zone" : "line";
      updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind, x: pending.x, y: pending.y, x2: p.x, y2: p.y, color: color || "#ef4444" }] }));
    }
    setPending(null); setPendingCurrent(null);
  }
  function moveItem(event: React.PointerEvent<SVGElement>, id: string) {
    if (!canEditActive || tool !== "select" || playing) return;
    event.stopPropagation();
    const item = displayItems.find((candidate) => candidate.id === id);
    if (!item) return;
    setHistory((old) => [...old.slice(-39), board]); setFuture([]); dragId.current = id; setDragPreview({ id, x: item.x, y: item.y }); setSelected(id); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onItemMove(event: React.PointerEvent<SVGSVGElement>) {
    if (pending && (tool === "arrow" || tool === "line" || tool === "zone")) {
      setPendingCurrent(point(event));
      return;
    }
    if (pendingPath && tool === "path") {
      const p = point(event); const last = pendingPath[pendingPath.length - 1]!;
      if (Math.hypot(p.x - last.x, p.y - last.y) > 5) setPendingPath((points) => points ? [...points, p] : null);
      return;
    }
    if (!dragId.current) return;
    const p = point(event);
    setDragPreview({ id: dragId.current, x: p.x, y: p.y });
  }
  function finishMove() {
    const id = dragId.current;
    const preview = dragPreview;
    dragId.current = null;
    setDragPreview(null);
    if (!id || !preview || preview.id !== id) return;
    setBoard((current) => {
      const target = current.items.find((item) => item.id === id);
      if (!target) return current;
      if ((target.kind === "player" || target.kind === "opponent" || target.kind === "ball") && current.mode === "video") {
        const frameItems = animatedItems(current, playhead).map((item) => item.id === id ? { ...item, x: preview.x, y: preview.y } : item);
        return upsertAnimationFrame(current, playhead, frameItems);
      }
      return { ...current, items: current.items.map((item) => {
        if (item.id !== id) return item;
        if (item.kind === "arrow" || item.kind === "line" || item.kind === "zone" || item.kind === "path") {
          const dx = preview.x - item.x; const dy = preview.y - item.y;
          return { ...item, x: preview.x, y: preview.y, x2: item.x2 + dx, y2: item.y2 + dy, ...(item.points ? { points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) } : {}) };
        }
        return { ...item, x: preview.x, y: preview.y };
      }) };
    });
  }
  function applyFormation(value: string) {
    setFormation(value);
    const spots = FORMATIONS[value] ?? STARTING_FORMATION;
    updateBoard((b) => ({ ...b, animation: { duration: b.animation?.duration ?? 10, frames: [] }, items: b.items.map((item) => {
      if (item.kind !== "player") return item;
      const index = Math.max(0, Number(item.number) - 1); const spot = spots[index % spots.length] ?? [14, 50];
      return { ...item, x: (spot[0] ?? 14) * 10, y: (spot[1] ?? 50) * 6.4 };
    }) }));
  }
  function changeTeam(value: string) {
    setTeamId(value);
    const teamCoaches = value ? coaches.filter((coach) => coach.teamIds.includes(value)) : coaches;
    if (board.coachName && !teamCoaches.some((coach) => coach.id === board.coachId || coach.label === board.coachName)) {
      updateBoard((current) => ({ ...current, coachId: undefined, coachName: "" }));
    }
  }
  function changeCoach(value: string) {
    const coach = coaches.find((item) => item.id === value);
    updateBoard((current) => ({ ...current, coachId: coach?.id, coachName: coach?.label ?? "" }));
  }
  async function savePlan() {
    if (!title.trim() || !canEditActive) return;
    setBusy(true); setMessage("");
    try {
      const saved = await saveTacticalPlanAction({ id: activeId ?? undefined, title, description, formation, teamId: teamId || null, data: JSON.stringify(board) });
      const existing = plans.find((plan) => plan.id === saved.id);
      const updated: Plan = { id: saved.id, title, description, formation, teamId: teamId || null, teamName: teams.find((team) => team.id === teamId)?.name ?? "", creatorName: existing?.creatorName ?? "", isOwner: true, data: board, updatedAt: saved.updatedAt };
      setPlans((items) => [updated, ...items.filter((plan) => plan.id !== saved.id)]); setActiveId(saved.id); setMessage(t.created);
    } catch (error) { console.error("Tactical plan save failed", error); setMessage(t.error); }
    finally { setBusy(false); }
  }
  function undo() { if (!history.length) return; const previous = history.at(-1)!; setFuture((items) => [...items, board]); setBoard({ ...previous, mode: board.mode }); setHistory((items) => items.slice(0, -1)); }
  function redo() { if (!future.length) return; const next = future.at(-1)!; setHistory((items) => [...items, board]); setBoard({ ...next, mode: board.mode }); setFuture((items) => items.slice(0, -1)); }
  function exportSvg() {
    if (!svgRef.current) return;
    const copySvg = svgRef.current.cloneNode(true) as SVGSVGElement;
    copySvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copySvg.querySelectorAll("image").forEach((image) => {
      const source = image.getAttribute("href");
      if (source?.startsWith("/")) image.setAttribute("href", new URL(source, window.location.origin).href);
    });
    const blob = new Blob([new XMLSerializer().serializeToString(copySvg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title.trim() || "tactical-plan"}.svg`; a.click(); URL.revokeObjectURL(url);
  }
  async function exportVideo() {
    const sourceSvg = svgRef.current;
    if (!sourceSvg || videoExportProgress !== null) return;
    const Recorder = window.MediaRecorder;
    const canvas = document.createElement("canvas");
    if (!Recorder || typeof canvas.captureStream !== "function") { setVideoExportMessage(t.videoExportUnsupported); return; }
    const formats = [
      { mime: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
      { mime: "video/mp4", extension: "mp4" },
      { mime: "video/quicktime", extension: "mov" },
      { mime: "video/webm;codecs=vp9", extension: "webm" },
      { mime: "video/webm", extension: "webm" }
    ];
    const format = formats.find((candidate) => Recorder.isTypeSupported(candidate.mime));
    if (!format) { setVideoExportMessage(t.videoExportUnsupported); return; }

    setVideoExportMessage("");
    setVideoExportProgress(0);
    setPlaying(false);
    const portrait = board.orientation === "vertical";
    canvas.width = portrait ? 720 : 1280;
    canvas.height = portrait ? 1125 : 820;
    const context = canvas.getContext("2d");
    if (!context) { setVideoExportProgress(null); setVideoExportMessage(t.videoExportError); return; }
    const stream = canvas.captureStream(24);
    let recorder: MediaRecorder | null = null;
    let objectUrl: string | null = null;
    try {
      const logo = sourceSvg.querySelector("image");
      let logoDataUrl: string | null = null;
      const logoSource = logo?.getAttribute("href");
      if (logoSource) {
        try {
          const response = await fetch(new URL(logoSource, window.location.href), { credentials: "same-origin", mode: "cors" });
          if (!response.ok) throw new Error("Could not load club logo");
          const logoBlob = await response.blob();
          logoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read club logo"));
            reader.onerror = () => reject(reader.error ?? new Error("Could not read club logo"));
            reader.readAsDataURL(logoBlob);
          });
        } catch { /* A logo blocked by cross-origin policy is omitted to keep canvas export safe. */ }
      }

      const chunks: BlobPart[] = [];
      recorder = new Recorder(stream, { mimeType: format.mime });
      const finished = new Promise<Blob>((resolve, reject) => {
        recorder!.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        recorder!.onerror = () => reject(new Error("Video recording failed"));
        recorder!.onstop = () => resolve(new Blob(chunks, { type: recorder!.mimeType || format.mime }));
      });
      recorder.start(250);
      const fps = 24;
      const frameCount = Math.max(1, Math.ceil(duration * fps));
      for (let frame = 0; frame <= frameCount; frame++) {
        const started = performance.now();
        const time = Math.min(duration, frame / fps);
        const clone = sourceSvg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        clone.setAttribute("width", String(canvas.width));
        clone.setAttribute("height", String(canvas.height));
        clone.setAttribute("viewBox", portrait ? "0 0 640 1000" : "0 0 1000 640");
        clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
        const frameItems = animatedItems(board, time);
        clone.querySelectorAll<SVGGElement>("[data-tactics-item]").forEach((element) => {
          const item = frameItems.find((candidate) => candidate.id === element.dataset.tacticsItem);
          if (item && (item.kind === "player" || item.kind === "opponent" || item.kind === "ball")) element.setAttribute("transform", `translate(${item.x} ${item.y})`);
        });
        clone.querySelectorAll("image").forEach((image) => {
          if (logoDataUrl) image.setAttribute("href", logoDataUrl);
          else image.remove();
        });
        const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
        objectUrl = URL.createObjectURL(svgBlob);
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not render a video frame"));
          image.src = objectUrl!;
        });
        context.fillStyle = "#101713";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        setVideoExportProgress(Math.min(99, Math.round((frame / frameCount) * 100)));
        if (frame < frameCount) await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 1000 / fps - (performance.now() - started))));
      }
      recorder.stop();
      const video = await finished;
      const downloadUrl = URL.createObjectURL(video);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${title.trim() || "tactical-plan"}.${format.extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);
      setVideoExportMessage(`${t.videoSaved} (${format.extension.toUpperCase()})`);
    } catch (error) {
      console.error("Tactical video export failed", error);
      if (recorder?.state === "recording") recorder.stop();
      setVideoExportMessage(t.videoExportError);
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      stream.getTracks().forEach((track) => track.stop());
      setVideoExportProgress(null);
    }
  }
  function chooseColor(nextColor: string) {
    setColor(nextColor);
  }
  function setItemColor(id: string, nextColor: string) {
    updateBoard((b) => ({ ...b, items: b.items.map((item) => item.id === id ? { ...item, color: nextColor } as Item : item) }));
  }
  function handleItemPointerDown(event: React.PointerEvent<SVGElement>, id: string) {
    if (tool === "eraser") return;
    if (tool === "select") moveItem(event, id);
  }
  const tools: { id: Tool; icon: typeof Move; label: string }[] = [
    { id: "select", icon: Move, label: t.select }, { id: "player", icon: Users, label: t.player }, { id: "opponent", icon: Shield, label: t.opponent }, { id: "ball", icon: Circle, label: t.ball }, { id: "arrow", icon: ArrowRight, label: t.arrow }, { id: "line", icon: Pencil, label: t.line }, { id: "path", icon: Route, label: t.path }, { id: "zone", icon: Flag, label: t.zone }, { id: "eraser", icon: Eraser, label: t.eraser }
  ];
  const viewBox = useMemo(() => { const width = (board.orientation === "vertical" ? 640 : 1000) / zoom; const height = (board.orientation === "vertical" ? 1000 : 640) / zoom; return `${((board.orientation === "vertical" ? 640 : 1000) - width) / 2} ${((board.orientation === "vertical" ? 1000 : 640) - height) / 2} ${width} ${height}`; }, [board.orientation, zoom]);

  return <div className="tactics-page mx-auto max-w-[1600px] space-y-4 pb-8" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div><h1 className="text-2xl font-bold">{t.title}</h1><p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p></div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <button type="button" onClick={newPlan} className="tactics-action"><FilePlus2 size={16}/>{t.newPlan}</button>}
        <Link href={`/${locale}/dashboard/tactics/plans`} className="tactics-action"><List size={16}/>{t.plans}</Link>
        {board.mode === "video" ? <button type="button" onClick={() => void exportVideo()} disabled={videoExportProgress !== null} className="tactics-action tactics-primary"><Video size={16}/>{videoExportProgress === null ? t.saveVideo : `${t.savingVideo} ${videoExportProgress}%`}</button> : <button type="button" onClick={exportSvg} className="tactics-action"><Download size={16}/>{t.export}</button>}
        <button type="button" onClick={() => window.print()} className="tactics-action tactics-primary"><Printer size={16}/>{t.print}</button>
      </div>
    </header>

    <header className="tactics-print-header hidden items-center justify-between gap-4 border-b-2 border-zinc-300 pb-4 text-zinc-900" dir="ltr">
      <img src="/branding/esh-logo-128.png" alt="ESH" className="h-20 w-20 object-contain" />
      <div className="flex-1 text-center" dir={locale === "ar" ? "rtl" : "ltr"}>
        <h1 className="text-2xl font-black">{title.trim() || t.titlePlaceholder}</h1>
        <p className="mt-1 text-base font-semibold">{board.coachName?.trim() || t.coach}</p>
        {teamId && <p className="mt-1 text-sm">{teams.find((team) => team.id === teamId)?.name}</p>}
      </div>
      <img src="/branding/esh-logo-128.png" alt="ESH" className="h-20 w-20 object-contain" />
    </header>

    <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_310px]">
      <main className="min-w-0 space-y-3">
        <section className="tactics-panel grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 2xl:grid-cols-4 print:hidden">
          <label className="tactics-field"><span>{t.titlePlaceholder}</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} disabled={!canEditActive} placeholder={t.titlePlaceholder}/></label>
          <label className="tactics-field"><span>{t.description}</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={!canEditActive} placeholder={t.description}/></label>
          <div className="tactics-field"><span>{t.formation}</span><FormSelect name="tactical-formation" locale={locale} value={formation} onValueChange={applyFormation} disabled={!canEditActive} options={Object.keys(FORMATIONS).map((item) => ({ value: item, label: item }))} ariaLabel={t.formation}/></div>
          <div className="tactics-field"><span>{t.team}</span><FormSelect name="tactical-team" locale={locale} value={teamId} onValueChange={changeTeam} disabled={!canEditActive} options={[{ value: "", label: t.noTeam }, ...teams.map((team) => ({ value: team.id, label: team.name }))]} ariaLabel={t.team}/></div>
        </section>

        <section className="tactics-screen-only tactics-panel flex flex-wrap gap-2 p-2" aria-label={locale === "ar" ? "نوع الخطة" : "Plan type"}>
          <button type="button" aria-pressed={board.mode !== "video"} onClick={() => setPlanMode("image")} className={`tactics-mode ${board.mode !== "video" ? "tactics-mode-active" : ""}`}><ImageIcon size={18}/><span className="text-start"><strong className="block">{t.imagePlan}</strong><small>{t.imageHelp}</small></span></button>
          <button type="button" aria-pressed={board.mode === "video"} onClick={() => setPlanMode("video")} className={`tactics-mode ${board.mode === "video" ? "tactics-mode-active" : ""}`}><Video size={18}/><span className="text-start"><strong className="block">{t.videoPlan}</strong><small>{t.videoHelp}</small></span></button>
        </section>

        <section className={`tactics-panel ${expanded ? "tactics-board-fullscreen" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div className="flex flex-wrap items-center gap-1.5">{tools.map(({ id, icon: Icon, label }) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={`tactics-tool ${tool === id ? "tactics-tool-active" : ""}`}><Icon size={17}/><span className="hidden sm:inline">{label}</span></button>)}<span className="mx-1 h-6 w-px bg-border"/><TacticalColorPicker label={t.color} value={color} onChange={chooseColor}/><div className="flex gap-1">{PALETTE.map((swatch) => <button key={swatch} type="button" aria-label={swatch} aria-pressed={color === swatch} onClick={() => chooseColor(swatch)} className={`h-6 w-6 rounded-full border-2 ${color === swatch ? "border-white ring-2 ring-club-primary" : "border-white/20"}`} style={{ background: swatch }}/>)}</div></div>
            <div className="flex items-center gap-1.5"><button type="button" title={t.undo} onClick={undo} disabled={!history.length} className="tactics-icon"><Undo2 size={17}/></button><button type="button" title={t.redo} onClick={redo} disabled={!future.length} className="tactics-icon"><Redo2 size={17}/></button><span className="mx-1 h-6 w-px bg-border"/><button type="button" title="Zoom out" onClick={() => setZoom((z) => Math.max(.75, z - .15))} className="tactics-icon"><ZoomOut size={17}/></button><span className="min-w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span><button type="button" title="Zoom in" onClick={() => setZoom((z) => Math.min(1.45, z + .15))} className="tactics-icon"><ZoomIn size={17}/></button><button type="button" title={expanded ? t.exitFitScreen : t.fitScreen} aria-label={expanded ? t.exitFitScreen : t.fitScreen} onClick={() => { setZoom(1); setExpanded((current) => !current); }} className="tactics-icon">{expanded ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}</button><button type="button" title={t.clear} onClick={() => updateBoard((b) => ({ ...b, items: b.items.filter((item) => item.kind === "player" || item.kind === "opponent") }))} className="tactics-icon text-red-400"><Trash2 size={17}/></button></div>
          </div>
          {board.mode === "video" && <div className="space-y-2 border-b border-border px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-semibold"><Video size={16} className="text-club-primary"/>{t.animation}</div><p className="text-xs text-muted-foreground">{t.videoGuide}</p></div>
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background/50 px-2 py-1.5">
              <button type="button" title={playing ? t.pause : t.play} aria-label={playing ? t.pause : t.play} disabled={!board.animation?.frames.length} onClick={() => setPlaying((value) => !value)} className="tactics-icon">{playing ? <Pause size={17}/> : <Play size={17}/>}</button>
              <input aria-label={t.animation} type="range" min={0} max={duration} step={0.1} value={Math.min(playhead, duration)} disabled={playing || !board.animation?.frames.length} onChange={(event) => setPlayhead(Number(event.target.value))} className="tactics-timeline min-w-0 flex-1" />
              <span className="min-w-[82px] text-center font-mono text-xs tabular-nums text-muted-foreground">{playhead.toFixed(1)}s / {duration.toFixed(0)}s</span>
            </div>
            <details className="tactics-advanced">
              <summary><Settings2 size={14}/>{t.advanced}</summary>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><span>{t.seconds}</span><input aria-label={t.seconds} type="number" min={2} max={60} value={durationDraft} disabled={!canEditActive || playing} onChange={(event) => setDurationDraft(event.target.value)} onBlur={() => setAnimationDuration(Number(durationDraft) || 10)} className="tactics-duration w-16" /></label>
                <button type="button" title={t.deleteFrame} aria-label={t.deleteFrame} disabled={!canEditActive || currentKeyframeIndex < 0 || playing} onClick={deleteCurrentKeyframe} className="tactics-icon text-red-400"><Trash size={15}/></button>
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><Gauge size={14}/><span>{t.playbackSpeed}</span><select aria-label={t.playbackSpeed} value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))} className="tactics-duration"><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
                <button type="button" aria-pressed={loopPlayback} title={t.loop} onClick={() => setLoopPlayback((value) => !value)} className={`tactics-icon ${loopPlayback ? "tactics-tool-active" : ""}`}><Repeat2 size={16}/><span>{t.loop}</span></button>
              </div>
            </details>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{keyframes.length === 0 ? t.noFrame : currentKeyframeIndex >= 0 ? `${t.keyframe} ${currentKeyframeIndex + 1} / ${keyframes.length}` : `${keyframes.length} ${t.keyframe}`}</p>{videoExportMessage && <p role="status" className={`text-xs ${videoExportMessage === t.videoExportError || videoExportMessage === t.videoExportUnsupported ? "text-red-400" : "text-emerald-400"}`}>{videoExportMessage}</p>}</div>
          </div>}
          <div className="tactics-pitch-wrap p-2 sm:p-4">
            <svg ref={svgRef} viewBox={viewBox} aria-label={t.pitch} className={`tactics-pitch ${board.orientation === "vertical" ? "tactics-pitch-vertical" : ""} ${tool !== "select" ? "tactics-crosshair" : ""}`} onPointerDown={onBoardPointerDown} onPointerMove={onItemMove} onPointerUp={(event) => { onBoardPointerUp(event); finishMove(); }} onPointerCancel={() => { setPending(null); setPendingCurrent(null); setPendingPath(null); dragId.current = null; setDragPreview(null); }}>
              <defs><pattern id="grass" width="100" height="640" patternUnits="userSpaceOnUse"><rect width="50" height="640" fill="#176b43"/><rect x="50" width="50" height="640" fill="#1b7549"/></pattern><marker id="tactics-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0L7 3.5L0 7z" fill="context-stroke"/></marker><pattern id="small-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" strokeOpacity=".055" strokeWidth="1"/></pattern></defs>
              <g transform={board.orientation === "vertical" ? "translate(640 0) rotate(90)" : undefined}>
                <rect width="1000" height="640" rx="12" fill="url(#grass)"/><rect width="1000" height="640" rx="12" fill="url(#small-grid)"/>
                <image href={clubLogoUrl || "/branding/esh-logo-transparent.png"} x="350" y="150" width="300" height="300" opacity=".16" preserveAspectRatio="xMidYMid meet" pointerEvents="none" aria-hidden="true"/>
              <g fill="none" stroke="#ecfdf5" strokeOpacity=".82" strokeWidth="3"><rect x="22" y="22" width="956" height="596" rx="4"/><line x1="500" y1="22" x2="500" y2="618"/><circle cx="500" cy="320" r="82"/><circle cx="500" cy="320" r="3" fill="#ecfdf5"/><rect x="22" y="168" width="145" height="304"/><rect x="22" y="232" width="58" height="176"/><circle cx="112" cy="320" r="3" fill="#ecfdf5"/><path d="M167 255a82 82 0 0 1 0 130"/><rect x="833" y="168" width="145" height="304"/><rect x="920" y="232" width="58" height="176"/><circle cx="888" cy="320" r="3" fill="#ecfdf5"/><path d="M833 255a82 82 0 0 0 0 130"/></g>
                {displayItems.map((item) => item.kind === "player" || item.kind === "opponent" ? <g key={item.id} data-tactics-item={item.id} className="tactics-player" transform={`translate(${item.x} ${item.y})`} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}>
                <g transform={board.orientation === "vertical" ? "rotate(-90)" : undefined}><circle r="23" fill={item.color} stroke={selected === item.id ? "#fbbf24" : item.kind === "player" ? "#111827" : "#075985"} strokeWidth={selected === item.id ? 4 : 2.5}/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill={item.color === "#f3f4f6" ? "#111827" : "white"}>{item.number}</text>{item.label && <text x={0} y={board.orientation === "vertical" ? -39 : 39} textAnchor="middle" fontSize="13" fontWeight="700" fill="white" paintOrder="stroke" stroke="#14532d" strokeWidth="4" strokeLinejoin="round">{item.label}</text>}</g>
              </g> : item.kind === "ball" ? <g key={item.id} data-tactics-item={item.id} transform={`translate(${item.x} ${item.y})`} className="tactics-player" onPointerDown={(e) => handleItemPointerDown(e, item.id)} onPointerMove={(e) => dragId.current === item.id && onItemMove(e as unknown as ReactPointerEvent<SVGSVGElement>)} onPointerUp={finishMove} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><circle r="12" fill={item.color ?? "#fff"} stroke="#111827" strokeWidth="3"/><path d="M0-6 6-2 4 5-4 5-6-2Z" transform={board.orientation === "vertical" ? "rotate(-90)" : undefined} fill="#111827"/></g> : item.kind === "zone" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><rect x={Math.min(item.x, item.x2)} y={Math.min(item.y, item.y2)} width={Math.abs(item.x2 - item.x)} height={Math.abs(item.y2 - item.y)} rx="8" fill={item.color} fillOpacity=".2" stroke={item.color} strokeWidth="3" strokeDasharray="8 6"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : item.kind === "path" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><polyline points={(item.points ?? [{ x: item.x, y: item.y }, { x: item.x2, y: item.y2 }]).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#tactics-arrow)"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2 - 10} textAnchor="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : item.kind === "arrow" || item.kind === "line" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth={item.kind === "arrow" ? 4 : 3} strokeDasharray={item.kind === "line" ? "12 8" : undefined} markerEnd={item.kind === "arrow" ? "url(#tactics-arrow)" : undefined} strokeLinecap="round"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2 - 10} textAnchor="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : null)}
              {pending && pendingCurrent && <g pointerEvents="none" opacity=".78">
                {tool === "zone" ? <rect x={Math.min(pending.x, pendingCurrent.x)} y={Math.min(pending.y, pendingCurrent.y)} width={Math.abs(pendingCurrent.x - pending.x)} height={Math.abs(pendingCurrent.y - pending.y)} rx="8" fill={color} fillOpacity=".18" stroke={color} strokeWidth="3" strokeDasharray="8 6"/> : <line x1={pending.x} y1={pending.y} x2={pendingCurrent.x} y2={pendingCurrent.y} stroke={color} strokeWidth={tool === "arrow" ? 4 : 3} strokeDasharray={tool === "line" ? "12 8" : undefined} markerEnd={tool === "arrow" ? "url(#tactics-arrow)" : undefined} strokeLinecap="round"/>}
                <circle cx={pending.x} cy={pending.y} r="5" fill={color}/><circle cx={pendingCurrent.x} cy={pendingCurrent.y} r="4" fill={color}/>
              </g>}
              {pendingPath && <polyline points={pendingPath.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>}
              </g>
            </svg>
          </div>
          <div className="tactics-screen-only flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Users size={14}/>{count} {t.players}</span><div className="flex items-center gap-2"><span>{t.orientation}</span><button type="button" className="tactics-small" onClick={() => updateBoard((b) => ({ ...b, orientation: "horizontal" }))}><ArrowRight size={14}/>{t.horizontal}</button><button type="button" className="tactics-small" onClick={() => updateBoard((b) => ({ ...b, orientation: "vertical" }))}><ArrowDown size={14}/>{t.vertical}</button></div></div>
        </section>

        <div className="tactics-screen-only grid gap-3 lg:grid-cols-2">
          <section className="tactics-panel p-4"><label className="tactics-field mb-4"><span>{t.coach}</span><FormSelect name="coachId" locale={locale} value={selectedCoach?.id ?? (board.coachName ? "__legacy__" : "")} onValueChange={changeCoach} disabled={!canEditActive} options={coachOptions} ariaLabel={t.coach} placeholder={availableCoaches.length ? t.coachPlaceholder : t.coachEmpty}/></label><label className="tactics-field"><span>{t.notes}</span><textarea rows={4} value={board.notes} onChange={(e) => updateBoard((b) => ({ ...b, notes: e.target.value }))} disabled={!canEditActive} placeholder={t.notesPlaceholder}/></label></section>
          <section className="tactics-panel p-4"><h2 className="mb-3 text-sm font-bold">{t.playerDetails}</h2>{activeItem && <div className="grid gap-3 sm:grid-cols-2">{(activeItem.kind === "player" || activeItem.kind === "opponent") && <><label className="tactics-field"><span>{t.number}</span><input value={activeItem.number} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && (it.kind === "player" || it.kind === "opponent") ? { ...it, number: e.target.value.slice(0, 3) } : it) }))}/></label><label className="tactics-field"><span>{t.label}</span><input value={activeItem.label} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && (it.kind === "player" || it.kind === "opponent") ? { ...it, label: e.target.value.slice(0, 32) } : it) }))}/></label></>}{(activeItem.kind === "arrow" || activeItem.kind === "line" || activeItem.kind === "zone" || activeItem.kind === "path") && <label className="tactics-field sm:col-span-2"><span>{t.label}</span><input value={activeItem.label ?? ""} maxLength={100} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && it.kind !== "player" && it.kind !== "opponent" && it.kind !== "ball" ? { ...it, label: e.target.value } : it) }))}/></label>}{activeItem.color && <div className="flex flex-wrap items-center gap-1 sm:col-span-2"><span className="me-1 text-xs text-muted-foreground">{t.color}</span>{PALETTE.map((swatch) => <button key={swatch} type="button" disabled={!canEditActive} aria-label={swatch} onClick={() => setItemColor(activeItem.id, swatch)} className="h-6 w-6 rounded-full border border-white/30" style={{ background: swatch }}/>)}</div>}<button type="button" disabled={!canEditActive} className="tactics-small text-red-400 sm:col-span-2" onClick={() => { updateBoard((b) => ({ ...b, items: b.items.filter((it) => it.id !== selected) })); setSelected(null); }}><Trash2 size={14}/>{t.deleteItem}</button></div>}{!activeItem && <p className="py-4 text-sm text-muted-foreground">{t.selectPlan}</p>}</section>
        </div>
      </main>

      <aside className="min-w-0 space-y-3 2xl:sticky 2xl:top-4">
        {canEdit && <section className="tactics-panel space-y-3 p-4"><button type="button" onClick={savePlan} disabled={busy || !title.trim() || !canEditActive} className="tactics-action tactics-primary w-full justify-center"><Save size={16}/>{busy ? t.saving : t.save}</button>{message && <p role="status" className="text-center text-sm text-emerald-400">{message}</p>}</section>}
        <section className="tactics-panel p-4"><h2 className="mb-3 text-sm font-bold">{t.tools}</h2><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>↗ {t.arrow}</span><span>⇢ {t.line}</span><span>▱ {t.zone}</span><span>⚽ {t.ball}</span><span>4-3-3</span><span>4-2-3-1</span></div></section>
      </aside>
    </div>
    <style jsx global>{`
      .tactics-advanced{font-size:.75rem;color:hsl(var(--muted-foreground))}.tactics-advanced>summary{display:inline-flex;cursor:pointer;list-style:none;align-items:center;gap:.4rem;border:1px solid hsl(var(--border));border-radius:.5rem;padding:.35rem .55rem}.tactics-advanced>summary::-webkit-details-marker{display:none}.tactics-advanced[open]>summary{border-color:#dc2626;color:hsl(var(--foreground))}
      .tactics-mode{display:flex;min-width:min(100%,16rem);flex:1;align-items:center;gap:.75rem;border:1px solid hsl(var(--border));border-radius:.7rem;padding:.7rem .85rem;color:hsl(var(--muted-foreground));transition:border-color .15s,background .15s,color .15s}.tactics-mode:hover{border-color:#dc262680;background:hsl(var(--muted)/.45)}.tactics-mode strong{font-size:.85rem;color:hsl(var(--foreground))}.tactics-mode small{display:block;margin-top:.15rem;font-size:.7rem;line-height:1.4}.tactics-mode-active{border-color:#dc2626;background:#dc262610;color:#ef4764;box-shadow:inset 0 0 0 1px #dc262633}
      .tactics-action{display:inline-flex;align-items:center;gap:.5rem;border:1px solid hsl(var(--border));border-radius:.55rem;padding:.55rem .8rem;font-size:.82rem;font-weight:650;transition:background .15s,border .15s}.tactics-action:hover{background:hsl(var(--muted))}.tactics-action:disabled{opacity:.5;cursor:not-allowed}.tactics-primary{background:#cf1235;color:#fff;border-color:#cf1235}.tactics-primary:hover{background:#b80f2e}.tactics-panel{border:1px solid hsl(var(--border));border-radius:.85rem;background:hsl(var(--card))}.tactics-field{display:flex;min-width:0;flex-direction:column;gap:.45rem}.tactics-field>span{font-size:.75rem;font-weight:650;color:hsl(var(--muted-foreground))}.tactics-field input,.tactics-field select,.tactics-field textarea{box-sizing:border-box;width:100%;min-height:2.5rem;border:1px solid hsl(var(--border));border-radius:.625rem;background:hsl(var(--background));padding:.5rem .75rem;color:hsl(var(--foreground));font-size:.875rem;text-align:start;outline:none;transition:border-color .15s,box-shadow .15s,background-color .15s}.tactics-field input:hover,.tactics-field select:hover,.tactics-field textarea:hover{border-color:#dc262680}.tactics-field input:focus,.tactics-field select:focus,.tactics-field textarea:focus{border-color:#dc2626;box-shadow:0 0 0 2px #dc262626}.tactics-field textarea{min-height:7rem;resize:vertical;line-height:1.6}.tactics-field input::placeholder,.tactics-field textarea::placeholder{color:hsl(var(--muted-foreground));opacity:.8}.tactics-field input:disabled,.tactics-field textarea:disabled,.tactics-field select:disabled{opacity:.65;cursor:not-allowed}.tactics-tool,.tactics-icon,.tactics-small{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid transparent;border-radius:.5rem;padding:.48rem;color:hsl(var(--muted-foreground));font-size:.73rem;transition:all .15s}.tactics-tool:hover,.tactics-icon:hover,.tactics-small:hover{background:hsl(var(--muted));color:hsl(var(--foreground))}.tactics-tool-active{border-color:#cf1235;background:#cf12351a;color:#ef4764}.tactics-icon:disabled,.tactics-small:disabled{opacity:.35;cursor:not-allowed}.tactics-small{border-color:hsl(var(--border));padding:.35rem .5rem}.tactics-duration{border:1px solid #383a40;border-radius:.45rem;background:#0d0e10;padding:.3rem .4rem;color:hsl(var(--foreground));font-size:.75rem}.tactics-timeline{height:6px;accent-color:#cf1235;cursor:pointer}.tactics-timeline:disabled{cursor:not-allowed;opacity:.45}.tactics-pitch-wrap{background:#101713}.tactics-pitch{display:block;width:100%;max-height:min(68vh,680px);aspect-ratio:1000/640;border-radius:.6rem;touch-action:none;user-select:none}.tactics-crosshair{cursor:crosshair}.tactics-player{cursor:grab;touch-action:none}.tactics-player:active{cursor:grabbing}.tactics-player text{pointer-events:none;user-select:none}.tactics-pitch-vertical{display:block;aspect-ratio:640/1000;width:min(100%,49.9dvh,544px);height:auto;max-width:100%;max-height:min(78dvh,850px);margin-inline:auto}
      .tactical-color-root{position:relative;z-index:30}.tactical-color-trigger{display:inline-flex;align-items:center;gap:.5rem;border:1px solid hsl(var(--border));border-radius:.55rem;background:hsl(var(--card));padding:.38rem .55rem;color:hsl(var(--muted-foreground));font-size:.72rem;transition:border-color .15s,color .15s}.tactical-color-trigger:hover,.tactical-color-trigger[aria-expanded=true]{border-color:#cf1235;color:hsl(var(--foreground))}.tactical-color-dot,.tactical-color-preview{display:block;flex:none;border:1px solid #ffffff40;border-radius:999px}.tactical-color-dot{height:1rem;width:1rem}.tactical-color-popover{position:absolute;top:calc(100% + .5rem);inset-inline-start:0;z-index:100;width:min(17rem,calc(100vw - 2rem));border:1px solid hsl(var(--border));border-radius:.8rem;background:hsl(var(--card));padding:.75rem;box-shadow:0 18px 48px #000b;color:hsl(var(--foreground))}.tactical-color-head{display:flex;align-items:center;gap:.65rem;border-bottom:1px solid hsl(var(--border));padding-bottom:.7rem}.tactical-color-preview{height:2.2rem;width:2.2rem}.tactical-color-caption{display:block;margin-bottom:.2rem;color:hsl(var(--muted-foreground));font-size:.65rem}.tactical-color-hex{width:100%;border:1px solid hsl(var(--border));border-radius:.4rem;background:hsl(var(--background));padding:.3rem .45rem;font:500 .75rem ui-monospace,monospace;text-transform:uppercase;outline:none}.tactical-color-hex:focus{border-color:#cf1235;box-shadow:0 0 0 1px #cf1235}.tactical-color-presets{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:.35rem;padding:.75rem 0}.tactical-color-swatch{display:flex;aspect-ratio:1;align-items:center;justify-content:center;border:1px solid #ffffff30;border-radius:.35rem;color:white;box-shadow:inset 0 0 0 1px #0002}.tactical-color-swatch:hover{transform:scale(1.1)}.tactical-color-range{display:grid;grid-template-columns:1rem minmax(0,1fr);align-items:center;gap:.55rem;margin-top:.45rem;color:hsl(var(--muted-foreground));font-size:.65rem;font-weight:700}.tactical-color-range input{height:.5rem;width:100%;appearance:none;border:1px solid #ffffff30;border-radius:999px;cursor:pointer}.tactical-color-range input::-webkit-slider-thumb{height:14px;width:14px;appearance:none;border:2px solid white;border-radius:50%;background:#cf1235;box-shadow:0 1px 4px #0008}.tactical-color-range input::-moz-range-thumb{height:11px;width:11px;border:2px solid white;border-radius:50%;background:#cf1235;box-shadow:0 1px 4px #0008}.tactical-color-done{width:100%;margin-top:.75rem;border:1px solid #cf1235;border-radius:.45rem;background:#cf1235;padding:.4rem;color:white;font-size:.75rem;font-weight:700}.tactical-color-done:hover{background:#b80f2e}
      .tactics-board-fullscreen{position:fixed!important;inset:0!important;z-index:100!important;display:flex!important;height:100dvh!important;max-height:100dvh!important;width:100vw!important;flex-direction:column!important;border:0!important;border-radius:0!important;background:hsl(var(--background))!important}.tactics-board-fullscreen>div:first-child{flex:none}.tactics-board-fullscreen .tactics-pitch-wrap{display:flex;min-height:0;flex:1;align-items:center;justify-content:center;padding:12px!important}.tactics-board-fullscreen .tactics-pitch{width:min(100%,calc((100dvh - 110px)*1.5625));height:auto;max-height:calc(100dvh - 110px);aspect-ratio:1000/640}.tactics-board-fullscreen .tactics-pitch-vertical{width:min(100%,calc((100dvh - 110px)*.64));height:auto;max-width:100%;max-height:calc(100dvh - 110px);aspect-ratio:640/1000}
      @media print{body *{visibility:hidden!important}.tactics-page,.tactics-page *{visibility:visible!important}.tactics-page{position:absolute!important;inset:0!important;width:100%!important;max-width:none!important;padding:0!important;background:white!important;color:#111!important}.tactics-page aside,.tactics-page .tactics-field,.tactics-page button,.tactics-page .border-b,.tactics-page .tactics-screen-only{display:none!important}.tactics-page>.tactics-print-header{display:grid!important;grid-template-columns:80px minmax(0,1fr) 80px!important;align-items:center!important;visibility:visible!important;border-color:#d4d4d8!important;padding:0 0 14px!important;margin-bottom:16px!important}.tactics-page>.tactics-print-header *{visibility:visible!important}.tactics-page>header:not(.tactics-print-header){display:none!important}.tactics-page main{width:100%!important}.tactics-page main>section:first-child{display:none!important}.tactics-page main>section.tactics-panel{border:none!important;box-shadow:none!important}.tactics-page main>section.tactics-panel:nth-child(2){break-inside:avoid!important;page-break-inside:avoid!important}.tactics-pitch{max-height:78vh!important}.tactics-pitch-wrap{padding:0!important;background:white!important}}
    `}</style>
  </div>;
}
