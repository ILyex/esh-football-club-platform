export type ShotBodyPart = "RIGHT_FOOT" | "LEFT_FOOT" | "HEAD" | "OTHER" | "UNKNOWN";
export type ShotSituation = "OPEN_PLAY" | "PENALTY" | "FREE_KICK" | "CORNER" | "OTHER";

/**
 * ESH xG v2 is a transparent geometry-and-context estimate for internal
 * coaching. It is not a licensed Opta/StatsBomb model. xG is only meaningful
 * when the shot location and attacking direction are recorded consistently.
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

  // A compact logistic model keeps the estimate monotonic: closer shots and
  // wider visible goal angles receive more xG. Coefficients are deliberately
  // conservative because the club does not yet have enough labelled shots to
  // train and calibrate its own model.
  let logit = -0.65 - 0.105 * distance + 0.025 * angle;
  if (input.bodyPart === "HEAD") logit -= 0.55;
  if (input.bodyPart === "OTHER") logit -= 0.3;
  if (situation === "FREE_KICK") logit -= 0.35;
  if (situation === "CORNER") logit -= 0.4;
  if (situation === "OTHER") logit -= 0.15;

  const probability = 1 / (1 + Math.exp(-logit));
  return Math.round(Math.min(0.95, Math.max(0.01, probability)) * 1000) / 1000;
}
