"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowRight, Circle, Copy, Download, Eraser, FilePlus2, Flag, Move, Pencil, Printer, Redo2, Save, Shield, Trash2, Undo2, Users, ZoomIn, ZoomOut, Route } from "lucide-react";
import { deleteTacticalPlanAction, saveTacticalPlanAction } from "@/app/[locale]/(dashboard)/dashboard/tactics/actions";

type Team = { id: string; name: string; category: string };
type PlayerItem = { id: string; kind: "player" | "opponent"; x: number; y: number; number: string; label: string; color: string };
type MarkItem = { id: string; kind: "arrow" | "line" | "zone" | "path"; x: number; y: number; x2: number; y2: number; color: string; label?: string; points?: { x: number; y: number }[] };
type BallItem = { id: string; kind: "ball"; x: number; y: number; color?: string };
type Item = PlayerItem | MarkItem | BallItem;
type BoardData = { items: Item[]; orientation: "horizontal" | "vertical"; notes: string; coachName?: string };
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
const DEFAULT_ITEMS: Item[] = [
  ...STARTING_FORMATION.map(([x = 14, y = 50], i) => ({ id: `h${i + 1}`, kind: "player" as const, x: x * 10, y: y * 6.4, number: String(i + 1), label: (["GK", "RB", "RCB", "LCB", "LB", "DM", "CM", "CM", "RW", "ST", "LW"][i] ?? ""), color: "#f3f4f6" })),
  ...STARTING_FORMATION.map(([x = 14, y = 50], i) => ({ id: `a${i + 1}`, kind: "opponent" as const, x: (100 - x) * 10, y: y * 6.4, number: String(i + 1), label: "", color: "#ef4444" }))
];
const freshBoard = (): BoardData => ({ items: DEFAULT_ITEMS.map((item) => ({ ...item })), orientation: "horizontal", notes: "" });
const PALETTE = ["#f3f4f6", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a78bfa"];
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function localize(locale: string) {
  const ar = locale === "ar";
  return ar ? {
    title: "الخطط والتكتيك", subtitle: "أنشئ خطط اللعب، حرّك اللاعبين، ارسم التحركات واطبع لوحة التدريب.", newPlan: "خطة جديدة", save: "حفظ الخطة", saving: "جارٍ الحفظ…", print: "طباعة", export: "تصدير SVG", plans: "خططي المحفوظة", selectPlan: "اختر خطة للبدء", titlePlaceholder: "اسم الخطة التكتيكية", description: "وصف الخطة / الهدف التدريبي", formation: "التشكيلة", team: "الفئة / الفريق", noTeam: "بدون فريق محدد", tools: "أدوات السبورة", select: "تحريك / تحديد", player: "إضافة لاعب", opponent: "إضافة خصم", ball: "الكرة", arrow: "سهم حركة", line: "خط تكتيكي", zone: "منطقة", path: "مسار حركة حر", eraser: "ممحاة العنصر", color: "لون الأداة المحددة", clear: "مسح الرسوم", undo: "تراجع", redo: "إعادة", notes: "ملاحظات المدرب", notesPlaceholder: "نقاط التدريب، واجبات اللاعبين، المحفزات التكتيكية…", playerDetails: "تفاصيل العنصر المحدد", number: "الرقم", label: "المركز / الاسم", deleteItem: "حذف العنصر", coach: "اسم المدرب", opponentLabel: "الخصم", created: "تم حفظ الخطة بنجاح", deleted: "تم حذف الخطة", delete: "حذف", copy: "نسخ الخطة", players: "لاعبون", saved: "آخر حفظ", orientation: "اتجاه الملعب", horizontal: "أفقي", vertical: "عمودي", empty: "لا توجد خطط محفوظة بعد", confirmDelete: "حذف هذه الخطة نهائيًا؟", error: "تعذر حفظ الخطة. تحقق من اتصالك وصلاحيتك.", pitch: "ملعب كرة القدم"
  } : {
    title: "Tactics & planning", subtitle: "Create match plans, position players, draw movements and print your coaching board.", newPlan: "New plan", save: "Save plan", saving: "Saving…", print: "Print", export: "Export SVG", plans: "Saved plans", selectPlan: "Choose a plan to start", titlePlaceholder: "Tactical plan name", description: "Plan description / coaching objective", formation: "Formation", team: "Team / category", noTeam: "No team selected", tools: "Board tools", select: "Select / move", player: "Add player", opponent: "Add opponent", ball: "Ball", arrow: "Movement arrow", line: "Tactical line", zone: "Zone", path: "Free movement path", eraser: "Erase item", color: "Selected tool color", clear: "Clear drawings", undo: "Undo", redo: "Redo", notes: "Coach notes", notesPlaceholder: "Coaching points, player duties, tactical triggers…", playerDetails: "Selected item details", number: "Number", label: "Position / name", deleteItem: "Delete item", coach: "Coach name", opponentLabel: "Opponent", created: "Plan saved", deleted: "Plan deleted", delete: "Delete", copy: "Duplicate plan", players: "players", saved: "Last saved", orientation: "Pitch orientation", horizontal: "Horizontal", vertical: "Vertical", empty: "No saved plans yet", confirmDelete: "Delete this plan permanently?", error: "Could not save the plan. Check your connection and permissions.", pitch: "Football pitch"
  };
}

export function TacticalBoard({ locale, canEdit, teams, plans: initialPlans }: { locale: string; canEdit: boolean; teams: Team[]; plans: Plan[] }) {
  const t = localize(locale);
  const [plans, setPlans] = useState(initialPlans);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formation, setFormation] = useState("4-3-3");
  const [teamId, setTeamId] = useState("");
  const [board, setBoard] = useState<BoardData>(() => freshBoard());
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>(PALETTE[1] ?? "#ef4444");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<BoardData[]>([]);
  const [future, setFuture] = useState<BoardData[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [pendingPath, setPendingPath] = useState<{ x: number; y: number }[] | null>(null);
  const dragId = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const activePlan = plans.find((plan) => plan.id === activeId);
  const canEditActive = canEdit && (!activePlan || Boolean(activePlan.teamId) || activePlan.isOwner);
  const count = board.items.filter((item) => item.kind === "player").length;
  const activeItem = board.items.find((item) => item.id === selected);

  function updateBoard(change: (current: BoardData) => BoardData) {
    setHistory((old) => [...old.slice(-39), board]);
    setFuture([]);
    setBoard(change(board));
  }
  function loadPlan(plan: Plan) {
    setActiveId(plan.id); setTitle(plan.title); setDescription(plan.description); setFormation(plan.formation); setTeamId(plan.teamId ?? "");
    const parsed = plan.data as BoardData;
    setBoard(parsed && Array.isArray(parsed.items) ? { ...parsed, coachName: parsed.coachName ?? "" } : freshBoard()); setHistory([]); setFuture([]); setSelected(null); setMessage("");
  }
  function newPlan() {
    setActiveId(null); setTitle(""); setDescription(""); setFormation("4-3-3"); setTeamId(""); setBoard(freshBoard()); setHistory([]); setFuture([]); setSelected(null);
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
    if (!canEditActive) return;
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
      updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind, x: p.x, y: p.y, number: String(b.items.filter((it) => it.kind === kind).length + 1), label: kind === "opponent" ? "" : "CM", color }] }));
      setTool("select"); return;
    }
    if (tool === "ball") { updateBoard((b) => ({ ...b, items: [...b.items, { id: uid(), kind: "ball", x: p.x, y: p.y, color }] })); setTool("select"); return; }
    if (tool === "path") { setPendingPath([p]); event.currentTarget.setPointerCapture(event.pointerId); return; }
    if (tool === "arrow" || tool === "line" || tool === "zone") { setPending(p); event.currentTarget.setPointerCapture(event.pointerId); return; }
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
    setPending(null);
  }
  function moveItem(event: React.PointerEvent<SVGElement>, id: string) {
    if (!canEditActive || tool !== "select") return;
    event.stopPropagation(); setHistory((old) => [...old.slice(-39), board]); setFuture([]); dragId.current = id; setSelected(id); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onItemMove(event: React.PointerEvent<SVGSVGElement>) {
    if (pendingPath && tool === "path") {
      const p = point(event); const last = pendingPath[pendingPath.length - 1]!;
      if (Math.hypot(p.x - last.x, p.y - last.y) > 5) setPendingPath((points) => points ? [...points, p] : null);
      return;
    }
    if (!dragId.current) return;
    const p = point(event); const id = dragId.current;
    setBoard((b) => ({ ...b, items: b.items.map((item) => {
      if (item.id !== id) return item;
      if (item.kind === "player" || item.kind === "opponent" || item.kind === "ball") return { ...item, x: p.x, y: p.y };
      if (item.kind === "arrow" || item.kind === "line" || item.kind === "zone" || item.kind === "path") {
        const dx = p.x - item.x; const dy = p.y - item.y;
        return { ...item, x: p.x, y: p.y, x2: item.x2 + dx, y2: item.y2 + dy, ...(item.points ? { points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) } : {}) };
      }
      return item;
    }) }));
  }
  function finishMove() { dragId.current = null; }
  function applyFormation(value: string) {
    setFormation(value);
    const spots = FORMATIONS[value] ?? STARTING_FORMATION;
    updateBoard((b) => ({ ...b, items: b.items.map((item) => {
      if (item.kind !== "player") return item;
      const index = Math.max(0, Number(item.number) - 1); const spot = spots[index % spots.length] ?? [14, 50];
      return { ...item, x: (spot[0] ?? 14) * 10, y: (spot[1] ?? 50) * 6.4 };
    }) }));
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
  async function duplicatePlan(plan: Plan) {
    if (!canEdit) return;
    const result = await saveTacticalPlanAction({ title: `${plan.title} — copy`, description: plan.description, formation: plan.formation, teamId: plan.teamId, data: JSON.stringify(plan.data) });
    const duplicate: Plan = { ...plan, id: result.id, title: `${plan.title} — copy`, creatorName: "", isOwner: true, updatedAt: result.updatedAt };
    setPlans((items) => [duplicate, ...items]); loadPlan(duplicate);
  }
  async function removePlan(plan: Plan) {
    if (!window.confirm(t.confirmDelete)) return;
    try { await deleteTacticalPlanAction(plan.id); setPlans((items) => items.filter((item) => item.id !== plan.id)); if (activeId === plan.id) newPlan(); setMessage(t.deleted); }
    catch (error) { console.error("Tactical plan delete failed", error); setMessage(t.error); }
  }
  function undo() { if (!history.length) return; const previous = history.at(-1)!; setFuture((items) => [...items, board]); setBoard(previous); setHistory((items) => items.slice(0, -1)); }
  function redo() { if (!future.length) return; const next = future.at(-1)!; setHistory((items) => [...items, board]); setBoard(next); setFuture((items) => items.slice(0, -1)); }
  function exportSvg() {
    if (!svgRef.current) return;
    const copySvg = svgRef.current.cloneNode(true) as SVGSVGElement;
    copySvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(copySvg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${title.trim() || "tactical-plan"}.svg`; a.click(); URL.revokeObjectURL(url);
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
        <button type="button" onClick={exportSvg} className="tactics-action"><Download size={16}/>{t.export}</button>
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

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
      <main className="min-w-0 space-y-3">
        <section className="tactics-panel grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1.2fr)_170px_150px] print:hidden">
          <label className="tactics-field"><span>{t.titlePlaceholder}</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} disabled={!canEditActive} placeholder={t.titlePlaceholder}/></label>
          <label className="tactics-field"><span>{t.description}</span><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} disabled={!canEditActive} placeholder={t.description}/></label>
          <label className="tactics-field"><span>{t.formation}</span><select value={formation} onChange={(e) => applyFormation(e.target.value)} disabled={!canEditActive}>{Object.keys(FORMATIONS).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="tactics-field"><span>{t.team}</span><select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!canEditActive}><option value="">{t.noTeam}</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        </section>

        <section className="tactics-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
            <div className="flex flex-wrap items-center gap-1.5">{tools.map(({ id, icon: Icon, label }) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={`tactics-tool ${tool === id ? "tactics-tool-active" : ""}`}><Icon size={17}/><span className="hidden sm:inline">{label}</span></button>)}<span className="mx-1 h-6 w-px bg-border"/><label className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground" title={t.color}><span>{t.color}</span><input aria-label={t.color} type="color" value={color} onChange={(e) => chooseColor(e.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"/></label><div className="flex gap-1">{PALETTE.map((swatch) => <button key={swatch} type="button" aria-label={swatch} aria-pressed={color === swatch} onClick={() => chooseColor(swatch)} className={`h-6 w-6 rounded-full border-2 ${color === swatch ? "border-white ring-2 ring-club-primary" : "border-white/20"}`} style={{ background: swatch }}/>)}</div></div>
            <div className="flex items-center gap-1.5"><button type="button" title={t.undo} onClick={undo} disabled={!history.length} className="tactics-icon"><Undo2 size={17}/></button><button type="button" title={t.redo} onClick={redo} disabled={!future.length} className="tactics-icon"><Redo2 size={17}/></button><span className="mx-1 h-6 w-px bg-border"/><button type="button" title="Zoom out" onClick={() => setZoom((z) => Math.max(.75, z - .15))} className="tactics-icon"><ZoomOut size={17}/></button><span className="min-w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span><button type="button" title="Zoom in" onClick={() => setZoom((z) => Math.min(1.45, z + .15))} className="tactics-icon"><ZoomIn size={17}/></button><button type="button" title={t.clear} onClick={() => updateBoard((b) => ({ ...b, items: b.items.filter((item) => item.kind === "player" || item.kind === "opponent") }))} className="tactics-icon text-red-400"><Trash2 size={17}/></button></div>
          </div>
          <div className="tactics-pitch-wrap p-2 sm:p-4">
            <svg ref={svgRef} viewBox={viewBox} aria-label={t.pitch} className={`tactics-pitch ${board.orientation === "vertical" ? "tactics-pitch-vertical" : ""} ${tool !== "select" ? "tactics-crosshair" : ""}`} onPointerDown={onBoardPointerDown} onPointerMove={onItemMove} onPointerUp={(event) => { onBoardPointerUp(event); finishMove(); }} onPointerCancel={() => { setPending(null); setPendingPath(null); }}>
              <defs><pattern id="grass" width="100" height="640" patternUnits="userSpaceOnUse"><rect width="50" height="640" fill="#176b43"/><rect x="50" width="50" height="640" fill="#1b7549"/></pattern><marker id="tactics-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth"><path d="M0 0L7 3.5L0 7z" fill="context-stroke"/></marker><pattern id="small-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#ffffff" strokeOpacity=".055" strokeWidth="1"/></pattern></defs>
              <g transform={board.orientation === "vertical" ? "translate(640 0) rotate(90)" : undefined}>
              <rect width="1000" height="640" rx="12" fill="url(#grass)"/><rect width="1000" height="640" rx="12" fill="url(#small-grid)"/>
              <g fill="none" stroke="#ecfdf5" strokeOpacity=".82" strokeWidth="3"><rect x="22" y="22" width="956" height="596" rx="4"/><line x1="500" y1="22" x2="500" y2="618"/><circle cx="500" cy="320" r="82"/><circle cx="500" cy="320" r="3" fill="#ecfdf5"/><rect x="22" y="168" width="145" height="304"/><rect x="22" y="232" width="58" height="176"/><circle cx="112" cy="320" r="3" fill="#ecfdf5"/><path d="M167 255a82 82 0 0 1 0 130"/><rect x="833" y="168" width="145" height="304"/><rect x="920" y="232" width="58" height="176"/><circle cx="888" cy="320" r="3" fill="#ecfdf5"/><path d="M833 255a82 82 0 0 0 0 130"/></g>
              {board.items.map((item) => item.kind === "player" || item.kind === "opponent" ? <g key={item.id} className="tactics-player" transform={`translate(${item.x} ${item.y})`} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onPointerMove={(e) => dragId.current === item.id && onItemMove(e as unknown as ReactPointerEvent<SVGSVGElement>)} onPointerUp={finishMove} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}>
                <circle r="23" fill={item.color} stroke={selected === item.id ? "#fbbf24" : item.kind === "player" ? "#111827" : "#7f1d1d"} strokeWidth={selected === item.id ? 4 : 2.5}/><text y="5" textAnchor="middle" fontSize="15" fontWeight="800" fill={item.color === "#f3f4f6" ? "#111827" : "white"}>{item.number}</text>{item.label && <text y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="white" paintOrder="stroke" stroke="#14532d" strokeWidth="4" strokeLinejoin="round">{item.label}</text>}
              </g> : item.kind === "ball" ? <g key={item.id} transform={`translate(${item.x} ${item.y})`} className="tactics-player" onPointerDown={(e) => handleItemPointerDown(e, item.id)} onPointerMove={(e) => dragId.current === item.id && onItemMove(e as unknown as ReactPointerEvent<SVGSVGElement>)} onPointerUp={finishMove} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><circle r="12" fill={item.color ?? "#fff"} stroke="#111827" strokeWidth="3"/><path d="M0-6 6-2 4 5-4 5-6-2Z" fill="#111827"/></g> : item.kind === "zone" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><rect x={Math.min(item.x, item.x2)} y={Math.min(item.y, item.y2)} width={Math.abs(item.x2 - item.x)} height={Math.abs(item.y2 - item.y)} rx="8" fill={item.color} fillOpacity=".2" stroke={item.color} strokeWidth="3" strokeDasharray="8 6"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : item.kind === "path" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><polyline points={(item.points ?? [{ x: item.x, y: item.y }, { x: item.x2, y: item.y2 }]).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={item.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#tactics-arrow)"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2 - 10} textAnchor="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : item.kind === "arrow" || item.kind === "line" ? <g key={item.id} onPointerDown={(e) => handleItemPointerDown(e, item.id)} onClick={(e) => { e.stopPropagation(); if (tool !== "eraser") setSelected(item.id); }}><line x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} stroke={item.color} strokeWidth={item.kind === "arrow" ? 4 : 3} strokeDasharray={item.kind === "line" ? "12 8" : undefined} markerEnd={item.kind === "arrow" ? "url(#tactics-arrow)" : undefined} strokeLinecap="round"/>{item.label && <text x={(item.x + item.x2) / 2} y={(item.y + item.y2) / 2 - 10} textAnchor="middle" fill="white" fontSize="16" fontWeight="700" paintOrder="stroke" stroke="#111827" strokeWidth="4">{item.label}</text>}</g> : null)}
              {pending && <circle cx={pending.x} cy={pending.y} r="7" fill={color}/>}
              {pendingPath && <polyline points={pendingPath.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>}
              </g>
            </svg>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Users size={14}/>{count} {t.players}</span><div className="flex items-center gap-2"><span>{t.orientation}</span><button type="button" className="tactics-small" onClick={() => updateBoard((b) => ({ ...b, orientation: "horizontal" }))}><ArrowRight size={14}/>{t.horizontal}</button><button type="button" className="tactics-small" onClick={() => updateBoard((b) => ({ ...b, orientation: "vertical" }))}><ArrowDown size={14}/>{t.vertical}</button></div></div>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="tactics-panel p-4"><label className="tactics-field mb-4"><span>{t.coach}</span><input value={board.coachName ?? ""} maxLength={100} onChange={(e) => updateBoard((b) => ({ ...b, coachName: e.target.value }))} disabled={!canEditActive} placeholder={t.coach}/></label><label className="tactics-field"><span>{t.notes}</span><textarea rows={4} value={board.notes} onChange={(e) => updateBoard((b) => ({ ...b, notes: e.target.value }))} disabled={!canEditActive} placeholder={t.notesPlaceholder}/></label></section>
          <section className="tactics-panel p-4"><h2 className="mb-3 text-sm font-bold">{t.playerDetails}</h2>{activeItem && <div className="grid gap-3 sm:grid-cols-2">{(activeItem.kind === "player" || activeItem.kind === "opponent") && <><label className="tactics-field"><span>{t.number}</span><input value={activeItem.number} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && (it.kind === "player" || it.kind === "opponent") ? { ...it, number: e.target.value.slice(0, 3) } : it) }))}/></label><label className="tactics-field"><span>{t.label}</span><input value={activeItem.label} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && (it.kind === "player" || it.kind === "opponent") ? { ...it, label: e.target.value.slice(0, 32) } : it) }))}/></label></>}{(activeItem.kind === "arrow" || activeItem.kind === "line" || activeItem.kind === "zone" || activeItem.kind === "path") && <label className="tactics-field sm:col-span-2"><span>{t.label}</span><input value={activeItem.label ?? ""} maxLength={100} disabled={!canEditActive} onChange={(e) => updateBoard((b) => ({ ...b, items: b.items.map((it) => it.id === activeItem.id && it.kind !== "player" && it.kind !== "opponent" && it.kind !== "ball" ? { ...it, label: e.target.value } : it) }))}/></label>}{activeItem.color && <div className="flex flex-wrap items-center gap-1 sm:col-span-2"><span className="me-1 text-xs text-muted-foreground">{t.color}</span>{PALETTE.map((swatch) => <button key={swatch} type="button" disabled={!canEditActive} aria-label={swatch} onClick={() => setItemColor(activeItem.id, swatch)} className="h-6 w-6 rounded-full border border-white/30" style={{ background: swatch }}/>)}</div>}<button type="button" disabled={!canEditActive} className="tactics-small text-red-400 sm:col-span-2" onClick={() => { updateBoard((b) => ({ ...b, items: b.items.filter((it) => it.id !== selected) })); setSelected(null); }}><Trash2 size={14}/>{t.deleteItem}</button></div>}{!activeItem && <p className="py-4 text-sm text-muted-foreground">{t.selectPlan}</p>}</section>
        </div>
      </main>

      <aside className="space-y-3 xl:sticky xl:top-4">
        {canEdit && <section className="tactics-panel space-y-3 p-4"><button type="button" onClick={savePlan} disabled={busy || !title.trim() || !canEditActive} className="tactics-action tactics-primary w-full justify-center"><Save size={16}/>{busy ? t.saving : t.save}</button>{message && <p role="status" className="text-center text-sm text-emerald-400">{message}</p>}</section>}
        <section className="tactics-panel overflow-hidden"><div className="border-b border-border p-4"><h2 className="font-bold">{t.plans}</h2></div><div className="max-h-[560px] overflow-auto p-2">{plans.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{t.empty}</p> : plans.map((plan) => { const mayManagePlan = canEdit && (Boolean(plan.teamId) || plan.isOwner); return <div key={plan.id} className={`mb-2 rounded-lg border p-3 ${activeId === plan.id ? "border-club-primary bg-club-primary/5" : "border-border"}`}><button type="button" onClick={() => loadPlan(plan)} className="w-full text-start"><span className="block truncate font-semibold">{plan.title}</span><span className="mt-1 block text-xs text-muted-foreground">{plan.teamName || plan.formation} · {new Date(plan.updatedAt).toLocaleDateString(locale === "ar" ? "ar-DZ" : "fr-DZ", { timeZone: "Africa/Algiers" })}</span></button>{mayManagePlan && <div className="mt-2 flex justify-end gap-1"><button type="button" className="tactics-icon" title={t.copy} onClick={() => void duplicatePlan(plan)}><Copy size={15}/></button><button type="button" className="tactics-icon text-red-400" title={t.delete} onClick={() => void removePlan(plan)}><Trash2 size={15}/></button></div>}</div>})}</div></section>
        <section className="tactics-panel p-4"><h2 className="mb-3 text-sm font-bold">{t.tools}</h2><div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>↗ {t.arrow}</span><span>⇢ {t.line}</span><span>▱ {t.zone}</span><span>⚽ {t.ball}</span><span>4-3-3</span><span>4-2-3-1</span></div></section>
      </aside>
    </div>
    <style jsx global>{`
      .tactics-action{display:inline-flex;align-items:center;gap:.5rem;border:1px solid hsl(var(--border));border-radius:.55rem;padding:.55rem .8rem;font-size:.82rem;font-weight:650;transition:background .15s,border .15s}.tactics-action:hover{background:hsl(var(--muted))}.tactics-action:disabled{opacity:.5;cursor:not-allowed}.tactics-primary{background:#cf1235;color:#fff;border-color:#cf1235}.tactics-primary:hover{background:#b80f2e}.tactics-panel{border:1px solid hsl(var(--border));border-radius:.85rem;background:hsl(var(--card))}.tactics-field{display:flex;min-width:0;flex-direction:column;gap:.4rem}.tactics-field>span{font-size:.75rem;font-weight:650;color:hsl(var(--muted-foreground))}.tactics-field input,.tactics-field select,.tactics-field textarea{width:100%;border:1px solid #383a40;border-radius:.55rem;background:#0d0e10;padding:.62rem .75rem;font-size:.85rem;outline:none}.tactics-field input:focus,.tactics-field select:focus,.tactics-field textarea:focus{border-color:#cf1235;box-shadow:0 0 0 1px #cf1235}.tactics-field input:disabled,.tactics-field textarea:disabled,.tactics-field select:disabled{opacity:.7}.tactics-tool,.tactics-icon,.tactics-small{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:1px solid transparent;border-radius:.5rem;padding:.48rem;color:hsl(var(--muted-foreground));font-size:.73rem;transition:all .15s}.tactics-tool:hover,.tactics-icon:hover,.tactics-small:hover{background:hsl(var(--muted));color:hsl(var(--foreground))}.tactics-tool-active{border-color:#cf1235;background:#cf12351a;color:#ef4764}.tactics-icon:disabled{opacity:.3}.tactics-small{border-color:hsl(var(--border));padding:.35rem .5rem}.tactics-pitch-wrap{background:#101713}.tactics-pitch{display:block;width:100%;max-height:min(68vh,680px);aspect-ratio:1000/640;border-radius:.6rem;touch-action:none;user-select:none}.tactics-crosshair{cursor:crosshair}.tactics-player{cursor:grab;touch-action:none}.tactics-player:active{cursor:grabbing}.tactics-player text{pointer-events:none;user-select:none}.tactics-pitch-vertical{aspect-ratio:640/1000;width:auto;max-width:100%;max-height:min(78vh,850px);margin-inline:auto}
      @media print{body *{visibility:hidden!important}.tactics-page,.tactics-page *{visibility:visible!important}.tactics-page{position:absolute!important;inset:0!important;width:100%!important;max-width:none!important;padding:0!important;background:white!important;color:#111!important}.tactics-page aside,.tactics-page .tactics-field,.tactics-page button,.tactics-page .border-b{display:none!important}.tactics-page>.tactics-print-header{display:grid!important;grid-template-columns:80px minmax(0,1fr) 80px!important;align-items:center!important;visibility:visible!important;border-color:#d4d4d8!important;padding:0 0 14px!important;margin-bottom:16px!important}.tactics-page>.tactics-print-header *{visibility:visible!important}.tactics-page>header:not(.tactics-print-header){display:none!important}.tactics-page main{width:100%!important}.tactics-page main>section:first-child{display:none!important}.tactics-page main>section.tactics-panel{border:none!important;box-shadow:none!important}.tactics-page main>section.tactics-panel:nth-child(2){break-inside:avoid!important;page-break-inside:avoid!important}.tactics-pitch{max-height:78vh!important}.tactics-pitch-wrap{padding:0!important;background:white!important}}
    `}</style>
  </div>;
}
