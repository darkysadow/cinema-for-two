// Next's development-resource check is separate from Server Action CSRF checks.
export function devTunnelOrigins(mode: string | undefined, hostname: string | undefined): string[] {
  if (mode !== "development" || !hostname) return [];
  if (hostname.length > 253 || !hostname.includes(".") ||
    !hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    throw new Error("DEV_TUNNEL_HOST must be one exact hostname, without scheme, port, path, or wildcards.");
  }
  return [hostname.toLowerCase()];
}
