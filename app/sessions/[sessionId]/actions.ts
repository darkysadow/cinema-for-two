"use server";

import { refresh } from "next/cache";
import { readAuth } from "@/lib/auth";
import { parseCinemaChoices, parseSessionId } from "@/lib/cinema";

export type SubmitCinemaState = { error: string | null };

export async function submitCinemaVote(
  sessionId: string,
  _previous: SubmitCinemaState,
  form: FormData,
): Promise<SubmitCinemaState> {
  const id = parseSessionId(sessionId);
  if (!id) return { error: "This session is unavailable." };

  const selected = parseCinemaChoices(form.getAll("choiceId"), "vote");
  if (form.get("confirmVote") !== "yes" || !selected) return { error: "Confirm a valid vote from this shortlist." };

  const member = await readAuth();
  if (member.kind === "signed-out") return { error: "Sign in again to vote." };
  if (member.kind !== "signed-in") return { error: "Couldn’t verify your sign-in. Try again." };

  try {
    const { error } = await member.supabase.rpc("submit_cinema_vote", { target_session: id, selected_ids: selected });
    if (error?.code === "42501") return { error: "This session is unavailable." };
    if (error?.code === "22023") {
      if (error.message === "vote_already_submitted") return { error: "Vote already submitted. Refresh to see the current status." };
      if (error.message === "invalid_ballot") return { error: "Select movies from this session’s shortlist." };
    }
    if (error) return { error: "Couldn’t submit your vote. Try again." };
  } catch {
    return { error: "Couldn’t submit your vote. Try again." };
  }
  refresh();
  return { error: null };
}
