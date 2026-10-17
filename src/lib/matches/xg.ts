export type ShotBodyPart = "RIGHT_FOOT" | "LEFT_FOOT" | "HEAD" | "OTHER" | "UNKNOWN";
export type ShotSituation = "OPEN_PLAY" | "PENALTY" | "FREE_KICK" | "CORNER" | "OTHER";

/**
 * ESH xG v1 is a transparent location-only estimate for internal coaching.
 * It is not a licensed Opta/StatsBomb model and should be recalibrated against
 * the club's own shot history before being used for external comparisons.
 */
export function estimateShotXg(input: {
  x?: number | null;
  y?: number | null;
  bodyPart?: ShotBodyPart | string | null;
  situation?: ShotSituation | string | null;
}): number | null {
  const situation = input.situation ?? "OPEN_PLAY";
  if (situation === "PENALTY") return 0.76;
  if (typeof input.x !== "number" || typeof input.y !== "number") return null;

  const x = Math.min(100, Math.max(0, input.x)) * 1.05;
  const y = Math.min(100, Math.max(0, input.y)) * 0.68;
  const goalX = 105;
  const goalY = 34;
  const dx = Math.max(0.5, goalX - x);
  const leftPostY = 34 - 3.66;
  const rightPostY = 34 + 3.66;
  const leftDy = leftPostY - y;
  const rightDy = rightPostY - y;
  const distance = Math.hypot(dx, y - goalY);
  const angle = Math.atan2(Math.abs(dx * (leftDy - rightDy)), dx * dx + leftDy * rightDy) * (180 / Math.PI);

  let logit = 0.2 - 0.16 * distance + 0.02 * angle;
  if (input.bodyPart === "HEAD") logit -= 0.65;
  if (input.bodyPart === "OTHER") logit -= 0.25;
  if (situation === "FREE_KICK" || situation === "CORNER") logit -= 0.2;

  const probability = 1 / (1 + Math.exp(-logit));
  return Math.round(Math.min(0.95, Math.max(0.01, probability)) * 1000) / 1000;
}
