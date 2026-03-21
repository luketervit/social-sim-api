export function sanitizeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next) {
    return fallback;
  }

  if (!next.startsWith("/")) {
    return fallback;
  }

  if (next.startsWith("//")) {
    return fallback;
  }

  return next;
}
