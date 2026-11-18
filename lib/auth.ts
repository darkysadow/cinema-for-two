import "server-only";
import { createClient } from "./supabase/server";
import { hasEnvVars } from "./utils";

export async function readAuth() {
  if (!hasEnvVars) return { kind: "unavailable" } as const;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (data?.claims.sub) {
      return { kind: "signed-in", ownerId: data.claims.sub, supabase } as const;
    }
    if (!error || error.name === "AuthSessionMissingError" || error.name === "AuthInvalidJwtError" ||
      (error.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 429)) {
      return { kind: "signed-out" } as const;
    }
  } catch {
    return { kind: "unavailable" } as const;
  }
  return { kind: "unavailable" } as const;
}
