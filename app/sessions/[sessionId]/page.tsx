import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EmptyState, ErrorState, LoadingState } from "@/components/page-state";
import { CinemaSession } from "@/components/cinema-session";
import { readAuth } from "@/lib/auth";
import { signInPath } from "@/lib/auth-return";
import { parseSessionId, sessionPath } from "@/lib/cinema";
import { readCinemaSession } from "@/lib/cinema-server";

export const metadata: Metadata = { title: "Voting session" };

type SessionParams = Promise<{ sessionId: string }>;

export default function Page({ params }: { params: SessionParams }) {
  return (
    <>
      <Link className="back-link" href="/watchlist" prefetch={false}>← Watchlist</Link>
      <div className="page-intro">
        <h1>Cinema for Two</h1>
      </div>
      <Suspense fallback={<LoadingState label="Loading session…" />}>
        <SessionContent params={params} />
      </Suspense>
    </>
  );
}

async function SessionContent({ params }: { params: SessionParams }) {
  await connection();
  const id = parseSessionId((await params).sessionId);
  if (!id) return <UnavailableSession />;

  const member = await readAuth();
  if (member.kind === "signed-out") redirect(signInPath(sessionPath(id)));
  if (member.kind === "unavailable") {
    return <ErrorState title="Couldn’t verify your sign-in" description="Try loading the session again." />;
  }
  const read = await readCinemaSession(member, id);
  if (read.kind === "unavailable") return <UnavailableSession />;
  return <CinemaSession key={`${id}:${member.ownerId}`} id={id} session={read.kind === "ok" ? read.session : null} />;
}

function UnavailableSession() {
  return <EmptyState title="This session is unavailable" description="Check the link or sign in with the account that was invited." />;
}
