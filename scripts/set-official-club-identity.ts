import { db } from "../src/lib/db";

async function main() {
  const result = await db.clubSettings.updateMany({
    where: { id: "singleton" },
    data: {
      name: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
      shortName: "ESH",
      description: "الجمعية الرياضية أمل سيدي حسني لكرة القدم — تيارت، بلدية سيدي حسني.",
      stadium: "الملعب البلدي طاهري حسني – سيدي حسني",
      address: "بلدية سيدي حسني، ولاية تيارت، الجزائر"
    }
  });
  if (result.count !== 1) throw new Error("Expected exactly one singleton ClubSettings row.");
  console.log("Official club name and location saved.");
}

main().catch((error) => {
  console.error("Could not update official club identity:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});
