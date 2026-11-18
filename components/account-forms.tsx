"use client";

import { useActionState, useState } from "react";
import { LogOut } from "lucide-react";
import { signIn, signOut } from "@/app/auth/login/actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, { error: null });
  const [email, setEmail] = useState("");
  return (
    <form className="account-form" action={action} aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      <label>
        Email
        <input className="input" type="email" name="email" autoComplete="username"
          required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function SignOutForm() {
  const [state, action, pending] = useActionState(signOut, { error: null });
  return (
    <form className="compact-form" action={action} aria-busy={pending}>
      <button className="button button-quiet" type="submit" disabled={pending}>
        <LogOut size={16} aria-hidden="true" />
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  );
}
