// Kept as a compatibility entry point for previous deployment instructions.
// The canonical script previews by default and only writes when --apply is set.
process.argv.push("--apply");

import("./sync-rbac-role-templates").catch((error) => {
  console.error("Role synchronization failed:", error);
  process.exitCode = 1;
});
