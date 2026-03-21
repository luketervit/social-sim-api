export const CREDITS_PER_MESSAGE = 1;
export const STANDARD_AUDIENCE_SIZE = 100;
export const SIMULATION_ROUNDS = 10;
export const MAX_MESSAGES_PER_SIMULATION = STANDARD_AUDIENCE_SIZE * SIMULATION_ROUNDS;
export const PLAYGROUND_PERSONA_CAP = STANDARD_AUDIENCE_SIZE;
export const PLAYGROUND_RUNS_INCLUDED = 5;
export const PLAYGROUND_KEY_PREFIX = "ssim_pg_";
export const DEV_UNLIMITED_CREDITS = 999_999_999;
export const DEV_UNLIMITED_CREDITS_ENABLED = process.env.NODE_ENV !== "production";

export function displayCredits(credits: number) {
  return DEV_UNLIMITED_CREDITS_ENABLED ? DEV_UNLIMITED_CREDITS : credits;
}
