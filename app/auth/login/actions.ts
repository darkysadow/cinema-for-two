"use server";

import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth-return";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

export type SignInState = { error: string | null };

export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { error: "Enter your email and password." };
  }
  if (!hasEnvVars) return { error: "Sign-in is temporarily unavailable. Try again later." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error?.code === "invalid_credentials" || error?.code === "email_not_confirmed") {
      return { error: "Couldn’t sign in with that email and password." };
    }
    if (error) return { error: "Sign-in is temporarily unavailable. Try again." };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Try again." };
  }

  redirect(safeReturnPath(form.get("next")));
}

export async function signOut(): Promise<SignInState> {
  if (!hasEnvVars) return { error: "Couldn’t sign out. Try again." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Couldn’t sign out. Try again." };
  } catch {
    return { error: "Couldn’t sign out. Try again." };
  }
  redirect("/");
}
