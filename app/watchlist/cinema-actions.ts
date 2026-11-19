"use server";

import { redirect } from "next/navigation";
import { readAuth } from "@/lib/auth";
import { parseCinemaChoices, parseSessionId, sessionPath } from "@/lib/cinema";

export type CreateCinemaState = { error: string | null };

export async function createCinemaSession(
  _previous: CreateCinemaState,
  form: FormData,
): Promise<CreateCinemaState> {
  const candidateIds = parseCinemaChoices(form.getAll("candidateId"), "shortlist");
  if (!candidateIds) return { error: "Choose 2 to 5 different movies from your Watchlist." };

  const username = form.get("username");
  if (typeof username !== "string" || !username.trim()) return { error: "Enter your partner’s username." };

  const host = await readAuth();
  if (host.kind === "signed-out") return { error: "Sign in again to create a session." };
  if (host.kind !== "signed-in") return { error: "Couldn’t verify your sign-in. Try again." };

  let sessionId: string | null = null;
  try {
    const { data, error } = await host.supabase.rpc("create_cinema_session", {
      invitee_username: username.trim(),
      candidate_ids: candidateIds,
    });
    if (error?.code === "22023") {
      if (error.message === "unknown_username") return { error: "No account matches that username." };
      if (error.message === "self_invite") return { error: "Enter a username other than your own." };
      if (error.message === "shortlist_not_saved") return { error: "A selected movie is no longer saved. Refresh your Watchlist and choose again." };
      if (error.message === "invalid_shortlist") return { error: "Choose 2 to 5 different movies from your Watchlist." };
    }
    if (!error) sessionId = parseSessionId(data);
  } catch {
    // Keep infrastructure details out of the response.
  }
  if (!sessionId) return { error: "Couldn’t create the session. Try again." };
  redirect(sessionPath(sessionId));
}
