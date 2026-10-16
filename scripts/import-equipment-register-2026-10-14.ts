import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db } from "../src/lib/db";

type Item = {
  name: string;
  category: "BALLS" | "KITS" | "CONES_MARKERS" | "GOALKEEPING" | "MEDICAL" | "TRAINING_AIDS" | "ELECTRONICS" | "OTHER";
  quantity: number;
  condition: "NEW" | "GOOD" | "FAIR" | "OLD" | "POOR" | "DAMAGED" | "UNSPECIFIED";
  notes?: string;
};

const sourceItems = ([
  { name: "كرات", category: "BALLS", quantity: 49, condition: "FAIR", notes: "ملاحظات السجل: أقل من 20 و19 و16 و18 و13 و11 سنة" },
  { name: "كرات توازن", category: "BALLS", quantity: 6, condition: "NEW" },
  { name: "كرة طبية", category: "BALLS", quantity: 2, condition: "NEW", notes: "حجم 5 كغ" },
  { name: "كرة سويسرية", category: "BALLS", quantity: 6, condition: "NEW" },
  { name: "سلم تدريبي", category: "TRAINING_AIDS", quantity: 6, condition: "NEW" },
  { name: "مضخة هوائية", category: "OTHER", quantity: 2, condition: "NEW", notes: "1 كبيرة، 1 صغيرة" },
  { name: "شبك مرمى", category: "GOALKEEPING", quantity: 2, condition: "FAIR" },
  { name: "أقماع مثقوبة", category: "CONES_MARKERS", quantity: 31, condition: "UNSPECIFIED" },
  { name: "أقماع برتقالية", category: "CONES_MARKERS", quantity: 15, condition: "UNSPECIFIED" },
  { name: "أقماع كبيرة حمراء", category: "CONES_MARKERS", quantity: 4, condition: "UNSPECIFIED" },
  { name: "أقماع حمراء", category: "CONES_MARKERS", quantity: 5, condition: "UNSPECIFIED" },
  { name: "أقماع خضراء متوسطة", category: "CONES_MARKERS", quantity: 10, condition: "UNSPECIFIED" },
  { name: "أقماع حمراء متوسطة", category: "CONES_MARKERS", quantity: 4, condition: "UNSPECIFIED" },
  { name: "أقماع صفراء متوسطة", category: "CONES_MARKERS", quantity: 4, condition: "UNSPECIFIED" },
  { name: "أعمدة زرقاء", category: "CONES_MARKERS", quantity: 6, condition: "NEW" },
  { name: "أعمدة صفراء", category: "CONES_MARKERS", quantity: 5, condition: "NEW" },
  { name: "حواجز بيضاء", category: "CONES_MARKERS", quantity: 20, condition: "OLD" },
  { name: "حواجز حمراء", category: "CONES_MARKERS", quantity: 16, condition: "NEW" },
  { name: "صحون (السلات)", category: "CONES_MARKERS", quantity: 144, condition: "NEW" },
  { name: "كرة سلة", category: "BALLS", quantity: 4, condition: "OLD" },
  { name: "ساك بالون", category: "TRAINING_AIDS", quantity: 5, condition: "NEW", notes: "حجم متوسط" },
  { name: "ساك بالون", category: "TRAINING_AIDS", quantity: 1, condition: "NEW", notes: "حجم كبير" },
  { name: "حلقات (سارسو)", category: "CONES_MARKERS", quantity: 40, condition: "NEW" },
  { name: "حلقات (سارسو)", category: "CONES_MARKERS", quantity: 30, condition: "NEW" },
  { name: "حبل قفز", category: "TRAINING_AIDS", quantity: 3, condition: "NEW" },
  { name: "كرة تنس", category: "BALLS", quantity: 2, condition: "NEW" },
  { name: "لاستيك أصفر", category: "TRAINING_AIDS", quantity: 25, condition: "NEW" },
  { name: "لاستيك (كبير)", category: "TRAINING_AIDS", quantity: 4, condition: "NEW" },
  { name: "سترة مقاومة", category: "TRAINING_AIDS", quantity: 2, condition: "NEW" },
  { name: "باراشيات", category: "TRAINING_AIDS", quantity: 2, condition: "NEW" },
  { name: "أقفال حديد", category: "OTHER", quantity: 2, condition: "OLD" },
  { name: "عمود أثقال", category: "TRAINING_AIDS", quantity: 1, condition: "OLD" },
  { name: "خزانة حديدية كبيرة", category: "OTHER", quantity: 2, condition: "OLD" },
  { name: "خزانة حديدية صغيرة", category: "OTHER", quantity: 2, condition: "NEW" },
  { name: "كرات ساراسون", category: "BALLS", quantity: 3, condition: "FAIR", notes: "منها كرة واحدة جديدة" },
  { name: "فروتوار", category: "TRAINING_AIDS", quantity: 6, condition: "NEW", notes: "منها قطعة واحدة قديمة" },
  { name: "جفافة", category: "TRAINING_AIDS", quantity: 4, condition: "NEW", notes: "منها قطعة واحدة قديمة" },
  { name: "مونش فروتوار", category: "TRAINING_AIDS", quantity: 3, condition: "NEW" },
  { name: "دلو", category: "OTHER", quantity: 3, condition: "NEW" },
  { name: "سانتر", category: "OTHER", quantity: 100, condition: "NEW" },
  { name: "كيس ثلجي", category: "MEDICAL", quantity: 1, condition: "UNSPECIFIED" },
  { name: "علبة إسعافات أولية", category: "MEDICAL", quantity: 4, condition: "OLD", notes: "منها علبة واحدة جديدة" },
  { name: "بدلة DJS", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 20 سنة", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 20 سنة", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 18 سنة", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 18 سنة", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 16 سنة", category: "KITS", quantity: 23, condition: "UNSPECIFIED" },
  { name: "بدلة أقل من 13 سنة", category: "KITS", quantity: 0, condition: "UNSPECIFIED" },
  { name: "سيريات", category: "OTHER", quantity: 0, condition: "UNSPECIFIED", notes: "الكمية غير مدونة؛ الاسم منقول كما يظهر في السجل ويحتاج مراجعة" }
] satisfies Item[]).map((item, index) => ({
  ...item,
  notes: [
    `رقم السجل الورقي: ${String(index + 1).padStart(3, "0")}`,
    item.quantity === 0 ? "الكمية غير مدونة في الوثيقة؛ لم تُقدّر." : null,
    item.condition === "UNSPECIFIED" ? "الحالة غير مدونة في الوثيقة." : null,
    item.notes
  ].filter(Boolean).join(" — ")
}));

async function main() {
  if (sourceItems.length !== 50) throw new Error(`Expected 50 register rows, found ${sourceItems.length}.`);

  const existing = await db.inventoryItem.findMany({
    select: { id: true, name: true, quantity: true, category: true, condition: true, location: true, notes: true, createdById: true }
  });
  const creatorId = existing[0]?.createdById ?? (await db.user.findFirst({ where: { isActive: true }, select: { id: true } }))?.id;
  if (!creatorId) throw new Error("Cannot import inventory without an active user for audit attribution.");

  const backupPath = join(tmpdir(), "esh-inventory-before-register-import-2026-10-14.json");
  await writeFile(backupPath, JSON.stringify(existing, null, 2), "utf8");

  await db.$transaction(async (tx) => {
    await tx.inventoryItem.deleteMany({});
    await tx.inventoryItem.createMany({
      data: sourceItems.map((item) => ({ ...item, location: "المخزن", teamId: null, createdById: creatorId }))
    });
    await tx.auditLog.create({
      data: {
        userId: creatorId,
        action: "inventory.reset.import",
        entityType: "InventoryItem",
        changes: {
          source: "user-provided warehouse register photos dated 2026-10-14",
          previousCount: existing.length,
          importedCount: sourceItems.length,
          rowsWithUnlistedQuantity: sourceItems.filter((item) => item.quantity === 0).length,
          backupPath
        }
      }
    });
  });

  const [count, aggregate, zeroQuantityCount] = await Promise.all([
    db.inventoryItem.count(),
    db.inventoryItem.aggregate({ _sum: { quantity: true } }),
    db.inventoryItem.count({ where: { quantity: 0 } })
  ]);
  console.log(JSON.stringify({ count, totalQuantity: aggregate._sum.quantity, zeroQuantityCount, backupPath }, null, 2));
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "Inventory import failed.");
  try { await db.$disconnect(); } catch { /* no-op */ }
  process.exitCode = 1;
});
