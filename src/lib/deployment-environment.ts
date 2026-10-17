/** Resolve the deployment context without treating Vercel Preview as production. */
export function getDeploymentEnvironment(): "production" | "preview" | "development" {
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.VERCEL_ENV === "production") return "production";
  return process.env.NODE_ENV === "production" ? "production" : "development";
}
