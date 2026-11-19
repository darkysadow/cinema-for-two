import { unstable_rethrow } from "next/navigation";
import type { CreateCinemaState } from "../app/watchlist/cinema-actions";

type CreateAction = (previous: CreateCinemaState, form: FormData) => Promise<CreateCinemaState>;

// RPC errors return ordinary action state. Network/framework failures reject
// before that state reaches the form, so handle those on the client as well.
export async function createCinemaWithFeedback(
  action: CreateAction,
  previous: CreateCinemaState,
  form: FormData,
): Promise<CreateCinemaState> {
  try {
    return await action(previous, form);
  } catch (error) {
    // A successful Server Action redirect is control flow, not a failed create.
    unstable_rethrow(error);
    return { error: "Couldn’t confirm session creation. Check your connection and reload before trying again." };
  }
}
