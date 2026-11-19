import "server-only";
import type { readAuth } from "./auth";
import { toSessionView, type SessionView } from "./cinema";

type Member = Extract<Awaited<ReturnType<typeof readAuth>>, { kind: "signed-in" }>;

export async function readOwnCinemaUsername(member: Member): Promise<string | null> {
  try {
    const { data, error } = await member.supabase
      .from("cinema_profiles")
      .select("username")
      .eq("user_id", member.ownerId)
      .maybeSingle();
    return !error && typeof data?.username === "string" ? data.username : null;
  } catch {
    return null;
  }
}

export type ReadCinemaSession =
  | { kind: "error" | "unavailable" }
  | { kind: "ok"; session: SessionView };

export async function readCinemaSession(member: Member, id: string): Promise<ReadCinemaSession> {
  try {
    const { data, error } = await member.supabase.rpc("read_cinema_session", { target_session: id });
    if (error) return { kind: "error" };
    if (data === null) return { kind: "unavailable" };
    const session = toSessionView(data);
    return session ? { kind: "ok", session } : { kind: "error" };
  } catch {
    return { kind: "error" };
  }
}
