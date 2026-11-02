const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const versions = await prisma.documentTemplateVersion.findMany({
    include: { template: true }
  });
  console.log(`Found ${versions.length} versions:`);
  for (const v of versions) {
    console.log(`- ID: ${v.id}, Template: ${v.template.name} (${v.template.type}), Status: ${v.status}, storageKey: ${v.storageKey}, filePath: ${v.filePath}`);
  }
}

main()
  .catch((error) => {
    // A diagnostic script must exit non-zero: swallowing the error made a failed
    // inspection look like a successful run to any caller or CI step.
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
