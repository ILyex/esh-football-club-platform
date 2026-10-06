import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Keep the default cache implementation for the first compatibility pass.
// Cloudflare-specific cache bindings can be added after the Worker preview is
// verified and the production account is configured.
const cloudflareConfig = defineCloudflareConfig();

export default {
  ...cloudflareConfig
};
