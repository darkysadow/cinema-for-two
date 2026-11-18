import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "@/components/account-forms";
import { LoadingState } from "@/components/page-state";
import { safeReturnPath } from "@/lib/auth-return";

export const metadata: Metadata = { title: "Sign in" };

type LoginProps = { searchParams: Promise<{ next?: string | string[] }> };

export default function Page({ searchParams }: LoginProps) {
  return (
    <div className="account-panel">
      <div className="page-intro">
        <h1>Sign in</h1>
        <p>Use your account to save movies to your private Watchlist.</p>
      </div>
      <Suspense fallback={<LoadingState label="Loading sign-in…" />}>
        <Login searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Login({ searchParams }: LoginProps) {
  const { next } = await searchParams;
  return <SignInForm next={safeReturnPath(next)} />;
}
