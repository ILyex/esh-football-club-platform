// cPanel/Passenger startup entry point.
// `next build` followed by scripts/prepare-cpanel.mjs creates the compact
// production server under .next/standalone. Keep this as a small CommonJS
// wrapper because cPanel's Node application manager expects a startup file.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "production";
}

try {
  require("./.next/standalone/server.js");
} catch (error) {
  console.error(
    "The cPanel production bundle is missing. Run `npm run build:cpanel` before starting the app."
  );
  console.error(error);
  process.exitCode = 1;
}
